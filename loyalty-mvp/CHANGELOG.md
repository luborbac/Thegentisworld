# Changelog — Mimos (Fidelidade Local)

Histórico de versões do projeto, com o que mudou e por quê. Datas em UTC.

## v2.1 — Redesign visual + funcionalidades do painel (2026-09-15)

**Motivação:** o painel funcional (v2) estava feio/genérico; era preciso um visual "moderno e sofisticado" e faltava fechar pontas do painel do lojista.

- Modo escuro/claro em todas as páginas (toggle, persistido em `localStorage`, respeita `prefers-color-scheme`).
- Fonte Plus Jakarta Sans, cards com ícones, avatares com iniciais.
- Painel do lojista:
  - 4 estatísticas reais (clientes, pontos em circulação, mimos resgatados, pontuações hoje) — nenhum número decorativo/fictício.
  - Ações rápidas por cliente na tabela: **+1 ponto** direto e **"Ações"** (reaproveita o `wallet_code` já carregado, sem precisar escanear de novo) para adicionar pontos ou resgatar um mimo.
  - Atalhos de pontos (+1/+2/+5) no painel de ações.
  - Exportar lista de clientes em CSV.
  - Card "Convide clientes": QR + link (`cliente.html?loja=slug`) para descoberta da loja — **não** é um retorno ao check-in por telefone (ver v2 abaixo), é só divulgação.
- App do cliente: abre a loja automaticamente quando acessado via `?loja=slug` (o link/QR de convite acima).
- Sincronizado manualmente para o repositório de deploy `luborbac/mimos-fidelidade-mvp1` (ver seção "Topologia de deploy" no README).

## v2 — Carteira digital + papéis (lojista/cliente) (2026-09-14/15)

**Motivação:** o fluxo v1 (cliente digita telefone para pontuar) não tinha identidade real de cliente, não permitia um app do lado do cliente, e o pedido explícito foi trocar para "lojista lê o QR do cliente".

- Nova tabela `profiles`: cada usuário autenticado tem um `role` (`lojista`/`cliente`) e um `wallet_code` único — é o conteúdo do QR pessoal do cliente.
- `shops` ganhou `description`, `address`, `lat`/`lng` para o mapa.
- `customers` (telefone, sem login) foi **substituída** por `shop_members` (vínculo cliente autenticado ↔ loja).
- Novas RPCs `SECURITY DEFINER`: `list_shops_public`/`get_shop_public` (descoberta pública), `scan_wallet`/`add_points_via_scan`/`redeem_reward_via_scan` (mecanismo de escaneamento, restrito a lojistas autenticados e validado contra `owner_id`), `get_my_wallet`.
- `checkin_public` (v1, autocheck-in por telefone) foi **removida**.
- Dados de teste da v1 (1 cliente fictício por telefone) foram descartados na migration — não havia identidade de usuário equivalente para migrar.
- Novo `index.html` (escolha de papel + login/cadastro), `lojista.html` (reconstruído com o scanner de câmera via jsQR), `cliente.html` (novo: busca de lojas, mapa Leaflet + OpenStreetMap, geolocalização, carteira pessoal).
- `checkin.html`/`js/checkin.js`/`js/dashboard.js` removidos (obsoletos).
- `get_advisors` rodado após cada migration; avisos restantes são intencionais (funções públicas por desenho).

## v1 — MVP inicial (2026-09-14)

- Primeira versão: lojista cria conta/loja, gera um QR fixo da loja; cliente escaneia esse QR, digita telefone e ganha pontos automaticamente (`checkin_public`, sem login do cliente).
- Schema inicial: `shops`, `customers` (por telefone), `rewards`, `point_transactions`, view `customer_balances`.
- Projeto Supabase dedicado criado (`mimos-fidelidade-mvp`, plano free), separado do projeto GENTIS já existente na conta.
- Task registrada no ClickUp (espaço "VibeCoder Pipeline de Empreendimentos").
- Deploy manual (drag-and-drop) no Netlify, projeto `mimos-fidelidade-mvp` (plano free).
