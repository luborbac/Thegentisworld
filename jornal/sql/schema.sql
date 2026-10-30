-- Esquema do jornal. Fica num schema próprio ("jornal"), fora da API pública do Supabase:
-- só o servidor do site, com a sua própria senha de banco, consegue ler e gravar aqui.
CREATE SCHEMA IF NOT EXISTS jornal;

CREATE TABLE IF NOT EXISTS jornal.posts (
  id            SERIAL PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_posts_pub ON jornal.posts(status, publicado_em);

CREATE TABLE IF NOT EXISTS jornal.settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jornal.admin (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  username    TEXT NOT NULL,
  pass_hash   TEXT NOT NULL,
  totp_secret TEXT,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jornal.sessions (
  token_hash TEXT PRIMARY KEY,
  csrf       TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  last_seen  BIGINT NOT NULL,
  ip         TEXT,
  ua         TEXT
);

CREATE TABLE IF NOT EXISTS jornal.login_attempts (
  ip TEXT NOT NULL,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts ON jornal.login_attempts(ip, ts);

-- Imagens (capas e foto da autora) ficam no próprio banco.
CREATE TABLE IF NOT EXISTS jornal.imagens (
  id        TEXT PRIMARY KEY,
  mime      TEXT NOT NULL,
  dados     BYTEA NOT NULL,
  criado_em TEXT NOT NULL
);

-- Texto de exemplo, para a vitrine não nascer vazia.
INSERT INTO jornal.posts (slug, tipo, editoria, titulo, subtitulo, corpo_html, status, destaque, publicado_em, criado_em, atualizado_em)
SELECT 'por-que-este-jornal-existe', 'editorial', 'Sociedade', 'Por que este jornal existe',
  'Texto de exemplo: edite ou apague na redação. Ele mostra como uma publicação aparece para quem lê.',
  '<p>Este é um texto de exemplo criado automaticamente para que você veja como a vitrine do jornal fica com uma publicação. Entre na redação, edite este texto ou apague-o e escreva o primeiro de verdade.</p><h2>Um intertítulo ajuda a respirar</h2><p>Textos longos ficam mais fáceis de ler quando divididos em blocos. Use intertítulos a cada quatro ou cinco parágrafos e destaque uma frase forte como citação.</p><blockquote><p>Opinião com fundamento é serviço público.</p></blockquote><p>Não há limite de caracteres. O editor mostra apenas sugestões de tamanho, de acordo com o tipo de texto escolhido.</p>',
  'publicado', 1, to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE NOT EXISTS (SELECT 1 FROM jornal.posts);
