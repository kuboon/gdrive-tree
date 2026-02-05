import { bundle } from "./bundle.ts";
import { createBundleServeMiddleware } from "./bundleServe.ts";
import { getChildren, update } from "./tree/mod.ts";
import { getFolderIdByChannelId, getWatchChannel } from "./tree/repo.ts";

import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { serveStatic } from "@hono/hono/deno";
import { moveAllHandler } from "./move.ts";

const app: Hono = new Hono();
app
  .use("/*", cors())
  .post("/api/move-all", moveAllHandler)
  .post("/api/watch", async (c) => {
    // Google Drive からの watch 通知を受け取る
    // https://developers.google.com/workspace/drive/api/guides/push
    const resourceState = c.req.header("X-Goog-Resource-State");
    const channelId = c.req.header("X-Goog-Channel-ID");

    console.log(
      `Watch notification: state=${resourceState}, channel=${channelId}`,
    );

    // sync 通知（初回）は無視
    if (resourceState === "sync") {
      return c.text("OK", 200);
    }

    // 必須ヘッダーの検証
    if (!channelId) {
      console.error("Watch notification without channelId");
      return c.text("Bad Request", 400);
    }

    // channelId から folderId を取得
    const folderId = await getFolderIdByChannelId(channelId);
    if (!folderId) {
      console.error(`Unknown channelId: ${channelId}`);
      return c.text("Forbidden", 403);
    }

    // channelId を検証：保存されている watch channel と一致するか確認
    try {
      const savedChannel = await getWatchChannel(folderId);
      if (!savedChannel || savedChannel.id !== channelId) {
        console.error(
          `Invalid channelId: expected ${savedChannel?.id}, got ${channelId}`,
        );
        return c.text("Forbidden", 403);
      }
    } catch (error) {
      console.error(`Failed to verify watch channel: ${error}`);
      return c.text("Forbidden", 403);
    }

    try {
      // キャッシュを更新
      await update(folderId);
      return c.text("OK", 200);
    } catch (error) {
      console.error(`Watch notification error: ${error}`);
      return c.text("Internal Server Error", 500);
    }
  })
  .get("/api/folders/:id", async (c) => {
    const folderId = c.req.param("id");
    const refresh = c.req.query("refresh") === "true";

    // Validate and sanitize folderId
    if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) {
      return c.json({ error: "Invalid folderId format" }, 400);
    }
    const response = await getChildren(folderId, refresh);
    return c.json(response);
  });

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
