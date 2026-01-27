import { Hono } from "jsr:@hono/hono";
import { serveStatic } from "jsr:@hono/hono/deno";
import { cors } from "jsr:@hono/hono/cors";

const app = new Hono();

// Enable CORS for development
app.use("/*", cors());

// Get Google Drive access token from environment variable
const GOOGLE_DRIVE_TOKEN = Deno.env.get("GOOGLE_DRIVE_TOKEN");

if (!GOOGLE_DRIVE_TOKEN) {
  console.warn("Warning: GOOGLE_DRIVE_TOKEN not set in environment variables");
  console.warn("The application will not be able to access Google Drive");
}

// API Routes
app.get("/api/auth/check", async (c) => {
  return c.json({ hasCredential: !!GOOGLE_DRIVE_TOKEN });
});

app.post("/api/drive/files/list", async (c) => {
  if (!GOOGLE_DRIVE_TOKEN) {
    return c.json({ error: "Server not configured with Google Drive token" }, 500);
  }
  
  const body = await c.req.json();
  const { pageSize, fields, folderId, pageToken, includeItemsFromAllDrives, supportsAllDrives, q, spaces, orderBy } = body;
  
  // Validate and sanitize folderId
  if (folderId && !/^[a-zA-Z0-9_-]+$/.test(folderId) && folderId !== "root") {
    return c.json({ error: "Invalid folderId format" }, 400);
  }
  
  // Build query parameters
  const params = new URLSearchParams();
  if (pageSize) params.append("pageSize", pageSize.toString());
  if (fields) params.append("fields", fields);
  if (pageToken) params.append("pageToken", pageToken);
  if (includeItemsFromAllDrives) params.append("includeItemsFromAllDrives", "true");
  if (supportsAllDrives) params.append("supportsAllDrives", "true");
  if (spaces) params.append("spaces", spaces);
  if (orderBy) params.append("orderBy", orderBy);
  
  // Build query - folderId needs to be properly escaped for Google Drive API
  let query = "";
  if (folderId) {
    // Google Drive file IDs are safe to use directly since we validated the format
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
          Authorization: `Bearer ${GOOGLE_DRIVE_TOKEN}`,
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
