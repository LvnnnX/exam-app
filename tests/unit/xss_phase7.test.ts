// tests/unit/xss_phase7.test.ts
// Unit testing for HTML sanitization (PRD BS-03, BS-07, OWASP A03:2021)
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHtml, sanitizeStyleString } from '../../src/lib/sanitizer.ts';

test('XSS Phase 7 - Script tag stripped completely', () => {
  const payload = '<script>alert(1)</script>';
  assert.equal(sanitizeHtml(payload), '');
});

test('XSS Phase 7 - Nested/obfuscated script tag sanitized safely without executable script', () => {
  const payload = '<scr<script>ipt>alert(1)</script>';
  const clean = sanitizeHtml(payload);
  assert.doesNotMatch(clean, /<script/i);
});

test('XSS Phase 7 - Img tag with onerror handler stripped', () => {
  const payload = '<img src=x onerror=alert(1)>';
  assert.equal(sanitizeHtml(payload), '');
});

test('XSS Phase 7 - Svg tag with onload handler stripped', () => {
  const payload = '<svg onload=alert(1)>';
  assert.equal(sanitizeHtml(payload), '');
});

test('XSS Phase 7 - Anchor tag with javascript: href has href stripped', () => {
  const payload = '<a href="javascript:alert(1)">Click Me</a>';
  const clean = sanitizeHtml(payload);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.doesNotMatch(clean, /href=/i);
  assert.match(clean, /Click Me/);
});

test('XSS Phase 7 - Style attribute with background:url(javascript:...) pruned', () => {
  const payload = '<div style="background:url(javascript:alert(1))">Test</div>';
  const clean = sanitizeHtml(payload);
  assert.doesNotMatch(clean, /javascript|url\(/i);
});

test('XSS Phase 7 - Style attribute with position:fixed overlay pruned', () => {
  const payload = '<p style="position:fixed;top:0;left:0;width:100%;height:100%;background-color:red">Overlay</p>';
  const clean = sanitizeHtml(payload);
  assert.doesNotMatch(clean, /position\s*:\s*fixed/i);
  assert.doesNotMatch(clean, /top\s*:/i);
  assert.match(clean, /background-color/);
});

test('XSS Phase 7 - Iframe tag stripped completely', () => {
  const payload = '<iframe src="https://evil.com"></iframe>';
  assert.equal(sanitizeHtml(payload), '');
});

test('XSS Phase 7 - Data URI HTML/SVG payload in img src is stripped', () => {
  const htmlData = '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">';
  assert.equal(sanitizeHtml(htmlData), '');

  const svgData = '<img src="data:image/svg+xml;utf8,<svg onload=alert(1)></svg>">';
  assert.equal(sanitizeHtml(svgData), '');
});

test('XSS Phase 7 - Legitimate base64 image (PNG) survives', () => {
  const validPng = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="dot">';
  const clean = sanitizeHtml(validPng);
  assert.match(clean, /<img/);
  assert.match(clean, /data:image\/png;base64,/);
  assert.match(clean, /alt="dot"/);
});

test('XSS Phase 7 - Legitimate math data-latex attributes survive', () => {
  const mathPayload = '<span class="tiptap-mathematics-render" data-latex="\\frac{1}{2}">$1/2$</span>';
  const clean = sanitizeHtml(mathPayload);
  assert.match(clean, /data-latex="\\frac\{1\}\{2\}"/);
  assert.match(clean, /class="tiptap-mathematics-render"/);
});

test('XSS Phase 7 - CSS style string sanitizer rejects dangerous vectors', () => {
  assert.equal(sanitizeStyleString('position: fixed; z-index: 99999'), '');
  assert.equal(sanitizeStyleString('background: url(javascript:alert(1))'), '');
  assert.equal(sanitizeStyleString('color: red; expression(alert(1))'), 'color: red');
  assert.equal(sanitizeStyleString('color: #ff0000; font-size: 14px; text-align: center'), 'color: #ff0000; font-size: 14px; text-align: center');
});
