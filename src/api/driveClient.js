// API client for server-side Google Drive access

// List files from Google Drive
export async function listDriveFiles(options) {
  const response = await fetch("/api/drive/files/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch files");
  }

  return await response.json();
}

// Purge the cache (for manual refresh)
export async function purgeDriveCache() {
  const response = await fetch("/api/drive/cache/purge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to purge cache");
  }

  return await response.json();
}
