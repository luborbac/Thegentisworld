# Mimos — MVP de Fidelidade para Negócios Locais

Programa de fidelidade digital com carteira QR para pequenos comércios (cafeterias, barbearias, estúdios de unhas etc.). Arquitetura 100% gratuita: Supabase (Postgres + Auth) + HTML/Tailwind via CDN, hospedável de graça na Vercel/Netlify (é um site estático).

## Links úteis

- **Site em produção:** https://mimos-fidelidade-mvp.netlify.app
- **PR de desenvolvimento:** https://github.com/luborbac/Thegentisworld/pull/2
- **Repositório de deploy (Netlify):** https://github.com/luborbac/mimos-fidelidade-mvp1
- **Painel Netlify:** https://app.netlify.com/projects/mimos-fidelidade-mvp
- **Projeto Supabase:** https://supabase.com/dashboard/project/kyopaqxmkgqhgrngjjzm
- **Task ClickUp:** https://app.clickup.com/t/86e391h17
- **Histórico de versões:** ver `CHANGELOG.md`

## Como funciona (v2 — carteira digital)

1. Ao entrar em `index.html`, a pessoa escolhe se é **lojista** 🏪 ou **cliente** 🙋 e cria a conta.
2. **Lojista** cai em `lojista.html`: cria a loja (nome, endereço, geolocalização, pontos por visita), cadastra mimos e usa o botão **"Escanear QR do cliente"** (câmera do celular/computador) para creditar pontos ou resgatar um mimo.
3. **Cliente** cai em `cliente.html`: busca lojas por nome, vê um mapa com geolocalização (lojas próximas), abre o detalhe de cada loja (mimos disponíveis, saldo de pontos) e tem uma **carteira pessoal** com um QR Code único — é esse QR que ele mostra no balcão para o lojista escanear.
4. Sem telefone digitado, sem app nativo: tudo roda no navegador.

## Projeto Supabase

- **Nome:** `mimos-fidelidade-mvp` (projeto dedicado, separado do projeto GENTIS já existente na conta)
- **Project ID:** `kyopaqxmkgqhgrngjjzm`
- **URL:** `https://kyopaqxmkgqhgrngjjzm.supabase.co`
- As migrations deste diretório (`schema.sql`, `rls_policies.sql`) já foram aplicadas ao projeto via Supabase MCP. Para reproduzir em outro projeto: rode `schema.sql` e depois `rls_policies.sql` no SQL Editor do Supabase.

## Modelo de dados

| Tabela/View | O que guarda |
|---|---|
| `profiles` | Um por usuário autenticado — `role` (`lojista`/`cliente`), nome, telefone e `wallet_code` (conteúdo do QR pessoal) |
| `shops` | Lojas — nome, endereço, `lat`/`lng` (mapa), pontos por visita |
| `rewards` | "Mimos" — recompensas que a loja oferece por pontos |
| `shop_members` | Vínculo cliente ↔ loja (criado no primeiro scan) |
| `point_transactions` | Ledger de pontos ganhos/resgatados |
| `customer_balances` | View com o saldo atual de pontos por cliente/loja |

## Segurança (RLS)

- Cada lojista só enxerga/edita os dados da **sua própria loja**; cada cliente só vê o **próprio perfil, carteira e histórico**.
- Nenhuma tabela sensível é exposta à chave pública (`anon`). A API pública é só um conjunto de funções `SECURITY DEFINER` auditadas:
  - `list_shops_public` / `get_shop_public` — descoberta de lojas (busca + mapa), sem dados sensíveis.
  - `scan_wallet` — resolve o QR escaneado para nome/telefone do cliente; só funciona se quem chama for dono de alguma loja.
  - `add_points_via_scan` / `redeem_reward_via_scan` — creditam/resgatam pontos; validam internamente que a loja pertence a quem chama antes de agir.
  - `get_my_wallet` — o próprio cliente busca seu `wallet_code` para gerar o QR pessoal.
- `get_advisors` (Supabase) foi rodado após cada migration; os únicos avisos restantes são sobre essas funções públicas por desenho (`WARN`, esperado) e o toggle de "leaked password protection" do Supabase Auth (configurável no painel, fora do escopo do schema).

## Arquivos

```
loyalty-mvp/
├── index.html            # Entrada: escolha de papel + login/cadastro
├── lojista.html           # Painel do lojista (scanner, clientes, mimos, config.)
├── cliente.html            # App do cliente (busca, mapa, carteira/QR pessoal)
├── schema.sql              # Tabelas, view e funções (espelha o Supabase)
├── rls_policies.sql        # Políticas de Row Level Security
└── js/
    ├── supabase-config.js  # URL + chave pública do projeto
    ├── auth.js              # Login/cadastro com escolha de papel
    ├── qr-scanner.js         # Leitura de QR via câmera (jsQR)
    ├── lojista.js             # Lógica do painel do lojista
    └── cliente.js              # Lógica do app do cliente (mapa, busca, carteira)
```

## Bibliotecas usadas (todas gratuitas, sem chave de API)

- **Tailwind CSS** via CDN — estilo.
- **Leaflet.js + OpenStreetMap** — mapa e marcadores das lojas (sem Google Maps, sem cobrança).
- **jsQR** — leitura de QR Code direto da câmera, client-side.
- **api.qrserver.com** — geração de imagem do QR Code (carteira do cliente).
- **Geolocation API do navegador** — "usar minha localização" (lojista) e "lojas perto de mim" (cliente); cálculo de distância é feito localmente (fórmula de Haversine), sem serviço pago de geocodificação.

## Rodando localmente

```bash
cd loyalty-mvp && python3 -m http.server 8080
# abra http://localhost:8080
```

## Deploy gratuito

Suba a pasta `loyalty-mvp/` na Vercel ou Netlify como site estático (arrastar-e-soltar ou linkar o repositório) — nenhuma variável de ambiente é necessária, a chave pública já está em `js/supabase-config.js` (segura para expor no client; o acesso real é controlado pelo RLS no banco).

## Topologia de deploy (2 repositórios — importante)

Este projeto vive em **dois** repositórios GitHub com papéis diferentes:

| Repositório | Papel |
|---|---|
| [`luborbac/Thegentisworld`](https://github.com/luborbac/Thegentisworld), pasta `loyalty-mvp/` | **Fonte de verdade.** Todo o desenvolvimento acontece aqui, via [PR #2](https://github.com/luborbac/Thegentisworld/pull/2). |
| [`luborbac/mimos-fidelidade-mvp1`](https://github.com/luborbac/mimos-fidelidade-mvp1) | **Espelho de deploy.** É o repo que o Netlify observa (`main` = auto-publish). Criado pelo próprio painel do Netlify ("Link to a Git repository"). |

**Por quê dois repos?** O Netlify só linka um site a um repositório próprio dele; `Thegentisworld` é um repositório maior (tem outros projetos, como o GENTIS) e não fazia sentido publicar o repositório inteiro. A solução foi manter o código real em `loyalty-mvp/` dentro de `Thegentisworld` e replicar o **conteúdo** desse diretório (sem o prefixo de pasta) na raiz do repo de deploy.

**Fluxo para publicar uma mudança:**
1. Editar/commitar em `Thegentisworld` (pasta `loyalty-mvp/`), normalmente.
2. Copiar o conteúdo atualizado de `loyalty-mvp/` para a raiz do clone de `mimos-fidelidade-mvp1`.
3. Commit + `git push origin main` nesse segundo repo.
4. Netlify detecta o push e publica automaticamente em `mimos-fidelidade-mvp.netlify.app` (leva poucos segundos).

Não há CI automatizando esse espelhamento ainda — é manual a cada rodada de mudanças. Ver `CHANGELOG.md` para o histórico de quando cada sincronização aconteceu.

## Próximos passos sugeridos

- Histórico de transações visível para o cliente (extrato de pontos).
- Avaliações/fotos das lojas na busca do cliente.
- Notificação ao lojista quando um cliente estiver perto de resgatar um mimo.
- Cobrança da mensalidade do lojista (ex: Stripe) quando sair do MVP gratuito.
