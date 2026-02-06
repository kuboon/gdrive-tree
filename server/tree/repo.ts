import type { DriveItem, WatchChannel } from "./types.ts";

const kv = await Deno.openKv();
const expireIn = 20 * 60 * 1000; // 20分
class KvEntry<T> {
  constructor(
    public key: Deno.KvKey,
    private options: { expireIn?: number } = { expireIn },
  ) {}
  async get(): Promise<T | null> {
    const result = await kv.get<T>(this.key);
    return result.value;
  }
  async set(value: T, options?: { expireIn?: number }): Promise<void> {
    await kv.set(this.key, value, options || this.options);
  }
  async delete(): Promise<void> {
    await kv.delete(this.key);
  }
}

/**
 * KV キーの生成を集約
 */
const repos = {
  watchChannel: (folderId: string) =>
    new KvEntry<WatchChannel>(["watch_channel", folderId], {
      expireIn: 7 * 24 * 60 * 60 * 1000,
    }), // 7日間
  driveItem: (itemId: string) => new KvEntry<DriveItem>(["drive_item", itemId]),
  driveItemByParent: (parentId: string) =>
    new KvEntry<string[]>(["drive_item_by_parent", parentId]),
} as const;

/**
 * watch channel の管理
 */
export function getWatchChannel(
  folderId: string,
): Promise<WatchChannel | null> {
  const repo = repos.watchChannel(folderId);
  return repo.get();
}

export async function saveWatchChannel(
  folderId: string,
  channel: WatchChannel,
): Promise<void> {
  const repo = repos.watchChannel(folderId);
  await repo.set(channel);
}

export async function deleteWatchChannel(folderId: string): Promise<void> {
  await repos.watchChannel(folderId).delete();
}

/**
 * DriveFile リストのキャッシュ管理
 */
export async function getChildren(
  folderId: string,
): Promise<DriveItem[] | null> {
  const ids = await repos.driveItemByParent(folderId).get();
  if (!ids) return null;

  // Deno KV の getMany は最大10個までなので、バッチ処理
  const batchSize = 10;
  const allItems: DriveItem[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const result = await kv.getMany(batch.map((id) => repos.driveItem(id).key));
    const items = result.map((r) => r.value).filter((v): v is DriveItem =>
      v !== null
    );
    allItems.push(...items);
  }

  return allItems;
}

export async function saveChildren(
  folderId: string,
  files: DriveItem[],
): Promise<void> {
  const repo = repos.driveItemByParent(folderId);
  await repo.set(files.map((file) => file.id));
  await Promise.all(files.map((file) => repos.driveItem(file.id).set(file)));
}

export async function deleteCachedFiles(folderId: string): Promise<void> {
  await repos.driveItemByParent(folderId).delete();
}

export function getDriveItem(
  folderId: string,
): Promise<DriveItem | null> {
  return repos.driveItem(folderId).get();
}
