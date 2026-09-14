// Painel do lojista — auth, gestão de loja, clientes, mimos e pontos.
const $ = (id) => document.getElementById(id);
let currentShop = null;

const views = ["auth-view", "create-shop-view", "dashboard-view"];
function showView(id) {
  views.forEach((v) => $(v).classList.toggle("hidden", v !== id));
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---------- Autenticação ----------
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError("");
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const isSignup = $("auth-mode").dataset.mode === "signup";

  const { error } = isSignup
    ? await supabaseClient.auth.signUp({ email, password })
    : await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) return setAuthError(error.message);
  if (isSignup) return setAuthError("Conta criada! Verifique seu e-mail (se a confirmação estiver ativa) e faça login.", true);
  await boot();
});

$("toggle-auth-mode").addEventListener("click", () => {
  const mode = $("auth-mode");
  const isSignup = mode.dataset.mode === "signup";
  mode.dataset.mode = isSignup ? "login" : "signup";
  $("auth-title").textContent = isSignup ? "Entrar" : "Criar conta";
  $("auth-submit").textContent = isSignup ? "Entrar" : "Criar conta";
  $("toggle-auth-mode").textContent = isSignup ? "Não tem conta? Criar uma" : "Já tem conta? Entrar";
});

function setAuthError(msg, ok = false) {
  const el = $("auth-error");
  el.textContent = msg;
  el.classList.toggle("hidden", !msg);
  el.classList.toggle("text-emerald-600", ok);
  el.classList.toggle("text-rose-600", !ok);
}

$("logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  currentShop = null;
  showView("auth-view");
});

// ---------- Criar loja ----------
$("shop-name-input").addEventListener("input", (e) => {
  $("shop-slug-preview").textContent = slugify(e.target.value || "sua-loja");
});

$("create-shop-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("shop-name-input").value.trim();
  const points = parseInt($("shop-points-input").value, 10) || 1;
  const { data: userData } = await supabaseClient.auth.getUser();

  const { data, error } = await supabaseClient
    .from("shops")
    .insert({ owner_id: userData.user.id, name, slug: slugify(name), points_per_checkin: points })
    .select()
    .single();

  if (error) return alert("Erro ao criar loja: " + error.message);
  currentShop = data;
  renderDashboard();
});

// ---------- Boot ----------
async function boot() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return showView("auth-view");

  const { data: shops } = await supabaseClient.from("shops").select("*").limit(1);
  if (!shops || shops.length === 0) return showView("create-shop-view");

  currentShop = shops[0];
  renderDashboard();
}

// ---------- Dashboard ----------
async function renderDashboard() {
  showView("dashboard-view");
  $("dashboard-shop-name").textContent = currentShop.name;

  const link = `${location.origin}${location.pathname.replace("index.html", "")}checkin.html?loja=${currentShop.slug}`;
  $("checkin-link").href = link;
  $("checkin-link").textContent = link;
  $("qr-image").src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;

  await Promise.all([loadCustomers(), loadRewards()]);
}

async function loadCustomers() {
  const { data } = await supabaseClient
    .from("customer_balances")
    .select("*")
    .eq("shop_id", currentShop.id)
    .order("balance", { ascending: false });

  $("stat-customers").textContent = data?.length ?? 0;
  $("stat-points").textContent = (data || []).reduce((sum, c) => sum + c.balance, 0);

  $("customers-body").innerHTML = (data || [])
    .map((c) => `
      <tr class="border-b border-stone-100">
        <td class="py-2 px-3">${c.name || "—"}</td>
        <td class="py-2 px-3 text-stone-500">${c.phone}</td>
        <td class="py-2 px-3 text-right font-semibold text-amber-700">${c.balance}</td>
      </tr>`)
    .join("") || `<tr><td colspan="3" class="py-4 px-3 text-center text-stone-400">Nenhum cliente ainda.</td></tr>`;
}

async function loadRewards() {
  const { data } = await supabaseClient
    .from("rewards")
    .select("*")
    .eq("shop_id", currentShop.id)
    .order("points_required");

  $("rewards-list").innerHTML = (data || [])
    .map((r) => `
      <li class="flex items-center justify-between py-2 px-3 border-b border-stone-100">
        <span>${r.title}</span>
        <span class="text-sm font-semibold text-amber-700">${r.points_required} pts</span>
      </li>`)
    .join("") || `<li class="py-4 px-3 text-center text-stone-400">Nenhum mimo cadastrado ainda.</li>`;
}

$("reward-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("reward-title").value.trim();
  const points = parseInt($("reward-points").value, 10);

  const { error } = await supabaseClient
    .from("rewards")
    .insert({ shop_id: currentShop.id, title, points_required: points });

  if (error) return alert("Erro ao criar mimo: " + error.message);
  e.target.reset();
  loadRewards();
});

// ---------- Adicionar pontos manualmente (balcão) ----------
$("add-points-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = $("points-phone").value.trim();
  const name = $("points-name").value.trim();
  const points = parseInt($("points-amount").value, 10) || currentShop.points_per_checkin;

  const { data: customer, error: upsertError } = await supabaseClient
    .from("customers")
    .upsert({ shop_id: currentShop.id, phone, name: name || undefined }, { onConflict: "shop_id,phone" })
    .select()
    .single();

  if (upsertError) return alert("Erro: " + upsertError.message);

  const { error: txError } = await supabaseClient
    .from("point_transactions")
    .insert({ shop_id: currentShop.id, customer_id: customer.id, points });

  if (txError) return alert("Erro ao adicionar pontos: " + txError.message);

  e.target.reset();
  loadCustomers();
});

boot();
