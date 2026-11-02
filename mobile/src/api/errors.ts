/** Turns openapi-fetch results into data-or-throw, with a stable error `code`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly body: unknown,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

type Result<T> = { data?: T; error?: unknown; response: Response };

function codeFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.code === 'string') return record.code;
    if (typeof record.detail === 'string' && /^[a-z_]+$/.test(record.detail)) return record.detail;
  }
  if (status === 0) return 'network';
  if (status >= 500) return 'server';
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 429) return 'throttled';
  return 'invalid';
}

export function unwrap<T>(result: Result<T>): T {
  if (result.error !== undefined || !result.response.ok) {
    const status = result.response.status;
    throw new ApiError(status, codeFrom(result.error, status), result.error);
  }
  return result.data as T;
}
