// Small in-memory sliding-window limiter. Good enough for a single self-hosted server.
const buckets = new Map();

export function allow(key, limit, windowMs) {
  const now = Date.now();
  const list = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    buckets.set(key, list);
    return false;
  }
  list.push(now);
  buckets.set(key, list);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, list] of buckets) {
    if (!list.length || now - list[list.length - 1] > 3600_000) buckets.delete(k);
  }
}, 600_000).unref();
