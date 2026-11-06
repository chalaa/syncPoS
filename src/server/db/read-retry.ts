const transientCodes = new Set([
  "ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT", "EAI_AGAIN",
  "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED",
  "08000", "08001", "08003", "08006", "53300", "57P01", "57P02", "57P03",
]);

function transientDatabaseCode(error: unknown): string | undefined {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  let transientCode: string | undefined;

  // Drizzle wraps driver errors in cause; Node may wrap socket failures in errors.
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const { code, cause, errors } = current as { code?: unknown; cause?: unknown; errors?: unknown };
    if (typeof code === "string") {
      if (transientCodes.has(code)) transientCode = code;
      else if (/^[0-9A-Z]{5}$/.test(code)) return undefined;
    }
    if (cause) pending.push(cause);
    if (Array.isArray(errors)) pending.push(...errors);
  }
  return transientCode;
}

/** Only use for reads. A disconnected write may already have committed. */
export async function withDatabaseReadRetry<T>(read: () => PromiseLike<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    const code = transientDatabaseCode(error);
    if (!code) throw error;
    console.warn(`[database] Retrying read after transient connection error ${code}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return await read();
  }
}
