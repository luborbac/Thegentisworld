'use strict';
document.addEventListener('DOMContentLoaded', function () {
  // Menu lateral
  var gaveta = document.getElementById('gaveta');
  var botao = document.querySelector('[data-menu]');
  function abrir(sim) {
    if (!gaveta || !botao) return;
    gaveta.hidden = !sim;
    botao.setAttribute('aria-expanded', String(sim));
    document.body.classList.toggle('sem-rolagem', sim);
    if (sim) { var i = gaveta.querySelector('input'); if (i) i.focus(); }
  }
  if (botao) botao.addEventListener('click', function () { abrir(gaveta.hidden); });
  document.querySelectorAll('[data-menu-fechar]').forEach(function (b) { b.addEventListener('click', function () { abrir(false); }); });
  if (gaveta) gaveta.addEventListener('click', function (e) { if (e.target === gaveta) abrir(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') abrir(false); });

  // Copiar link
  document.querySelectorAll('[data-copiar]').forEach(function (b) {
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(b.getAttribute('data-copiar')).then(function () {
        b.classList.add('copiado');
        b.setAttribute('aria-label', 'Link copiado');
        setTimeout(function () { b.classList.remove('copiado'); b.setAttribute('aria-label', 'Copiar link'); }, 1800);
      });
    });
  });

  // Confirmações (redação)
  document.querySelectorAll('form[data-confirmar]').forEach(function (f) {
    f.addEventListener('submit', function (e) { if (!confirm(f.getAttribute('data-confirmar'))) e.preventDefault(); });
  });
  document.querySelectorAll('button[data-confirmar]').forEach(function (b) {
    b.addEventListener('click', function (e) { if (!confirm(b.getAttribute('data-confirmar'))) e.preventDefault(); });
  });
});
