import { describe, expect, test } from 'bun:test';
import { getMediaSourceKey } from './media-source';

describe('media source identity', () => {
  test('ignores case and surrounding whitespace, including nonbreaking spaces', () => {
    for (const name of ['TopGear', 'topgear', ' TOPGEAR ', '\tTopGear\n', '\u00a0TopGear\u00a0']) {
      expect(getMediaSourceKey(name)).toBe('topgear');
    }
    expect(getMediaSourceKey(' ÉCHAPPEMENT ')).toBe('échappement');
  });

  test('empty or absent names do not identify a medium', () => {
    for (const name of [null, undefined, '', '   ', '\t\n', '\u00a0']) {
      expect(getMediaSourceKey(name)).toBeNull();
    }
  });

  test('preserves accents, punctuation and internal whitespace', () => {
    expect(getMediaSourceKey('Échappement')).not.toBe(getMediaSourceKey('Echappement'));
    expect(getMediaSourceKey("L'Argus")).not.toBe(getMediaSourceKey('L’Argus'));
    expect(getMediaSourceKey('Auto  Express')).not.toBe(getMediaSourceKey('Auto Express'));
  });
});
