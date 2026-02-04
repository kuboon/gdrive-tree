import { getAccessToken } from "./oauth.ts";

export interface DriveFile {
  parents: string[];
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  iconLink: string;
}

// API Key による認証（オプション）
const GOOGLE_KEY = Deno.env.get("GOOGLE_KEY");

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
  refresh = false,
): Promise<DriveFile[]> {
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

  const response = await cachedFetch(url, refresh, headers);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Drive API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }
  const json = await response.json() as { files: DriveFile[] };
  return json.files.sort((a, b) => a.name.localeCompare(b.name));
}
async function cachedFetch(
  url: string,
  refresh: boolean,
  headers: Record<string, string>,
) {
  const cache = await caches.open("gdrive-folder");
  if (refresh) {
    cache.delete(url);
  } else {
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      return cachedResponse;
    }
  }
  const res = await fetch(url, { headers });
  cache.put(url, res.clone());
  return res;
}

/**
 * フォルダ内のサブフォルダを取得
 */
export async function getFolders(folderId: string): Promise<DriveFile[]> {
  const params = new URLSearchParams();
  params.append("includeItemsFromAllDrives", "true");
  params.append("supportsAllDrives", "true");
  params.append("pageSize", "100");
  params.append("fields", "files(id,name,mimeType,parents)");
  const query =
    `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
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
  const json = await response.json() as { files: DriveFile[] };
  return json.files;
}

/**
 * フォルダ内のファイルを取得（フォルダは除く）
 */
export async function getFiles(folderId: string): Promise<DriveFile[]> {
  const params = new URLSearchParams();
  params.append("includeItemsFromAllDrives", "true");
  params.append("supportsAllDrives", "true");
  params.append("pageSize", "1000");
  params.append("fields", "files(id,name,mimeType,parents)");
  const query =
    `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`;
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
  const json = await response.json() as { files: DriveFile[] };
  return json.files;
}

/**
 * 親フォルダ内に同名のフォルダを検索、なければ作成
 */
export async function getOrCreateFolder(
  parentId: string,
  folderName: string,
): Promise<DriveFile> {
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
  const searchJson = await searchResponse.json() as { files: DriveFile[] };

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
  return await createResponse.json() as DriveFile;
}

/**
 * ファイルをリネーム
 */
export async function renameFile(
  fileId: string,
  newName: string,
): Promise<void> {
  const params = new URLSearchParams();
  params.append("supportsAllDrives", "true");
  const url = await buildApiUrl(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    params,
  );
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });
  if (!response.ok) {
    throw new Error(`Rename failed: ${response.statusText}`);
  }
}

/**
 * ファイルを移動（親フォルダを変更）
 */
export async function moveFile(
  fileId: string,
  oldParentId: string,
  newParentId: string,
): Promise<void> {
  const params = new URLSearchParams();
  params.append("supportsAllDrives", "true");
  params.append("addParents", newParentId);
  params.append("removeParents", oldParentId);

  const url = await buildApiUrl(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    params,
  );
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Move failed: ${response.statusText}`);
  }
}
