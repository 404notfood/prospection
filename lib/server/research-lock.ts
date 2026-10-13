const running = new Set<string>();
const lastCalls = new Map<string, number>();

export function startResearch(userId: string) {
  const now = Date.now();
  for (const [id, time] of lastCalls) if (now - time > 60000) lastCalls.delete(id);
  if (running.has(userId) || now - (lastCalls.get(userId) || 0) < 1500) return false;
  running.add(userId);
  lastCalls.set(userId, now);
  return true;
}

export function finishResearch(userId: string) {
  running.delete(userId);
}
