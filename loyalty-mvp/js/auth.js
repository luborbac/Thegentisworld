// Entrada — escolha de papel (lojista/cliente) + login/cadastro.
const $ = (id) => document.getElementById(id);
let selectedRole = null;

function selectRole(role) {
  selectedRole = role;
  $("role-lojista").classList.toggle("ring-2", role === "lojista");
  $("role-lojista").classList.toggle("ring-indigo-500", role === "lojista");
  $("role-cliente").classList.toggle("ring-2", role === "cliente");
  $("role-cliente").classList.toggle("ring-indigo-500", role === "cliente");
  $("auth-card").classList.remove("hidden");
  $("signup-extra").classList.toggle("hidden", $("auth-mode").dataset.mode !== "signup");
}

$("role-lojista").addEventListener("click", () => selectRole("lojista"));
$("role-cliente").addEventListener("click", () => selectRole("cliente"));

$("toggle-auth-mode").addEventListener("click", () => {
  const mode = $("auth-mode");
  const isSignup = mode.dataset.mode === "signup";
  mode.dataset.mode = isSignup ? "login" : "signup";
  $("auth-title").textContent = isSignup ? "Entrar" : "Criar conta";
  $("auth-submit").textContent = isSignup ? "Entrar" : "Criar conta";
  $("toggle-auth-mode").textContent = isSignup ? "Não tem conta? Criar uma" : "Já tem conta? Entrar";
  $("signup-extra").classList.toggle("hidden", isSignup);
});

function setAuthError(msg, ok = false) {
  const el = $("auth-error");
  el.textContent = msg;
  el.classList.toggle("hidden", !msg);
  el.classList.toggle("text-emerald-600", ok);
  el.classList.toggle("text-rose-600", !ok);
}

$("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError("");
  if (!selectedRole) return setAuthError("Escolha se você é lojista ou cliente.");

  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const isSignup = $("auth-mode").dataset.mode === "signup";

  if (isSignup) {
    const name = $("auth-name").value.trim();
    const phone = $("auth-phone").value.trim();
    const { error } = await supabaseClient.auth.signUp({
      email, password,
      options: { data: { role: selectedRole, name, phone } },
    });
    if (error) return setAuthError(error.message);
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) return redirectByRole();
    return setAuthError("Conta criada! Faça login.", true);
  }

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return setAuthError(error.message);
  redirectByRole();
});

async function redirectByRole() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  const { data: profile } = await supabaseClient.from("profiles").select("role").eq("id", user.id).single();
  location.href = profile?.role === "cliente" ? "cliente.html" : "lojista.html";
}

(async function bootstrap() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) return redirectByRole();
  $("loading-view").classList.add("hidden");
  $("landing").classList.remove("hidden");
})();
