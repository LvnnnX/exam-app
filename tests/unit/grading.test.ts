import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShortAnswer, stripHtml } from '../../src/lib/grading.ts';

describe('grading: stripHtml', () => {
  it('removes html tags and decodes common entities', () => {
    assert.equal(stripHtml('<p>Jawaban &amp; kunci</p>'), 'Jawaban & kunci');
    assert.equal(stripHtml('<b>Bold</b> <i>italic</i>'), 'Bold italic');
  });

  it('converts non-breaking spaces to standard space', () => {
    assert.equal(stripHtml('satu&nbsp;dua&#160;tiga'), 'satu dua tiga');
  });
});

describe('grading: checkShortAnswer (BS-09)', () => {
  it('is case insensitive', () => {
    assert.equal(checkShortAnswer('Jakarta', 'jakarta'), true);
    assert.equal(checkShortAnswer('JAKARTA', 'jakarta'), true);
    assert.equal(checkShortAnswer('jAkArTa', 'JAKARTA'), true);
  });

  it('removes ALL whitespace before comparison', () => {
    assert.equal(checkShortAnswer('  3.14  ', '3.14'), true);
    assert.equal(checkShortAnswer('3 . 1 4', '3.14'), true);
    assert.equal(checkShortAnswer('Ki Hajar Dewantara', 'kihajardewantara'), true);
    assert.equal(checkShortAnswer('ki  hajar   dewantara', 'Ki Hajar Dewantara'), true);
  });

  it('strips HTML from both answer and key', () => {
    assert.equal(checkShortAnswer('<p>O(N log N)</p>', 'o(nlogn)'), true);
    assert.equal(checkShortAnswer('<span>50</span> m/s', '50m/s'), true);
  });

  it('returns false for wrong answer or empty key', () => {
    assert.equal(checkShortAnswer('Bandung', 'Jakarta'), false);
    assert.equal(checkShortAnswer('', 'Jakarta'), false);
    assert.equal(checkShortAnswer('Jakarta', ''), false);
    assert.equal(checkShortAnswer('Jakarta', null), false);
  });
});
