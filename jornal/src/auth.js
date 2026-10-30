'use strict';
const crypto = require('crypto');
const db = require('./db');

// ---------- Senha (scrypt, com sal aleatório) ----------
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length,
    { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem });
  return crypto.timingSafeEqual(actual, expected);
}

// Hash usado quando o usuário não existe, para o tempo de resposta não revelar isso.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

function getAdmin() {
  return db.get('SELECT * FROM admin WHERE id = 1');
}

async function writeAdmin(username, hash) {
  await db.run(`INSERT INTO admin (id, username, pass_hash, updated_at) VALUES (1, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET username = excluded.username, pass_hash = excluded.pass_hash, updated_at = excluded.updated_at`,
  [username, hash, new Date().toISOString()]);
  // Trocar a senha derruba todas as sessões abertas.
  await db.run('DELETE FROM sessions');
}

function setAdmin(username, password) {
  return writeAdmin(username, hashPassword(password));
}

// Permite definir o acesso pelo painel da hospedagem, sem terminal: ADMIN_USER e
// ADMIN_PASSWORD_HASH (gerado com `npm run hash`). A senha em si nunca fica no servidor.
async function syncAdminFromEnv() {
  const user = process.env.ADMIN_USER, hash = process.env.ADMIN_PASSWORD_HASH;
  if (!user || !hash) return;
  if (!/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(hash)) {
    console.error('ADMIN_PASSWORD_HASH inválido. Gere com: npm run hash');
    return;
  }
  const atual = await getAdmin();
  if (atual && atual.username === user && atual.pass_hash === hash) return;
  await writeAdmin(user, hash);
  console.log(`Acesso da redação definido pelas variáveis de ambiente (usuária "${user}").`);
}

function passwordProblems(password, username) {
  const p = [];
  if (password.length < 12) p.push('A senha precisa ter pelo menos 12 caracteres.');
  if (!/[a-zA-ZÀ-ú]/.test(password) || !/[0-9]/.test(password)) p.push('Use letras e números.');
  if (username && password.toLowerCase().includes(username.toLowerCase())) p.push('A senha não pode conter o nome de usuário.');
  return p;
}

// ---------- TOTP (verificação em duas etapas, RFC 6238) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = str.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0, value = 0; const out = [];
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error('base32 inválido');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function totpAt(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1000000).toString();
  return code.padStart(6, '0');
}

function verifyTotp(secret, code) {
  if (!/^\d{6}$/.test(code || '')) return false;
  const now = Math.floor(Date.now() / 30000);
  let ok = false;
  for (let d = -1; d <= 1; d++) {
    const expected = Buffer.from(totpAt(secret, now + d));
    if (crypto.timingSafeEqual(expected, Buffer.from(code))) ok = true;
  }
  return ok;
}

function newTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

// ---------- Limite de tentativas de login ----------
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_GLOBAL = 50;

async function loginBlocked(ip) {
  const since = Date.now() - WINDOW_MS;
  await db.run('DELETE FROM login_attempts WHERE ts < ?', [since]);
  const perIp = (await db.get('SELECT COUNT(*)::int AS n FROM login_attempts WHERE ip = ? AND ts >= ?', [ip, since])).n;
  const global = (await db.get('SELECT COUNT(*)::int AS n FROM login_attempts WHERE ts >= ?', [since])).n;
  return perIp >= MAX_PER_IP || global >= MAX_GLOBAL;
}

function recordFailure(ip) {
  return db.run('INSERT INTO login_attempts (ip, ts) VALUES (?, ?)', [ip, Date.now()]);
}

function clearFailures(ip) {
  return db.run('DELETE FROM login_attempts WHERE ip = ?', [ip]);
}

// ---------- Sessões (token aleatório; no banco só fica o hash) ----------
const IDLE_MS = 2 * 60 * 60 * 1000;       // 2h sem uso
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;  // 12h no máximo

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

function cookieName(secure) {
  return secure ? '__Host-redacao' : 'redacao';
}

async function createSession(req, res, secure) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.run('INSERT INTO sessions (token_hash, csrf, created_at, last_seen, ip, ua) VALUES (?, ?, ?, ?, ?, ?)',
    [sha256(token), csrf, now, now, req.ip, String(req.get('user-agent') || '').slice(0, 300)]);
  res.cookie(cookieName(secure), token, {
    httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: ABSOLUTE_MS
  });
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

async function loadSession(req, secure) {
  const token = readCookie(req, cookieName(secure));
  if (!token) return null;
  const row = await db.get('SELECT * FROM sessions WHERE token_hash = ?', [sha256(token)]);
  if (!row) return null;
  const now = Date.now();
  if (now - row.last_seen > IDLE_MS || now - row.created_at > ABSOLUTE_MS) {
    await db.run('DELETE FROM sessions WHERE token_hash = ?', [row.token_hash]);
    return null;
  }
  await db.run('UPDATE sessions SET last_seen = ? WHERE token_hash = ?', [now, row.token_hash]);
  return row;
}

async function destroySession(req, res, secure) {
  const token = readCookie(req, cookieName(secure));
  if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
  res.clearCookie(cookieName(secure), { httpOnly: true, secure, sameSite: 'strict', path: '/' });
}

function csrfValid(session, token) {
  if (!session || typeof token !== 'string') return false;
  const a = Buffer.from(session.csrf), b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  hashPassword, verifyPassword, DUMMY_HASH, getAdmin, setAdmin, syncAdminFromEnv, passwordProblems,
  newTotpSecret, verifyTotp,
  loginBlocked, recordFailure, clearFailures,
  createSession, loadSession, destroySession, csrfValid
};
