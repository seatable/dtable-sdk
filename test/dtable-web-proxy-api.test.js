import { execFileSync } from 'child_process';
import path from 'path';
import DTableWebProxyAPI from '../src/dtable-web-proxy-api';

describe('DTableWebProxyAPI', () => {
  it.each([
    ['https://example.com', 'https://example.com/'],
    ['https://example.com/', 'https://example.com/'],
    ['https://example.com///', 'https://example.com/'],
    ['https://example.com/seatable///', 'https://example.com/seatable/'],
    ['https://example.com/a//b///', 'https://example.com/a//b/'],
    ['https://example.com/\n', 'https://example.com/\n/'],
    ['https://example.com/\n///', 'https://example.com/\n/'],
    ['/', '/'],
    ['////', '/'],
    ['', ''],
    [undefined, undefined],
    [null, null],
  ])('normalizes server %p to %p', (server, expected) => {
    const api = new DTableWebProxyAPI({ server });
    expect(api.server).toBe(expected);
  });

  it.each([
    ['getTableRelatedUsers', 'related-users'],
    ['getTableDepartments', 'departments'],
  ])('%s preserves the base path and authorization header', async (method, endpoint) => {
    const api = new DTableWebProxyAPI({
      server: 'https://example.com/seatable///',
      dtableUuid: 'test-uuid',
      accessToken: 'test-token',
    });
    const response = { data: {} };
    const get = jest.spyOn(api.req, 'get').mockResolvedValue(response);

    await expect(api[method]()).resolves.toBe(response);
    expect(get).toHaveBeenCalledWith(
      'https://example.com/seatable/api/v2.1/dtables/test-uuid/' + endpoint + '/',
      { headers: { 'Authorization': 'Token test-token' } }
    );
  });

  it('handles long slash sequences within a bounded time', () => {
    // A separate process bounds the runtime if a backtracking regex is reintroduced.
    execFileSync(process.execPath, ['-r', '@babel/register', '-e', `
      const assert = require('assert');
      const DTableWebProxyAPI = require('./src/dtable-web-proxy-api').default;
      const base = 'https://example.com';
      const slashes = '/'.repeat(1000000);
      const cases = [
        [slashes, '/'],
        [slashes + 'x', slashes + 'x/'],
        [base + slashes, base + '/'],
        [base + slashes + 'x', base + slashes + 'x/'],
        [base + slashes + 'x///', base + slashes + 'x/'],
      ];
      for (const [server, expected] of cases) {
        assert.ok(new DTableWebProxyAPI({ server }).server === expected);
      }
    `], {
      cwd: path.resolve(__dirname, '..'),
      timeout: 10000,
    });
  }, 15000);
});
