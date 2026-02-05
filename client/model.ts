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
  updateCallbacks.forEach((cb) => cb());
}

export function getFolderState(folderId: string): FolderState {
  return globalModel.folders.get(folderId) ?? {
    expanded: false,
    files: [],
    status: "idle",
    error: null,
  };
}

// ============================================================================
// Msg
// ============================================================================

export type Msg =
  | {
    type: "RegisterItem";
    id: string;
    itemType: "folder" | "file";
    element: HTMLElement | null;
    parentId?: string;
  }
  | { type: "UnregisterItem"; id: string }
  | { type: "SetFocus"; id: string | null }
  | { type: "NavigateUp" }
  | { type: "NavigateDown" }
  | { type: "NavigateLeft" }
  | { type: "NavigateRight" }
  | { type: "ToggleFolder"; folderId: string }
  | { type: "LoadFolderStart"; folderId: string; refresh?: boolean }
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

      const currentIndex = items.findIndex(([id]) =>
        id === model.focusedItemId
      );
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

      const currentIndex = items.findIndex(([id]) =>
        id === model.focusedItemId
      );

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
        const folderState = getFolderState(model.focusedItemId);
        if (!folderState.expanded) {
          return update({
            type: "ToggleFolder",
            folderId: model.focusedItemId,
          });
        }
      }
      return [null];
    }

    case "NavigateLeft": {
      if (!model.focusedItemId) return [null];
      const item = model.itemRegistry.get(model.focusedItemId);
      const { parentId } = item || {};

      if (item?.type === "folder") {
        const folderState = getFolderState(model.focusedItemId);
        if (folderState.expanded) {
          return update({
            type: "ToggleFolder",
            folderId: model.focusedItemId,
          });
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
      const folderState = getFolderState(msg.folderId);
      const newExpanded = !folderState.expanded;

      model.folders.set(msg.folderId, {
        ...folderState,
        expanded: newExpanded,
      });

      if (
        newExpanded && folderState.files.length === 0 &&
        folderState.status === "idle"
      ) {
        return update({ type: "LoadFolderStart", folderId: msg.folderId });
      }

      return [null];
    }

    case "LoadFolderStart": {
      const folderState = getFolderState(msg.folderId);
      model.folders.set(msg.folderId, {
        ...folderState,
        status: "loading",
        error: null,
      });

      const cmd = async (): Promise<Msg | null> => {
        try {
          const files = await fetchFolderContents(
            msg.folderId,
            msg.refresh ?? false,
          );
          return { type: "LoadFolderSuccess", folderId: msg.folderId, files };
        } catch (e) {
          const error = e instanceof Error ? e.message : "Unknown error";
          return { type: "LoadFolderError", folderId: msg.folderId, error };
        }
      };

      return [cmd];
    }

    case "LoadFolderSuccess": {
      const folderState = getFolderState(msg.folderId);
      model.folders.set(msg.folderId, {
        ...folderState,
        files: msg.files,
        status: "success",
        error: null,
      });
      return [null];
    }

    case "LoadFolderError": {
      const folderState = getFolderState(msg.folderId);
      model.folders.set(msg.folderId, {
        ...folderState,
        status: "error",
        error: msg.error,
      });
      return [null];
    }

    case "RefreshFolder": {
      return update({
        type: "LoadFolderStart",
        folderId: msg.folderId,
        refresh: true,
      });
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

// ============================================================================
// Public API
// ============================================================================

export { registerUpdateCallback };

// Dispatch function with side-effect handling
export function dispatch(msg: Msg) {
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
}
