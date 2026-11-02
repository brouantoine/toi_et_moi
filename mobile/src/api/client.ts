/**
 * Typed API client. Types come ONLY from the generated `schema.d.ts`
 * (run `sh scripts/api-types.sh` after any backend API change). Never hand-write API types.
 */
import createClient, { type Middleware } from 'openapi-fetch';

import { API_URL } from '@/config/env';

import type { components, paths } from './schema';

export type Schemas = components['schemas'];
export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(baseUrl: string = API_URL, middlewares: Middleware[] = []) {
  const client = createClient<paths>({ baseUrl, headers: { Accept: 'application/json' } });
  middlewares.forEach((m) => client.use(m));
  return client;
}
