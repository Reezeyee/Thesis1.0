const SENSITIVE_KEY_PATTERN = /password|token|secret|credential|auth|uid|base64|snapshot/i;

function sanitizeForLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeForLog(entry),
    ]),
  );
}

export function logUiAction(label: string) {
  console.log(`[UI] ${label}`);
}

export async function logStateApiActivity<T>(
  method: string,
  route: string,
  payload: unknown,
  action: () => Promise<T>,
  successStatus = 200,
): Promise<T> {
  const startedAt = performance.now();
  console.log(`[API] ${method} ${route}`);
  console.log('[API] Request:', sanitizeForLog(payload));

  try {
    const result = await action();
    console.log(`[API] Response: ${successStatus}`);
    console.log(`[API] Duration: ${Math.round(performance.now() - startedAt)}ms`);
    console.log('[API] Success');
    return result;
  } catch (error) {
    console.log('[API] Response: 400');
    console.log(`[API] Duration: ${Math.round(performance.now() - startedAt)}ms`);
    console.log('[API] Error:', sanitizeForLog(error instanceof Error ? { message: error.message } : error));
    throw error;
  }
}
