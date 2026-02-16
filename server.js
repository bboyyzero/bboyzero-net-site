const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const ROOT = __dirname;

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.BBOY_ADMIN_TOKEN || "change-this-admin-token";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const SUPABASE_STORAGE_BUCKET = String(process.env.SUPABASE_STORAGE_BUCKET || "event-images");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 15_000_000) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function isAdmin(req) {
  const auth = req.headers.authorization || "";
  return auth === `Bearer ${ADMIN_TOKEN}`;
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...options,
    headers: supabaseHeaders(options.headers || {}),
  });
  return response;
}

function extensionFromMimeType(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

async function saveUploadedEventImage(imageUpload) {
  if (!imageUpload || typeof imageUpload !== "object") return "";
  const mimeType = String(imageUpload.mimeType || "").trim();
  const dataBase64 = String(imageUpload.dataBase64 || "").trim();
  const ext = extensionFromMimeType(mimeType);

  if (!ext || !dataBase64) return "";

  const filename = `${Date.now()}-${randomUUID()}${ext}`;
  const objectPath = `events/${filename}`;
  const bytes = Buffer.from(dataBase64, "base64");

  const uploadResponse = await supabaseRequest(
    `/storage/v1/object/${encodeURIComponent(SUPABASE_STORAGE_BUCKET)}/${objectPath}`,
    {
      method: "POST",
      headers: {
        "Content-Type": mimeType,
        "x-upsert": "false",
      },
      body: bytes,
    }
  );

  if (!uploadResponse.ok) {
    throw new Error("Image upload failed");
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${objectPath}`;
}

function mapEventRow(row) {
  return {
    id: row.id,
    date: row.date,
    city: row.city,
    venue: row.venue,
    ticketUrl: row.ticket_url,
    imageUrl: row.image_url || "",
    details: row.details || "",
  };
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const safePath = path.normalize(relativePath);
  if (safePath.startsWith("..")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  let filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    if (!hasSupabaseConfig()) {
      return sendJson(res, 500, {
        error: "Missing Supabase config. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env",
      });
    }
  }

  if (url.pathname === "/api/events" && req.method === "GET") {
    try {
      const response = await supabaseRequest(
        "/rest/v1/events?select=id,date,city,venue,ticket_url,image_url,details&order=date.asc"
      );
      if (!response.ok) return sendJson(res, 502, { error: "Failed to load events" });
      const rows = await response.json();
      return sendJson(res, 200, { events: rows.map(mapEventRow) });
    } catch {
      return sendJson(res, 500, { error: "Events request failed" });
    }
  }

  if (url.pathname === "/api/events" && req.method === "POST") {
    if (!isAdmin(req)) return sendJson(res, 401, { error: "Unauthorized" });

    try {
      const body = await readBody(req);
      const uploadedImageUrl = await saveUploadedEventImage(body.imageUpload);

      const event = {
        id: randomUUID(),
        date: String(body.date || "").trim(),
        city: String(body.city || "").trim(),
        venue: String(body.venue || "").trim(),
        ticket_url: String(body.ticketUrl || "").trim(),
        image_url: uploadedImageUrl || String(body.imageUrl || "").trim(),
        details: String(body.details || "").trim(),
      };

      if (!event.date || !event.city || !event.venue || !event.ticket_url) {
        return sendJson(res, 400, { error: "Missing fields" });
      }

      const response = await supabaseRequest("/rest/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        return sendJson(res, 502, { error: "Failed to save event" });
      }

      const rows = await response.json();
      return sendJson(res, 201, { event: mapEventRow(rows[0]) });
    } catch {
      return sendJson(res, 400, { error: "Invalid payload" });
    }
  }

  if (url.pathname.startsWith("/api/events/") && req.method === "DELETE") {
    if (!isAdmin(req)) return sendJson(res, 401, { error: "Unauthorized" });

    const id = decodeURIComponent(url.pathname.replace("/api/events/", ""));

    try {
      const response = await supabaseRequest(`/rest/v1/events?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Prefer: "return=minimal",
        },
      });

      if (!response.ok) {
        return sendJson(res, 502, { error: "Failed to delete event" });
      }

      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 500, { error: "Delete request failed" });
    }
  }

  if (url.pathname === "/api/contact" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const message = {
        id: randomUUID(),
        name: String(body.name || "").trim(),
        email: String(body.email || "").trim(),
        message: String(body.message || "").trim(),
      };

      if (!message.name || !message.email || !message.message) {
        return sendJson(res, 400, { error: "Missing fields" });
      }

      const response = await supabaseRequest("/rest/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        return sendJson(res, 502, { error: "Failed to save message" });
      }

      return sendJson(res, 201, { ok: true });
    } catch {
      return sendJson(res, 400, { error: "Invalid payload" });
    }
  }

  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`BBOY ZERO site running at http://localhost:${PORT}`);
});
