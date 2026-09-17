import { redis } from "./redis.js";

/** Set of currently-connected user ids (maintained by the chat socket). */
export async function onlineSet(): Promise<Set<string>> {
  try {
    return new Set(await redis.sMembers("online"));
  } catch {
    return new Set();
  }
}
