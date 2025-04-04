import Redis from "ioredis";

// Check required environment variables
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

if (!REDIS_HOST) throw new Error("Missing REDIS_HOST");
if (!REDIS_PORT) throw new Error("Missing REDIS_PORT");
if (!REDIS_PASSWORD) throw new Error("Missing REDIS_PASSWORD");

// Create a singleton Redis client
let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (client) {
    return client;
  }

  client = new Redis({
    host: REDIS_HOST || "",
    port: parseInt(REDIS_PORT || "6379"),
    username: process.env.REDIS_USERNAME || "default",
    password: REDIS_PASSWORD || "",
    retryStrategy: (times) => {
      // Exponential backoff with a maximum delay of 5 seconds
      const delay = Math.min(times * 100, 5000);
      return delay;
    },
    connectTimeout: 10000,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1, // Reduce retries to prevent connection buildup
    lazyConnect: true, // Don't connect immediately
    keepAlive: 10000, // Keep connection alive
    reconnectOnError: (err) => {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  });

  client.on("error", (error) => {
    console.error("Redis Client Error:", error);
    // If we hit max clients or connection reset, try to reconnect
    if (
      error.message.includes("max number of clients reached") ||
      error.message.includes("ECONNRESET")
    ) {
      console.log("Connection issue detected, attempting to reconnect...");
      client?.disconnect();
      client = null;
    }
  });

  client.on("connect", () => {
    console.log("Redis Client Connected");
  });

  return client;
}

// Graceful shutdown helper
export async function closeRedisConnection() {
  if (client) {
    await client.quit();
    client = null;
  }
}

// Export a function to get the client instead of creating it immediately
export default function redis() {
  return getRedisClient();
}
