import { createClient } from "redis";
import { env } from "./env.js";

// Primary client for session storage + general use.
export const redis = createClient({ url: env.REDIS_URL });
redis.on("error", (e) => console.error("[redis] error", e));

// Separate pub/sub pair for the Socket.IO Redis adapter.
export const pubClient = createClient({ url: env.REDIS_URL });
export const subClient = pubClient.duplicate();
pubClient.on("error", (e) => console.error("[redis pub] error", e));
subClient.on("error", (e) => console.error("[redis sub] error", e));

export async function connectRedis() {
  await Promise.all([redis.connect(), pubClient.connect(), subClient.connect()]);
}
