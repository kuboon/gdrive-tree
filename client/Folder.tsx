import type { Handle } from "@remix-run/component";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: number;
  webViewLink: string;
  iconLink: string;
  parents?: string[];
}

// Fetch folder contents from the server API
async function fetchFolderContents(
  folderId: string,
  refresh = false,
): Promise<DriveFile[]> {
  const url = `/api/folders/${folderId}${refresh ? "?refresh=true" : ""}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch folder: ${response.statusText}`);
  }
  return await response.json();
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Folder component: displays a folder and its contents
export function Folder(
  handle: Handle,
  setup: {
    folderId: string;
    name: string;
    depth: number;
    webViewLink: string;
  },
) {
  let expanded = false;
  let loading = false;
  let error: string | null = null;
  let files: DriveFile[] = [];

  const loadContents = async (refresh = false) => {
    loading = true;
    error = null;
    handle.update();

    try {
      files = await fetchFolderContents(setup.folderId, refresh);
      loading = false;
      handle.update();
    } catch (e) {
      error = e instanceof Error ? e.message : "Unknown error";
      loading = false;
      handle.update();
    }
  };

  const toggleExpand = () => {
    expanded = !expanded;
    if (expanded && files.length === 0) {
      loadContents();
    } else {
      handle.update();
    }
  };

  const refresh = () => {
    loadContents(true);
  };

  return () => {
    const folders = files.filter((f) =>
      f.mimeType === "application/vnd.google-apps.folder"
    );
    const nonFolders = files.filter((f) =>
      f.mimeType !== "application/vnd.google-apps.folder"
    );

    return (
      <div
        css={{
          marginLeft: `${setup.depth * 5}px`,
          paddingLeft: setup.depth > 0 ? "10px" : "0",
        }}
      >
        <div
          css={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 0",
            "&:hover": {
              backgroundColor: "#f5f5f5",
            },
          }}
        >
          <button
            type="button"
            on={{ click: toggleExpand }}
            css={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "16px",
              padding: "4px 8px",
              minWidth: "24px",
            }}
            aria-label={expanded ? "Collapse folder" : "Expand folder"}
          >
            {expanded ? "▼" : "▶"}
          </button>
          <a
            href={setup.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            css={{
              fontWeight: "bold",
              textDecoration: "none",
              color: "#202124",
              "&:hover": {
                textDecoration: "underline",
                color: "#1a73e8",
              },
            }}
          >
            📁 {setup.name}
          </a>
          <button
            type="button"
            on={{ click: refresh }}
            disabled={loading}
            css={{
              border: "none",
              background: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "16px",
              padding: "4px",
              opacity: loading ? 0.5 : 1,
              "&:hover": {
                opacity: loading ? 0.5 : 0.7,
              },
            }}
            aria-label="Refresh folder contents"
          >
            🔄
          </button>
        </div>

        {expanded && (
          <div>
            {loading && (
              <div
                css={{
                  padding: "8px",
                  color: "#666",
                  fontStyle: "italic",
                }}
              >
                Loading...
              </div>
            )}

            {error && (
              <div
                css={{
                  padding: "8px",
                  color: "#d32f2f",
                  backgroundColor: "#ffebee",
                  borderRadius: "4px",
                  margin: "4px 0",
                }}
              >
                Error: {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {/* Render folders first */}
                {folders.map((folder) => (
                  <Folder
                    key={folder.id}
                    setup={{
                      folderId: folder.id,
                      name: folder.name,
                      depth: setup.depth + 1,
                      webViewLink: folder.webViewLink,
                    }}
                  />
                ))}

                {/* Render non-folder files */}
                {nonFolders.map((file) => (
                  <div
                    key={file.id}
                    css={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "4px 0",
                      marginLeft: `${(setup.depth + 1) * 10}px`,
                      "&:hover": {
                        backgroundColor: "#f5f5f5",
                      },
                    }}
                  >
                    <img
                      src={file.iconLink}
                      alt=""
                      css={{
                        width: "16px",
                        height: "16px",
                      }}
                    />
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      css={{
                        textDecoration: "none",
                        color: "#1a73e8",
                        flex: 1,
                        "&:hover": {
                          textDecoration: "underline",
                        },
                      }}
                    >
                      {file.name}
                    </a>
                    {file.size && (
                      <span
                        css={{
                          fontSize: "12px",
                          color: "#666",
                        }}
                      >
                        {formatFileSize(file.size)}
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    );
  };
}
