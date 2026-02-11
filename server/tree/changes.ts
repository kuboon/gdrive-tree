import { allParents } from "./mod.ts";
import {
  deleteChangeWatchChannel,
  getChangeStartPageToken,
  getChangeWatchChannel,
  getRepoDriveItem,
  saveChangeStartPageToken,
  saveChangeWatchChannel,
} from "./repo.ts";
import {
  type Change,
  getChangesStartPageToken,
  getDriveItem,
  listChanges,
  stopWatch,
  watchChanges,
} from "../gdrive.ts";
import { doMove } from "../move.ts";

const EXPIRATION_BUFFER = 60 * 60 * 1000; // 1 hour
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
    newChannel.expiration - Date.now(),
  );
  await saveChangeWatchChannel(newChannel, expireIn);
  const expiresAt = new Date(newChannel.expiration).toISOString();
  console.log(
    `Created change watch channel ${newChannel.resourceId}, expires at ${expiresAt}`,
  );
}

const targetDriveId = "0AAcDDlI12SEtUk9PVA";
async function collectRecentChanges(): Promise<Change[]> {
  const startPageToken = await resolveStartPageToken();
  let pageToken = startPageToken;
  const changes: Change[] = [];
  while (pageToken) {
    const response = await listChanges(pageToken);
    for (const change of response.changes) {
      if (change.driveId && change.driveId !== targetDriveId) continue;
      if (!change.removed) {
        changes.push(change);
      }
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

  return changes;
}

export async function processChangeNotification(): Promise<void> {
  const changes = await collectRecentChanges();

  const pairs: { change: Change; parentId: string }[] = [];
  for (const change of changes) {
    if (!change.fileId) continue;
    const driveItem = (await getRepoDriveItem(change.fileId)) ||
      (await getDriveItem(change.fileId));
    if (!driveItem || !driveItem.parents || driveItem.parents.length === 0) {
      continue;
    }
    pairs.push({ change, parentId: driveItem.parents[0] });
  }

  const map = Map.groupBy(pairs, (p) => p.parentId);

  for (const [parentId, items] of map) {
    const parents = await allParents(parentId);
    await doMove(
      items.map((p) => {
        const file = p.change.file!;
        return { name: file.name, id: file.id };
      }),
      parents,
    );
  }
}
