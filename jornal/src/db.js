'use strict';
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Defina DATABASE_URL (endereço do banco Postgres). Veja o README.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Na Vercel cada instância é pequena: poucas conexões, liberadas rápido.
  max: Number(process.env.DB_POOL_MAX || 3),
  idleTimeoutMillis: 10000,
  ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL || '') ? false : { rejectUnauthorized: false }
});
// As tabelas ficam no schema "jornal"; o usuário do banco tem search_path = jornal
// (ALTER ROLE ... SET search_path), o que funciona também através do pooler do Supabase.

// Aceita "?" como marcador (estilo do código original) e troca por $1, $2…
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function all(sql, params = [], client = pool) {
  return (await client.query(toPg(sql), params)).rows;
}
async function get(sql, params = [], client = pool) {
  return (await all(sql, params, client))[0];
}
async function run(sql, params = [], client = pool) {
  return client.query(toPg(sql), params);
}
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

const DEFAULT_SETTINGS = {
  nome_jornal: 'Viés Independente',
  slogan: 'Jornalismo de opinião, com lado e com fundamento',
  cor_destaque: '#9B1D20',
  fonte_logo: 'metal-mania',
  autora_nome: 'Luciana Borba',
  autora_bio: 'Jornalista. Escreve análises e artigos de opinião sobre política, sociedade e cultura.',
  autora_foto: '',
  editorias: 'Política, Economia, Sociedade, Trabalho, Cultura, Internacional',
  contato_email: '',
  link_instagram: '',
  link_x: ''
};

async function getSettings() {
  const rows = await all('SELECT key, value FROM settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  out.lista_editorias = out.editorias.split(',').map(s => s.trim()).filter(Boolean);
  return out;
}

async function saveSettings(obj) {
  await tx(async c => {
    for (const [k, v] of Object.entries(obj)) {
      if (k in DEFAULT_SETTINGS) {
        await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [k, String(v)], c);
      }
    }
  });
}

module.exports = { pool, all, get, run, tx, getSettings, saveSettings, DEFAULT_SETTINGS };
