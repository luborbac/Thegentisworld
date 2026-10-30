'use strict';
// Cria ou troca a usuária única da redação.  Uso:  npm run senha
// Para automatizar (ex.: no primeiro deploy): ADMIN_USER=... ADMIN_PASSWORD=... npm run senha
const readline = require('readline');
const auth = require('../src/auth');

function ask(question, hidden) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = s => { if (s.includes(question)) rl.output.write(s); else rl.output.write('*'); };
    }
    rl.question(question, answer => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer); });
  });
}

(async () => {
  const atual = auth.getAdmin();
  let user = process.env.ADMIN_USER, pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) {
    user = (await ask(`Nome de usuária${atual ? ` [${atual.username}]` : ''}: `)).trim() || (atual && atual.username);
    pass = await ask('Senha (mínimo 12 caracteres, com letras e números): ', true);
    const confirma = await ask('Repita a senha: ', true);
    if (pass !== confirma) { console.error('As senhas não conferem.'); process.exit(1); }
  }
  if (!user || !/^[\w.@-]{3,60}$/.test(user)) { console.error('Usuária inválida (3 a 60 caracteres: letras, números, . _ - @).'); process.exit(1); }
  const problemas = auth.passwordProblems(pass, user);
  if (problemas.length) { console.error(problemas.join('\n')); process.exit(1); }
  auth.setAdmin(user, pass);
  console.log(`Pronto. Usuária "${user}" salva. Todas as sessões abertas foram encerradas.`);
})();
