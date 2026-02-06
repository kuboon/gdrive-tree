import type { DriveFile } from "./model.ts";

// const basePath = "https://gdrive-tree.kuboon-tokyo.deno.net"
const basePath = "";

export async function fetchFolderContents(
  folderId: string,
  refresh = false,
): Promise<DriveFile[]> {
  const url = `${basePath}/api/folders/${folderId}${
    refresh ? "?refresh=true" : ""
  }`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch folder: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchFolderTree(
  folderId: string,
): Promise<DriveFile[]> {
  const url = `${basePath}/api/tree/${folderId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch folder tree: ${response.statusText}`);
  }
  return await response.json();
}
