import _ from "lodash";

import { getRicherNodes, isFolder } from "./tree/node";
import { store, setStore } from "../index";
import { listDriveFiles } from "../api/driveClient";

import { rootId } from "./../globalConstant";

/**
 * Maps a node id to an array of children nodes.
 */
const nodesCache = {};

async function getNodesFromDirectory(folderId, refresh = false) {
  // If refresh is requested, skip cache
  if (!refresh && nodesCache[folderId]) {
    return nodesCache[folderId];
  }

  const result = await listDriveFiles({
    folderId,
    refresh,
  });

  const files = result.files || [];

  nodesCache[folderId] = [...files];

  return files;
}

export async function getSortedNodesFromDirectory(folderId, refresh = false) {
  const nodes = await getNodesFromDirectory(folderId, refresh);
  // Create a copy before sorting to avoid mutating cached array
  const nodesCopy = [...nodes];
  // Sort directories first, then alphabetically
  nodesCopy.sort((node0, node1) => {
    if (isFolder(node0) && !isFolder(node1)) {
      return -1;
    } else if (!isFolder(node0) && isFolder(node1)) {
      return 1;
    } else {
      return node0.name.localeCompare(node1.name);
    }
  });
  return nodesCopy;
}

async function initNodesFromRoot(refresh = false) {
  return await getSortedNodesFromDirectory("root", refresh);
}

// Note: shared and every modes not yet updated for new API
async function initSharedNodes(refresh = false) {
  // For now, treat as empty - this would need a different API endpoint
  return [];
}

async function initEveryNodes(refresh = false) {
  // For now, treat as empty - this would need a different API endpoint
  return [];
}

export async function triggerFilesRequest(initSwitch, refresh = false) {
  function grabFiles(initSwitch, refresh) {
    switch (initSwitch) {
      case "drive":
        return initNodesFromRoot(refresh);
      case "shared":
        return initSharedNodes(refresh);
      case "every":
        return initEveryNodes(refresh);
      default:
        console.error(`initSwitch "${initSwitch}" is not handled.`);
        return new Promise((resolve) => {
          resolve([]);
        });
    }
  }

  setStore("nodes", (current) => ({ ...current, isLoading: true }));

  let newNodes = await grabFiles(initSwitch, refresh);

  const richerNodes = getRicherNodes(newNodes, store.nodes.content[rootId].id);

  const nodesToUpdate = {};
  let hasUpdated = false;

  const newSubNodesId = richerNodes.map((n) => n.id);
  if (!_.isEqual(store.nodes.content["root"].subNodesId, newSubNodesId)) {
    nodesToUpdate["root"] = {
      ...store.nodes.content["root"],
      subNodesId: newSubNodesId,
    };
    hasUpdated = true;
  }

  for (const node of richerNodes) {
    if (!_.isEqual(node, store.nodes.content[node.id])) {
      nodesToUpdate[node.id] = node;
      hasUpdated = true;
    }
  }

  if (hasUpdated) {
    if (Object.keys(nodesToUpdate).length) {
      setStore("nodes", (current) => ({
        ...current,
        isInitialised: true,
        isLoading: false,
        content: { ...current.content, ...nodesToUpdate },
      }));
    }
  } else {
    setStore("nodes", (current) => ({
      ...current,
      isInitialised: true,
      isLoading: false,
    }));
  }
}
