import { RateLimitError } from "../gdrive.ts";

type Task = () => Promise<void>;
const queue: Task[] = [];
export function enqueue<T>(task: Task): void {
  queue.push(task);
}
const sleep = (ms: number) => (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
export function runQueue(limitMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    while (queue.length > 0) {
      const now = Date.now();
      if (now - start >= limitMs) {
        break;
      }
      const task = queue.shift()!;
      return task().catch((error: Error) => {
        console.error("Error in task:", error);
        if (error instanceof RateLimitError) {
          queue.unshift(sleep(1000));
        }
        queue.push(task);
      });
    }
    resolve();
  });
}
