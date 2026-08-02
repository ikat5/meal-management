import mongoose from "mongoose";

/**
 * DATABASE CONNECTION (call `await dbConnect()` at the top of every API route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Why the global cache? In development, Next.js hot-reloads modules on every
 * file save. Without caching, each reload would open a NEW connection pool
 * and MongoDB Atlas would quickly hit its connection limit. Storing the
 * connection on `global` survives reloads; in production it simply means
 * "connect once, reuse forever".
 */
const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// eslint-disable-next-line no-var
declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cache;

export default async function dbConnect(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!MONGODB_URI) {
    throw new Error(
      "Missing MONGODB_URI — create .env.local (see README.md, step 3)"
    );
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false, // fail fast instead of silently queueing queries

      // Node's "Happy Eyeballs" races IPv6 vs IPv4 and gives each attempt
      // only 250 ms by default. On high-latency networks (mobile/NAT64)
      // the Atlas handshake regularly needs more, which shows up as
      // intermittent `connect ETIMEDOUT` even though the host is fine.
      // 2 s per attempt keeps the race but survives slow links.
      autoSelectFamilyAttemptTimeout: 2000,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null; // allow a retry on the next request
    throw err;
  }

  return cache.conn;
}
