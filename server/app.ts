import { bundle } from "./bundle.ts";
import { createBundleServeMiddleware } from "./bundleServe.ts";
import { createTreeRouter } from "./tree/hono.ts";

import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { serveStatic } from "@hono/hono/deno";
import { moveAllHandler } from "./move.ts";

const app: Hono = new Hono();
app
  .use("/*", cors())
  .post("/api/move-all", moveAllHandler)
  .route("/api", createTreeRouter());

async function clientServer() {
  try {
    const distPath = new URL("../dist", import.meta.url).pathname;
    const st = await Deno.stat(distPath);
    if (st.isDirectory) {
      return serveStatic({
        root: distPath,
        rewriteRequestPath(path) {
          if (path === "/") return "/index.html";
          return path;
        },
      });
    }
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      console.error(e);
    }
  }

  console.log("Bundling client...");
  const bundleResult = await bundle(false);
  return createBundleServeMiddleware(bundleResult);
}
// Serve bundled application using Deno.bundle
app.get("/*", await clientServer())
  .get("*", (c) => c.text("Not Found", 404))
  .onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

const appFetch: Deno.ServeHandler = app.fetch.bind(app);
export default { app, fetch: appFetch };
