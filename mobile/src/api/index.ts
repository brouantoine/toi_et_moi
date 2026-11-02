import { API_URL } from '@/config/env';

import { authMiddleware } from './authMiddleware';
import { createApiClient } from './client';

/** The app-wide authenticated API client. */
export const api = createApiClient(API_URL, [authMiddleware(API_URL)]);

export { ApiError, unwrap } from './errors';
export type { Schemas } from './client';
