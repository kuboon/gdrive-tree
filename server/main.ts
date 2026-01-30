import { Hono } from "@hono/hono";
import { serveStatic } from "@hono/hono/deno";
import { cors } from "@hono/hono/cors";
import { createCache, type DriveCache } from "./cache.ts";

const app = new Hono();

// Enable CORS for development
app.use("/*", cors());

// Get Google Drive access token and drive ID from environment variables
const GOOGLE_DRIVE_TOKEN = Deno.env.get("GOOGLE_DRIVE_TOKEN");
const GOOGLE_DRIVE_ID = Deno.env.get("GOOGLE_DRIVE_ID");

if (!GOOGLE_DRIVE_TOKEN) {
  console.error("Error: GOOGLE_DRIVE_TOKEN not set in environment variables");
  Deno.exit(1);
}

if (!GOOGLE_DRIVE_ID) {
  console.error("Error: GOOGLE_DRIVE_ID not set in environment variables");
  Deno.exit(1);
}

// Initialize cache
const cache: DriveCache = await createCache();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Fixed fields that the client needs
const FIXED_FIELDS = "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,parents)";

// API Routes
app.get("/api/folders/:id", async (c) => {
  const folderId = c.req.param("id");
  const refresh = c.req.query("refresh") === "true";
  
  // Validate and sanitize folderId
  if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) {
    return c.json({ error: "Invalid folderId format" }, 400);
  }
  
  // Generate cache key based on folderId
  const cacheKey = `folder:${folderId}`;
  
  // Check cache first (unless refresh is requested)
  if (!refresh) {
    let cachedData = null;
    try {
      cachedData = await cache.get(cacheKey);
      if (cachedData) {
        console.log("Cache hit for folder:", folderId);
        return c.json(cachedData);
      }
    } catch (error) {
      console.error("Cache get failed, fetching fresh data:", error);
    }
  } else {
    console.log("Refresh requested for folder:", folderId);
  }
  
  console.log("Fetching fresh data for folder:", folderId);
  
  // Build query parameters with fixed values
  const params = new URLSearchParams();
  params.append("pageSize", "100");
  params.append("fields", FIXED_FIELDS);
  params.append("includeItemsFromAllDrives", "true");
  params.append("supportsAllDrives", "true");
  params.append("spaces", "drive");
  params.append("corpora", "domain");
  params.append("driveId", GOOGLE_DRIVE_ID);
  params.append("orderBy", "modifiedTime desc");
  
  // Build query for folder contents
  const query = `'${folderId}' in parents and trashed = false`;
  params.append("q", query);
  
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
    try {
      await cache.set(cacheKey, data, CACHE_TTL_MS);
      console.log("Cached data for folder:", folderId);
    } catch (error) {
      console.error("Failed to cache response:", error);
      // Continue even if caching fails
    }
    
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
