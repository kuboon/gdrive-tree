import { ensureWatchChannel, getChildren, update } from "./mod.ts";
import { getWatchChannel } from "./repo.ts";
import type { DriveItem } from "./types.ts";
import { isFolder } from "../gdrive.ts";
import { Hono } from "@hono/hono";

/**
 * Tree 関連の API ルートを提供する Hono middleware
 */
export function createTreeRouter(): Hono {
  const router = new Hono()
    .post("/watch/:folderId", async (c) => {
      // Google Drive からの watch 通知を受け取る
      // https://developers.google.com/workspace/drive/api/guides/push
      const resourceState = c.req.header("X-Goog-Resource-State");
      const channelId = c.req.header("X-Goog-Channel-ID");
      const changed = c.req.header("X-Goog-Changed");
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
      console.log(
        `Received watch notification for folder ${folderId}: state=${resourceState}, changed=${changed}`,
      );

      try {
        await update(folderId);
        return c.text("OK", 200);
      } catch (error) {
        console.error(`Watch notification error: ${error}`);
        return c.text("Internal Server Error", 500);
      }
    })
    .get("/folders/:id", async (c) => {
      // フォルダの子要素を取得
      const folderId = c.req.param("id");
      const refresh = c.req.query("refresh") === "true";

      // Validate and sanitize folderId
      if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) {
        return c.json({ error: "Invalid folderId format" }, 400);
      }

      const reqUrl = new URL(c.req.url);
      const webHookUrl = `${reqUrl.origin}/api/watch/${folderId}`;
      await ensureWatchChannel(webHookUrl, folderId);

      const response = await getChildren(folderId, refresh);
      return c.json(response);
    })
    .get("/tree/:id", async (c) => {
      // フォルダツリー全体を取得
      const folderId = c.req.param("id");
      const ret: DriveItem[] = [];
      const children = await getChildren(folderId);
      const folders = children?.filter(isFolder) || [];
      if (folders.length === 0) return c.json([]);

      // 再帰的にフォルダを収集（並列数を制限）
      const concurrencyLimit = 3; // 並列実行数を制限
      const queue = [...folders];

      while (queue.length > 0) {
        const batch = queue.splice(0, concurrencyLimit);

        await Promise.all(
          [
            ...batch.map(async (file) => {
              ret.push(file);

              const subChildren = await getChildren(file.id);
              const folders = subChildren?.filter(isFolder) || [];
              if (folders.length > 0) {
                queue.push(...folders);
              }
            }),
          ],
        );
      }

      return c.json(ret);
    });
  return router;
}
