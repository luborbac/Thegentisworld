'use strict';
// Fontes que podem ser escolhidas para o nome do jornal (todas gratuitas, do Google Fonts).
// A lista é fechada de propósito: o formulário só aceita um destes ids.
// "escala" estica as letras na vertical (1 = sem esticar); "tamanho" reduz as fontes
// mais largas para todas ocuparem mais ou menos a mesma largura no topo.
const FONTES = [
  { id: 'metal-mania',     nome: 'Metal Mania',          google: 'Metal+Mania',          escala: 1.3, tamanho: 1,  estilo: 'Pixo reto: pontuda e angulosa' },
  { id: 'new-rocker',      nome: 'New Rocker',           google: 'New+Rocker',           escala: 1.2, tamanho: 0.75,  estilo: 'Pixo com serifas cortantes' },
  { id: 'grenze-gotisch',  nome: 'Grenze Gotisch',       google: 'Grenze+Gotisch:wght@700', escala: 1.25, tamanho: 0.88, estilo: 'Gótica alta e estreita' },
  { id: 'pirata-one',      nome: 'Pirata One',           google: 'Pirata+One',           escala: 1.15, tamanho: 1, estilo: 'Gótica condensada' },
  { id: 'germania-one',    nome: 'Germania One',         google: 'Germania+One',         escala: 1.2, tamanho: 1,  estilo: 'Gótica simplificada' },
  { id: 'sedgwick',        nome: 'Sedgwick Ave Display', google: 'Sedgwick+Ave+Display', escala: 1, tamanho: 0.91,    estilo: 'Tag de grafite, feita à mão' },
  { id: 'permanent-marker', nome: 'Permanent Marker',    google: 'Permanent+Marker',     escala: 1, tamanho: 0.77,    estilo: 'Escrita com marcador' },
  { id: 'rubik-wet-paint', nome: 'Rubik Wet Paint',      google: 'Rubik+Wet+Paint',      escala: 1, tamanho: 0.73,    estilo: 'Spray escorrendo' },
  { id: 'butcherman',      nome: 'Butcherman',           google: 'Butcherman',           escala: 1, tamanho: 0.87,    estilo: 'Rasgada, de cartaz' },
  { id: 'eater',           nome: 'Eater',                google: 'Eater',                escala: 1, tamanho: 0.72,    estilo: 'Desgastada, punk' },
  { id: 'anton',           nome: 'Anton',                google: 'Anton',                escala: 1, tamanho: 1,    estilo: 'Clássica de jornal, condensada' }
];

const PADRAO = 'metal-mania';
const porId = Object.fromEntries(FONTES.map(f => [f.id, f]));

function fonte(id) {
  return porId[id] || porId[PADRAO];
}

function googleUrl(lista) {
  return 'https://fonts.googleapis.com/css2?' + lista.map(f => 'family=' + f.google).join('&') + '&display=swap';
}

module.exports = { FONTES, PADRAO, fonte, googleUrl };
