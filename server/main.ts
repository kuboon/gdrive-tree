import { Hono } from "jsr:@hono/hono";
import { serveStatic } from "jsr:@hono/hono/deno";
import { cors } from "jsr:@hono/hono/cors";

const app = new Hono();

// Enable CORS for development
app.use("/*", cors());

// Store tokens in memory (in production, use a proper session store)
const tokenStore = new Map<string, any>();

// API Routes
app.post("/api/auth/token", async (c) => {
  const body = await c.req.json();
  const { accessToken, sessionId } = body;
  
  if (!accessToken || !sessionId) {
    return c.json({ error: "Missing accessToken or sessionId" }, 400);
  }
  
  tokenStore.set(sessionId, { accessToken, timestamp: Date.now() });
  
  return c.json({ success: true });
});

app.post("/api/auth/revoke", async (c) => {
  const body = await c.req.json();
  const { sessionId } = body;
  
  if (!sessionId) {
    return c.json({ error: "Missing sessionId" }, 400);
  }
  
  tokenStore.delete(sessionId);
  
  return c.json({ success: true });
});

app.get("/api/auth/check", async (c) => {
  const sessionId = c.req.header("X-Session-Id");
  
  if (!sessionId) {
    return c.json({ hasCredential: false });
  }
  
  const token = tokenStore.get(sessionId);
  return c.json({ hasCredential: !!token });
});

app.post("/api/drive/files/list", async (c) => {
  const sessionId = c.req.header("X-Session-Id");
  
  if (!sessionId) {
    return c.json({ error: "Missing session ID" }, 401);
  }
  
  const tokenData = tokenStore.get(sessionId);
  if (!tokenData) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const body = await c.req.json();
  const { pageSize, fields, folderId, pageToken, includeItemsFromAllDrives, supportsAllDrives, q, spaces, orderBy } = body;
  
  // Build query parameters
  const params = new URLSearchParams();
  if (pageSize) params.append("pageSize", pageSize.toString());
  if (fields) params.append("fields", fields);
  if (pageToken) params.append("pageToken", pageToken);
  if (includeItemsFromAllDrives) params.append("includeItemsFromAllDrives", "true");
  if (supportsAllDrives) params.append("supportsAllDrives", "true");
  if (spaces) params.append("spaces", spaces);
  if (orderBy) params.append("orderBy", orderBy);
  
  // Build query
  let query = "";
  if (folderId) {
    query = `'${folderId}' in parents and trashed = false`;
  } else if (q) {
    query = q;
  }
  if (query) {
    params.append("q", query);
  }
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Drive API error:", errorText);
      return c.json({ error: "Failed to fetch files from Google Drive", details: errorText }, response.status);
    }
    
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("Error calling Google Drive API:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Serve static files from dist directory
app.use("/*", serveStatic({ root: "./dist" }));

// Fallback to index.html for SPA routing
app.get("/*", serveStatic({ path: "./dist/index.html" }));

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`Server running on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);
