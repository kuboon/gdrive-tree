import type { Handle } from "@remix-run/component";
import {
  dispatch,
  type DriveFile,
  getFocusedItemId,
  getFolderState,
  registerFocusCallback,
  registerUpdateCallback,
} from "./model.ts";

// Element registry for focus management (View layer)
const elementRegistry = new Map<string, HTMLElement>();

function registerElement(id: string, element: HTMLElement | null) {
  if (element) {
    elementRegistry.set(id, element);
  } else {
    elementRegistry.delete(id);
  }
}

function focusElement(id: string) {
  const element = elementRegistry.get(id);
  if (element) {
    element.focus();
    element.scrollIntoView({ block: "nearest" });
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ============================================================================
// View - FileItem
// ============================================================================

function FileItem(
  _handle: Handle,
  setup: {
    file: DriveFile;
    depth: number;
    parentId?: string;
  },
) {
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        dispatch({ type: "NavigateUp" });
        break;
      case "ArrowDown":
        e.preventDefault();
        dispatch({ type: "NavigateDown" });
        break;
      case "Enter":
        e.preventDefault();
        globalThis.open(setup.file.webViewLink, "_blank");
        break;
    }
  };

  const handleFocus = () => {
    dispatch({ type: "SetFocus", id: setup.file.id });
  };

  return () => {
    const isFocused = getFocusedItemId() === setup.file.id;

    return (
      <div
        connect={(el, signal) => {
          registerElement(setup.file.id, el);
          dispatch({
            type: "RegisterItem",
            id: setup.file.id,
            itemType: "file",
            parentId: setup.parentId,
          });

          // Focus if this is the focused item
          if (isFocused) {
            focusElement(setup.file.id);
          }

          signal.addEventListener("abort", () => {
            registerElement(setup.file.id, null);
            dispatch({ type: "UnregisterItem", id: setup.file.id });
          });
        }}
        tabIndex={0}
        on={{
          keydown: handleKeyDown,
          focus: handleFocus,
        }}
        css={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 0",
          marginLeft: `${setup.depth * 10}px`,
          outline: "none",
          "&:hover": {
            backgroundColor: "#f5f5f5",
          },
          "&:focus": {
            backgroundColor: "#e8f0fe",
            boxShadow: "0 0 0 2px #1a73e8",
          },
        }}
      >
        <img
          src={setup.file.iconLink}
          alt=""
          css={{
            width: "16px",
            height: "16px",
          }}
        />
        <a
          href={setup.file.webViewLink}
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
          {setup.file.name}
        </a>
        {setup.file.size && (
          <span
            css={{
              fontSize: "12px",
              color: "#666",
            }}
          >
            {formatFileSize(setup.file.size)}
          </span>
        )}
      </div>
    );
  };
}

// Folder component: displays a folder and its contents
// View - Folder
// ============================================================================

export function Folder(
  handle: Handle,
  setup: {
    folderId: string;
    name: string;
    depth: number;
    webViewLink: string;
    parentId?: string;
  },
) {
  // Register this component's update callback
  let unregister: (() => void) | null = null;

  const initialize = () => {
    if (!unregister) {
      unregister = registerUpdateCallback(() => handle.update());
    }
  };

  initialize();

  // Keyboard event handlers
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        dispatch({ type: "NavigateUp" });
        break;
      case "ArrowDown":
        e.preventDefault();
        dispatch({ type: "NavigateDown" });
        break;
      case "ArrowRight":
        e.preventDefault();
        dispatch({ type: "NavigateRight" });
        break;
      case "ArrowLeft":
        e.preventDefault();
        dispatch({ type: "NavigateLeft" });
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        dispatch({ type: "ToggleFolder", folderId: setup.folderId });
        break;
    }
  };

  const handleFocus = () => {
    dispatch({ type: "SetFocus", id: setup.folderId });
  };

  const handleToggle = () => {
    dispatch({ type: "ToggleFolder", folderId: setup.folderId });
  };

  const handleRefresh = () => {
    dispatch({ type: "RefreshFolder", folderId: setup.folderId });
  };

  // View render function
  return () => {
    const folderState = getFolderState(setup.folderId);
    const { expanded, files, status, error } = folderState;
    const loading = status === "loading";
    const isFocused = getFocusedItemId() === setup.folderId;

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
          connect={(el, signal) => {
            registerElement(setup.folderId, el);
            dispatch({
              type: "RegisterItem",
              id: setup.folderId,
              itemType: "folder",
              parentId: setup.parentId,
            });

            // Focus if this is the focused item
            if (isFocused) {
              focusElement(setup.folderId);
            }

            signal.addEventListener("abort", () => {
              registerElement(setup.folderId, null);
              dispatch({ type: "UnregisterItem", id: setup.folderId });
            });
          }}
          tabIndex={0}
          on={{
            keydown: handleKeyDown,
            focus: handleFocus,
          }}
          css={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 0",
            outline: "none",
            "&:hover": {
              backgroundColor: "#f5f5f5",
            },
            "&:focus": {
              backgroundColor: "#e8f0fe",
              boxShadow: "0 0 0 2px #1a73e8",
            },
          }}
        >
          <button
            type="button"
            on={{ click: handleToggle }}
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
            on={{ click: handleRefresh }}
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
                      parentId: setup.folderId,
                    }}
                  />
                ))}

                {/* Render non-folder files */}
                {nonFolders.map((file) => (
                  <FileItem
                    key={file.id}
                    setup={{
                      file,
                      depth: setup.depth + 1,
                      parentId: setup.folderId,
                    }}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    );
  };
}

// ============================================================================
// Initialize focus callback
// ============================================================================

registerFocusCallback((id: string) => {
  focusElement(id);
});
