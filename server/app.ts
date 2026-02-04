import { bundle } from "./bundle.ts";
import { createBundleServeMiddleware } from "./bundleServe.ts";

import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { driveFiles } from "./gdrive.ts";
import { moveAllHandler } from "./move.ts";

const bundleResult = await bundle(false);

const app: Hono = new Hono();
app
  .use("/*", cors())
  .post("/api/move-all", moveAllHandler)
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
app.get("/*", createBundleServeMiddleware(bundleResult))
  .get("*", (c) => c.text("Not Found", 404))
  .onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

const appFetch: Deno.ServeHandler = app.fetch.bind(app);
export default { app, fetch: appFetch };
