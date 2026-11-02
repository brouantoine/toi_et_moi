import { ApiError, unwrap } from '../errors';

const res = (status: number) => new Response(null, { status });

describe('unwrap', () => {
  it('returns data on success', () => {
    expect(unwrap({ data: { a: 1 }, response: res(200) })).toEqual({ a: 1 });
  });

  it.each([
    [{ code: 'invalid_code' }, 400, 'invalid_code'],
    [{ detail: 'no_active_couple' }, 403, 'no_active_couple'],
    [{ detail: 'Some sentence.' }, 403, 'invalid'],
    [{}, 401, 'unauthorized'],
    [{}, 404, 'not_found'],
    [{}, 429, 'throttled'],
    [{}, 503, 'server'],
  ])('maps %j / %i to code %s', (body, status, code) => {
    expect(() => unwrap({ error: body, response: res(status) })).toThrow(ApiError);
    try {
      unwrap({ error: body, response: res(status) });
    } catch (e) {
      expect((e as ApiError).code).toBe(code);
      expect((e as ApiError).status).toBe(status);
    }
  });
});
