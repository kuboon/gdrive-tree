import { Hono } from "@hono/hono";
import { serveStatic } from "@hono/hono/deno";
import { cors } from "@hono/hono/cors";
import { createCache, type DriveCache } from "./cache.ts";

const app = new Hono();

// Enable CORS for development
app.use("/*", cors());

// Get Google Drive access token from environment variable
const GOOGLE_DRIVE_TOKEN = Deno.env.get("GOOGLE_DRIVE_TOKEN");

if (!GOOGLE_DRIVE_TOKEN) {
  console.error("Error: GOOGLE_DRIVE_TOKEN not set in environment variables");
  Deno.exit(1);
}

// Initialize cache
const cache: DriveCache = await createCache();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Helper function to generate cache key
function getCacheKey(params: any): string {
  return JSON.stringify(params);
}

// API Routes
app.post("/api/drive/cache/purge", async (c) => {
  await cache.clear();
  return c.json({ success: true, message: "Cache purged successfully" });
});

app.post("/api/drive/files/list", async (c) => {
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
  
  // Generate cache key
  const cacheKey = getCacheKey({
    pageSize,
    fields,
    folderId,
    pageToken,
    includeItemsFromAllDrives,
    supportsAllDrives,
    q,
    spaces,
    orderBy,
  });
  
  // Check cache first
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    console.log("Cache hit for key:", cacheKey.substring(0, 50) + "...");
    return c.json(cachedData);
  }
  
  console.log("Cache miss for key:", cacheKey.substring(0, 50) + "...");
  
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
    
    // Cache the response
    await cache.set(cacheKey, data, CACHE_TTL_MS);
    
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
