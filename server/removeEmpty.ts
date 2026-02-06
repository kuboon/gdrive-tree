import { trashFile, isFolder } from "./gdrive.ts";
import { getChildren } from "./tree/mod.ts";

// move.ts の DL_FOLDER_ID を使用
const DL_FOLDER_ID = "1PRWrByLt53bCQ5g1tbxKsqEzhKIpdsS7";

export interface RemoveEmptyResult {
  status: "success" | "error";
  deletedFolders: number;
  logs: string[];
  error?: string;
}

/**
 * 空のフォルダを再帰的に削除する
 * @param folderId 対象フォルダのID
 * @returns 削除されたフォルダの数
 */
async function removeEmptyFoldersRecursive(
  folderId: string,
  addLog: (message: string) => void,
): Promise<[number, boolean]> {
  let deletedCount = 0;
  let deleteSelf = false;

  // 子要素を取得
  const children = await getChildren(folderId);

  // フォルダのみをフィルタ
  const folders = children.filter(isFolder);

  // 各サブフォルダを再帰的に処理
  let deletedChildren = 0;
  const results = await Promise.all(
    folders.map((folder) => removeEmptyFoldersRecursive(folder.id, addLog)),
  );
  for (const [deleted, deletedSelf] of results) {
    deletedCount += deleted;
    if (deletedSelf) deletedChildren++;
  }

  // 子要素が全て削除されていたら、自分自身も削除
  if (children.length === deletedChildren) {
    try {
      await trashFile(folderId);
      addLog(`Deleted empty folder: ${folderId}`);
      deletedCount++;
      deleteSelf = true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("Not Found")) {
        deleteSelf = true;
      }
      addLog(`Failed to delete folder ${folderId}: ${errorMsg}`);
    }
  }

  return [deletedCount, deleteSelf];
}

/**
 * DL_FOLDER_ID 内の空フォルダをすべて削除
 */
export async function removeAllEmptyFolders(): Promise<RemoveEmptyResult> {
  const logs: string[] = [];
  function addLog(message: string) {
    console.log(message);
    logs.push(message);
  }

  try {
    addLog(`Starting empty folder removal in ${DL_FOLDER_ID}`);

    const children = await getChildren(DL_FOLDER_ID);
    const folders = children.filter(isFolder);

    addLog(`Found ${folders.length} top-level folders to check`);

    let totalDeleted = 0;

    // 各トップレベルフォルダを処理
    for (const folder of folders) {
      const [deleted, _] = await removeEmptyFoldersRecursive(folder.id, addLog);
      totalDeleted += deleted;
    }

    addLog(`Completed. Total deleted: ${totalDeleted}`);

    return {
      status: "success",
      deletedFolders: totalDeleted,
      logs,
    };
  } catch (error) {
    addLog(
      `Error in removeAllEmptyFolders: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      status: "error",
      deletedFolders: 0,
      logs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 単体実行時のメイン処理
if (import.meta.main) {
  const result = await removeAllEmptyFolders();
  console.log("\n=== Results ===");
  console.log(`Status: ${result.status}`);
  console.log(`Deleted folders: ${result.deletedFolders}`);

  if (result.error) {
    console.error(`Error: ${result.error}`);
  }

  Deno.exit(result.status === "success" ? 0 : 1);
}
