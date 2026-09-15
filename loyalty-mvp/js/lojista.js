// Painel do lojista — auth, loja, clientes (busca), mimos, scanner de carteira.
const $ = (id) => document.getElementById(id);
let currentShop = null;
let allCustomers = [];
let activeRewards = [];
let scannedCustomer = null;

const views = ["loading-view", "role-guard-view", "create-shop-view", "dashboard-view"];
function showView(id) {
  views.forEach((v) => $(v).classList.toggle("hidden", v !== id));
}

function slugify(text) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------- Boot ----------
async function boot() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return (location.href = "index.html");

  const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", session.user.id).single();
  if (profile?.role !== "lojista") return showView("role-guard-view");

  const { data: shops } = await supabaseClient.from("shops").select("*").limit(1);
  if (!shops || shops.length === 0) return showView("create-shop-view");

  currentShop = shops[0];
  renderDashboard();
}

$("logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.href = "index.html";
});

// ---------- Criar loja ----------
$("shop-name-input").addEventListener("input", (e) => {
  $("shop-slug-preview").textContent = slugify(e.target.value || "sua-loja");
});

let capturedLocation = null;
$("use-location-btn").addEventListener("click", () => {
  const status = $("location-status");
  status.textContent = "Buscando localização...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      capturedLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      status.textContent = `Localização capturada ✓ (${capturedLocation.lat.toFixed(4)}, ${capturedLocation.lng.toFixed(4)})`;
    },
    () => (status.textContent = "Não foi possível obter sua localização."),
  );
});

$("create-shop-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("shop-name-input").value.trim();
  const address = $("shop-address-input").value.trim();
  const points = parseInt($("shop-points-input").value, 10) || 1;
  const { data: userData } = await supabaseClient.auth.getUser();

  const { data, error } = await supabaseClient
    .from("shops")
    .insert({
      owner_id: userData.user.id, name, slug: slugify(name), address: address || null,
      points_per_checkin: points, lat: capturedLocation?.lat, lng: capturedLocation?.lng,
    })
    .select().single();

  if (error) return alert("Erro ao criar loja: " + error.message);
  currentShop = data;
  renderDashboard();
});

// ---------- Dashboard ----------
async function renderDashboard() {
  showView("dashboard-view");
  $("dashboard-shop-name").textContent = currentShop.name;
  $("settings-name").value = currentShop.name;
  $("settings-address").value = currentShop.address || "";
  $("settings-points").value = currentShop.points_per_checkin;
  await Promise.all([loadCustomers(), loadRewards()]);
}

async function loadCustomers() {
  const { data } = await supabaseClient
    .from("customer_balances").select("*").eq("shop_id", currentShop.id).order("balance", { ascending: false });
  allCustomers = data || [];
  $("stat-customers").textContent = allCustomers.length;
  $("stat-points").textContent = allCustomers.reduce((sum, c) => sum + c.balance, 0);
  renderCustomerList(allCustomers);
}

function renderCustomerList(list) {
  $("customers-body").innerHTML = list.map((c) => `
      <tr class="border-b border-slate-100 last:border-0">
        <td class="py-3 px-4 font-medium text-slate-700">${c.name || "Sem nome"}</td>
        <td class="py-3 px-4 text-slate-500">${c.phone || "—"}</td>
        <td class="py-3 px-4 text-right font-semibold text-indigo-700">${c.balance}</td>
      </tr>`).join("") ||
    `<tr><td colspan="3" class="py-6 px-4 text-center text-slate-400">Nenhum cliente ainda. Escaneie o QR de alguém para começar.</td></tr>`;
}

$("customer-search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = !q ? allCustomers : allCustomers.filter(
    (c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q),
  );
  renderCustomerList(filtered);
});

async function loadRewards() {
  const { data } = await supabaseClient.from("rewards").select("*").eq("shop_id", currentShop.id).order("points_required");
  activeRewards = (data || []).filter((r) => r.active);
  $("rewards-list").innerHTML = (data || []).map((r) => `
      <li class="flex items-center justify-between py-2.5 px-1 border-b border-slate-100 last:border-0">
        <span class="text-slate-700">${r.title}</span>
        <span class="text-sm font-semibold text-indigo-700 bg-indigo-50 rounded-full px-2.5 py-0.5">${r.points_required} pts</span>
      </li>`).join("") || `<li class="py-6 text-center text-slate-400">Nenhum mimo cadastrado ainda.</li>`;
}

$("reward-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("reward-title").value.trim();
  const points = parseInt($("reward-points").value, 10);
  const { error } = await supabaseClient.from("rewards").insert({ shop_id: currentShop.id, title, points_required: points });
  if (error) return alert("Erro ao criar mimo: " + error.message);
  e.target.reset();
  loadRewards();
});

// ---------- Configurações da loja ----------
$("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const updates = {
    name: $("settings-name").value.trim(),
    address: $("settings-address").value.trim() || null,
    points_per_checkin: parseInt($("settings-points").value, 10) || 1,
  };
  if (capturedLocation) { updates.lat = capturedLocation.lat; updates.lng = capturedLocation.lng; }

  const { data, error } = await supabaseClient.from("shops").update(updates).eq("id", currentShop.id).select().single();
  if (error) return alert("Erro: " + error.message);
  currentShop = data;
  $("dashboard-shop-name").textContent = currentShop.name;
  $("settings-saved").classList.remove("hidden");
  setTimeout(() => $("settings-saved").classList.add("hidden"), 2000);
});

// ---------- Scanner: escanear carteira do cliente ----------
$("open-scanner-btn").addEventListener("click", () => {
  $("scan-result").classList.add("hidden");
  $("scan-error").classList.add("hidden");
  openQrScanner({ onResult: handleScanResult });
});

async function handleScanResult(walletCode) {
  const { data, error } = await supabaseClient.rpc("scan_wallet", { p_wallet_code: walletCode });
  const customer = data?.[0];
  if (error || !customer) {
    $("scan-error").textContent = "QR Code inválido ou cliente não encontrado.";
    return $("scan-error").classList.remove("hidden");
  }
  scannedCustomer = { ...customer, walletCode };
  $("scan-customer-name").textContent = customer.name || "Cliente";
  $("scan-customer-phone").textContent = customer.phone || "";
  $("scan-add-points").value = currentShop.points_per_checkin;
  $("scan-reward-select").innerHTML =
    `<option value="">Trocar por um mimo...</option>` +
    activeRewards.map((r) => `<option value="${r.id}">${r.title} (${r.points_required} pts)</option>`).join("");
  $("scan-result").classList.remove("hidden");
}

$("scan-add-btn").addEventListener("click", async () => {
  const points = parseInt($("scan-add-points").value, 10) || currentShop.points_per_checkin;
  const { error } = await supabaseClient.rpc("add_points_via_scan", {
    p_wallet_code: scannedCustomer.walletCode, p_shop_id: currentShop.id, p_points: points,
  });
  if (error) return alert("Erro: " + error.message);
  $("scan-result").classList.add("hidden");
  loadCustomers();
});

$("scan-redeem-btn").addEventListener("click", async () => {
  const rewardId = $("scan-reward-select").value;
  if (!rewardId) return alert("Escolha um mimo para resgatar.");
  const { error } = await supabaseClient.rpc("redeem_reward_via_scan", {
    p_wallet_code: scannedCustomer.walletCode, p_shop_id: currentShop.id, p_reward_id: rewardId,
  });
  if (error) return alert("Erro: " + error.message);
  $("scan-result").classList.add("hidden");
  loadCustomers();
});

boot();
