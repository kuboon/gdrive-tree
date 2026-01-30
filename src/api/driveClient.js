// API client for server-side Google Drive access

// List files from Google Drive folder
export async function listDriveFiles(options) {
  const { folderId, refresh = false } = options;
  const id = folderId || "root";
  
  const url = `/api/folders/${id}${refresh ? "?refresh=true" : ""}`;
  const response = await fetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch files");
  }

  return await response.json();
}
