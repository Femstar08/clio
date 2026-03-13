/**
 * Fetch wrapper with AbortSignal-based timeout.
 * Prevents hanging requests from blocking the entire runtime.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = 60_000, ...fetchInit } = init ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Respect caller's signal if provided
  if (fetchInit.signal) {
    fetchInit.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    return await fetch(url, { ...fetchInit, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wrap a promise with a timeout. Rejects with an error if the promise
 * doesn't resolve within the given time.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "Operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
