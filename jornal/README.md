# Jornal: vitrine pública + redação protegida

Site de jornalismo independente de opinião, assinado por Luciana Borba.

- **Vitrine (pública, sem login):** página inicial com manchete, editorias, página do texto (selo, título, linha fina, assinatura, botões de compartilhar, capa com crédito), arquivo, busca, página "Sobre" e feed RSS.
- **Redação (privada):** uma única usuária com senha. Ali você escreve, salva rascunhos, agenda, publica, despublica e exclui textos, e configura o jornal (nome, slogan, cor, editorias, bio e foto).

Nome: **Viés Independente**. Para trocar nome, slogan ou cor, entre na redação e vá em **Configurações**.

## Rodar no computador

Requer Node.js 20 ou mais novo.

```bash
cd jornal
npm install
npm run senha      # cria a usuária e a senha da redação
npm start
```

- Site: http://localhost:3000
- Redação: http://localhost:3000/redacao

## Escrevendo

- Não há limite de caracteres. O editor mostra **sugestões** de tamanho:
  | Tipo | Palavras sugeridas |
  |---|---|
  | Nota curta | 150–400 |
  | Editorial | 400–700 |
  | Crônica | 500–900 |
  | Artigo de opinião | 600–1.000 |
  | Coluna | 700–1.200 |
  | Análise | 1.000–2.000 |
  | Ensaio | 2.000–5.000 |
  
  O título tem sugestão de 30 a 80 caracteres; a linha fina, de 80 a 180.
- A barra de tamanho fica verde quando o texto está na faixa usual do tipo escolhido.
- Ao colar texto do Word ou do Google Docs, a formatação é limpa e os parágrafos são mantidos.
- Enquanto você escreve, o navegador guarda uma cópia de segurança. Se a página fechar sem salvar, ela é oferecida de volta.
- **Pré-visualizar** mostra o texto como o leitor verá, sem publicá-lo.
- **Data de publicação** no futuro agenda o texto. Ele aparece sozinho na hora marcada (horário de Brasília).
- **Modo foco** esconde tudo, menos o texto.

## Segurança da redação

- Senha guardada só como *hash* scrypt com sal. Nem quem tem acesso ao banco consegue lê-la.
- Bloqueio de 15 minutos depois de 5 tentativas erradas no mesmo IP (e 50 no total).
- Sessão com cookie `HttpOnly`, `Secure`, `SameSite=Strict`. Expira após 2 h sem uso ou 12 h no total. Trocar a senha encerra todas as sessões.
- Proteção contra CSRF (token em todo formulário e checagem de origem).
- O corpo dos textos passa por um filtro que remove scripts, `onclick`, `iframe`, links `javascript:` etc.
- Política de segurança de conteúdo (CSP) estrita, sem scripts inline. Proteção contra o site ser embutido em outro (clickjacking).
- Uploads: só imagens de verdade (o conteúdo do arquivo é conferido, não a extensão), até 8 MB, com nome aleatório.
- A redação não aparece em buscadores nem no `robots.txt`.

### Recomendado em produção

1. **Troque o endereço da redação** para algo difícil de adivinhar, com a variável `ADMIN_PATH` (ex.: `ADMIN_PATH=redacao-k7q2`).
2. (Opcional) **Ligue a verificação em duas etapas** (código do celular, como nos bancos):
   ```bash
   npm run 2fa
   ```
   Siga as instruções para cadastrar a chave no app autenticador. Para desligar: `npm run 2fa -- off`.
3. Use uma senha longa e única, que você não usa em nenhum outro lugar. Uma frase serve.
4. Faça backup regular da pasta `data/` (textos) e da pasta `uploads/` (imagens).

## Publicar na internet

O site precisa de um servidor Node.js com **disco persistente**, porque os textos ficam num banco SQLite em `data/`. O GitHub Pages não serve, pois só hospeda páginas estáticas. Opções simples:

- **Render** (Web Service + Disk), **Railway** (com Volume) ou **Fly.io** (com Volume);
- ou uma VPS (DigitalOcean, Hostinger, Locaweb…) com Nginx na frente.

Variáveis de ambiente:

| Variável | Para quê | Exemplo |
|---|---|---|
| `NODE_ENV` | ativa cookies seguros e HSTS (exige HTTPS) | `production` |
| `PORT` | porta do servidor | `3000` |
| `ADMIN_PATH` | endereço secreto da redação | `redacao-k7q2` |
| `DATA_DIR` | onde fica o banco (aponte para o disco persistente) | `/var/data/db` |
| `UPLOAD_DIR` | onde ficam as imagens (disco persistente) | `/var/data/uploads` |
| `TRUST_PROXY` | use `1` atrás de proxy (Render, Railway, Nginx) para o bloqueio por IP funcionar | `1` |
| `SITE_URL` | endereço oficial, usado nos links de compartilhamento e no RSS | `https://margem.com.br` |
| `ADMIN_USER` | nome de usuária da redação | `luciana` |
| `ADMIN_PASSWORD_HASH` | hash da senha (gerado com `npm run hash`). A senha em si nunca vai para o servidor. | `scrypt$32768$8$1$…` |

Comandos no host: build `npm install`, start `npm start`.

**Acesso da redação:** o jeito mais simples é preencher `ADMIN_USER` e `ADMIN_PASSWORD_HASH` no painel da hospedagem. Para trocar a senha, gere um novo hash com `npm run hash` e substitua a variável. Outra opção é rodar `npm run senha` no terminal do serviço. Nunca coloque a senha nem o hash em arquivos do repositório.

## Estrutura

```
server.js              servidor, cabeçalhos de segurança
src/db.js              banco SQLite e configurações
src/auth.js            senha, sessões, limite de tentativas, 2FA
src/content.js         filtro de HTML, contagem de palavras, tipos de texto
src/routes/public.js   vitrine
src/routes/admin.js    redação
views/                 páginas (EJS)
public/                CSS, JS, ícone
scripts/               npm run senha / npm run 2fa
```
