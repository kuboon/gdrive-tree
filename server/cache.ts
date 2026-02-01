// Cache interface for Google Drive API responses
export interface DriveCache {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// In-memory cache implementation (for testing/development)
export class MemoryCache implements DriveCache {
  private cache: Map<string, { value: unknown; expiresAt: number }> = new Map();
  private cleanupInterval: number;

  constructor() {
    // Clean up expired entries every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  get(key: string): Promise<unknown | null> {
    const entry = this.cache.get(key);
    if (!entry) return Promise.resolve(null);

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.value);
  }

  set(key: string, value: unknown, ttlMs: number): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.cache.delete(key);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.cache.clear();
    return Promise.resolve();
  }

  // Cleanup method to be called when shutting down
  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

// Deno KV cache implementation (for production)
export class DenoKVCache implements DriveCache {
  private kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  async get(key: string): Promise<unknown | null> {
    const result = await this.kv.get(["drive_cache", key]);
    return result.value;
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.kv.set(["drive_cache", key], value, {
      expireIn: ttlMs,
    });
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(["drive_cache", key]);
  }

  async clear(): Promise<void> {
    // List all keys and delete them
    const entries = this.kv.list({ prefix: ["drive_cache"] });
    for await (const entry of entries) {
      await this.kv.delete(entry.key);
    }
  }
}

// Factory function to create the appropriate cache implementation
export async function createCache(): Promise<DriveCache> {
  const useDenoKV = Deno.env.get("USE_DENO_KV") === "true";

  if (useDenoKV) {
    try {
      const kv = await Deno.openKv();
      console.log("Using Deno KV cache");
      return new DenoKVCache(kv);
    } catch (error) {
      console.warn(
        "Failed to open Deno KV, falling back to memory cache:",
        error,
      );
      return new MemoryCache();
    }
  }

  console.log("Using in-memory cache");
  return new MemoryCache();
}
