'use strict';
// Liga (ou desliga) a verificação em duas etapas da redação.
// Uso:  npm run 2fa          → gera um novo código secreto
//       npm run 2fa -- off   → desliga
const { db } = require('../src/db');
const auth = require('../src/auth');

const admin = auth.getAdmin();
if (!admin) { console.error('Crie a usuária antes:  npm run senha'); process.exit(1); }

if (process.argv[2] === 'off') {
  db.prepare('UPDATE admin SET totp_secret = NULL WHERE id = 1').run();
  console.log('Verificação em duas etapas desligada.');
  process.exit(0);
}

const secret = auth.newTotpSecret();
db.prepare('UPDATE admin SET totp_secret = ? WHERE id = 1').run(secret);
db.prepare('DELETE FROM sessions').run();
const label = encodeURIComponent(`Redação:${admin.username}`);
console.log(`
Verificação em duas etapas LIGADA.

1. Abra um app autenticador no celular (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).
2. Escolha "inserir chave manualmente" e digite:

     ${secret.match(/.{1,4}/g).join(' ')}

   (tipo: baseada em tempo, 6 dígitos)

   Ou, se o app aceitar um link, use:
     otpauth://totp/${label}?secret=${secret}&issuer=Redacao&digits=6&period=30

3. A partir de agora, o login pede o código de 6 dígitos que aparece no app.

Guarde a chave acima em lugar seguro: sem ela (ou sem o celular), só dá para entrar
desligando a verificação no servidor com:  npm run 2fa -- off
`);
