/**
 * Validation helpers for car-related slugs and data.
 */

export function isValidSlugPart(part: string): boolean {
  // Allow alphanumeric, hyphens.
  // Strictly disallow quotes, slashes, and other special chars to prevent injection/XSS.
  // Underscores are NOT allowed in marque/famille because they are separators in the composite slug.
  // Enforcing lowercase for strict slug compliance.
  return /^[a-z0-9\-]+$/.test(part);
}

export function isValidModelPart(part: string): boolean {
  // Models can contain underscores if they were joined back from parts.
  // Strictly disallow quotes.
  // Enforcing lowercase for strict slug compliance.
  return /^[a-z0-9\-_]+$/.test(part);
}

export function isValidYear(year: number): boolean {
  return !isNaN(year) && year >= 1900 && year <= 2100;
}

/**
 * Escapes strings for PostgREST double-quoted literals by using backslash escaping.
 * First escapes \ to \\, then " to \".
 * See: https://postgrest.org/en/stable/references/api/resource_embedding.html#embedded-filters
 */
export function escapePostgrestValue(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
