// API client for server-side Google Drive access
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// Generate a session ID for this browser session
function getSessionId() {
  let sessionId = sessionStorage.getItem("gdrive_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("gdrive_session_id", sessionId);
  }
  return sessionId;
}

// Store the access token on the server
export async function storeToken(accessToken) {
  const sessionId = getSessionId();
  const response = await fetch(`${API_BASE_URL}/api/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accessToken, sessionId }),
  });

  if (!response.ok) {
    throw new Error("Failed to store token");
  }

  return await response.json();
}

// Revoke the token
export async function revokeToken() {
  const sessionId = getSessionId();
  const response = await fetch(`${API_BASE_URL}/api/auth/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    throw new Error("Failed to revoke token");
  }

  return await response.json();
}

// Check if user has valid credentials
export async function checkHasCredential() {
  const sessionId = getSessionId();
  const response = await fetch(`${API_BASE_URL}/api/auth/check`, {
    method: "GET",
    headers: {
      "X-Session-Id": sessionId,
    },
  });

  if (!response.ok) {
    return { hasCredential: false };
  }

  return await response.json();
}

// List files from Google Drive
export async function listDriveFiles(options) {
  const sessionId = getSessionId();
  const response = await fetch(`${API_BASE_URL}/api/drive/files/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Id": sessionId,
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch files");
  }

  return await response.json();
}
