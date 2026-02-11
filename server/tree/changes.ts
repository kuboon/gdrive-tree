import { getChildren } from "./mod.ts";
import {
  deleteChangeWatchChannel,
  getChangeStartPageToken,
  getChangeWatchChannel,
  getDriveItem,
  saveChangeStartPageToken,
  saveChangeWatchChannel,
} from "./repo.ts";
import {
  type Change,
  getChangesStartPageToken,
  listChanges,
  stopWatch,
  watchChanges,
} from "../gdrive.ts";

const EXPIRATION_BUFFER = 60 * 60 * 1000;
const CHANGE_CHANNEL_ID = "drive-changes";

async function resolveStartPageToken(): Promise<string> {
  let token = await getChangeStartPageToken();
  if (!token) {
    token = await getChangesStartPageToken();
    await saveChangeStartPageToken(token);
  }
  return token;
}

export async function ensureChangesWatchChannel(
  webhookUrl: string,
): Promise<void> {
  if (webhookUrl.startsWith("http://")) return;

  const channel = await getChangeWatchChannel();
  if (channel && channel.expiration > Date.now() + EXPIRATION_BUFFER) {
    return;
  }

  if (channel) {
    try {
      await stopWatch(channel);
    } catch (error) {
      console.error(`Failed to stop existing change channel: ${error}`);
    }
    await deleteChangeWatchChannel();
  }

  const startPageToken = await resolveStartPageToken();
  const newChannel = await watchChanges(
    webhookUrl,
    startPageToken,
    CHANGE_CHANNEL_ID,
  );
  const expireIn = Math.max(
    0,
    newChannel.expiration - Date.now() - EXPIRATION_BUFFER,
  );
  await saveChangeWatchChannel(newChannel, expireIn);
  const expiresAt = new Date(newChannel.expiration).toISOString();
  console.log(
    `Created change watch channel ${newChannel.resourceId}, expires at ${expiresAt}`,
  );
}

async function collectParentFolders(
  change: Change,
  folders: Set<string>,
): Promise<void> {
  const parents = change.file?.parents;
  if (parents && parents.length > 0) {
    parents.forEach((parent) => folders.add(parent));
    return;
  }
  if (!change.fileId) return;
  const cached = await getDriveItem(change.fileId);
  cached?.parents?.forEach((parent) => folders.add(parent));
}

async function refreshFolders(folders: Set<string>): Promise<void> {
  if (folders.size === 0) { return; }
  await Promise.all([...folders].map(async (folderId) => {
    try {
      await getChildren(folderId, true);
    } catch (error) {
      console.warn(
        `Failed to refresh folder ${folderId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }));
  console.log(`Refreshed ${folders.size} folder caches`);
}

export async function processChangeNotification(): Promise<void> {
  const startPageToken = await resolveStartPageToken();
  const foldersToRefresh = new Set<string>();
  let pageToken = startPageToken;

  while (pageToken) {
    const response = await listChanges(pageToken);
    for (const change of response.changes) {
      await collectParentFolders(change, foldersToRefresh);
    }

    if (response.nextPageToken) {
      pageToken = response.nextPageToken;
      continue;
    }

    const nextToken = response.newStartPageToken ?? pageToken;
    if (nextToken) {
      await saveChangeStartPageToken(nextToken);
    }
    break;
  }

  await refreshFolders(foldersToRefresh);
}
