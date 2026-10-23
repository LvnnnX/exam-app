import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMAGE_BYTES, validateImage } from '../../src/features/bank-soal/editor/image-validation.ts';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0]);
const GIF = bytes('GIF89a');
const WEBP = bytes('RIFF', [0, 0, 0, 0], 'WEBP');
const SVG = bytes('<svg xmlns=');

describe('image validation', () => {
  it('derives extension from validated MIME, not file name', () => {
    assert.equal(validateImage('image/png', 100, PNG), 'png');
    assert.equal(validateImage('image/jpeg', 100, JPEG), 'jpg');
    assert.equal(validateImage('image/gif', 100, GIF), 'gif');
    assert.equal(validateImage('image/webp', 100, WEBP), 'webp');
  });

  it('rejects SVG and other MIME types', () => {
    assert.throws(() => validateImage('image/svg+xml', 100, SVG), /Format gambar tidak didukung/);
    assert.throws(() => validateImage('image/avif', 100, PNG), /Format gambar tidak didukung/);
    assert.throws(() => validateImage('', 100, PNG), /Format gambar tidak didukung/);
  });

  it('rejects content that does not match the declared MIME', () => {
    assert.throws(() => validateImage('image/png', 100, SVG), /Isi file tidak sesuai/);
    assert.throws(() => validateImage('image/jpeg', 100, PNG), /Isi file tidak sesuai/);
    assert.throws(() => validateImage('image/webp', 100, bytes('RIFF', [0, 0, 0, 0], 'WAVE')), /Isi file tidak sesuai/);
  });

  it('enforces 2 MB limit and non-empty file', () => {
    assert.equal(validateImage('image/png', MAX_IMAGE_BYTES, PNG), 'png');
    assert.throws(() => validateImage('image/png', MAX_IMAGE_BYTES + 1, PNG), /2 MB/);
    assert.throws(() => validateImage('image/png', 0, PNG), /kosong/);
  });
});
