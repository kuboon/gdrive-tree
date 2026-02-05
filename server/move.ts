import type { Context } from "@hono/hono";
import { getOrCreateFolder, moveFile } from "./gdrive.ts";
import { getChildren, update } from "./tree/mod.ts";

// フォルダIDを指定
const UP_FOLDER_ID = "1QAArkDWkzjVBJtw6Uosq5Iki3NdgMZLh";
const FOLDER_B_ID = "1PRWrByLt53bCQ5g1tbxKsqEzhKIpdsS7";

export interface MoveAllResult {
  status: "success" | "error";
  processedFiles: number;
  foldersCount: number;
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
  function addLog(message: string) {
    console.log(message);
    logs.push(message);
  }
  let foldersCount = 0;
  let processedCount = 0;

  try {
    // 階層1のフォルダをすべて取得
    const foldersL1 = (await getChildren(UP_FOLDER_ID)).filter(isFolder);
    addLog(`Found ${foldersL1.length} L1 folders`);

    // L1フォルダを並行処理
    await Promise.all(foldersL1.map(async (folderL1) => {
      const nameL1 = folderL1.name;

      // 階層2のフォルダを取得と、targetL1の作成を並行実行
      const [foldersL2, targetL1] = await Promise.all([
        getChildren(folderL1.id).then((children) => children.filter(isFolder)),
        getOrCreateFolder(FOLDER_B_ID, nameL1),
      ]);

      // L2フォルダを並行処理
      await Promise.all(foldersL2.map(async (folderL2) => {
        const nameL2 = folderL2.name;

        // 階層3のフォルダを取得と、targetL2の作成を並行実行
        const [foldersL3, targetL2] = await Promise.all([
          getChildren(folderL2.id).then((children) =>
            children.filter(isFolder)
          ),
          getOrCreateFolder(targetL1.id, nameL2),
        ]);

        // L3フォルダを並行処理
        await Promise.all(foldersL3.map(async (folderL3) => {
          const nameL3 = folderL3.name;

          foldersCount++;

          // ファイル取得とtargetL3の作成を並行実行
          const [files, targetL3] = await Promise.all([
            getChildren(folderL3.id).then((children) =>
              children.filter(isFile)
            ),
            getOrCreateFolder(targetL2.id, nameL3),
          ]);

          const prefix = `${nameL1}-${nameL2}-${nameL3}-`;

          // 各ファイルの処理を並行実行
          await Promise.all(files.map(async (file) => {
            const originalName = file.name;
            const newName = prefix + originalName;

            // 移動とリネームを1回のAPIコールで実行
            const moved = await moveFile(
              file.id,
              folderL3.id,
              targetL3.id,
              newName,
            );

            processedCount++;
            addLog(
              `Processed: ${newName}, ${JSON.stringify(moved)}`,
            );
          }));
          if (files.length > 0) {
            await update(folderL3.id);
          }
        }));
      }));
    }));

    return {
      status: "success",
      foldersCount,
      processedFiles: processedCount,
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
  const result = await moveAllFiles();
  console.log("\n=== Results ===");
  console.log(`Status: ${result.status}`);
  console.log(`Folders processed: ${result.foldersCount}`);
  console.log(`Processed files: ${result.processedFiles}`);

  if (result.error) {
    console.error(`Error: ${result.error}`);
  }
  Deno.cron("Log a message", "* * * * *", async () => {
    console.log(new Date(), `Starting file migration...`);

    const result = await moveAllFiles();

    console.log("\n=== Results ===");
    console.log(`Status: ${result.status}`);
    console.log(`Folders processed: ${result.foldersCount}`);
    console.log(`Processed files: ${result.processedFiles}`);

    if (result.error) {
      console.error(`Error: ${result.error}`);
    }
  });

  // Deno.exit(result.status === "success" ? 0 : 1);
}
