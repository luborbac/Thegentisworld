'use strict';
const express = require('express');
const { db } = require('../db');
const { slugify, excerpt } = require('../content');

const router = express.Router();
const baseUrl = req => process.env.SITE_URL ? process.env.SITE_URL.replace(/\/+$/, '') : `${req.protocol}://${req.get('host')}`;

// Só aparece ao público o que está publicado e com data já alcançada (agendamento).
const VISIBLE = "status = 'publicado' AND publicado_em <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

router.get('/', (req, res) => {
  const posts = db.prepare(`SELECT * FROM posts WHERE ${VISIBLE} ORDER BY destaque DESC, publicado_em DESC LIMIT 25`).all();
  const manchete = posts[0] || null;
  const restantes = posts.slice(1).sort((a, b) => b.publicado_em.localeCompare(a.publicado_em));
  res.render('home', { manchete, secundarias: restantes.slice(0, 3), lista: restantes.slice(3) });
});

router.get('/texto/:slug', (req, res, next) => {
  const post = db.prepare(`SELECT * FROM posts WHERE slug = ? AND ${VISIBLE}`).get(req.params.slug);
  if (!post) return next();
  const relacionados = db.prepare(`SELECT * FROM posts WHERE ${VISIBLE} AND id != ? ORDER BY (editoria = ?) DESC, publicado_em DESC LIMIT 3`)
    .all(post.id, post.editoria);
  res.render('artigo', { post, relacionados, preview: false, url: `${baseUrl(req)}/texto/${post.slug}` });
});

router.get('/editoria/:slug', (req, res, next) => {
  const nome = res.locals.site.lista_editorias.find(e => slugify(e) === req.params.slug);
  if (!nome) return next();
  const posts = db.prepare(`SELECT * FROM posts WHERE ${VISIBLE} AND editoria = ? ORDER BY publicado_em DESC LIMIT 100`).all(nome);
  res.render('lista', { titulo: nome, descricao: `Textos de ${nome.toLowerCase()}`, posts });
});

router.get('/textos', (req, res) => {
  const posts = db.prepare(`SELECT * FROM posts WHERE ${VISIBLE} ORDER BY publicado_em DESC LIMIT 200`).all();
  res.render('lista', { titulo: 'Todos os textos', descricao: '', posts });
});

router.get('/busca', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  let posts = [];
  if (q.length >= 2) {
    const like = `%${q.replace(/[%_\\]/g, m => '\\' + m)}%`;
    posts = db.prepare(`SELECT * FROM posts WHERE ${VISIBLE} AND (titulo LIKE ? ESCAPE '\\' OR subtitulo LIKE ? ESCAPE '\\' OR corpo_html LIKE ? ESCAPE '\\')
                        ORDER BY publicado_em DESC LIMIT 50`).all(like, like, like);
  }
  res.render('lista', { titulo: q ? `Busca: “${q}”` : 'Busca', descricao: q.length >= 2 ? `${posts.length} resultado(s)` : 'Digite ao menos 2 letras.', posts, q });
});

router.get('/sobre', (req, res) => {
  const total = db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE ${VISIBLE}`).get().n;
  res.render('sobre', { total });
});

router.get('/feed.xml', (req, res) => {
  const site = res.locals.site;
  const base = baseUrl(req);
  const esc = s => String(s).replace(/[<>&'"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]));
  const posts = db.prepare(`SELECT * FROM posts WHERE ${VISIBLE} ORDER BY publicado_em DESC LIMIT 30`).all();
  const items = posts.map(p => `<item><title>${esc(p.titulo)}</title><link>${base}/texto/${p.slug}</link><guid>${base}/texto/${p.slug}</guid>` +
    `<pubDate>${new Date(p.publicado_em).toUTCString()}</pubDate><description>${esc(p.subtitulo || excerpt(p.corpo_html))}</description></item>`).join('');
  res.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.nome_jornal)}</title>` +
    `<link>${base}</link><description>${esc(site.slogan)}</description><language>pt-br</language>${items}</channel></rss>`);
});

router.get('/robots.txt', (req, res) => {
  // O endereço da redação não é listado aqui de propósito: robots.txt é público.
  res.type('text/plain').send('User-agent: *\nAllow: /\n');
});

module.exports = router;
