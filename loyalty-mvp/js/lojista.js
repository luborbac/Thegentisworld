// Painel do lojista — auth, loja, clientes (busca), mimos, scanner de carteira.
const $ = (id) => document.getElementById(id);
let currentShop = null;
let myProfile = null;
let allCustomers = [];
let activeRewards = [];
let actionsCustomer = null; // { customer_id, name, phone, walletCode }

const views = ["loading-view", "role-guard-view", "create-shop-view", "dashboard-view"];
function showView(id) {
  views.forEach((v) => $(v).classList.toggle("hidden", v !== id));
}

function slugify(text) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

// ---------- Boot ----------
async function boot() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return (location.href = "index.html");

  const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", session.user.id).single();
  if (profile?.role !== "lojista") return showView("role-guard-view");
  myProfile = profile;

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
  $("dashboard-shop-address").textContent = currentShop.address || "Endereço não informado";
  $("owner-name").textContent = myProfile?.name || "Lojista";
  $("owner-initials").textContent = initials(myProfile?.name);
  $("settings-name").value = currentShop.name;
  $("settings-address").value = currentShop.address || "";
  $("settings-points").value = currentShop.points_per_checkin;

  const shareLink = `${location.origin}${location.pathname.replace("lojista.html", "")}cliente.html?loja=${currentShop.slug}`;
  $("share-link").href = shareLink;
  $("share-link").textContent = shareLink;
  $("share-qr").src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareLink)}`;
  $("copy-link-btn").onclick = () => {
    navigator.clipboard.writeText(shareLink);
    $("copy-link-btn").textContent = "Copiado ✓";
    setTimeout(() => ($("copy-link-btn").textContent = "Copiar link"), 1500);
  };

  await Promise.all([loadCustomers(), loadRewards(), loadStats()]);
}

async function loadStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: redeemedCount }, { count: todayCount }] = await Promise.all([
    supabaseClient.from("point_transactions").select("id", { count: "exact", head: true })
      .eq("shop_id", currentShop.id).not("reward_id", "is", null),
    supabaseClient.from("point_transactions").select("id", { count: "exact", head: true })
      .eq("shop_id", currentShop.id).gte("created_at", todayStart.toISOString()),
  ]);

  $("stat-rewards-redeemed").textContent = redeemedCount ?? 0;
  $("stat-today").textContent = todayCount ?? 0;
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
      <tr class="border-b border-slate-100 dark:border-slate-700 last:border-0">
        <td class="py-3 px-4">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center">${initials(c.name)}</span>
            <span class="font-medium text-slate-700 dark:text-slate-200">${c.name || "Sem nome"}</span>
          </div>
        </td>
        <td class="py-3 px-4 text-slate-500 dark:text-slate-400">${c.phone || "—"}</td>
        <td class="py-3 px-4 text-right font-semibold text-indigo-700 dark:text-indigo-300">${c.balance}</td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          <button data-quick-add="${c.wallet_code}" title="+1 ponto" class="row-action inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 text-slate-600 dark:text-slate-300 font-bold text-sm">+</button>
          <button data-open="${c.wallet_code}" data-name="${(c.name || "").replace(/"/g, "&quot;")}" data-phone="${c.phone || ""}" data-id="${c.customer_id}" class="row-action ml-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline">Ações</button>
        </td>
      </tr>`).join("") ||
    `<tr><td colspan="4" class="py-8 px-4 text-center text-slate-400 dark:text-slate-500">Nenhum cliente ainda. Escaneie o QR de alguém para começar.</td></tr>`;

  $("customers-body").querySelectorAll("[data-quick-add]").forEach((btn) =>
    btn.addEventListener("click", () => quickAddPoint(btn.dataset.quickAdd)),
  );
  $("customers-body").querySelectorAll("[data-open]").forEach((btn) =>
    btn.addEventListener("click", () =>
      openCustomerActions({ customer_id: btn.dataset.id, name: btn.dataset.name, phone: btn.dataset.phone, walletCode: btn.dataset.open }),
    ),
  );
}

async function quickAddPoint(walletCode) {
  const { error } = await supabaseClient.rpc("add_points_via_scan", {
    p_wallet_code: walletCode, p_shop_id: currentShop.id, p_points: 1,
  });
  if (error) return alert("Erro: " + error.message);
  loadCustomers();
}

$("customer-search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = !q ? allCustomers : allCustomers.filter(
    (c) => (c.name || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q),
  );
  renderCustomerList(filtered);
});

$("export-csv-btn").addEventListener("click", () => {
  const rows = [["Nome", "Telefone", "Pontos"], ...allCustomers.map((c) => [c.name || "", c.phone || "", c.balance])];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `clientes-${currentShop.slug}.csv`;
  a.click();
});

async function loadRewards() {
  const { data } = await supabaseClient.from("rewards").select("*").eq("shop_id", currentShop.id).order("points_required");
  activeRewards = (data || []).filter((r) => r.active);
  $("rewards-list").innerHTML = (data || []).map((r) => `
      <li class="flex items-center justify-between py-2.5 px-1 border-b border-slate-100 dark:border-slate-700 last:border-0">
        <span class="text-slate-700 dark:text-slate-200">${r.title}</span>
        <span class="text-sm font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/20 rounded-full px-2.5 py-0.5">${r.points_required} pts</span>
      </li>`).join("") || `<li class="py-6 text-center text-slate-400 dark:text-slate-500">Nenhum mimo cadastrado ainda.</li>`;
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
  $("dashboard-shop-address").textContent = currentShop.address || "Endereço não informado";
  $("settings-saved").classList.remove("hidden");
  setTimeout(() => $("settings-saved").classList.add("hidden"), 2000);
});

// ---------- Scanner: escanear carteira do cliente ----------
$("open-scanner-btn").addEventListener("click", () => {
  $("scan-error").classList.add("hidden");
  $("scan-result").classList.add("hidden");
  openQrScanner({ onResult: handleScanResult });
});

async function handleScanResult(walletCode) {
  const { data, error } = await supabaseClient.rpc("scan_wallet", { p_wallet_code: walletCode });
  const customer = data?.[0];
  if (error || !customer) {
    $("scan-error").textContent = "QR Code inválido ou cliente não encontrado.";
    return $("scan-error").classList.remove("hidden");
  }
  openCustomerActions({ customer_id: customer.customer_id, name: customer.name, phone: customer.phone, walletCode });
}

async function openCustomerActions({ customer_id, name, phone, walletCode }) {
  actionsCustomer = { customer_id, name, phone, walletCode };
  $("scan-customer-name").textContent = name || "Cliente";
  $("scan-customer-phone").textContent = phone || "";
  $("scan-add-points").value = currentShop.points_per_checkin;

  const { data: balanceRow } = await supabaseClient
    .from("customer_balances").select("balance").eq("shop_id", currentShop.id).eq("customer_id", customer_id).maybeSingle();
  const balance = balanceRow?.balance || 0;
  $("scan-balance").textContent = balance;

  renderScanRewards(balance);
  $("scan-result").classList.remove("hidden");
}

function renderScanRewards(balance) {
  $("scan-rewards-list").innerHTML = activeRewards.map((r) => {
    const eligible = balance >= r.points_required;
    return `
      <button data-reward-id="${r.id}" ${eligible ? "" : "disabled"}
        class="w-full flex items-center justify-between text-sm rounded-lg px-3 py-2 border transition ${
          eligible
            ? "border-amber-300 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 cursor-pointer"
            : "border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
        }">
        <span>${eligible ? "🎁" : "🔒"} ${r.title}</span>
        <span class="font-semibold">${eligible ? "Resgatar →" : `faltam ${r.points_required - balance} pts`}</span>
      </button>`;
  }).join("") || `<p class="text-sm text-slate-400 dark:text-slate-500 text-center py-2">Nenhum mimo cadastrado ainda.</p>`;

  $("scan-rewards-list").querySelectorAll("[data-reward-id]:not([disabled])").forEach((btn) =>
    btn.addEventListener("click", () => redeemReward(btn.dataset.rewardId)),
  );
}

async function redeemReward(rewardId) {
  const { error } = await supabaseClient.rpc("redeem_reward_via_scan", {
    p_wallet_code: actionsCustomer.walletCode, p_shop_id: currentShop.id, p_reward_id: rewardId,
  });
  if (error) return alert("Erro: " + error.message);
  $("scan-result").classList.add("hidden");
  loadCustomers();
  loadStats();
}

document.querySelectorAll("[data-preset-points]").forEach((btn) =>
  btn.addEventListener("click", () => ($("scan-add-points").value = btn.dataset.presetPoints)),
);

$("scan-add-btn").addEventListener("click", async () => {
  const points = parseInt($("scan-add-points").value, 10) || currentShop.points_per_checkin;
  const { error } = await supabaseClient.rpc("add_points_via_scan", {
    p_wallet_code: actionsCustomer.walletCode, p_shop_id: currentShop.id, p_points: points,
  });
  if (error) return alert("Erro: " + error.message);
  $("scan-result").classList.add("hidden");
  loadCustomers();
});

boot();
