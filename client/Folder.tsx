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

// Global state for keyboard navigation
let focusedItemId: string | null = null;
const itemRegistry = new Map<string, {
  type: "folder" | "file";
  element: HTMLElement | null;
  toggleExpand?: () => void;
  isExpanded?: () => boolean;
  parentId?: string;
}>();

export function registerItem(
  id: string,
  type: "folder" | "file",
  element: HTMLElement | null,
  toggleExpand?: () => void,
  isExpanded?: () => boolean,
  parentId?: string,
) {
  itemRegistry.set(id, { type, element, toggleExpand, isExpanded, parentId });
}

export function unregisterItem(id: string) {
  itemRegistry.delete(id);
}

export function setFocusedItem(id: string | null) {
  focusedItemId = id;
}

export function getFocusedItemId() {
  return focusedItemId;
}

function getAllVisibleItems() {
  const items = Array.from(itemRegistry.entries())
    .filter(([_, item]) => item.element !== null);

  // Sort by DOM position instead of registration order
  items.sort((a, b) => {
    const [_, itemA] = a;
    const [__, itemB] = b;
    if (!itemA.element || !itemB.element) return 0;

    const position = itemA.element.compareDocumentPosition(itemB.element);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1; // itemA comes before itemB
    } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1; // itemB comes before itemA
    }
    return 0;
  });

  return items;
}

function focusItem(id: string) {
  const item = itemRegistry.get(id);
  if (item?.element) {
    item.element.focus();
    item.element.scrollIntoView({ block: "nearest" });
    setFocusedItem(id);
  }
}

function navigateUp() {
  const items = getAllVisibleItems();
  if (items.length === 0) return;

  const currentIndex = items.findIndex(([id]) => id === focusedItemId);
  if (currentIndex > 0) {
    focusItem(items[currentIndex - 1][0]);
  }
}

function navigateDown() {
  const items = getAllVisibleItems();
  if (items.length === 0) return;

  const currentIndex = items.findIndex(([id]) => id === focusedItemId);

  if (currentIndex === -1 && items.length > 0) {
    // No item focused, focus the first one
    focusItem(items[0][0]);
  } else if (currentIndex < items.length - 1) {
    // Move to next item (which is the first child if current is expanded folder)
    focusItem(items[currentIndex + 1][0]);
  }
}

function navigateRight() {
  if (!focusedItemId) return;
  const item = itemRegistry.get(focusedItemId);
  if (item?.toggleExpand && item.type === "folder") {
    const isExpanded = item.isExpanded?.();
    if (!isExpanded) {
      item.toggleExpand();
    }
  }
}

function navigateLeft() {
  if (!focusedItemId) return;
  const item = itemRegistry.get(focusedItemId);

  if (item?.type === "folder" && item.toggleExpand) {
    const isExpanded = item.isExpanded?.();
    if (isExpanded) {
      // If folder is expanded, collapse it
      item.toggleExpand();
    } else if (item.parentId) {
      // If folder is already collapsed, move to parent
      focusItem(item.parentId);
    }
  } else if (item?.type === "file" && item.parentId) {
    // If it's a file, move to parent folder
    focusItem(item.parentId);
  }
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

// FileItem component with keyboard navigation support
function FileItem(
  _handle: Handle,
  setup: {
    file: DriveFile;
    depth: number;
    parentId?: string;
  },
) {
  let _fileElement: HTMLElement | null = null;

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        navigateUp();
        break;
      case "ArrowDown":
        e.preventDefault();
        navigateDown();
        break;
      case "Enter":
        e.preventDefault();
        // Open file in new tab
        globalThis.open(setup.file.webViewLink, "_blank");
        break;
    }
  };

  const handleFocus = () => {
    setFocusedItem(setup.file.id);
  };

  return () => (
    <div
      connect={(el, signal) => {
        _fileElement = el;
        registerItem(
          setup.file.id,
          "file",
          el,
          undefined,
          undefined,
          setup.parentId,
        );
        signal.addEventListener("abort", () => {
          unregisterItem(setup.file.id);
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
}

// Folder component: displays a folder and its contents
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

  const isExpanded = () => expanded;

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        navigateUp();
        break;
      case "ArrowDown":
        e.preventDefault();
        navigateDown();
        break;
      case "ArrowRight":
        e.preventDefault();
        navigateRight();
        break;
      case "ArrowLeft":
        e.preventDefault();
        navigateLeft();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        toggleExpand();
        break;
    }
  };

  const handleFocus = () => {
    setFocusedItem(setup.folderId);
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
          connect={(el, signal) => {
            registerItem(
              setup.folderId,
              "folder",
              el,
              toggleExpand,
              isExpanded,
              setup.parentId,
            );
            signal.addEventListener("abort", () => {
              unregisterItem(setup.folderId);
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
