import { createApiClient } from '../client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createApiClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('calls the typed health endpoint on the configured base URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok', brand: 'Bolingo' }));
    const api = createApiClient('https://api.example.com');
    const { data, error } = await api.GET('/api/v1/health/');
    expect(error).toBeUndefined();
    expect(data?.status).toBe('ok');
    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe('https://api.example.com/api/v1/health/');
  });

  it('returns typed errors for 4xx responses', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'invalid_code' }, 400));
    const api = createApiClient('https://api.example.com');
    const { data, error } = await api.POST('/api/v1/couple/join/', { body: { code: 'ZZZZZZ' } });
    expect(data).toBeUndefined();
    expect(error).toEqual({ code: 'invalid_code' });
  });
});
