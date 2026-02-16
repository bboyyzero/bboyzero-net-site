const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

const listEl = document.getElementById("events-list");
const adminPanel = document.getElementById("admin-content");
const toggleAdminBtn = document.getElementById("toggle-admin");
const form = document.getElementById("event-form");
const adminEvents = document.getElementById("admin-events");
const statusEl = document.getElementById("admin-status");
const authStatusEl = document.getElementById("admin-auth-status");
const saveEventBtn = document.getElementById("save-event-btn");
const emailInput = document.getElementById("admin-email");
const passwordInput = document.getElementById("admin-password");
const signInBtn = document.getElementById("admin-sign-in");
const signOutBtn = document.getElementById("admin-sign-out");

if (toggleAdminBtn && adminPanel) {
  toggleAdminBtn.addEventListener("click", () => {
    adminPanel.hidden = !adminPanel.hidden;
  });
}

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle("status-error", isError);
}

function setAuthStatus(message, isError = false) {
  if (!authStatusEl) return;
  authStatusEl.textContent = message;
  authStatusEl.classList.toggle("status-error", isError);
}

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setAuthState(user) {
  const signedIn = Boolean(user);
  if (saveEventBtn) saveEventBtn.disabled = !signedIn;
  if (signInBtn) signInBtn.hidden = signedIn;
  if (signOutBtn) signOutBtn.hidden = !signedIn;

  if (signedIn) {
    setAuthStatus(`Signed in as ${user.email || "admin"}.`);
  } else {
    setAuthStatus("Sign in required for event edits.");
  }
}

function renderEvents(events) {
  if (!listEl) return;
  listEl.innerHTML = "";

  if (!events.length) {
    const empty = document.createElement("li");
    empty.className = "empty-events";
    empty.textContent = "No events listed.";
    listEl.append(empty);
    return;
  }

  events.forEach((event) => {
    const li = document.createElement("li");
    const hasImage = Boolean(event.imageUrl);
    li.className = hasImage ? "event-item event-with-image" : "event-item";

    const image = hasImage
      ? `<img class="event-image" src="${escapeHtml(event.imageUrl)}" alt="${escapeHtml(event.city)} event image" loading="lazy" />`
      : "";

    li.innerHTML = `
      ${image}
      <div class="event-content">
        <div class="event-date">${formatDate(event.date)}</div>
        <div class="event-meta">
          <strong>${escapeHtml(event.city)}</strong>
          <span>${escapeHtml(event.venue)}</span>
          ${event.details ? `<span>${escapeHtml(event.details)}</span>` : ""}
        </div>
        <a class="ticket-link" href="${escapeHtml(event.ticketUrl)}" target="_blank" rel="noopener noreferrer">tickets</a>
      </div>
    `;
    listEl.append(li);
  });
}

function renderAdmin(events, canEdit, deleteHandler) {
  if (!adminEvents) return;
  adminEvents.innerHTML = "";

  events.forEach((event) => {
    const row = document.createElement("div");
    row.className = "admin-event-row";
    row.innerHTML = `<span>${formatDate(event.date)} • ${escapeHtml(event.city)} • ${escapeHtml(event.venue)}</span>`;

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "delete";
    del.disabled = !canEdit;
    del.addEventListener("click", () => deleteHandler(event.id, canEdit));

    row.append(del);
    adminEvents.append(row);
  });
}

(function init() {
  const config = window.SUPABASE_CONFIG || {};
  const supabaseGlobal = window.supabase;

  if (!supabaseGlobal || typeof supabaseGlobal.createClient !== "function") {
    setStatus("Supabase script failed to load.", true);
    setAuthStatus("Admin unavailable until Supabase loads.", true);
    renderEvents([]);
    setAuthState(null);
    return;
  }

  if (!config.url || !config.anonKey || String(config.url).includes("YOUR_PROJECT_ID")) {
    setStatus("Configure js/supabase-config.js first.", true);
    setAuthStatus("Missing Supabase config.", true);
    renderEvents([]);
    setAuthState(null);
    return;
  }

  const supabase = supabaseGlobal.createClient(config.url, config.anonKey);

  async function fetchEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("id, date, city, venue, ticket_url, image_url, details")
      .order("date", { ascending: true });

    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.id,
      date: row.date,
      city: row.city,
      venue: row.venue,
      ticketUrl: row.ticket_url,
      imageUrl: row.image_url || "",
      details: row.details || "",
    }));
  }

  async function uploadEventImage(file) {
    if (!file || file.size === 0) return "";
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error("Image is too large. Max size is 8MB.");
    }

    const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
    const objectPath = `events/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const bucket = config.storageBucket || "event-images";

    const { error } = await supabase.storage.from(bucket).upload(objectPath, file, { upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return data.publicUrl || "";
  }

  async function refresh() {
    try {
      const events = await fetchEvents();
      const { data: auth } = await supabase.auth.getUser();
      const canEdit = Boolean(auth && auth.user);
      renderEvents(events);
      renderAdmin(events, canEdit, async (id, editable) => {
        if (!editable) return;
        const { error } = await supabase.from("events").delete().eq("id", id);
        if (error) {
          setStatus("Delete failed. Check admin sign-in.", true);
          return;
        }
        setStatus("Event deleted.");
        await refresh();
      });
    } catch {
      setStatus("Unable to load events.", true);
    }
  }

  if (signInBtn && emailInput && passwordInput) {
    signInBtn.addEventListener("click", async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        setAuthStatus("Enter admin email and password.", true);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthStatus("Sign-in failed.", true);
        return;
      }

      passwordInput.value = "";
      setAuthState(data.user);
      setStatus("Admin sign-in successful.");
      await refresh();
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      setAuthState(null);
      setStatus("Signed out.");
      await refresh();
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const { data: auth } = await supabase.auth.getUser();
      if (!auth || !auth.user) {
        setStatus("Sign in first.", true);
        return;
      }

      const data = new FormData(form);
      const imageFile = data.get("imageFile");

      let uploadedUrl = "";
      try {
        if (imageFile instanceof File && imageFile.size > 0) {
          uploadedUrl = await uploadEventImage(imageFile);
        }
      } catch {
        setStatus("Image upload failed.", true);
        return;
      }

      const row = {
        id: crypto.randomUUID(),
        date: String(data.get("date") || "").trim(),
        city: String(data.get("city") || "").trim(),
        venue: String(data.get("venue") || "").trim(),
        ticket_url: String(data.get("ticketUrl") || "").trim(),
        image_url: uploadedUrl || String(data.get("imageUrl") || "").trim(),
        details: String(data.get("details") || "").trim(),
      };

      if (!row.date || !row.city || !row.venue || !row.ticket_url) {
        setStatus("Fill required fields.", true);
        return;
      }

      const { error } = await supabase.from("events").insert(row);
      if (error) {
        setStatus("Save failed. Check admin permissions.", true);
        return;
      }

      form.reset();
      setStatus("Event saved.");
      await refresh();
    });
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    setAuthState(session?.user || null);
  });

  (async () => {
    const { data } = await supabase.auth.getSession();
    setAuthState(data.session?.user || null);
    await refresh();
  })();
})();
