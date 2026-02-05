import type { DriveFile, WatchChannel } from "./types.ts";

const kv = await Deno.openKv();

/**
 * watch channel の管理
 */
export async function getWatchChannel(
  folderId: string,
): Promise<WatchChannel | null> {
  const key = ["watch_channel", folderId];
  const result = await kv.get<WatchChannel>(key);
  return result.value;
}

export async function saveWatchChannel(
  folderId: string,
  channel: WatchChannel,
): Promise<void> {
  const key = ["watch_channel", folderId];
  const idKey = ["watch_channel_by_id", channel.id];
  await kv.set(key, channel);
  await kv.set(idKey, folderId);
}

export async function deleteWatchChannel(folderId: string): Promise<void> {
  const channel = await getWatchChannel(folderId);
  const key = ["watch_channel", folderId];
  await kv.delete(key);
  if (channel) {
    const idKey = ["watch_channel_by_id", channel.id];
    await kv.delete(idKey);
  }
}

/**
 * DriveFile リストのキャッシュ管理
 */
export async function getCachedFiles(
  folderId: string,
): Promise<DriveFile[] | null> {
  const key = ["folder_files", folderId];
  const result = await kv.get<DriveFile[]>(key);
  return result.value;
}

export async function saveCachedFiles(
  folderId: string,
  files: DriveFile[],
): Promise<void> {
  const key = ["folder_files", folderId];
  await kv.set(key, files);
}

export async function deleteCachedFiles(folderId: string): Promise<void> {
  const key = ["folder_files", folderId];
  await kv.delete(key);
}

/**
 * channelId から folderId を取得
 */
export async function getFolderIdByChannelId(
  channelId: string,
): Promise<string | null> {
  const key = ["watch_channel_by_id", channelId];
  const result = await kv.get<string>(key);
  return result.value;
}
