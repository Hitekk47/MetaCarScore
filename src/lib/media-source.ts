/**
 * Media identity: ignore surrounding whitespace and case, preserving accents,
 * punctuation and internal whitespace. Empty names do not identify a source.
 * Keep in sync with public.normalize_media_source(text).
 */
export function getMediaSourceKey(name: string | null | undefined): string | null {
  return name?.trim().toLowerCase() || null;
}
