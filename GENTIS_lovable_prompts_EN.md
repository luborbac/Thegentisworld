# GENTIS — Lovable Prompts (English)
> Paste one prompt at a time, in this order. After each generation, review, then continue with the next.

---

## PROMPT 1 — Master / Foundation

Build a web app called GENTIS — a genealogy and cultural platform that helps Black and Indigenous people reconstruct ancestries erased by forced diaspora and slavery. The product's core principle: **UI language and cultural content are two independent axes**. The UI is available in 7 languages (PT, ES, EN, DE, FR, ZH, IT) using an i18n key system (e.g., t.home.tagline). Cultural content (regions, peoples, flora, fauna, timelines) is keyed by the user's ancestral region — never by UI language. Example: a German-speaking user with Ghanaian ancestry sees all UI in German but all cultural content about Ghana and the Gulf of Benin.

Design system: primary terracotta #B4552D, secondary forest green #3E5F45, accent golden ochre #D9A441, background sand #F5EFE4, text charcoal #2B2620. Warm serif for headings, clean sans-serif for body. Tone: warm, human, never academic-cold, never condescending.

CRITICAL HONESTY RULE: the app never states an origin as absolute fact. Every hypothesis carries a visible certainty badge: Likely (green), Possible (yellow), Compatible with (blue).

Home page: hero with the tagline "Your people have a name." and a search field "Enter your grandmother's surname"; three promise cards — Reconstruct (family tree), Recognize (living culture), Reunite (community); an honesty block explaining the certainty levels ("History that was meant to be erased left no certificates — so we work with degrees of certainty"); CTA "Start with what you have. One name is enough."; footer with a 7-language selector.

---

## PROMPT 2 — Onboarding ("Enter what you have" — everything optional)

Build the onboarding flow. Every step is optional, and the persistent message is "It's okay if it's little."

Step 1 — Names: grandparents / great-grandparents / parents, with extra fields for former surnames, nicknames, and spelling variants (e.g., "Souza / Sousa / Souzza"), because old records often misspelled names.

Step 2 — Dates: birth dates with an "I don't know the exact year — it was around…" option: a decade selector plus a margin-of-error field.

Step 3 — Places: birthplace OR the place where the family lived longest (city/state/country).

Step 4 — Oral fragments: free-text area + audio upload for stories told by grandparents, expressions, recipes, songs. Explain in one friendly line: "These carry language and regional clues — they count as much as documents."

Step 5 — DNA (optional, coming soon): make it visually clear DNA is a future optional complement, never a requirement.

Final screen: a panel called "Our first clues" listing origin hypotheses, each with its certainty badge (Likely / Possible / Compatible with).

---

## PROMPT 3 — Gap-tolerant family tree

Build the family tree view. It must be tolerant of gaps: unknown nodes show an elegant "?" styled as an invitation — "This branch awaits a memory" — never as an error state. Each node shows: name, approximate decade, place, and a certainty badge. Each node has a button "Tell what you know" opening a modal for audio / text / document photo. Top bar shows current region hypotheses, e.g., "Gulf of Benin (Possible) · Quilombo do Carmo (Likely)". Empty states should be beautiful and hopeful, not sad.

---

## PROMPT 4 — The Region tab (most important screen)

Build the Region tab, the emotional heart of the app. It opens when an ancestral region is identified. Full-screen header with a photograph/illustration of the region's biome, the region name, and the local-language word for "ancestral land" with a play button for audio pronunciation (seed example: Yoruba "ìpìnlẹ̀").

Four sub-tabs:

1. **Timeline by decades** — a horizontal-scroll timeline where each decade shows two parallel cards: "In the region…" (local events) and "In the world…" (global context). Seed content: Costa do Mina (Gulf of Benin), 1480s to present.

2. **Peoples and kingdoms** — an interactive map area with cards for each people/kingdom: Dahomey, Oyo, Allada, Whydah, Ashanti, Benin Empire, Yoruba (Nagô), Fon (Jeje). Each card: social organization, historical territory, known trajectories, and its presence in Brazil (nations Nagô and Jeje).

3. **Living culture** — food, music, language, religion, festivals that still exist today and that the user might recognize in their own family without knowing the origin. Seed examples: acarajé, caruru, the afoxé Filhos de Gandhi, orixás, the 1835 Malê Revolt, Yoruba words in Brazilian Portuguese (axé, agogô).

4. **"The Land They Saw"** — a sensory walk through the biome: dawn bird sounds (real recorded audio), the river, the trees, the fruits. Flora section includes a special block "Plants that crossed the Atlantic": oil palm (dendê), okra, black-eyed pea, yam — the same plant on both sides of the ocean as visual proof of the ancestors' route; plus reverse crossings (cassava, peanut, cashew went Americas → Africa). Fauna section: totemic animals (leopard — royal symbol of Dahomey; sacred python of Ouidah), animals of domestic memory (guineafowl — the "galinha d'angola"), sacred animals of the orixás (dog of Ogun, white egret of Oxalá), and legend-linked fauna (Anansi). Every item connects explicitly to ancestral daily life — experience, not encyclopedia.

Every historical claim in this tab displays its certainty badge where the record is fragmentary.

---

## PROMPT 5 — Community & Privacy

Build the Community tab ("Reunions"): forums grouped by region, a bulletin board "I am looking for descendants of…", and surname+place match alerts. Emphasize real-world reunion networks over solitary results. Include moderation and privacy granularity (the user chooses exactly what is public).

Build the Privacy & Settings screen: strong stance — encrypted family data, full data export and deletion, granular sharing controls, and a clear written promise: "We never sell genealogical data. Never."

---

## Note
Build Prompt 4 first using the seed content in GENTIS_regiao_modelo_costa_do_mina.md (region Costa do Mina) before generalizing to other regions.
