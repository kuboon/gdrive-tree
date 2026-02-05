import type { Handle } from "@remix-run/component";

// ============================================================================
// Types
// ============================================================================

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

interface ItemRegistryEntry {
  type: "folder" | "file";
  element: HTMLElement | null;
  parentId?: string;
}

type LoadingStatus = "idle" | "loading" | "success" | "error";

interface FolderState {
  expanded: boolean;
  files: DriveFile[];
  status: LoadingStatus;
  error: string | null;
}

// ============================================================================
// Model (Global State)
// ============================================================================

interface Model {
  focusedItemId: string | null;
  itemRegistry: Map<string, ItemRegistryEntry>;
  folders: Map<string, FolderState>;
}

// Global model instance shared across all components
const globalModel: Model = {
  focusedItemId: null,
  itemRegistry: new Map(),
  folders: new Map(),
};

// Store all update callbacks from all components
const updateCallbacks = new Set<() => void>();

function registerUpdateCallback(callback: () => void) {
  updateCallbacks.add(callback);
  return () => updateCallbacks.delete(callback);
}

function triggerAllUpdates() {
  updateCallbacks.forEach(cb => cb());
}

function getFolderState(model: Model, folderId: string): FolderState {
  return model.folders.get(folderId) ?? {
    expanded: false,
    files: [],
    status: "idle",
    error: null,
  };
}

// ============================================================================
// Msg
// ============================================================================

type Msg =
  | { type: "RegisterItem"; id: string; itemType: "folder" | "file"; element: HTMLElement | null; parentId?: string }
  | { type: "UnregisterItem"; id: string }
  | { type: "SetFocus"; id: string | null }
  | { type: "NavigateUp" }
  | { type: "NavigateDown" }
  | { type: "NavigateLeft" }
  | { type: "NavigateRight" }
  | { type: "ToggleFolder"; folderId: string }
  | { type: "LoadFolderStart"; folderId: string }
  | { type: "LoadFolderSuccess"; folderId: string; files: DriveFile[] }
  | { type: "LoadFolderError"; folderId: string; error: string }
  | { type: "RefreshFolder"; folderId: string };

// ============================================================================
// Update
// ============================================================================

function update(msg: Msg): [(() => Promise<Msg | null>) | null] {
  const model = globalModel;
  
  switch (msg.type) {
    case "RegisterItem": {
      model.itemRegistry.set(msg.id, {
        type: msg.itemType,
        element: msg.element,
        parentId: msg.parentId,
      });
      return [null];
    }

    case "UnregisterItem": {
      model.itemRegistry.delete(msg.id);
      return [null];
    }

    case "SetFocus": {
      model.focusedItemId = msg.id;
      return [null];
    }

    case "NavigateUp": {
      const items = getAllVisibleItems();
      if (items.length === 0) return [null];

      const currentIndex = items.findIndex(([id]) => id === model.focusedItemId);
      if (currentIndex > 0) {
        const nextId = items[currentIndex - 1][0];
        model.focusedItemId = nextId;
        return [() => Promise.resolve({ type: "SetFocus", id: nextId })];
      }
      return [null];
    }

    case "NavigateDown": {
      const items = getAllVisibleItems();
      if (items.length === 0) return [null];

      const currentIndex = items.findIndex(([id]) => id === model.focusedItemId);
      
      if (currentIndex === -1 && items.length > 0) {
        const nextId = items[0][0];
        model.focusedItemId = nextId;
        return [() => Promise.resolve({ type: "SetFocus", id: nextId })];
      } else if (currentIndex < items.length - 1) {
        const nextId = items[currentIndex + 1][0];
        model.focusedItemId = nextId;
        return [() => Promise.resolve({ type: "SetFocus", id: nextId })];
      }
      return [null];
    }

    case "NavigateRight": {
      if (!model.focusedItemId) return [null];
      const item = model.itemRegistry.get(model.focusedItemId);
      if (item?.type === "folder") {
        const folderState = getFolderState(model, model.focusedItemId);
        if (!folderState.expanded) {
          return update({ type: "ToggleFolder", folderId: model.focusedItemId });
        }
      }
      return [null];
    }

    case "NavigateLeft": {
      if (!model.focusedItemId) return [null];
      const item = model.itemRegistry.get(model.focusedItemId);
      const { parentId } = item || {};
      
      if (item?.type === "folder") {
        const folderState = getFolderState(model, model.focusedItemId);
        if (folderState.expanded) {
          return update({ type: "ToggleFolder", folderId: model.focusedItemId });
        } else if (parentId) {
          model.focusedItemId = parentId;
          return [() => Promise.resolve({ type: "SetFocus", id: parentId })];
        }
      } else if (item?.type === "file" && parentId) {
        model.focusedItemId = parentId;
        return [() => Promise.resolve({ type: "SetFocus", id: parentId })];
      }
      return [null];
    }

    case "ToggleFolder": {
      const folderState = getFolderState(model, msg.folderId);
      const newExpanded = !folderState.expanded;
      
      model.folders.set(msg.folderId, { ...folderState, expanded: newExpanded });
      
      if (newExpanded && folderState.files.length === 0 && folderState.status === "idle") {
        return update({ type: "LoadFolderStart", folderId: msg.folderId });
      }
      
      return [null];
    }

    case "LoadFolderStart": {
      const folderState = getFolderState(model, msg.folderId);
      model.folders.set(msg.folderId, { ...folderState, status: "loading", error: null });
      
      const cmd = async (): Promise<Msg | null> => {
        try {
          const files = await fetchFolderContents(msg.folderId, false);
          return { type: "LoadFolderSuccess", folderId: msg.folderId, files };
        } catch (e) {
          const error = e instanceof Error ? e.message : "Unknown error";
          return { type: "LoadFolderError", folderId: msg.folderId, error };
        }
      };
      
      return [cmd];
    }

    case "LoadFolderSuccess": {
      const folderState = getFolderState(model, msg.folderId);
      model.folders.set(msg.folderId, {
        ...folderState,
        files: msg.files,
        status: "success",
        error: null,
      });
      return [null];
    }

    case "LoadFolderError": {
      const folderState = getFolderState(model, msg.folderId);
      model.folders.set(msg.folderId, {
        ...folderState,
        status: "error",
        error: msg.error,
      });
      return [null];
    }

    case "RefreshFolder": {
      return update({ type: "LoadFolderStart", folderId: msg.folderId });
    }

    default:
      return [null];
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getAllVisibleItems(): Array<[string, ItemRegistryEntry]> {
  const items = Array.from(globalModel.itemRegistry.entries())
    .filter(([_, item]) => item.element !== null);

  items.sort((a, b) => {
    const [_, itemA] = a;
    const [__, itemB] = b;
    if (!itemA.element || !itemB.element) return 0;

    const position = itemA.element.compareDocumentPosition(itemB.element);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    }
    return 0;
  });

  return items;
}

function focusElement(id: string) {
  const item = globalModel.itemRegistry.get(id);
  if (item?.element) {
    item.element.focus();
    item.element.scrollIntoView({ block: "nearest" });
  }
}

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
    dispatch: (msg: Msg) => void;
  },
) {
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        setup.dispatch({ type: "NavigateUp" });
        break;
      case "ArrowDown":
        e.preventDefault();
        setup.dispatch({ type: "NavigateDown" });
        break;
      case "Enter":
        e.preventDefault();
        globalThis.open(setup.file.webViewLink, "_blank");
        break;
    }
  };

  const handleFocus = () => {
    setup.dispatch({ type: "SetFocus", id: setup.file.id });
  };

  return () => (
    <div
      connect={(el, signal) => {
        setup.dispatch({
          type: "RegisterItem",
          id: setup.file.id,
          itemType: "file",
          element: el,
          parentId: setup.parentId,
        });
        signal.addEventListener("abort", () => {
          setup.dispatch({ type: "UnregisterItem", id: setup.file.id });
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
  
  const cleanup = () => {
    if (unregister) {
      unregister();
      unregister = null;
    }
  };

  // Dispatch function with side-effect handling
  const dispatch = (msg: Msg) => {
    const [cmd] = update(msg);
    
    // Handle side effects
    if (cmd) {
      cmd().then((resultMsg) => {
        if (resultMsg) {
          dispatch(resultMsg);
        }
      });
    }
    
    // Focus management
    if (msg.type === "SetFocus" && msg.id) {
      focusElement(msg.id);
    }
    
    // Trigger all component updates
    triggerAllUpdates();
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
    const folderState = getFolderState(globalModel, setup.folderId);
    const { expanded, files, status, error } = folderState;
    const loading = status === "loading";

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
            dispatch({
              type: "RegisterItem",
              id: setup.folderId,
              itemType: "folder",
              element: el,
              parentId: setup.parentId,
            });
            signal.addEventListener("abort", () => {
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
                      dispatch
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
