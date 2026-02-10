import { RateLimitError } from "../gdrive.ts";

type Task = () => Promise<void>;
const queue: Task[] = [];
console.log("Task runner initialized");
export function enqueue<T>(task: Task): void {
  queue.push(task);
}
const sleep = (ms: number) => (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
export function runQueue(timeLimit: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve) => {
    while (queue.length > 0) {
      if (Date.now() - start >= timeLimit) {
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
