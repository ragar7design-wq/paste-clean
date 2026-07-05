import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanUrl, restoreParam } from './urlCleaner.js';

describe('urlCleaner', () => {
  it('removes UTM and keeps ref', () => {
    const r = cleanUrl('https://example.com?utm_source=email&utm_medium=banner&ref=partner');
    assert.equal(r.ok, true);
    assert.deepEqual(r.removed.map(i => i.key), ['utm_source', 'utm_medium']);
    assert.deepEqual(r.kept.map(i => i.key), ['ref']);
    assert.equal(r.clean, 'https://example.com/?ref=partner');
  });

  it('unwraps YouTube consent URL', () => {
    const r = cleanUrl('https://consent.youtube.com/m?continue=https%3A%2F%2Fwww.youtube.com%2Fchannel%2FUCo0jbvIx4hn-fHHXozO6zhw%3Fsub_confirmation%3D1%26cbrd%3D1&gl=NL&m=0&pc=yt&cm=2&hl=nl&src=1');
    assert.equal(r.ok, true);
    assert.equal(r.unwrapped, true);
    assert.equal(r.clean, 'https://www.youtube.com/channel/UCo0jbvIx4hn-fHHXozO6zhw');
    assert.equal(r.kept.length, 0);
  });

  it('unwraps Google redirect URL', () => {
    const r = cleanUrl('https://www.google.com/url?q=https://example.com/page&sa=U&ved=123&usg=ABC');
    assert.equal(r.unwrapped, true);
    assert.equal(r.clean, 'https://example.com/page');
  });

  it('keeps unknown non-tracking params', () => {
    const r = cleanUrl('https://example.com?id=123&category=news');
    assert.equal(r.stats.removedCount, 0);
    assert.equal(r.stats.keptCount, 2);
  });

  it('returns error on invalid URL', () => {
    const r = cleanUrl('not a url');
    assert.equal(r.ok, false);
  });

  it('restoreParam re-adds a removed param', () => {
    const restored = restoreParam('https://example.com/?lang=ru', 'utm_source', 'email');
    assert.equal(restored, 'https://example.com/?lang=ru&utm_source=email');
  });
});