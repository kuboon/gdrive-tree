import { createAndCacheWatchChannel, ensureWatchChannel } from "./mod.ts";

export type Task = {
  type: "ensureWatchChannel";
  webHookUrl: string;
  folderId: string;
} | {
  type: "createAndCacheWatchChannel";
  webHookUrl: string;
  folderId: string;
};

export function runTask(task: Task): Promise<void> {
  switch (task.type) {
    case "ensureWatchChannel":
      return ensureWatchChannel(task.folderId, task.webHookUrl);
    case "createAndCacheWatchChannel":
      return createAndCacheWatchChannel(task.folderId, task.webHookUrl);
    default:
      return Promise.reject(new Error(`Unknown task: ${task}`));
  }
}
