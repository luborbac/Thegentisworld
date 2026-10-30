'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'jornal.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  tipo          TEXT NOT NULL DEFAULT 'artigo',
  editoria      TEXT NOT NULL DEFAULT '',
  titulo        TEXT NOT NULL,
  subtitulo     TEXT NOT NULL DEFAULT '',
  corpo_html    TEXT NOT NULL DEFAULT '',
  capa          TEXT NOT NULL DEFAULT '',
  capa_credito  TEXT NOT NULL DEFAULT '',
  capa_legenda  TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado')),
  destaque      INTEGER NOT NULL DEFAULT 0,
  publicado_em  TEXT,
  criado_em     TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_pub ON posts(status, publicado_em);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  username    TEXT NOT NULL,
  pass_hash   TEXT NOT NULL,
  totp_secret TEXT,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  csrf       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  ip         TEXT,
  ua         TEXT
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts ON login_attempts(ip, ts);
`);

const DEFAULT_SETTINGS = {
  nome_jornal: 'MARGEM',
  slogan: 'Jornalismo independente de opinião',
  cor_destaque: '#9B1D20',
  autora_nome: 'Luciana Borba',
  autora_bio: 'Jornalista. Escreve análises e artigos de opinião sobre política, sociedade e cultura.',
  autora_foto: '',
  editorias: 'Política, Economia, Sociedade, Trabalho, Cultura, Internacional',
  contato_email: '',
  link_instagram: '',
  link_x: ''
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  out.lista_editorias = out.editorias.split(',').map(s => s.trim()).filter(Boolean);
  return out;
}

function saveSettings(obj) {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.transaction(() => {
    for (const [k, v] of Object.entries(obj)) {
      if (k in DEFAULT_SETTINGS) stmt.run(k, String(v));
    }
  })();
}

// Texto de exemplo, criado só no primeiro uso, para a vitrine não nascer vazia.
if (db.prepare('SELECT COUNT(*) AS n FROM posts').get().n === 0) {
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO posts (slug, tipo, editoria, titulo, subtitulo, corpo_html, status, destaque, publicado_em, criado_em, atualizado_em)
              VALUES (?, 'editorial', 'Sociedade', ?, ?, ?, 'publicado', 1, ?, ?, ?)`).run(
    'por-que-este-jornal-existe',
    'Por que este jornal existe',
    'Texto de exemplo: edite ou apague na redação. Ele mostra como uma publicação aparece para quem lê.',
    '<p>Este é um texto de exemplo criado automaticamente para que você veja como a vitrine do jornal fica com uma publicação. Entre na redação, edite este texto ou apague-o e escreva o primeiro de verdade.</p>' +
    '<h2>Um intertítulo ajuda a respirar</h2>' +
    '<p>Textos longos ficam mais fáceis de ler quando divididos em blocos. Use intertítulos a cada quatro ou cinco parágrafos e destaque uma frase forte como citação.</p>' +
    '<blockquote><p>Opinião com fundamento é serviço público.</p></blockquote>' +
    '<p>Não há limite de caracteres. O editor mostra apenas sugestões de tamanho, de acordo com o tipo de texto escolhido.</p>',
    now, now, now
  );
}

module.exports = { db, getSettings, saveSettings, DATA_DIR };
