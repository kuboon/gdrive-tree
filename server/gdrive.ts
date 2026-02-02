export interface DriveFile {
  parents: string[];
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  iconLink: string;
}
export async function driveFiles(
  folderId: string,
  refresh = false,
): Promise<DriveFile[]> {
  const FIXED_FIELDS =
    "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,parents)";
  const params = new URLSearchParams();
  params.append("key", Deno.env.get("GOOGLE_KEY")!);
  params.append("includeItemsFromAllDrives", "true");
  params.append("supportsAllDrives", "true");

  params.append("orderBy", "modifiedTime desc");
  params.append("pageSize", "50");

  params.append("fields", FIXED_FIELDS);
  // const folderId = "1QAArkDWkzjVBJtw6Uosq5Iki3NdgMZLh"; // up folder
  const query = `'${folderId}' in parents and trashed=false`;
  params.append("q", query);

  const response = await cachedFetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    refresh,
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Drive API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }
  const json = await response.json() as { files: DriveFile[] };
  return json.files.sort((a, b) => a.name.localeCompare(b.name));
}
async function cachedFetch(url: string, refresh: boolean) {
  const cache = await caches.open("gdrive-folder");
  if (refresh) {
    cache.delete(url);
  } else {
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      return cachedResponse;
    }
  }
  const res = await fetch(url);
  cache.put(url, res.clone());
  return res;
}
