import { bundle } from "./bundle.ts";
import { createBundleServeMiddleware } from "./bundleServe.ts";

import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { driveFiles } from "./gdrive.ts";

const bundleResult = await bundle(false);

const app = new Hono();
app
  .use("/*", cors())
  .get("/api/folders/:id", async (c) => {
    const folderId = c.req.param("id");
    const refresh = c.req.query("refresh") === "true";

    // Validate and sanitize folderId
    if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) {
      return c.json({ error: "Invalid folderId format" }, 400);
    }
    const response = await driveFiles(folderId, refresh);
    return c.json(response);
  });

// Serve bundled application using Deno.bundle
app.get("/*", createBundleServeMiddleware(bundleResult));

export default { app, fetch: app.fetch.bind(app) };
