const form = document.getElementById("contact-form");
const statusEl = document.getElementById("contact-status");

const config = window.SUPABASE_CONFIG || {};
const supabase = window.supabase.createClient(config.url, config.anonKey);

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("status-error", isError);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!config.url || !config.anonKey || config.url.includes("YOUR_PROJECT_ID")) {
    setStatus("Supabase config missing.", true);
    return;
  }

  const data = new FormData(form);
  const payload = {
    id: crypto.randomUUID(),
    name: String(data.get("name") || "").trim(),
    email: String(data.get("email") || "").trim(),
    message: String(data.get("message") || "").trim(),
  };

  if (!payload.name || !payload.email || !payload.message) {
    setStatus("Fill all fields.", true);
    return;
  }

  const { error } = await supabase.from("messages").insert(payload);

  if (error) {
    setStatus("Send failed. Try again.", true);
    return;
  }

  form.reset();
  setStatus("Sent.");
});
