# GENTIS — Backend MVP

## Stack escolhida: Supabase (Postgres + Auth + API automática)

Para "gratuito e seguro" sem gerenciar servidor, **Supabase** é a escolha mais direta:

- **Banco**: Postgres real (não é um NoSQL limitado) — plano free inclui 500MB de banco, o suficiente para um MVP.
- **Auth**: login por e-mail/senha, magic link ou OAuth (Google, etc.) já pronto, sem você programar hashing de senha ou tokens.
- **API**: o Supabase gera automaticamente uma API REST (PostgREST) e uma API realtime a partir do schema — você não precisa escrever um backend Express/FastAPI do zero para o MVP.
- **Segurança**: Row Level Security (RLS) do Postgres garante, *no nível do banco*, que ninguém acesse a árvore genealógica de outra pessoa — mesmo que a chave pública da API vaze, o banco recusa a consulta.
- **Custo**: plano free cobre um MVP confortavelmente (2 projetos, 50k usuários autenticados/mês, 5GB de tráfego).

Se depois você precisar de lógica mais complexa (ex: algoritmo de matching de sobrenome+lugar mais sofisticado), dá pra adicionar **Supabase Edge Functions** (Deno, também no plano free) sem sair do ecossistema.

## Estrutura dos arquivos

| Arquivo | O que faz |
|---|---|
| `schema.sql` | Cria todas as tabelas: perfis, árvores, pessoas, relações, regiões, hipóteses de ancestralidade (com grau de certeza), fórum de reuniões e alertas de match. |
| `rls_policies.sql` | Ativa as políticas de segurança: dados genealógicos são privados ao dono; regiões e fórum são públicos para leitura. |
| `seed.sql` | Um exemplo de região (Costa do Mina) para você já ter algo pra testar na tela de Region. |

## Passo a passo para subir

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) e um novo projeto.
2. No painel, vá em **SQL Editor** → cole e rode `schema.sql`.
3. Rode `rls_policies.sql` em seguida.
4. (Opcional, para já ter dado de teste) rode `seed.sql`.
5. Em **Project Settings → API**, copie a `URL` do projeto e a chave `anon public` — são as duas únicas credenciais que o frontend precisa.
6. No seu site (ou app cliente), instale o SDK: `npm install @supabase/supabase-js` e conecte com essas duas credenciais.

A partir daí, toda operação (criar árvore, adicionar pessoa, postar no fórum) é uma chamada direta do frontend para o Supabase — sem servidor intermediário pra manter.

## Modelo de dados, em resumo

- **family_trees** → pertence a um usuário (`owner_id`).
- **people** → nós da árvore; podem ser "placeholders" (ancestral desconhecido, o "convite aberto" que aparece no site).
- **relationships** → liga duas pessoas (`parent_of` ou `spouse_of`).
- **regions** → conteúdo curado (não editável pelo usuário comum) — timeline, povos/reinos, comida, festivais.
- **ancestry_hypotheses** → conecta uma árvore/pessoa a uma região, sempre com um `certainty_code` (`likely` / `possible` / `compatible`) — é a "regra de honestidade" do site virando dado estruturado.
- **forum_threads / forum_replies** → Reunions, com tags de sobrenome e lugar pra permitir busca/match.
- **match_alerts** → usuário opta por ser notificado quando alguém postar com sobrenome+lugar parecido.

## Próximos passos sugeridos

- Popular `regions` com conteúdo histórico real (hoje só tem um placeholder de exemplo).
- Decidir se o matching de sobrenome+lugar roda por busca simples (`ilike`) ou por uma Edge Function com lógica fuzzy (nomes têm grafias variantes).
- Definir política de moderação para o fórum antes de abrir ao público.
