import type { Context } from "@hono/hono";
import { isFolder, moveFile } from "./gdrive.ts";
import {
  ensureWatchChannel,
  getChildren,
  getOrCreateFolder,
} from "./tree/mod.ts";
import type { DriveItem } from "./tree/types.ts";
import { runQueue } from "./tree/repo.ts";

// フォルダIDを指定
export const UP_FOLDER_ID = "1QAArkDWkzjVBJtw6Uosq5Iki3NdgMZLh";
const DL_FOLDER_ID = "1PRWrByLt53bCQ5g1tbxKsqEzhKIpdsS7";

export interface MoveAllResult {
  status: "success" | "error";
  processedFiles: number;
  foldersCount: number;
  logs: string[];
  error?: string;
}

/**
 * FOLDER_A 内の各サブフォルダにあるファイルを、
 * FOLDER_B 内の同名フォルダへ移動する
 */
export async function moveAllFiles(
  { origin }: { origin: string },
): Promise<MoveAllResult> {
  const logs: string[] = [];
  function addLog(message: string) {
    console.log(message);
    logs.push(message);
  }
  let foldersCount = 0;
  let processedFiles = 0;

  try {
    // 階層1のフォルダをすべて取得
    const foldersL1 = (await getChildren(UP_FOLDER_ID)).filter(isFolder);
    // addLog(`Found ${foldersL1.length} L1 folders`);

    // L1フォルダを並行処理
    await Promise.all(foldersL1.map(async (folderL1) => {
      const webHookUrl = `${origin}/api/watch/${folderL1.id}`;
      await ensureWatchChannel(webHookUrl, folderL1.id);
      // 階層2のフォルダを取得
      const foldersL2 = (await getChildren(folderL1.id, true)).filter(isFolder);
      await Promise.all(foldersL2.map(async (folderL2) => {
        // const webHookUrl = `${origin}/api/watch/${folderL2.id}`;
        // await ensureWatchChannel(webHookUrl, folderL2.id);
        // 階層3のフォルダを取得
        const foldersL3 = (await getChildren(folderL2.id, true)).filter(
          isFolder,
        );
        await Promise.all(foldersL3.map(async (folderL3) => {
          // const webHookUrl = `${origin}/api/watch/${folderL3.id}`;
          // await ensureWatchChannel(webHookUrl, folderL3.id);
          foldersCount++;

          // ファイル取得
          const files = await getChildren(folderL3.id);

          if (files.length === 0) return;
          await doMove(files, [
            folderL1,
            folderL2,
            folderL3,
          ]);
          processedFiles += files.length;
        }));
      }));
    }));

    return {
      status: "success",
      foldersCount,
      processedFiles,
      logs,
    };
  } catch (error) {
    addLog(
      `Error in moveAllFiles: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      status: "error",
      foldersCount,
      processedFiles: processedFiles,
      logs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getTargetFolder(
  parentId: string,
  folderNames: string[],
): Promise<DriveItem> {
  const folderName = folderNames[0];
  const target = await getOrCreateFolder(parentId, folderName);
  if (folderNames.length == 1) return target;
  return getTargetFolder(target.id, folderNames.slice(1));
}

export async function doMove(
  items: { name: string; id: string }[],
  parents: DriveItem[],
): Promise<number> {
  if (parents.length !== 3) return 0;
  if (parents[0].parents[0] !== UP_FOLDER_ID) return 0;
  const folderNames = parents.map((f) => f.name);
  const prefix = folderNames.join("-") + "-";
  const parentId = parents[parents.length - 1].id;

  const target = await getTargetFolder(DL_FOLDER_ID, folderNames);

  // 各ファイルの処理を並行実行
  await Promise.all(items.map(async (file) => {
    const newName = prefix + file.name;

    // 移動とリネームを1回のAPIコールで実行
    await moveFile(
      file.id,
      parentId,
      target.id,
      newName,
    );

    console.log(
      `Processed: ${newName}`,
    );
  }));
  if (items.length > 0) {
    await Promise.all([
      getChildren(parentId, true),
      getChildren(target.id, true),
    ]);
  }
  return items.length;
}

/**
 * Hono ハンドラ
 */
export async function moveAllHandler(c: Context) {
  const origin = new URL(c.req.url).origin;
  try {
    const [result, _] = await Promise.all([
      moveAllFiles({ origin }),
      runQueue(10000),
    ]);
    if (result.processedFiles > 0) {
      console.log(
        `moveAllHandler: Processed ${result.processedFiles} files in ${result.foldersCount} folders`,
        result.logs,
      );
    }

    if (result.status === "error") {
      return c.json({
        error: "Internal server error",
        details: result.error,
        logs: result.logs,
      }, 500);
    }

    return c.json(result);
  } catch (error) {
    console.error("Error in /api/move-all:", error);
    return c.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

// 単体実行時のメイン処理
if (import.meta.main) {
  // const origin = "https://gdrive-tree.kuboon-tokyo.deno.net";
  const origin = "http://localhost:8787";
  const result = await moveAllFiles({ origin });
  console.log("\n=== Results ===");
  console.log(`Status: ${result.status}`);
  console.log(`Folders processed: ${result.foldersCount}`);
  console.log(`Processed files: ${result.processedFiles}`);

  if (result.error) {
    console.error(`Error: ${result.error}`);
  }
  Deno.cron("moveAllFiles", "* * * * *", async () => {
    console.log(new Date(), `\nStarting file migration...`);

    const [result, _] = await Promise.all([
      moveAllFiles({ origin }),
      runQueue(550000),
    ]);
    console.log(new Date(), "\n=== Results ===");
    console.log(`Status: ${result.status}`);
    console.log(`Folders processed: ${result.foldersCount}`);
    console.log(`Processed files: ${result.processedFiles}`);

    if (result.error) {
      console.error(`Error: ${result.error}`);
    }
  });

  // Deno.exit(result.status === "success" ? 0 : 1);
}
