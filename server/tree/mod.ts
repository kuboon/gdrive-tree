import type { DriveItem } from "./types.ts";
import {
  deleteWatchChannel,
  enqueue,
  getChildren as getCachedChildren,
  getDriveItem,
  getWatchChannel,
  saveChildren,
  saveWatchChannel,
} from "./repo.ts";
import {
  createWatch,
  driveFiles,
  getOrCreateFolder as getOrCreateFolderInDrive,
  isFolder,
  stopWatch,
} from "../gdrive.ts";
import { doMove } from "../move.ts";

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
): Promise<DriveItem[]> {
  // 1. refresh == false かつキャッシュがあれば返す
  if (!refresh) {
    const cached = await getCachedChildren(folderId);
    if (cached) return cached;
  }

  // 2. gdrive.ts の driveFiles を呼び出して取得
  const files = await driveFiles(folderId);
  files.sort((a, b) =>
    (isFolder(a) ? -3 : 0) + (isFolder(b) ? 3 : 0) +
    a.name.localeCompare(b.name)
  );

  // 3. キャッシュに保存
  await saveChildren(folderId, files);

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
  if (webhookUrl.startsWith("http://")) return;
  const channel = await getWatchChannel(folderId);
  if (channel && channel.expiration < Date.now() - EXPIRATION_BUFFER) {
    return;
  }
  if (channel) {
    try {
      await stopWatch(channel);
    } catch (error) {
      console.error(`Failed to stop old watch channel: ${error}`);
    }
    await deleteWatchChannel(folderId);
  }
  await enqueue({
    type: "createAndCacheWatchChannel",
    webHookUrl: webhookUrl,
    folderId,
  });
}
export async function createAndCacheWatchChannel(
  folderId: string,
  webHookUrl: string,
): Promise<void> {
  const channel = await createWatch(folderId, webHookUrl);
  await saveWatchChannel(
    folderId,
    channel,
    channel.expiration - Date.now() - EXPIRATION_BUFFER,
  );
  const expiresAt = new Date(channel.expiration).toISOString();
  console.log(
    `Created watch channel for ${folderId} ${channel.resourceId}, expires at ${expiresAt}`,
  );
}

/**
 * watch 通知を受け取った時に呼ばれるメソッド
 */
export async function update(folderId: string): Promise<void> {
  try {
    // 最新のファイルリストを取得
    const files = await driveFiles(folderId);
    const counts = await processMove(folderId, files);

    // キャッシュを更新
    if (counts > 0) {
      if (files.length === counts) {
        await saveChildren(folderId, []);
      } else {
        const files = await driveFiles(folderId);
        await saveChildren(folderId, files);
      }
    }

    console.log(`Updated cache for folder ${folderId}, ${files.length} files`);
  } catch (error) {
    console.error(`Failed to update cache for folder ${folderId}: ${error}`);
    throw error;
  }
}

async function allParents(fileId: string): Promise<DriveItem[]> {
  const item = await getDriveItem(fileId);
  if (item && item.parents && item.parents.length > 0) {
    const parent = item.parents[0];
    const grandparents = await allParents(parent);
    return [...grandparents, item];
  } else {
    return [];
  }
}

async function processMove(
  folderId: string,
  items: DriveItem[],
): Promise<number> {
  if (items.length === 0) return 0;
  const parents = await allParents(folderId);
  return doMove(items, parents);
}

/**
 * フォルダツリーを再帰的に取得
 */
export async function getTree(
  folderId: string,
): Promise<DriveItem[]> {
  const children = await getChildren(folderId, false);
  const folders = children.filter((file) =>
    file.mimeType === "application/vnd.google-apps.folder"
  );

  const allFiles: DriveItem[] = [...children];

  for (const folder of folders) {
    const subTree = await getTree(folder.id);
    allFiles.push(...subTree);
  }

  return allFiles;
}

/**
 * 親フォルダ内に同名のフォルダを検索、なければ作成
 */
export async function getOrCreateFolder(
  parentId: string,
  folderName: string,
): Promise<DriveItem> {
  const children = await getChildren(parentId);
  const existing = children.find((item) =>
    isFolder(item) && item.name === folderName
  );
  if (existing) return existing;

  return getOrCreateFolderInDrive(parentId, folderName);
}
