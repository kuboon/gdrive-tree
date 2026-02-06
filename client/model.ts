import { fetchFolderContents, fetchFolderTree } from "./api.ts";

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
  parentId?: string;
  // folder の場合のみ使用
  folderStateKey?: string;
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

export function registerUpdateCallback(callback: () => void) {
  updateCallbacks.add(callback);
  return () => updateCallbacks.delete(callback);
}

function triggerAllUpdates() {
  updateCallbacks.forEach((cb) => cb());
}

// Focus callback for View layer
let focusCallback: ((id: string) => void) | null = null;

export function registerFocusCallback(callback: (id: string) => void) {
  focusCallback = callback;
  return () => {
    focusCallback = null;
  };
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
  | { type: "RefreshFolder"; folderId: string }
  | { type: "InitTreeStart"; rootFolderId: string }
  | { type: "InitTreeSuccess"; rootFolderId: string; tree: DriveFile[] }
  | { type: "InitTreeError"; rootFolderId: string; error: string };

// ============================================================================
// Update
// ============================================================================

function update(msg: Msg): [(() => Promise<Msg | null>) | null] {
  const model = globalModel;

  switch (msg.type) {
    case "RegisterItem": {
      model.itemRegistry.set(msg.id, {
        type: msg.itemType,
        parentId: msg.parentId,
        folderStateKey: msg.itemType === "folder" ? msg.id : undefined,
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

      const currentIndex = items.findIndex((id) => id === model.focusedItemId);
      if (currentIndex > 0) {
        const nextId = items[currentIndex - 1];
        model.focusedItemId = nextId;
        return [() => Promise.resolve({ type: "SetFocus", id: nextId })];
      }
      return [null];
    }

    case "NavigateDown": {
      const items = getAllVisibleItems();
      if (items.length === 0) return [null];

      const currentIndex = items.findIndex((id) => id === model.focusedItemId);

      if (currentIndex === -1 && items.length > 0) {
        const nextId = items[0];
        model.focusedItemId = nextId;
        return [() => Promise.resolve({ type: "SetFocus", id: nextId })];
      } else if (currentIndex < items.length - 1) {
        const nextId = items[currentIndex + 1];
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

    case "InitTreeStart": {
      const folderState = getFolderState(msg.rootFolderId);
      model.folders.set(msg.rootFolderId, {
        ...folderState,
        status: "loading",
        error: null,
      });

      const cmd = async (): Promise<Msg | null> => {
        try {
          const tree = await fetchFolderTree(msg.rootFolderId);
          return {
            type: "InitTreeSuccess",
            rootFolderId: msg.rootFolderId,
            tree,
          };
        } catch (e) {
          const error = e instanceof Error ? e.message : "Unknown error";
          return {
            type: "InitTreeError",
            rootFolderId: msg.rootFolderId,
            error,
          };
        }
      };

      return [cmd];
    }

    case "InitTreeSuccess": {
      // ツリー全体のフォルダ情報をmodelに登録
      const rootState = getFolderState(msg.rootFolderId);
      model.folders.set(msg.rootFolderId, {
        ...rootState,
        expanded: false,
        status: "success",
        error: null,
      });

      // 各フォルダの親子関係を構築してmodelに登録
      for (const folder of msg.tree) {
        const folderState = getFolderState(folder.id);
        model.folders.set(folder.id, {
          ...folderState,
          expanded: false,
          status: "success",
          files: msg.tree.filter((f) => f.parents?.[0] === folder.id),
        });
      }

      return [null];
    }

    case "InitTreeError": {
      const folderState = getFolderState(msg.rootFolderId);
      model.folders.set(msg.rootFolderId, {
        ...folderState,
        status: "error",
        error: msg.error,
      });
      return [null];
    }

    default:
      return [null];
  }
}

// ============================================================================
// Helpers
// ============================================================================

// Model で管理する表示順序を構築
function getAllVisibleItems(): string[] {
  const result: string[] = [];

  // ルートフォルダを探す
  const rootItems = Array.from(globalModel.itemRegistry.entries())
    .filter(([_, item]) => !item.parentId)
    .map(([id]) => id);

  // 各ルートアイテムから再帰的に展開されたアイテムを収集
  function collectVisibleChildren(itemId: string) {
    result.push(itemId);

    const item = globalModel.itemRegistry.get(itemId);
    if (item?.type === "folder" && item.folderStateKey) {
      const folderState = globalModel.folders.get(item.folderStateKey);
      if (folderState?.expanded) {
        // フォルダ内のアイテムを順番に収集
        const children = folderState.files;
        for (const child of children) {
          if (globalModel.itemRegistry.has(child.id)) {
            collectVisibleChildren(child.id);
          }
        }
      }
    }
  }

  for (const rootId of rootItems) {
    collectVisibleChildren(rootId);
  }

  return result;
}

export function getFocusedItemId(): string | null {
  return globalModel.focusedItemId;
}

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

  // Focus management - notify View layer
  if (msg.type === "SetFocus" && msg.id && focusCallback) {
    focusCallback(msg.id);
  }

  // Trigger all component updates
  triggerAllUpdates();
}
