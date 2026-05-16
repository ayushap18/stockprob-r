const inFlight = new Map();

export function dedupeRequest(key, task, { timeoutMs = 12_000 } = {}) {
  const id = String(key);
  if (inFlight.has(id)) return inFlight.get(id).promise;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const promise = Promise.resolve()
    .then(() => task(controller.signal))
    .finally(() => {
      clearTimeout(timeout);
      inFlight.delete(id);
    });
  inFlight.set(id, { promise, controller, startedAt: Date.now() });
  return promise;
}

export function abortRequest(key) {
  const entry = inFlight.get(String(key));
  if (!entry) return false;
  entry.controller.abort('superseded');
  inFlight.delete(String(key));
  return true;
}

export function abortMatching(prefix) {
  for (const key of [...inFlight.keys()]) {
    if (key.startsWith(prefix)) abortRequest(key);
  }
}

export function inFlightStatus() {
  return { active: inFlight.size, keys: [...inFlight.keys()].slice(0, 20) };
}
