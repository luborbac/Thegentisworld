// Página pública de check-in — cliente escaneia o QR Code e cai aqui.
const params = new URLSearchParams(location.search);
const shopSlug = params.get("loja");

const $ = (id) => document.getElementById(id);

async function loadShop() {
  if (!shopSlug) return showError("QR Code inválido: loja não informada.");

  const { data, error } = await supabaseClient.rpc("get_shop_public", { p_shop_slug: shopSlug });
  const shop = data?.[0];

  if (error || !shop) return showError("Loja não encontrada.");

  $("shop-name").textContent = shop.name;
  $("shop-points-info").textContent = `+${shop.points_per_checkin} ponto(s) a cada check-in`;
  $("loading").classList.add("hidden");
  $("form-section").classList.remove("hidden");
}

function showError(message) {
  $("loading").classList.add("hidden");
  $("error").textContent = message;
  $("error").classList.remove("hidden");
}

$("checkin-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const phone = $("phone").value.trim();
  const name = $("name").value.trim();
  const button = $("submit-btn");

  button.disabled = true;
  button.textContent = "Registrando...";

  const { data, error } = await supabaseClient.rpc("checkin_public", {
    p_shop_slug: shopSlug,
    p_phone: phone,
    p_name: name || null,
  });

  if (error) {
    button.disabled = false;
    button.textContent = "Confirmar check-in";
    return showError("Não foi possível registrar. Tente novamente.");
  }

  const result = data?.[0];
  $("form-section").classList.add("hidden");
  $("result-name").textContent = result?.customer_name || name || "Cliente";
  $("result-balance").textContent = result?.new_balance ?? "-";
  $("result-section").classList.remove("hidden");
});

loadShop();
