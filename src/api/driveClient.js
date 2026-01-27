// API client for server-side Google Drive access
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// Check if server has valid credentials
export async function checkHasCredential() {
  const response = await fetch(`${API_BASE_URL}/api/auth/check`, {
    method: "GET",
  });

  if (!response.ok) {
    return { hasCredential: false };
  }

  return await response.json();
}

// List files from Google Drive
export async function listDriveFiles(options) {
  const response = await fetch(`${API_BASE_URL}/api/drive/files/list`, {
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
