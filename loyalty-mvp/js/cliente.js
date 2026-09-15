// App do cliente — buscar lojas, mapa com geolocalização, carteira digital (QR).
const $ = (id) => document.getElementById(id);
let me = null;
let myWallet = null;
let allShops = [];
let myPosition = null;
let map = null;
let markers = [];

const views = ["loading-view", "role-guard-view", "app-view"];
function showView(id) {
  views.forEach((v) => $(v).classList.toggle("hidden", v !== id));
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ---------- Boot ----------
async function boot() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return (location.href = "index.html");

  const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", session.user.id).single();
  if (profile?.role !== "cliente") return showView("role-guard-view");

  me = profile;
  $("greeting").textContent = `Olá, ${me.name || "cliente"}!`;
  showView("app-view");

  initMap();
  await Promise.all([loadShops(), loadDashboard()]);
  requestGeolocation();

  const sharedSlug = new URLSearchParams(location.search).get("loja");
  if (sharedSlug) {
    showTab("explore");
    openShopDetail(sharedSlug);
  }
}

// ---------- Abas ----------
function showTab(tab) {
  $("dashboard-section").classList.toggle("hidden", tab !== "dashboard");
  $("explore-section").classList.toggle("hidden", tab !== "explore");

  const active = ["bg-indigo-600", "text-white"];
  const inactive = ["bg-slate-100", "dark:bg-slate-800", "text-slate-600", "dark:text-slate-300"];
  $("tab-dashboard").classList.remove(...active, ...inactive);
  $("tab-explore").classList.remove(...active, ...inactive);
  $("tab-dashboard").classList.add(...(tab === "dashboard" ? active : inactive));
  $("tab-explore").classList.add(...(tab === "explore" ? active : inactive));

  if (tab === "explore") setTimeout(() => map.invalidateSize(), 50);
}
$("tab-dashboard").addEventListener("click", () => showTab("dashboard"));
$("tab-explore").addEventListener("click", () => showTab("explore"));

// ---------- Dashboard: meus pontos ----------
async function loadDashboard() {
  const { data: balances } = await supabaseClient.rpc("get_my_shop_balances");
  const myShops = balances || [];

  $("dash-total-points").textContent = myShops.reduce((sum, b) => sum + b.balance, 0);
  $("dash-shop-count").textContent = myShops.length;

  const shopIds = myShops.map((b) => b.shop_id);
  const { data: rewards } = shopIds.length
    ? await supabaseClient.from("rewards").select("*").in("shop_id", shopIds).eq("active", true)
    : { data: [] };

  $("dash-shops").innerHTML = myShops.map((b) => {
    const shopRewards = (rewards || []).filter((r) => r.shop_id === b.shop_id).sort((x, y) => x.points_required - y.points_required);
    const next = shopRewards.find((r) => r.points_required > b.balance);
    let progressHtml = "";
    if (next) {
      const pct = Math.min(100, Math.round((b.balance / next.points_required) * 100));
      progressHtml = `
        <div class="mt-2">
          <div class="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Próximo: ${next.title}</span><span>${b.balance}/${next.points_required} pts</span>
          </div>
          <div class="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div class="h-full bg-indigo-500" style="width:${pct}%"></div>
          </div>
        </div>`;
    } else if (shopRewards.length) {
      progressHtml = `<p class="text-xs text-emerald-600 dark:text-emerald-400 mt-2">🎉 Todos os mimos disponíveis!</p>`;
    }
    return `
      <button data-slug="${b.shop_slug}" class="dash-shop-card w-full text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 hover:border-indigo-300 dark:hover:border-indigo-500 transition">
        <div class="flex items-center justify-between">
          <p class="font-semibold text-slate-800 dark:text-slate-100">${b.shop_name}</p>
          <span class="text-sm font-bold text-amber-600 dark:text-amber-400">${b.balance} pts</span>
        </div>
        ${progressHtml}
      </button>`;
  }).join("") ||
    `<p class="text-center text-slate-400 dark:text-slate-500 py-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">Você ainda não é cliente de nenhuma loja.<br>Peça pro lojista escanear sua carteira (🪪) na primeira visita!</p>`;

  $("dash-shops").querySelectorAll(".dash-shop-card").forEach((btn) =>
    btn.addEventListener("click", () => { showTab("explore"); openShopDetail(btn.dataset.slug); }),
  );

  const shopNameById = Object.fromEntries(myShops.map((b) => [b.shop_id, b.shop_name]));
  const { data: recentTx } = await supabaseClient
    .from("point_transactions").select("*").eq("customer_id", me.id).order("created_at", { ascending: false }).limit(10);

  $("dash-activity").innerHTML = (recentTx || []).map((t) => `
      <li class="flex items-center justify-between py-2.5 text-sm">
        <span class="text-slate-600 dark:text-slate-300">${shopNameById[t.shop_id] || "Loja"}${t.reward_id ? " · resgate de mimo" : ""}</span>
        <span class="font-semibold ${t.points >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}">${t.points >= 0 ? "+" : ""}${t.points}</span>
      </li>`).join("") || `<li class="text-center text-slate-400 dark:text-slate-500 py-6 text-sm">Nenhuma atividade ainda.</li>`;
}

$("logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.href = "index.html";
});

// ---------- Mapa ----------
function initMap() {
  map = L.map("map").setView([-23.5505, -46.6333], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);
}

function requestGeolocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      myPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setView([myPosition.lat, myPosition.lng], 14);
      L.circleMarker([myPosition.lat, myPosition.lng], { radius: 8, color: "#4f46e5", fillColor: "#818cf8", fillOpacity: 0.9 })
        .addTo(map).bindPopup("Você está aqui");
      renderShopList(currentFilter());
    },
    () => {},
  );
}

// ---------- Lojas ----------
async function loadShops() {
  const { data } = await supabaseClient.rpc("list_shops_public");
  allShops = data || [];
  plotMarkers(allShops);
  renderShopList(allShops);
}

function plotMarkers(shops) {
  markers.forEach((m) => map.removeLayer(m));
  markers = shops
    .filter((s) => s.lat && s.lng)
    .map((s) => {
      const marker = L.marker([s.lat, s.lng]).addTo(map).bindPopup(`<strong>${s.name}</strong><br>${s.address || ""}`);
      marker.on("click", () => openShopDetail(s.slug));
      return marker;
    });
}

function currentFilter() {
  const q = $("shop-search").value.trim().toLowerCase();
  return !q ? allShops : allShops.filter((s) => s.name.toLowerCase().includes(q));
}

function renderShopList(shops) {
  const withDistance = shops.map((s) => ({
    ...s,
    distanceKm: myPosition && s.lat && s.lng ? haversineKm(myPosition, { lat: s.lat, lng: s.lng }) : null,
  }));
  withDistance.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  $("shop-list").innerHTML = withDistance.map((s) => `
      <button data-slug="${s.slug}" class="shop-card w-full text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-sm transition">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-semibold text-slate-800 dark:text-slate-100">${s.name}</p>
            <p class="text-sm text-slate-500 dark:text-slate-400">${s.address || "Endereço não informado"}</p>
          </div>
          ${s.distanceKm != null ? `<span class="shrink-0 text-xs font-medium bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-full px-2.5 py-1">${s.distanceKm.toFixed(1)} km</span>` : ""}
        </div>
      </button>`).join("") ||
    `<p class="text-center text-slate-400 dark:text-slate-500 py-8">Nenhuma loja encontrada.</p>`;

  document.querySelectorAll(".shop-card").forEach((btn) =>
    btn.addEventListener("click", () => openShopDetail(btn.dataset.slug)),
  );
}

$("shop-search").addEventListener("input", () => renderShopList(currentFilter()));

// ---------- Detalhe da loja ----------
async function openShopDetail(slug) {
  const { data } = await supabaseClient.rpc("get_shop_public", { p_shop_slug: slug });
  const shop = data?.[0];
  if (!shop) return;

  if (shop.lat && shop.lng) map.setView([shop.lat, shop.lng], 16);

  const { data: rewards } = await supabaseClient.from("rewards").select("*").eq("shop_id", shop.id).eq("active", true);
  const { data: balanceRow } = await supabaseClient
    .from("customer_balances").select("balance").eq("shop_id", shop.id).eq("customer_id", me.id).maybeSingle();

  $("detail-name").textContent = shop.name;
  $("detail-address").textContent = shop.address || "Endereço não informado";
  $("detail-description").textContent = shop.description || "";
  $("detail-balance").textContent = balanceRow ? `Você tem ${balanceRow.balance} pontos aqui` : "Você ainda não é cliente desta loja";
  $("detail-rewards").innerHTML = (rewards || []).map((r) => `
      <li class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
        <span>${r.title}</span>
        <span class="text-sm font-semibold text-indigo-700 dark:text-indigo-300">${r.points_required} pts</span>
      </li>`).join("") || `<li class="text-slate-400 dark:text-slate-500 py-2">Nenhum mimo cadastrado ainda.</li>`;

  $("shop-detail-modal").classList.remove("hidden");
}

$("shop-detail-close").addEventListener("click", () => $("shop-detail-modal").classList.add("hidden"));

// ---------- Minha carteira (QR pessoal) ----------
$("wallet-btn").addEventListener("click", async () => {
  if (!myWallet) {
    const { data } = await supabaseClient.rpc("get_my_wallet");
    myWallet = data?.[0];
  }
  $("wallet-name").textContent = myWallet?.name || me.name || "Cliente";
  $("wallet-qr").src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(myWallet.wallet_code)}`;
  $("wallet-modal").classList.remove("hidden");
});
$("wallet-close").addEventListener("click", () => $("wallet-modal").classList.add("hidden"));

boot();
