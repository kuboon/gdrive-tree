import type { Context } from "@hono/hono";
import {
  getOrCreateFolder,
  moveFile,
  renameFile,
} from "./gdrive.ts";
import { getChildren } from "./tree/mod.ts";

// フォルダIDを指定
const FOLDER_A_ID = "1QAArkDWkzjVBJtw6Uosq5Iki3NdgMZLh";
const FOLDER_B_ID = "1PRWrByLt53bCQ5g1tbxKsqEzhKIpdsS7";

export interface MoveAllResult {
  status: "success" | "error";
  processedFiles: number;
  logs: string[];
  error?: string;
}


function isFolder(file: { mimeType: string }): boolean {
  return file.mimeType === "application/vnd.google-apps.folder";
}
function isFile(file: { mimeType: string }): boolean {
  return !isFolder(file);
}
/**
 * FOLDER_A 内の各サブフォルダにあるファイルを、
 * FOLDER_B 内の同名フォルダへ移動する
 */
export async function moveAllFiles(): Promise<MoveAllResult> {
  const logs: string[] = [];
  let processedCount = 0;

  try {
    // 階層1のフォルダをすべて取得
    const foldersL1 = (await getChildren(FOLDER_A_ID)).filter(isFolder);
    logs.push(`Found ${foldersL1.length} L1 folders`);

    // L1フォルダを並行処理
    await Promise.all(foldersL1.map(async (folderL1) => {
      const nameL1 = folderL1.name;
      logs.push(`Processing L1: ${nameL1}`);

      // 階層2のフォルダを取得と、targetL1の作成を並行実行
      const [foldersL2, targetL1] = await Promise.all([
        getChildren(folderL1.id).then(children => children.filter(isFolder)),
        getOrCreateFolder(FOLDER_B_ID, nameL1),
      ]);

      // L2フォルダを並行処理
      await Promise.all(foldersL2.map(async (folderL2) => {
        const nameL2 = folderL2.name;

        // 階層3のフォルダを取得と、targetL2の作成を並行実行
        const [foldersL3, targetL2] = await Promise.all([
          getChildren(folderL2.id).then(children => children.filter(isFolder)),
          getOrCreateFolder(targetL1.id, nameL2),
        ]);

        // L3フォルダを並行処理
        await Promise.all(foldersL3.map(async (folderL3) => {
          const nameL3 = folderL3.name;

          // ファイル取得とtargetL3の作成を並行実行
          const [files, targetL3] = await Promise.all([
            getChildren(folderL3.id).then(children => children.filter(isFile)),
            getOrCreateFolder(targetL2.id, nameL3),
          ]);

          const prefix = `${nameL1}-${nameL2}-${nameL3}-`;

          // 各ファイルの処理を並行実行
          await Promise.all(files.map(async (file) => {
            const originalName = file.name;
            const newName = prefix + originalName;

            // リネームと移動を順次実行（同一ファイルへの操作なので）
            await renameFile(file.id, newName);
            await moveFile(file.id, folderL3.id, targetL3.id);

            processedCount++;
            logs.push(`Processed: ${newName}`);
            console.log(`Processed: ${newName}`);
          }));
        }));
      }));
    }));

    return {
      status: "success",
      processedFiles: processedCount,
      logs,
    };
  } catch (error) {
    console.error("Error in moveAllFiles:", error);
    return {
      status: "error",
      processedFiles: processedCount,
      logs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Hono ハンドラ
 */
export async function moveAllHandler(c: Context) {
  try {
    const result = await moveAllFiles();

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
  Deno.cron("Log a message", "* * * * *", async () => {
    console.log(new Date(), `Starting file migration...`);
    console.log(`Source folder: ${FOLDER_A_ID}`);
    console.log(`Target folder: ${FOLDER_B_ID}`);

    const result = await moveAllFiles();

    console.log("\n=== Results ===");
    console.log(`Status: ${result.status}`);
    console.log(`Processed files: ${result.processedFiles}`);

    if (result.error) {
      console.error(`Error: ${result.error}`);
    }

    console.log("\n=== Logs ===");
    result.logs.forEach((log) => console.log(log));
  });

  // Deno.exit(result.status === "success" ? 0 : 1);
}
