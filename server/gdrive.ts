import { getAccessToken } from "./oauth.ts";
import type { DriveItem, WatchChannel } from "./tree/types.ts";

// API Key による認証（オプション）
const GOOGLE_KEY = Deno.env.get("GOOGLE_KEY");

export function isFolder(file: { mimeType: string }): boolean {
  return file.mimeType === "application/vnd.google-apps.folder";
}

/**
 * 認証ヘッダーを取得
 * OAuth2 トークンを優先し、なければ API Key を使用
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const accessToken = await getAccessToken();
    return {
      "Authorization": `Bearer ${accessToken}`,
    };
  } catch {
    // OAuth2 トークンが取得できない場合は API Key にフォールバック
    if (!GOOGLE_KEY) {
      throw new Error(
        "OAuth2 トークンも API Key も利用できません。環境変数を確認してください。",
      );
    }
    return {};
  }
}

/**
 * APIリクエスト用のURLを構築
 */
async function buildApiUrl(
  baseUrl: string,
  params: URLSearchParams,
): Promise<string> {
  try {
    await getAccessToken();
    // OAuth2 を使用する場合は API Key は不要
    return `${baseUrl}?${params.toString()}`;
  } catch {
    // API Key にフォールバック
    if (GOOGLE_KEY) {
      params.append("key", GOOGLE_KEY);
    }
    return `${baseUrl}?${params.toString()}`;
  }
}

export async function driveFiles(
  folderId: string,
): Promise<DriveItem[]> {
  const FIXED_FIELDS =
    "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,parents)";
  const params = new URLSearchParams();
  params.append("includeItemsFromAllDrives", "true");
  params.append("supportsAllDrives", "true");
  params.append("orderBy", "modifiedTime desc");
  params.append("pageSize", "50");

  params.append("fields", FIXED_FIELDS);
  // const folderId = "1QAArkDWkzjVBJtw6Uosq5Iki3NdgMZLh"; // up folder
  const query = `'${folderId}' in parents and trashed=false`;
  params.append("q", query);

  const url = await buildApiUrl(
    "https://www.googleapis.com/drive/v3/files",
    params,
  );
  const headers = await getAuthHeaders();

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Drive API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }
  const json = await response.json() as { files: DriveItem[] };
  const files = json.files;
  return files;
}

/**
 * 親フォルダ内に同名のフォルダを検索、なければ作成
 */
export async function getOrCreateFolder(
  parentId: string,
  folderName: string,
): Promise<DriveItem> {
  // まず検索
  const params = new URLSearchParams();
  params.append("includeItemsFromAllDrives", "true");
  params.append("supportsAllDrives", "true");
  params.append("fields", "files(id,name,mimeType,parents)");
  const query =
    `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  params.append("q", query);

  const searchUrl = await buildApiUrl(
    "https://www.googleapis.com/drive/v3/files",
    params,
  );
  const headers = await getAuthHeaders();

  const searchResponse = await fetch(searchUrl, { headers });
  if (!searchResponse.ok) {
    throw new Error(`Search failed: ${searchResponse.statusText}`);
  }
  const searchJson = await searchResponse.json() as { files: DriveItem[] };

  if (searchJson.files.length > 0) {
    return searchJson.files[0];
  }

  // なければ作成
  const createParams = new URLSearchParams();
  createParams.append("supportsAllDrives", "true");
  const createUrl = await buildApiUrl(
    "https://www.googleapis.com/drive/v3/files",
    createParams,
  );

  const createResponse = await fetch(
    createUrl,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    },
  );
  if (!createResponse.ok) {
    console.error(`getOrCreateFolder(${parentId}, ${folderName}) failed.`);
    throw new Error(`Create folder failed: ${createResponse.statusText}`);
  }
  return await createResponse.json() as DriveItem;
}

/**
 * ファイルを移動（親フォルダを変更）
 */
export async function moveFile(
  fileId: string,
  oldParentId: string,
  newParentId: string,
  newName?: string,
): Promise<DriveItem> {
  const params = new URLSearchParams();
  params.append("supportsAllDrives", "true");
  params.append("addParents", newParentId);
  params.append("removeParents", oldParentId);

  const body: Record<string, string> = {};
  if (newName) {
    body.name = newName;
  }

  const url = await buildApiUrl(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    params,
  );
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Move failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * フォルダの変更を監視する watch channel を作成
 * https://developers.google.com/workspace/drive/api/reference/rest/v3/files/watch
 */
export async function createWatch(
  folderId: string,
  webhookUrl: string,
): Promise<WatchChannel> {
  const params = new URLSearchParams();
  params.append("supportsAllDrives", "true");
  params.append("includeItemsFromAllDrives", "true");

  const url = await buildApiUrl(
    `https://www.googleapis.com/drive/v3/files/${folderId}/watch`,
    params,
  );
  const headers = await getAuthHeaders();

  const channelId = crypto.randomUUID();
  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
      expiration: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7日後
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Watch failed: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = await response.json() as {
    id: string;
    resourceId: string;
    expiration: string;
  };
  console.log(`Created watch channel: ${JSON.stringify(result)}`);

  return {
    id: result.id,
    resourceId: result.resourceId,
    expiration: parseInt(result.expiration),
  };
}

/**
 * watch channel を停止
 */
export async function stopWatch(channel: WatchChannel): Promise<void> {
  const url = "https://www.googleapis.com/drive/v3/channels/stop";
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: channel.id,
      resourceId: channel.resourceId,
    }),
  });

  if (!response.ok && response.status !== 404) {
    // 404 は channel が既に存在しない場合なので無視
    throw new Error(`Stop watch failed: ${response.statusText}`);
  }
}
