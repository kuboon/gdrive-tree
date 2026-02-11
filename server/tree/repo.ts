import { runTask, type Task } from "./taskRunner.ts";
import type { DriveItem, WatchChannel } from "./types.ts";
import { RateLimitError } from "../gdrive.ts";
import { monotonicUlid } from "@std/ulid";

const kv = await Deno.openKv();
const expireIn = 40 * 60 * 1000; // 40分
const memoryCache = new Map<Deno.KvKey, { data: unknown; expireAt: number }>();

class KvEntry<T> {
  constructor(
    public key: Deno.KvKey,
    private options: { expireIn?: number } = { expireIn },
  ) {}
  async get(): Promise<T | null> {
    if (memoryCache.has(this.key)) {
      const { data, expireAt } = memoryCache.get(this.key)!;
      if (Date.now() < expireAt) {
        return data as T;
      } else {
        memoryCache.delete(this.key);
      }
    }
    const result = await kv.get<T>(this.key);
    if (result.value !== null) {
      memoryCache.set(this.key, {
        data: result.value,
        expireAt: Date.now() + (this.options.expireIn ?? expireIn),
      });
    }
    return result.value;
  }
  async set(value: T, options?: { expireIn?: number }): Promise<void> {
    memoryCache.set(this.key, {
      data: value,
      expireAt: Date.now() +
        (options?.expireIn ?? this.options.expireIn ?? expireIn),
    });
    await kv.set(this.key, value, options || this.options);
  }
  async update(
    updater: (current: T | null) => T | null,
  ): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    const current = await kv.get<T>(this.key);
    const updated = updater(current.value);
    const atomic = kv.atomic().check(current);
    if (updated === null) {
      memoryCache.delete(this.key);
      return atomic.delete(this.key).commit();
    }
    memoryCache.set(this.key, {
      data: updated,
      expireAt: Date.now() + (this.options.expireIn ?? expireIn),
    });
    return atomic.set(this.key, updated).commit();
  }
  async delete(): Promise<void> {
    memoryCache.delete(this.key);
    await kv.delete(this.key);
  }
}
class KvListEntry<T> {
  constructor(
    public key: Deno.KvKey,
    private options: { expireIn?: number } = { expireIn },
  ) {}
  async *[Symbol.asyncIterator](): AsyncIterableIterator<KvEntry<T>> {
    const list = kv.list<T>({ prefix: this.key });
    for await (const entry of list) {
      yield new KvEntry<T>(entry.key, this.options);
    }
  }
  async new(value: T, options?: { expireIn?: number }): Promise<void> {
    let done = false;
    while (!done) {
      const ulid = monotonicUlid();
      const entry = new KvEntry<T>(
        [...this.key, ulid],
        options || this.options,
      );
      const result = await entry.update((current) => {
        if (current !== null) return current;
        done = true;
        return value;
      });
      if (!result.ok) done = false;
    }
  }
}
/**
 * KV キーの生成を集約
 */
const repos = {
  watchChannel: (folderId: string) =>
    new KvEntry<WatchChannel>(["watch_channel", folderId], {
      expireIn: 24 * 60 * 60 * 1000, // 1日間
    }),
  driveItem: (itemId: string) => new KvEntry<DriveItem>(["drive_item", itemId]),
  driveItemByParent: (parentId: string) =>
    new KvEntry<string[]>(["drive_item_by_parent", parentId]),
  tasks: () => new KvListEntry<Task[]>(["tasks"]),
} as const;

export function getWatchChannel(
  folderId: string,
): Promise<WatchChannel | null> {
  return repos.watchChannel(folderId).get();
}

export async function saveWatchChannel(
  folderId: string,
  channel: WatchChannel,
  expireIn: number,
): Promise<void> {
  const repo = repos.watchChannel(folderId);
  await repo.set(channel, { expireIn });
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

// export async function deleteCachedFiles(folderId: string): Promise<void> {
//   await repos.driveItemByParent(folderId).delete();
// }

export function getDriveItem(
  folderId: string,
): Promise<DriveItem | null> {
  return repos.driveItem(folderId).get();
}

const tasksRepo = repos.tasks();
export function enqueue(...tasks: Task[]): Promise<void> {
  return tasksRepo.new(tasks);
}
export async function runQueue(limitMs: number = 5000): Promise<void> {
  const tasks: Task[] = [];
  const endAt = performance.now() + limitMs;
  const inLimit = () => performance.now() < endAt;
  while (inLimit()) {
    for await (const entry of tasksRepo) {
      await entry.update((current) => {
        if (current && current.length > 0) {
          tasks.push(...current.splice(0, 10));
        }
        return current;
      });
      if (tasks.length === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        break;
      }
      console.log(`Loaded tasks, queue length: ${tasks.length}`);
      while (tasks.length > 0) {
        const task = tasks.shift()!;
        try {
          await runTask(task);
        } catch (error_) {
          const error = error_ instanceof Error
            ? error_
            : new Error(String(error_));
          if (error instanceof RateLimitError) {
            console.warn(`RateLimitError. Wait for 5000 ms`);
            await enqueue(task);
            await new Promise((r) => setTimeout(r, 5000));
          } else {
            console.error(
              `Error running task ${JSON.stringify(task)}: ${error.message}`,
            );
          }
          if (!inLimit()) {
            console.log(`Time limit reached, re-enqueue remaining tasks`);
            await enqueue(...tasks);
            break;
          }
        }
      }
    }
  }
}
