'use strict';
// Gera o hash da senha para a variável ADMIN_PASSWORD_HASH da hospedagem.
// Uso:  npm run hash   (a senha é digitada sem aparecer na tela e não é gravada)
const readline = require('readline');
const auth = require('../src/auth');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const pergunta = 'Senha: ';
rl._writeToOutput = s => rl.output.write(s.includes(pergunta) ? s : '*');
rl.question(pergunta, senha => {
  rl.close();
  process.stdout.write('\n');
  const problemas = auth.passwordProblems(senha);
  if (problemas.length) { console.error(problemas.join('\n')); process.exit(1); }
  console.log('\nCopie a linha abaixo para a variável ADMIN_PASSWORD_HASH:\n');
  console.log(auth.hashPassword(senha));
});
