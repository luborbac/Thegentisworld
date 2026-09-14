# Mimos — MVP de Fidelidade para Negócios Locais

Programa de fidelidade digital por QR Code para pequenos comércios (cafeterias, barbearias, estúdios de unhas etc.), sem maquininha e sem app. Arquitetura 100% gratuita: Supabase (Postgres + Auth) + HTML/Tailwind via CDN, hospedável de graça na Vercel/Netlify (é um site estático).

## Como funciona

1. O lojista cria uma conta e sua loja em `index.html` (painel do lojista).
2. O painel gera um QR Code único (`checkin.html?loja=<slug>`) para imprimir no balcão/mesa.
3. O cliente final escaneia, digita o telefone e ganha pontos automaticamente — sem login, sem app.
4. O lojista acompanha clientes, saldo de pontos e cadastra "mimos" (recompensas) resgatáveis, tudo no painel.

## Projeto Supabase

- **Nome:** `mimos-fidelidade-mvp` (projeto dedicado, separado do projeto GENTIS já existente na conta)
- **Project ID:** `kyopaqxmkgqhgrngjjzm`
- **URL:** `https://kyopaqxmkgqhgrngjjzm.supabase.co`
- As migrations deste diretório (`schema.sql`, `rls_policies.sql`) já foram aplicadas ao projeto via Supabase MCP. Para reproduzir em outro projeto: rode `schema.sql` e depois `rls_policies.sql` no SQL Editor do Supabase.

## Modelo de dados

| Tabela | O que guarda |
|---|---|
| `shops` | Lojistas (`owner_id` = usuário autenticado dono da loja) |
| `customers` | Clientes finais de cada loja, identificados por telefone (sem precisar de login) |
| `rewards` | "Mimos" — recompensas que a loja oferece por pontos |
| `point_transactions` | Ledger de pontos ganhos/resgatados por cliente |
| `customer_balances` | View com o saldo atual de pontos por cliente |

## Segurança (RLS)

- Cada lojista só enxerga/edita os dados da **sua própria loja** (`auth.uid() = owner_id`, propagado via `shop_id` nas demais tabelas).
- Nenhuma tabela é exposta à chave pública (`anon`). O único caminho de escrita/leitura pública é por duas funções `SECURITY DEFINER` explícitas e auditadas:
  - `get_shop_public(slug)` — retorna só nome/slug/pontos por check-in (sem dados sensíveis), usada pela página de check-in para identificar a loja.
  - `checkin_public(slug, telefone, nome)` — faz upsert do cliente e credita os pontos do check-in.
- `get_advisors` (Supabase) foi rodado após as migrations; o único item de nível `ERROR` (view rodando com privilégios do dono) foi corrigido com `security_invoker = true`. Os avisos restantes (`WARN`) são sobre as duas funções públicas acima — comportamento intencional, pois são a API pública por desenho.

## Arquivos

```
loyalty-mvp/
├── index.html          # Painel do lojista (auth, clientes, mimos, pontos, QR Code)
├── checkin.html         # Página pública de check-in (aberta ao escanear o QR Code)
├── schema.sql            # Tabelas, view e funções (espelha o que foi aplicado no Supabase)
├── rls_policies.sql      # Políticas de Row Level Security
└── js/
    ├── supabase-config.js  # URL + chave pública (publishable) do projeto
    ├── dashboard.js         # Lógica do painel do lojista
    └── checkin.js           # Lógica da página de check-in do cliente
```

## Rodando localmente

Como é um site estático, basta servir a pasta `loyalty-mvp/`:

```bash
cd loyalty-mvp && python3 -m http.server 8080
# abra http://localhost:8080
```

## Deploy gratuito

Suba a pasta `loyalty-mvp/` na [Vercel](https://vercel.com/) (ou Netlify) como site estático — nenhuma variável de ambiente é necessária, a chave pública já está em `js/supabase-config.js` (é segura para expor no client; o acesso real é controlado pelo RLS no banco).

## Próximos passos sugeridos

- Tela de resgate de mimos (debitar pontos ao trocar por uma recompensa).
- Confirmação de e-mail/telefone antes do primeiro check-in, para reduzir abuso.
- Métricas simples de retenção (clientes que voltaram no mês).
- Cobrança da mensalidade do lojista (ex: Stripe) quando sair do MVP gratuito.
