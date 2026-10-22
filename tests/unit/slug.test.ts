import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidSlug, normalizeSlug } from '../../src/lib/slug.ts';

describe('slug: normalizeSlug', () => {
  it('trims leading/trailing underscores and spaces', () => {
    assert.equal(normalizeSlug('  _hello_world_  '), 'hello_world');
  });

  it('converts uppercase to lowercase', () => {
    assert.equal(normalizeSlug('INFORMATIKA'), 'informatika');
    assert.equal(normalizeSlug('Bab 1: Pengenalan Komputer'), 'bab_1_pengenalan_komputer');
  });

  it('strips punctuation and non-alphanumeric characters', () => {
    assert.equal(normalizeSlug('Algoritma & Pemrograman!'), 'algoritma__pemrograman');
    assert.equal(normalizeSlug('Sub-Bab #3 (Array)'), 'subbab_3_array');
  });

  it('handles empty or null gracefully', () => {
    assert.equal(normalizeSlug(''), '');
    assert.equal(normalizeSlug(null), '');
    assert.equal(normalizeSlug(undefined), '');
  });
});

describe('slug: isValidSlug', () => {
  it('validates clean slugs', () => {
    assert.equal(isValidSlug('informatika'), true);
    assert.equal(isValidSlug('bab_1'), true);
    assert.equal(isValidSlug('sub_bab_1_dasar'), true);
  });

  it('rejects invalid slugs with spaces, leading/trailing underscore, or symbols', () => {
    assert.equal(isValidSlug(''), false);
    assert.equal(isValidSlug('_leading'), false);
    assert.equal(isValidSlug('trailing_'), false);
    assert.equal(isValidSlug('with space'), false);
    assert.equal(isValidSlug('with-dash'), false);
    assert.equal(isValidSlug('with.dot'), false);
  });
});
