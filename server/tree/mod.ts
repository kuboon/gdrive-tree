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
  // 1. refresh == false かつキャッシュがあれば返す
  if (!refresh) {
    const cached = await getCachedFiles(folderId);
    if (cached) {
      return cached;
    }
  }

  // 2. gdrive.ts の driveFiles を呼び出して取得
  const files = await driveFiles(folderId);

  // 3. キャッシュに保存
  await saveCachedFiles(folderId, files);

  // 4. 返す
  return files;
}

/**
 * watch channel が有効かチェックし、必要に応じて作成・更新
 */
export async function ensureWatchChannel(
  webhookUrl: string,
  folderId: string,
): Promise<void> {
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

    // http: の場合は createWatch をスキップ（https のみ）
    if (webhookUrl.startsWith("https:")) {
      try {
        const newChannel = await createWatch(folderId, webhookUrl);
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
    } else {
      console.log(
        `Skipping watch channel creation for http URL: ${webhookUrl}`,
      );
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

/**
 * フォルダツリーを再帰的に取得
 */
export async function getTree(
  folderId: string,
): Promise<DriveFile[]> {
  const children = await getChildren(folderId, false);
  const folders = children.filter((file) =>
    file.mimeType === "application/vnd.google-apps.folder"
  );

  const allFiles: DriveFile[] = [...children];

  for (const folder of folders) {
    const subTree = await getTree(folder.id);
    allFiles.push(...subTree);
  }

  return allFiles;
}
