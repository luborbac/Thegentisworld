'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const { getSettings } = require('./src/db');
const content = require('./src/content');

const PORT = process.env.PORT || 3000;
const PRODUCTION = process.env.NODE_ENV === 'production';
// Endereço da redação. Em produção, troque por algo difícil de adivinhar (ex.: /redacao-7f3k).
const ADMIN_PATH = '/' + String(process.env.ADMIN_PATH || 'redacao').replace(/^\/+|\/+$/g, '');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

require('./src/auth').syncAdminFromEnv();

const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Atrás de um proxy (Render, Railway, Nginx…) é preciso confiar nele para saber o IP real.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

// Cabeçalhos de segurança em todas as respostas.
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "object-src 'none'"
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin'
  });
  if (PRODUCTION) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: PRODUCTION ? '7d' : 0 }));
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '30d',
  setHeaders: res => res.set('Content-Security-Policy', "default-src 'none'; sandbox")
}));

// Variáveis disponíveis em todos os templates.
app.use((req, res, next) => {
  res.locals.site = getSettings();
  res.locals.c = content;
  res.locals.adminPath = ADMIN_PATH;
  res.locals.path = req.path;
  next();
});

// Cor de destaque escolhida na redação, servida como CSS (a CSP não permite estilos inline).
app.get('/tema.css', (req, res) => {
  const cor = /^#[0-9a-fA-F]{6}$/.test(res.locals.site.cor_destaque) ? res.locals.site.cor_destaque : '#9B1D20';
  res.type('text/css').set('Cache-Control', 'no-cache').send(`:root{--accent:${cor};}`);
});

app.use(ADMIN_PATH, require('./src/routes/admin')({ uploadDir: UPLOAD_DIR, secure: PRODUCTION }));
app.use('/', require('./src/routes/public'));

app.use((req, res) => res.status(404).render('erro', { titulo: 'Página não encontrada', mensagem: 'O endereço que você procurou não existe ou foi removido.' }));

app.use((err, req, res, next) => {
  const ref = crypto.randomBytes(4).toString('hex');
  console.error(`[erro ${ref}]`, err);
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).render('erro', {
    titulo: status === 403 ? 'Acesso negado' : status === 413 ? 'Arquivo grande demais' : 'Algo deu errado',
    mensagem: status === 413 ? 'A imagem deve ter no máximo 8 MB.' : `Tente de novo. Código de referência: ${ref}.`
  });
});

app.listen(PORT, () => {
  console.log(`Jornal no ar em http://localhost:${PORT}`);
  console.log(`Redação em http://localhost:${PORT}${ADMIN_PATH}`);
  if (!require('./src/auth').getAdmin()) {
    console.log('\nAinda não há usuária cadastrada. Rode:  npm run senha\n');
  }
});
