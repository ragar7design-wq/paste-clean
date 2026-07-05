import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('xray', () => {
  it('returns error for invalid URL', async () => {
    const { xray } = await import('./xray.js');
    const r = await xray('not a url');
    assert.equal(r.ok, false);
  });

  it('returns a chain from server-side proxy', async () => {
    const origFetch = global.fetch;
    global.fetch = async (url) => {
      if (url.startsWith('/api/xray')) {
        return new Response(JSON.stringify({
          ok: true,
          chain: [
            { url: 'https://example.com/', status: 200, domain: 'example.com', safe: true }
          ],
          finalUrl: 'https://example.com/',
          totalHops: 1,
          suspicious: false
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return origFetch(url);
    };
    try {
      const { xray } = await import('./xray.js');
      const r = await xray('https://example.com/');
      assert.equal(r.ok, true);
      assert.ok(r.chain.length >= 1);
    } finally {
      global.fetch = origFetch;
    }
  });
});