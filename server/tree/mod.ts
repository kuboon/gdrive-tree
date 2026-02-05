import type { DriveFile } from "./types.ts";
import {
  deleteWatchChannel,
  getCachedFiles,
  getWatchChannel,
  saveCachedFiles,
  saveWatchChannel,
} from "./repo.ts";
import { createWatch, driveFiles, stopWatch } from "../gdrive.ts";

/**
 * webhook の URL を環境変数から取得
 * 例: https://yourdomain.com/api/watch
 */
const WEBHOOK_URL = Deno.env.get("WATCH_WEBHOOK_URL");

/**
 * watch channel の有効期限のバッファ（ミリ秒）
 * 有効期限の1時間前に更新する
 */
const EXPIRATION_BUFFER = 60 * 60 * 1000;

/**
 * フォルダ内のファイルを取得
 * watch channel を管理し、キャッシュを利用する
 */
export async function getChildren(
  folderId: string,
  refresh = false,
): Promise<DriveFile[]> {
  // 1. watch channel の確認と作成・更新
  await ensureWatchChannel(folderId);

  // 2. refresh == false かつキャッシュがあれば返す
  if (!refresh) {
    const cached = await getCachedFiles(folderId);
    if (cached) {
      return cached;
    }
  }

  // 3. gdrive.ts の driveFiles を呼び出して取得
  const files = await driveFiles(folderId);

  // 4. キャッシュに保存
  await saveCachedFiles(folderId, files);

  // 5. 返す
  return files;
}

/**
 * watch channel が有効かチェックし、必要に応じて作成・更新
 */
async function ensureWatchChannel(folderId: string): Promise<void> {
  const channel = await getWatchChannel(folderId);
  const now = Date.now();

  // channel がない、または有効期限が近い場合は再作成
  if (!channel || channel.expiration < now + EXPIRATION_BUFFER) {
    // 古い channel があれば停止
    if (channel) {
      try {
        await stopWatch(channel);
      } catch (error) {
        console.error(`Failed to stop old watch channel: ${error}`);
      }
      await deleteWatchChannel(folderId);
    }

    // 新しい channel を作成
    if (WEBHOOK_URL) {
      try {
        const newChannel = await createWatch(folderId, WEBHOOK_URL);
        await saveWatchChannel(folderId, newChannel);
        console.log(
          `Created watch channel for folder ${folderId}, expires at ${new Date(
            newChannel.expiration,
          )}`,
        );
      } catch (error) {
        console.error(`Failed to create watch channel: ${error}`);
        // watch channel の作成に失敗してもファイルリストの取得は続行
      }
    }
  }
}

/**
 * watch 通知を受け取った時に呼ばれるメソッド
 * キャッシュを無効化し、最新のファイルリストを取得して保存
 */
export async function update(folderId: string): Promise<void> {
  console.log(`Received watch notification for folder ${folderId}`);

  try {
    // 最新のファイルリストを取得
    const files = await driveFiles(folderId);

    // キャッシュを更新
    await saveCachedFiles(folderId, files);

    console.log(`Updated cache for folder ${folderId}, ${files.length} files`);
  } catch (error) {
    console.error(`Failed to update cache for folder ${folderId}: ${error}`);
    throw error;
  }
}
