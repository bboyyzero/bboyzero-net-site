const API_BASE = "/api/events";
const ADMIN_TOKEN_KEY = "bboyzero_admin_token";
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

const listEl = document.getElementById("events-list");
const adminPanel = document.getElementById("admin-content");
const toggleAdminBtn = document.getElementById("toggle-admin");
const form = document.getElementById("event-form");
const adminEvents = document.getElementById("admin-events");
const tokenInput = document.getElementById("admin-token");
const statusEl = document.getElementById("admin-status");

tokenInput.value = sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("status-error", isError);
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

function toImageUpload(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.size > MAX_FILE_SIZE_BYTES) {
      reject(new Error("Image is too large. Max size is 8MB."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const parts = result.split(",");
      if (parts.length !== 2) {
        reject(new Error("Could not process image."));
        return;
      }

      resolve({
        filename: file.name,
        mimeType: file.type,
        dataBase64: parts[1],
      });
    };
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

async function fetchEvents() {
  const res = await fetch(API_BASE, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load events");
  const data = await res.json();
  return Array.isArray(data.events) ? data.events : [];
}

function renderEvents(events) {
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
    li.className = "event-item";

    const image = event.imageUrl
      ? `<img class="event-image" src="${escapeHtml(event.imageUrl)}" alt="${escapeHtml(event.city)} event image" loading="lazy" />`
      : "";

    li.innerHTML = `
      ${image}
      <div class="event-date">${formatDate(event.date)}</div>
      <div class="event-meta">
        <strong>${escapeHtml(event.city)}</strong>
        <span>${escapeHtml(event.venue)}</span>
        ${event.details ? `<span>${escapeHtml(event.details)}</span>` : ""}
      </div>
      <a class="ticket-link" href="${escapeHtml(event.ticketUrl)}" target="_blank" rel="noopener noreferrer">tickets</a>
    `;
    listEl.append(li);
  });
}

function renderAdmin(events) {
  adminEvents.innerHTML = "";

  events.forEach((event) => {
    const row = document.createElement("div");
    row.className = "admin-event-row";
    row.innerHTML = `<span>${formatDate(event.date)} • ${escapeHtml(event.city)} • ${escapeHtml(event.venue)}</span>`;

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "delete";
    del.addEventListener("click", async () => {
      const token = tokenInput.value.trim();
      if (!token) {
        setStatus("Enter admin token to delete events.", true);
        return;
      }

      const res = await fetch(`${API_BASE}/${encodeURIComponent(event.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setStatus("Delete failed. Check admin token.", true);
        return;
      }

      setStatus("Event deleted.");
      await refresh();
    });

    row.append(del);
    adminEvents.append(row);
  });
}

async function refresh() {
  try {
    const events = await fetchEvents();
    renderEvents(events);
    renderAdmin(events);
  } catch {
    setStatus("Unable to connect to events API.", true);
  }
}

toggleAdminBtn.addEventListener("click", () => {
  adminPanel.hidden = !adminPanel.hidden;
});

tokenInput.addEventListener("input", () => {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, tokenInput.value.trim());
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus("Enter admin token before saving.", true);
    return;
  }

  const data = new FormData(form);
  const imageFile = data.get("imageFile");

  let imageUpload = null;
  try {
    if (imageFile instanceof File && imageFile.size > 0) {
      imageUpload = await toImageUpload(imageFile);
    }
  } catch (error) {
    setStatus(error.message || "Image upload failed.", true);
    return;
  }

  const payload = {
    date: String(data.get("date") || "").trim(),
    city: String(data.get("city") || "").trim(),
    venue: String(data.get("venue") || "").trim(),
    ticketUrl: String(data.get("ticketUrl") || "").trim(),
    imageUrl: String(data.get("imageUrl") || "").trim(),
    imageUpload,
    details: String(data.get("details") || "").trim(),
  };

  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    setStatus("Save failed. Check admin token and fields.", true);
    return;
  }

  form.reset();
  setStatus("Event saved.");
  await refresh();
});

refresh();
