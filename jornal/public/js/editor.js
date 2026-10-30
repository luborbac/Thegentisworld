'use strict';
(function () {
  var dados = JSON.parse(document.getElementById('dados-editor').textContent);
  var form = document.querySelector('[data-editor]');
  var corpo = document.getElementById('corpo');
  var campoHtml = document.getElementById('corpo_html');
  var seletorTipo = document.querySelector('[data-tipo]');
  var chaveLocal = 'rascunho-redacao-' + dados.rascunhoId;
  var alterado = false;

  document.execCommand('defaultParagraphSeparator', false, 'p');

  // ---------- Barra de ferramentas ----------
  function foco() { corpo.focus(); }
  document.querySelectorAll('[data-cmd]').forEach(function (b) {
    b.addEventListener('click', function () { foco(); document.execCommand(b.getAttribute('data-cmd'), false, null); atualizar(); });
  });
  document.querySelectorAll('[data-bloco]').forEach(function (b) {
    b.addEventListener('click', function () {
      foco();
      var tag = b.getAttribute('data-bloco');
      // Clicar de novo no mesmo bloco volta para parágrafo.
      var atual = document.queryCommandValue('formatBlock').toLowerCase();
      document.execCommand('formatBlock', false, atual === tag && tag !== 'p' ? 'p' : tag);
      atualizar();
    });
  });
  function inserirLink() {
    var url = prompt('Endereço do link (https://…):', 'https://');
    if (!url || url === 'https://') return;
    if (!/^(https?:\/\/|mailto:)/i.test(url)) url = 'https://' + url;
    foco();
    document.execCommand('createLink', false, url);
    atualizar();
  }
  document.querySelector('[data-link]').addEventListener('click', inserirLink);
  document.querySelector('[data-tela-cheia]').addEventListener('click', function () {
    document.body.classList.toggle('modo-foco');
    foco();
  });
  corpo.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inserirLink(); }
    if (e.key === 'Escape') document.body.classList.remove('modo-foco');
  });

  // ---------- Colar sem formatação, mantendo parágrafos ----------
  corpo.addEventListener('paste', function (e) {
    e.preventDefault();
    var texto = (e.clipboardData || window.clipboardData).getData('text/plain');
    var blocos = texto.replace(/\r/g, '').split(/\n\s*\n|\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (blocos.length <= 1) { document.execCommand('insertText', false, texto); return; }
    var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    document.execCommand('insertHTML', false, blocos.map(function (b) { return '<p>' + esc(b) + '</p>'; }).join(''));
  });

  // ---------- Contadores ----------
  function fmt(n) { return n.toLocaleString('pt-BR'); }

  function contarCampo(el) {
    var chave = el.getAttribute('data-medir');
    var s = dados.sugestoes[chave];
    var n = el.value.trim().length;
    var alvo = document.querySelector('[data-contador="' + chave + '"]');
    var estado = n === 0 ? '' : n < s.min ? 'curto' : n > s.max ? 'longo' : 'ideal';
    alvo.textContent = fmt(n) + ' caracteres · sugerido ' + s.min + '–' + s.max;
    alvo.className = 'contador ' + estado;
  }
  document.querySelectorAll('[data-medir]').forEach(function (el) {
    el.addEventListener('input', function () { contarCampo(el); marcarAlterado(); });
    contarCampo(el);
  });
  document.querySelectorAll('[data-autogrow]').forEach(function (el) {
    function cresce() { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
    el.addEventListener('input', cresce); cresce();
  });

  function contarPalavras() {
    var t = (corpo.innerText || '').trim();
    return { palavras: t ? t.split(/\s+/).length : 0, caracteres: t.length };
  }

  function atualizarTipo() {
    var tipo = dados.tipos[seletorTipo.value];
    document.querySelector('[data-tipo-dica]').textContent = tipo.dica;
  }

  function atualizarMedidor() {
    var tipo = dados.tipos[seletorTipo.value];
    var n = contarPalavras();
    document.querySelector('[data-palavras]').textContent = fmt(n.palavras);
    document.querySelector('[data-caracteres]').textContent = fmt(n.caracteres);
    document.querySelector('[data-leitura]').textContent = Math.max(1, Math.round(n.palavras / 200));
    // A barra vai de 0 a 1,5 × o máximo sugerido; a faixa colorida é o intervalo ideal.
    var escala = tipo.max * 1.5;
    var faixa = document.querySelector('[data-faixa]');
    faixa.style.left = (tipo.min / escala * 100) + '%';
    faixa.style.width = ((tipo.max - tipo.min) / escala * 100) + '%';
    document.querySelector('[data-ponteiro]').style.left = Math.min(100, n.palavras / escala * 100) + '%';
    var status = document.querySelector('[data-medidor-status]');
    var medidor = document.querySelector('[data-medidor]');
    var msg, estado;
    if (n.palavras === 0) { msg = 'Comece a escrever. Para um(a) ' + tipo.nome.toLowerCase() + ', o usual é ' + fmt(tipo.min) + ' a ' + fmt(tipo.max) + ' palavras.'; estado = ''; }
    else if (n.palavras < tipo.min) { msg = 'Faltam cerca de ' + fmt(tipo.min - n.palavras) + ' palavras para o tamanho usual de um(a) ' + tipo.nome.toLowerCase() + '.'; estado = 'curto'; }
    else if (n.palavras <= tipo.max) { msg = 'Dentro do tamanho usual de um(a) ' + tipo.nome.toLowerCase() + '.'; estado = 'ideal'; }
    else { msg = fmt(n.palavras - tipo.max) + ' palavras acima do usual. Tudo bem se o tema pedir; considere intertítulos para facilitar a leitura.'; estado = 'longo'; }
    status.textContent = msg;
    medidor.className = 'medidor ' + estado;
  }

  // ---------- Cópia local de segurança ----------
  var avisoLocal = document.querySelector('[data-salvo-local]');
  var timer;
  function marcarAlterado() {
    alterado = true;
    clearTimeout(timer);
    timer = setTimeout(function () {
      try {
        localStorage.setItem(chaveLocal, JSON.stringify({
          quando: Date.now(), html: corpo.innerHTML,
          titulo: form.titulo.value, subtitulo: form.subtitulo.value
        }));
        avisoLocal.textContent = 'Cópia de segurança neste navegador às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.';
      } catch (e) { /* armazenamento indisponível: segue sem cópia local */ }
    }, 1500);
  }

  function atualizar() { atualizarMedidor(); marcarAlterado(); }

  // A cópia local só é apagada depois que o servidor confirmou o salvamento.
  if (/[?&]ok=/.test(location.search)) {
    try { localStorage.removeItem(chaveLocal); localStorage.removeItem('rascunho-redacao-novo'); } catch (e) { /* ignora */ }
  }

  try {
    var salvo = JSON.parse(localStorage.getItem(chaveLocal) || 'null');
    if (salvo && salvo.html !== corpo.innerHTML && salvo.html.replace(/<[^>]+>/g, '').trim()) {
      var quando = new Date(salvo.quando).toLocaleString('pt-BR');
      if (confirm('Há uma versão deste texto não salva no servidor, guardada neste navegador em ' + quando + '. Recuperar?')) {
        corpo.innerHTML = salvo.html;
        form.titulo.value = salvo.titulo || form.titulo.value;
        form.subtitulo.value = salvo.subtitulo || form.subtitulo.value;
        alterado = true;
      } else {
        localStorage.removeItem(chaveLocal);
      }
    }
  } catch (e) { /* ignora */ }

  corpo.addEventListener('input', atualizar);
  seletorTipo.addEventListener('change', function () { atualizarTipo(); atualizarMedidor(); });
  form.addEventListener('change', function () { alterado = true; });
  atualizarTipo();
  atualizarMedidor();

  form.addEventListener('submit', function () {
    campoHtml.value = corpo.innerHTML;
    alterado = false;
  });
  window.addEventListener('beforeunload', function (e) {
    if (alterado) { e.preventDefault(); e.returnValue = ''; }
  });
})();
