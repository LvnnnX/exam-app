import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHtml, sanitizeStyleString } from '../../src/lib/sanitizer.ts';

describe('sanitizeStyleString', () => {
  it('preserves allowed CSS properties', () => {
    const raw = 'color: #333; background-color: rgb(255, 255, 255); font-family: Arial, sans-serif; font-size: 14pt; line-height: 1.5; text-align: center';
    const cleaned = sanitizeStyleString(raw);
    assert.match(cleaned, /color:\s*#333/);
    assert.match(cleaned, /background-color:\s*rgb\(255, 255, 255\)/);
    assert.match(cleaned, /font-family:\s*Arial,\s*sans-serif/);
    assert.match(cleaned, /font-size:\s*14pt/);
    assert.match(cleaned, /line-height:\s*1\.5/);
    assert.match(cleaned, /text-align:\s*center/);
  });

  it('strips non-whitelisted CSS properties', () => {
    const raw = 'color: red; position: fixed; top: 0; left: 0; z-index: 99999; display: flex; width: 100vw; height: 100vh';
    const cleaned = sanitizeStyleString(raw);
    assert.equal(cleaned, 'color: red');
    assert.doesNotMatch(cleaned, /position/);
    assert.doesNotMatch(cleaned, /fixed/);
    assert.doesNotMatch(cleaned, /z-index/);
    assert.doesNotMatch(cleaned, /display/);
  });

  it('blocks dangerous CSS values: url() and background images', () => {
    const raw = 'background-color: red; color: url("javascript:alert(1)"); line-height: 1.5';
    const cleaned = sanitizeStyleString(raw);
    assert.doesNotMatch(cleaned, /url/);
    assert.match(cleaned, /background-color: red/);
    assert.match(cleaned, /line-height: 1\.5/);
  });

  it('blocks CSS expression() and behavior vectors', () => {
    const raw = 'color: expression(alert(1)); font-size: 12pt';
    const cleaned = sanitizeStyleString(raw);
    assert.doesNotMatch(cleaned, /expression/);
    assert.equal(cleaned, 'font-size: 12pt');
  });
});

describe('sanitizeHtml', () => {
  it('strips script tags and event handlers', () => {
    const malicious = '<p>Halo <script>alert("xss")</script><img src="x" onerror="alert(1)"></p>';
    const cleaned = sanitizeHtml(malicious);
    assert.doesNotMatch(cleaned, /<script/i);
    assert.doesNotMatch(cleaned, /onerror/i);
    assert.match(cleaned, /<p>Halo <\/p>/);
  });

  it('allows safe inline styles on paragraphs and spans', () => {
    const input = '<p style="color: #2a6858; font-size: 16pt; position: fixed">Teks <strong>tebal</strong></p>';
    const cleaned = sanitizeHtml(input);
    assert.match(cleaned, /color:\s*#2a6858/);
    assert.match(cleaned, /font-size:\s*16pt/);
    assert.doesNotMatch(cleaned, /position/);
    assert.doesNotMatch(cleaned, /fixed/);
  });

  it('preserves KaTeX mathematics render containers', () => {
    const input = '<span class="tiptap-mathematics-render" data-type="inline-math" data-latex="\\sqrt{x}">sqrt</span>';
    const cleaned = sanitizeHtml(input);
    assert.match(cleaned, /data-type="inline-math"/);
    assert.match(cleaned, /data-latex="\\sqrt\{x\}"/);
  });

  it('preserves code blocks and language tags', () => {
    const input = '<pre><code class="language-python">print("hello")</code></pre>';
    const cleaned = sanitizeHtml(input);
    assert.match(cleaned, /<pre><code class="language-python">print\("hello"\)<\/code><\/pre>/);
  });

  it('preserves tables and cell formatting', () => {
    const input = '<table><tbody><tr><th colspan="2" style="text-align: center">Header</th></tr><tr><td>A</td><td>B</td></tr></tbody></table>';
    const cleaned = sanitizeHtml(input);
    assert.match(cleaned, /colspan="2"/);
    assert.match(cleaned, /style="text-align: center"/);
  });
});
