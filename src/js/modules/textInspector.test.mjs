import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inspectText } from './textInspector.js';

describe('textInspector', () => {
  it('finds zero-width characters', () => {
    const r = inspectText('hello\u200Bworld');
    assert.equal(r.findings.length, 1);
    assert.equal(r.findings[0].type, 'invisible');
    assert.equal(r.cleaned, 'helloworld');
  });

  it('finds homoglyph mix of latin and cyrillic', () => {
    const r = inspectText('аpple');
    assert.equal(r.findings.length, 1);
    assert.equal(r.findings[0].type, 'homoglyph');
  });

  it('reports clean text', () => {
    const r = inspectText('normal text');
    assert.equal(r.findings.length, 0);
  });
});