'use strict';
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { getSettings, saveSettings } = db;
const auth = require('../auth');
const c = require('../content');
const { FONTES } = require('../fontes');

// Aceita só imagens reais, conferindo os primeiros bytes do arquivo (não a extensão).
function imageType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.subarray(0, 6).toString() === 'GIF89a' || buf.subarray(0, 6).toString() === 'GIF87a') return 'gif';
  return null;
}

module.exports = function adminRouter({ secure }) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1, fieldSize: 20 * 1024 * 1024 } });
  const form = express.urlencoded({ extended: false, limit: '20mb' });

  const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

  async function saveImage(file) {
    if (!file || !file.size) return null;
    const ext = imageType(file.buffer);
    if (!ext) { const e = new Error('Formato de imagem não aceito'); e.status = 400; e.userMessage = 'Envie uma imagem JPG, PNG, WEBP ou GIF.'; throw e; }
    const id = crypto.randomUUID();
    await db.run('INSERT INTO imagens (id, mime, dados, criado_em) VALUES (?, ?, ?, ?)', [id, MIME[ext], file.buffer, new Date().toISOString()]);
    return `/img/${id}.${ext}`;
  }

  async function removeImage(url) {
    const m = /^\/img\/([a-f0-9-]+)\./.exec(url || '');
    if (m) await db.run('DELETE FROM imagens WHERE id = ?', [m[1]]);
  }

  // Nada da redação vai para cache nem para buscadores.
  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    res.locals.base = req.baseUrl;
    next();
  });

  // Requisições que alteram dados precisam vir do próprio site.
  router.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.get('origin');
      if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).render('erro', { titulo: 'Acesso negado', mensagem: 'Origem não autorizada.' });
    }
    next();
  });

  // ---------- Login ----------
  const LOGIN_COOKIE = secure ? '__Host-login' : 'login';

  async function renderLogin(res, erro, status = 200) {
    const token = crypto.randomBytes(24).toString('base64url');
    res.cookie(LOGIN_COOKIE, token, { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 30 * 60 * 1000 });
    const admin = await auth.getAdmin();
    res.status(status).render('admin/login', { erro, loginToken: token, semUsuaria: !admin, pedeCodigo: !!(admin && admin.totp_secret) });
  }

  router.get('/login', async (req, res) => {
    if (await auth.loadSession(req, secure)) return res.redirect(req.baseUrl + '/');
    await renderLogin(res, null);
  });

  router.post('/login', form, async (req, res) => {
    const ip = req.ip;
    const cookieToken = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(LOGIN_COOKIE + '='));
    if (!cookieToken || cookieToken.slice(LOGIN_COOKIE.length + 1) !== req.body.login_token) {
      return renderLogin(res, 'A página de login expirou. Tente de novo.', 403);
    }
    if (await auth.loginBlocked(ip)) {
      return renderLogin(res, 'Muitas tentativas. Por segurança, o acesso foi bloqueado por 15 minutos.', 429);
    }
    const admin = await auth.getAdmin();
    const user = String(req.body.usuario || '');
    const pass = String(req.body.senha || '').slice(0, 1024);
    const passOk = auth.verifyPassword(pass, admin ? admin.pass_hash : auth.DUMMY_HASH);
    const userOk = !!admin && crypto.timingSafeEqual(
      crypto.createHash('sha256').update(user).digest(), crypto.createHash('sha256').update(admin.username).digest());
    const codeOk = !admin || !admin.totp_secret || auth.verifyTotp(admin.totp_secret, String(req.body.codigo || '').trim());
    if (!(admin && passOk && userOk && codeOk)) {
      await auth.recordFailure(ip);
      return renderLogin(res, 'Usuário, senha ou código incorretos.', 401);
    }
    await auth.clearFailures(ip);
    res.clearCookie(LOGIN_COOKIE, { httpOnly: true, secure, sameSite: 'strict', path: '/' });
    await auth.createSession(req, res, secure);
    res.redirect(req.baseUrl + '/');
  });

  // ---------- Daqui para baixo, só com sessão válida ----------
  router.use(async (req, res, next) => {
    const session = await auth.loadSession(req, secure);
    if (!session) return res.redirect(req.baseUrl + '/login');
    req.session = session;
    res.locals.csrf = session.csrf;
    next();
  });

  function requireCsrf(req, res, next) {
    if (!auth.csrfValid(req.session, req.body && req.body._csrf)) {
      return res.status(403).render('erro', { titulo: 'Acesso negado', mensagem: 'A sessão expirou ou o formulário é inválido. Volte e tente de novo.' });
    }
    next();
  }

  router.post('/sair', form, requireCsrf, async (req, res) => {
    await auth.destroySession(req, res, secure);
    res.redirect(req.baseUrl + '/login');
  });

  router.get('/', async (req, res) => {
    const filtro = ['rascunho', 'publicado'].includes(req.query.status) ? req.query.status : null;
    const posts = filtro
      ? await db.all('SELECT * FROM posts WHERE status = ? ORDER BY atualizado_em DESC', [filtro])
      : await db.all('SELECT * FROM posts ORDER BY atualizado_em DESC');
    const contagem = (await db.all('SELECT status, COUNT(*)::int AS n FROM posts GROUP BY status'))
      .reduce((acc, r) => ({ ...acc, [r.status]: r.n }), { rascunho: 0, publicado: 0 });
    res.render('admin/painel', { posts, filtro, contagem, aviso: req.query.ok });
  });

  // ---------- Escrever / editar ----------
  function emptyPost() {
    return { id: null, slug: '', tipo: 'artigo', editoria: '', titulo: '', subtitulo: '', corpo_html: '', capa: '', capa_credito: '', capa_legenda: '', status: 'rascunho', destaque: 0, publicado_em: null };
  }

  function renderEditor(res, post, erro) {
    res.render('admin/editor', { post, erro, tipos: c.TIPOS, sugestoes: c.SUGESTOES, publicadoLocal: c.isoToLocalInput(post.publicado_em) });
  }

  async function uniqueSlug(base, id) {
    let slug = c.slugify(base), n = 2;
    while (await db.get('SELECT 1 FROM posts WHERE slug = ? AND id IS DISTINCT FROM ?', [slug, id])) slug = `${c.slugify(base)}-${n++}`;
    return slug;
  }

  async function savePost(req, res, existing) {
    const b = req.body;
    const post = { ...(existing || emptyPost()) };
    post.titulo = String(b.titulo || '').trim();
    post.subtitulo = String(b.subtitulo || '').trim();
    post.tipo = c.TIPOS[b.tipo] ? b.tipo : 'artigo';
    post.editoria = res.locals.site.lista_editorias.includes(b.editoria) ? b.editoria : '';
    post.corpo_html = c.sanitizeBody(b.corpo_html);
    post.capa_credito = String(b.capa_credito || '').trim().slice(0, 200);
    post.capa_legenda = String(b.capa_legenda || '').trim().slice(0, 500);
    post.destaque = b.destaque === '1' ? 1 : 0;
    const acao = b.acao;

    if (!post.titulo) return renderEditor(res.status(400), post, 'O título é obrigatório.');

    try {
      const nova = await saveImage(req.file);
      if (nova) { if (existing) await removeImage(existing.capa); post.capa = nova; }
    } catch (e) {
      return renderEditor(res.status(400), post, e.userMessage || 'Não foi possível salvar a imagem.');
    }
    if (b.remover_capa === '1' && !req.file?.size) { await removeImage(post.capa); post.capa = ''; }

    if (acao === 'publicar') {
      post.status = 'publicado';
      post.publicado_em = c.localInputToIso(b.publicado_em) || post.publicado_em || new Date().toISOString();
    } else if (acao === 'despublicar') {
      post.status = 'rascunho';
    }
    // "Salvar" mantém o status atual; se já publicado, permite ajustar a data.
    if (acao === 'salvar' && post.status === 'publicado') {
      post.publicado_em = c.localInputToIso(b.publicado_em) || post.publicado_em;
    }

    const slugDesejado = String(b.slug || '').trim();
    post.slug = await uniqueSlug(slugDesejado || post.slug || post.titulo, post.id);
    const now = new Date().toISOString();

    await db.tx(async t => {
      if (post.destaque) await db.run('UPDATE posts SET destaque = 0', [], t);
      if (post.id) {
        await db.run(`UPDATE posts SET slug=?, tipo=?, editoria=?, titulo=?, subtitulo=?, corpo_html=?, capa=?, capa_credito=?, capa_legenda=?,
                      status=?, destaque=?, publicado_em=?, atualizado_em=? WHERE id=?`,
        [post.slug, post.tipo, post.editoria, post.titulo, post.subtitulo, post.corpo_html, post.capa, post.capa_credito, post.capa_legenda,
          post.status, post.destaque, post.publicado_em, now, post.id], t);
      } else {
        post.id = (await db.get(`INSERT INTO posts (slug, tipo, editoria, titulo, subtitulo, corpo_html, capa, capa_credito, capa_legenda, status, destaque, publicado_em, criado_em, atualizado_em)
                                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
        [post.slug, post.tipo, post.editoria, post.titulo, post.subtitulo, post.corpo_html, post.capa, post.capa_credito, post.capa_legenda,
          post.status, post.destaque, post.publicado_em, now, now], t)).id;
      }
    });

    const msg = acao === 'publicar' ? 'publicado' : acao === 'despublicar' ? 'despublicado' : 'salvo';
    res.redirect(`${req.baseUrl}/editar/${post.id}?ok=${msg}`);
  }

  async function findPost(id) {
    return /^\d{1,9}$/.test(id) ? db.get('SELECT * FROM posts WHERE id = ?', [Number(id)]) : null;
  }

  router.get('/novo', (req, res) => renderEditor(res, emptyPost(), null));
  router.post('/novo', upload.single('capa'), requireCsrf, (req, res) => savePost(req, res, null));

  router.get('/editar/:id', async (req, res, next) => {
    const post = await findPost(req.params.id);
    if (!post) return next();
    res.locals.aviso = req.query.ok;
    renderEditor(res, post, null);
  });
  router.post('/editar/:id', upload.single('capa'), requireCsrf, async (req, res, next) => {
    const post = await findPost(req.params.id);
    if (!post) return next();
    return savePost(req, res, post);
  });

  router.get('/previa/:id', async (req, res, next) => {
    const post = await findPost(req.params.id);
    if (!post) return next();
    res.render('artigo', { post, relacionados: [], preview: true, url: '' });
  });

  router.post('/excluir/:id', form, requireCsrf, async (req, res, next) => {
    const post = await findPost(req.params.id);
    if (!post) return next();
    await db.run('DELETE FROM posts WHERE id = ?', [post.id]);
    await removeImage(post.capa);
    res.redirect(req.baseUrl + '/?ok=excluido');
  });

  // ---------- Configurações do jornal ----------
  router.get('/configuracoes', (req, res) => res.render('admin/configuracoes', { erro: null, aviso: req.query.ok, amostrasFontes: true }));

  router.post('/configuracoes', upload.single('autora_foto'), requireCsrf, async (req, res) => {
    const b = req.body, atual = await getSettings();
    const novo = {};
    for (const k of ['nome_jornal', 'slogan', 'autora_nome', 'autora_bio', 'editorias', 'contato_email', 'link_instagram', 'link_x']) {
      novo[k] = String(b[k] || '').trim().slice(0, 2000);
    }
    if (!novo.nome_jornal) novo.nome_jornal = atual.nome_jornal;
    if (/^#[0-9a-fA-F]{6}$/.test(b.cor_destaque || '')) novo.cor_destaque = b.cor_destaque;
    if (FONTES.some(f => f.id === b.fonte_logo)) novo.fonte_logo = b.fonte_logo;
    for (const k of ['link_instagram', 'link_x']) if (novo[k] && !/^https:\/\//.test(novo[k])) novo[k] = '';
    try {
      const foto = await saveImage(req.file);
      if (foto) { await removeImage(atual.autora_foto); novo.autora_foto = foto; }
    } catch (e) {
      return res.status(400).render('admin/configuracoes', { erro: e.userMessage, aviso: null, amostrasFontes: true });
    }
    if (b.remover_foto === '1' && !req.file?.size) { await removeImage(atual.autora_foto); novo.autora_foto = ''; }
    await saveSettings(novo);
    res.redirect(req.baseUrl + '/configuracoes?ok=1');
  });

  // ---------- Trocar senha ----------
  router.get('/senha', (req, res) => res.render('admin/senha', { erro: null }));

  router.post('/senha', form, requireCsrf, async (req, res) => {
    const admin = await auth.getAdmin();
    const atual = String(req.body.senha_atual || '');
    const nova = String(req.body.senha_nova || '');
    if (!auth.verifyPassword(atual, admin.pass_hash)) return res.status(400).render('admin/senha', { erro: 'A senha atual está incorreta.' });
    if (nova !== req.body.senha_confirma) return res.status(400).render('admin/senha', { erro: 'A confirmação não confere com a nova senha.' });
    const problemas = auth.passwordProblems(nova, admin.username);
    if (problemas.length) return res.status(400).render('admin/senha', { erro: problemas.join(' ') });
    await auth.setAdmin(admin.username, nova);
    await auth.createSession(req, res, secure);
    res.redirect(req.baseUrl + '/?ok=senha');
  });

  return router;
};
