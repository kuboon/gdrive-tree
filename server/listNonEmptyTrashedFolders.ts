import { driveFiles, isFolder, trashedFolders } from "./gdrive.ts";
import type { DriveItem } from "./tree/types.ts";

/**
 * ゴミ箱内の中身が残っているフォルダを再帰的にリストアップ
 * 最大5並列で処理
 */
export async function listNonEmptyTrashedFolders(): Promise<
  { folder: DriveItem; fileCount: number }[]
> {
  const results: { folder: DriveItem; fileCount: number }[] = [];
  const concurrencyLimit = 5;

  async function processWithConcurrency<T>(
    source: AsyncIterable<T>,
    limit: number,
    worker: (item: T) => Promise<void>,
  ) {
    const running = new Set<Promise<void>>();
    for await (const item of source) {
      const promise = worker(item);
      running.add(promise);
      promise.finally(() => running.delete(promise));
      if (running.size >= limit) {
        await Promise.race(running);
      }
    }
    await Promise.all(running);
  }

  async function countFilesRecursive(folderId: string): Promise<number> {
    const items = await driveFiles(folderId);
    let count = items.filter((item) => !isFolder(item)).length;
    const subfolders = items.filter(isFolder);
    await processWithConcurrency(
      (async function* () {
        for (const sub of subfolders) {
          yield sub;
        }
      })(),
      concurrencyLimit,
      async (sf) => {
        count += await countFilesRecursive(sf.id);
      },
    );
    return count;
  }

  await processWithConcurrency(
    trashedFolders(),
    concurrencyLimit,
    async (folder) => {
      const fileCount = await countFilesRecursive(folder.id);
      if (fileCount > 0) {
        results.push({ folder, fileCount });
      }
    },
  );

  return results;
}

if (import.meta.main) {
  console.log(await listNonEmptyTrashedFolders());
}
