'use strict';
const express = require('express');
const db = require('../db');
const { slugify, excerpt } = require('../content');

const router = express.Router();
const baseUrl = req => process.env.SITE_URL ? process.env.SITE_URL.replace(/\/+$/, '') : `${req.protocol}://${req.get('host')}`;

// Só aparece ao público o que está publicado e com data já alcançada (agendamento).
const VISIBLE = "status = 'publicado' AND publicado_em <= to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')";

router.get('/', async (req, res) => {
  const posts = await db.all(`SELECT * FROM posts WHERE ${VISIBLE} ORDER BY destaque DESC, publicado_em DESC LIMIT 25`);
  const manchete = posts[0] || null;
  const restantes = posts.slice(1).sort((a, b) => b.publicado_em.localeCompare(a.publicado_em));
  res.render('home', { manchete, secundarias: restantes.slice(0, 3), lista: restantes.slice(3) });
});

router.get('/texto/:slug', async (req, res, next) => {
  const post = await db.get(`SELECT * FROM posts WHERE slug = ? AND ${VISIBLE}`, [req.params.slug]);
  if (!post) return next();
  const relacionados = await db.all(`SELECT * FROM posts WHERE ${VISIBLE} AND id != ? ORDER BY (editoria = ?) DESC, publicado_em DESC LIMIT 3`,
    [post.id, post.editoria]);
  res.render('artigo', { post, relacionados, preview: false, url: `${baseUrl(req)}/texto/${post.slug}` });
});

router.get('/editoria/:slug', async (req, res, next) => {
  const nome = res.locals.site.lista_editorias.find(e => slugify(e) === req.params.slug);
  if (!nome) return next();
  const posts = await db.all(`SELECT * FROM posts WHERE ${VISIBLE} AND editoria = ? ORDER BY publicado_em DESC LIMIT 100`, [nome]);
  res.render('lista', { titulo: nome, descricao: `Textos de ${nome.toLowerCase()}`, posts });
});

router.get('/textos', async (req, res) => {
  const posts = await db.all(`SELECT * FROM posts WHERE ${VISIBLE} ORDER BY publicado_em DESC LIMIT 200`);
  res.render('lista', { titulo: 'Todos os textos', descricao: '', posts });
});

router.get('/busca', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  let posts = [];
  if (q.length >= 2) {
    const like = `%${q.replace(/[%_\\]/g, m => '\\' + m)}%`;
    posts = await db.all(`SELECT * FROM posts WHERE ${VISIBLE} AND (titulo ILIKE ? ESCAPE '\\' OR subtitulo ILIKE ? ESCAPE '\\' OR corpo_html ILIKE ? ESCAPE '\\')
                          ORDER BY publicado_em DESC LIMIT 50`, [like, like, like]);
  }
  res.render('lista', { titulo: q ? `Busca: “${q}”` : 'Busca', descricao: q.length >= 2 ? `${posts.length} resultado(s)` : 'Digite ao menos 2 letras.', posts, q });
});

router.get('/sobre', async (req, res) => {
  const total = (await db.get(`SELECT COUNT(*)::int AS n FROM posts WHERE ${VISIBLE}`)).n;
  res.render('sobre', { total });
});

router.get('/feed.xml', async (req, res) => {
  const site = res.locals.site;
  const base = baseUrl(req);
  const esc = s => String(s).replace(/[<>&'"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]));
  const posts = await db.all(`SELECT * FROM posts WHERE ${VISIBLE} ORDER BY publicado_em DESC LIMIT 30`);
  const items = posts.map(p => `<item><title>${esc(p.titulo)}</title><link>${base}/texto/${p.slug}</link><guid>${base}/texto/${p.slug}</guid>` +
    `<pubDate>${new Date(p.publicado_em).toUTCString()}</pubDate><description>${esc(p.subtitulo || excerpt(p.corpo_html))}</description></item>`).join('');
  res.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.nome_jornal)}</title>` +
    `<link>${base}</link><description>${esc(site.slogan)}</description><language>pt-br</language>${items}</channel></rss>`);
});

// Imagens enviadas pela redação (guardadas no banco).
router.get('/img/:arquivo', async (req, res, next) => {
  const m = /^([a-f0-9-]{10,64})\.(jpg|png|webp|gif)$/.exec(req.params.arquivo);
  if (!m) return next();
  const img = await db.get('SELECT mime, dados FROM imagens WHERE id = ?', [m[1]]);
  if (!img) return next();
  res.set({ 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Security-Policy': "default-src 'none'; sandbox" });
  res.send(img.dados);
});

router.get('/robots.txt', (req, res) => {
  // O endereço da redação não é listado aqui de propósito: robots.txt é público.
  res.type('text/plain').send('User-agent: *\nAllow: /\n');
});

module.exports = router;
