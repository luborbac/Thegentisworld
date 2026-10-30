'use strict';
const sanitizeHtml = require('sanitize-html');

// Tipos de texto e tamanhos sugeridos (em palavras). São referências de redação,
// não limites: o editor aceita textos de qualquer tamanho.
const TIPOS = {
  editorial: { nome: 'Editorial',          min: 400,  max: 700,  dica: 'Posição do jornal sobre um tema. Direto, sem rodeios: tese no primeiro parágrafo.' },
  artigo:    { nome: 'Artigo de opinião',  min: 600,  max: 1000, dica: 'Uma tese, dois ou três argumentos com dados, e uma conclusão que retome a tese.' },
  coluna:    { nome: 'Coluna',             min: 700,  max: 1200, dica: 'Voz pessoal e recorrente. Pode misturar comentário, bastidor e análise.' },
  analise:   { nome: 'Análise',            min: 1000, max: 2000, dica: 'Contexto, causas e consequências. Cite fontes e números; use intertítulos.' },
  cronica:   { nome: 'Crônica',            min: 500,  max: 900,  dica: 'Parte do cotidiano para chegar a uma ideia. Ritmo e imagem contam mais que dados.' },
  ensaio:    { nome: 'Ensaio',             min: 2000, max: 5000, dica: 'Reflexão longa e aprofundada. Intertítulos a cada 4–6 parágrafos ajudam a leitura.' },
  nota:      { nome: 'Nota curta',         min: 150,  max: 400,  dica: 'Comentário rápido sobre um fato do dia.' }
};

// Sugestões para os outros campos (em caracteres).
const SUGESTOES = {
  titulo:    { min: 30, max: 80,  dica: 'Títulos entre 30 e 80 caracteres aparecem inteiros no Google e nas redes.' },
  subtitulo: { min: 80, max: 180, dica: 'A linha fina complementa o título; até ~180 caracteres.' }
};

function sanitizeBody(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'a', 'hr', 'sup', 'sub'],
    allowedAttributes: { a: ['href', 'title', 'rel', 'target'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      b: 'strong', i: 'em',
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
      div: 'p'
    },
    exclusiveFilter: frame => frame.tag === 'p' && !frame.text.trim()
  });
}

function plainText(html) {
  return sanitizeHtml(String(html || ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function wordCount(html) {
  const t = plainText(String(html || '').replace(/<\/(p|h2|h3|li|blockquote)>/g, ' ')).trim();
  return t ? t.split(/\s+/).length : 0;
}

function readingMinutes(html) {
  return Math.max(1, Math.round(wordCount(html) / 200));
}

function excerpt(html, len = 180) {
  const t = plainText(String(html || '').replace(/<\/(p|h2|h3|li)>/g, ' ')).replace(/\s+/g, ' ').trim();
  return t.length > len ? t.slice(0, len).replace(/\s+\S*$/, '') + '…' : t;
}

function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'texto';
}

const TZ = 'America/Sao_Paulo';
const fmtDate = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${fmtDate.format(d).replace(/\./g, '').replace(/ de /g, ' ')} · ${fmtTime.format(d).replace(':', 'h')}`;
}

// Converte "2026-10-30T09:00" (horário de Brasília, digitado no formulário) para ISO UTC, e de volta.
const BRT_OFFSET = '-03:00';
function localInputToIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')) return null;
  const d = new Date(`${value}:00${BRT_OFFSET}`);
  return isNaN(d) ? null : d.toISOString();
}
function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

module.exports = {
  TIPOS, SUGESTOES, sanitizeBody, plainText, wordCount, readingMinutes, excerpt, slugify,
  formatDate, localInputToIso, isoToLocalInput
};
