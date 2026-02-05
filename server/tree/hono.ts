import { Hono } from "@hono/hono";
import { ensureWatchChannel, getChildren, update } from "./mod.ts";
import { getFolderIdByChannelId, getWatchChannel } from "./repo.ts";

/**
 * Tree 関連の API ルートを提供する Hono middleware
 */
export function createTreeRouter(): Hono {
  const router = new Hono();

  // Google Drive からの watch 通知を受け取る
  router.post("/watch/:folderId", async (c) => {
    // https://developers.google.com/workspace/drive/api/guides/push
    const resourceState = c.req.header("X-Goog-Resource-State");
    const channelId = c.req.header("X-Goog-Channel-ID");
    const folderId = c.req.param("folderId"); // Validate and sanitize folderId
    if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) {
      return c.json({ error: "Invalid folderId format" }, 400);
    }

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
    const folderIdFromChannel = await getFolderIdByChannelId(channelId);
    if (!folderIdFromChannel || folderIdFromChannel !== folderId) {
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
  });

  // フォルダの子要素を取得
  router.get("/folders/:id", async (c) => {
    const folderId = c.req.param("id");
    const refresh = c.req.query("refresh") === "true";

    // Validate and sanitize folderId
    if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) {
      return c.json({ error: "Invalid folderId format" }, 400);
    }

    // watch channel の確認と作成・更新
    const origin = new URL(c.req.url).origin;
    const webhookUrl = `${origin}/api/watch/${folderId}`;
    await ensureWatchChannel(webhookUrl, folderId);

    const response = await getChildren(folderId, refresh);
    return c.json(response);
  });

  return router;
}
