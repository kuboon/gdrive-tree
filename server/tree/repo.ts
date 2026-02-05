import type { DriveFile, WatchChannel } from "./types.ts";

const kv = await Deno.openKv();

/**
 * KV キーの生成を集約
 */
const keys = {
  watchChannel: (folderId: string) => ["watch_channel", folderId] as const,
  watchChannelById: (channelId: string) =>
    ["watch_channel_by_id", channelId] as const,
  folderFiles: (folderId: string) => ["folder_files", folderId] as const,
} as const;

/**
 * watch channel の管理
 */
export async function getWatchChannel(
  folderId: string,
): Promise<WatchChannel | null> {
  const key = keys.watchChannel(folderId);
  const result = await kv.get<WatchChannel>(key);
  return result.value;
}

export async function saveWatchChannel(
  folderId: string,
  channel: WatchChannel,
): Promise<void> {
  const key = keys.watchChannel(folderId);
  const idKey = keys.watchChannelById(channel.id);
  await kv.set(key, channel);
  await kv.set(idKey, folderId);
}

export async function deleteWatchChannel(folderId: string): Promise<void> {
  const channel = await getWatchChannel(folderId);
  const key = keys.watchChannel(folderId);
  await kv.delete(key);
  if (channel) {
    const idKey = keys.watchChannelById(channel.id);
    await kv.delete(idKey);
  }
}

/**
 * DriveFile リストのキャッシュ管理
 */
export async function getCachedFiles(
  folderId: string,
): Promise<DriveFile[] | null> {
  const key = keys.folderFiles(folderId);
  const result = await kv.get<DriveFile[]>(key);
  return result.value;
}

export async function saveCachedFiles(
  folderId: string,
  files: DriveFile[],
): Promise<void> {
  const key = keys.folderFiles(folderId);
  await kv.set(key, files, { expireIn: 20 * 60 * 1000 }); // 20分で期限切れ
}

export async function deleteCachedFiles(folderId: string): Promise<void> {
  const key = keys.folderFiles(folderId);
  await kv.delete(key);
}

/**
 * channelId から folderId を取得
 */
export async function getFolderIdByChannelId(
  channelId: string,
): Promise<string | null> {
  const key = keys.watchChannelById(channelId);
  const result = await kv.get<string>(key);
  return result.value;
}
