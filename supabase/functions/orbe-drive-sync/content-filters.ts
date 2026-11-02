// Pure, Deno-independent content filters for the Drive sync — kept in their
// own module (no Deno.* calls) specifically so they can be imported and
// tested directly from the Node test suite (tests/drive-content-filters.test.ts),
// instead of only being exercised indirectly through the deployed function.

// Names (file or folder) that mean "do not index, this is access data, raw
// personal data, or a credential dump" — checked before any content is read.
// Matching a folder name stops the walk from descending into it at all, so
// nothing inside an excluded folder is even listed.
export const RESTRICTED_NAME_PATTERNS: RegExp[] = [
  /acesso/i,                 // "Planilha de Acessos"
  /senha/i, /password/i,
  /credencial/i, /credential/i,
  /\btoken\b/i, /\bsecret\b/i, /\bchave\b/i, /\blogin\b/i,
  /base de clientes/i,       // bulk customer records
  /\blead(s)?\b/i,           // raw lead sheets
  /p[úu]blico/i, /audi[êe]ncia/i, /audience/i, // raw audience/CSV exports
  /whatsapp/i,               // chat exports (personal conversations)
];

export function isRestrictedName(name: string): boolean {
  return RESTRICTED_NAME_PATTERNS.some((p) => p.test(name));
}

// Content-level check for files that pass the name filter but may still
// carry an embedded secret (e.g. a key pasted into a notes doc) or bulk
// personal data (phone/e-mail lists). Only a boolean/generic reason is ever
// produced — the matched text itself is never returned, logged or stored.
export const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  // Covers "Token: xyz", "token=xyz" AND "Token xyz" (space, no
  // punctuation) — a keyword immediately followed by a single
  // non-whitespace run of 8+ chars (UUID, hex, base64, anything
  // token-shaped). Plain prose after these words ("o token de acesso")
  // is a short connector word, not an 8+ char contiguous string, so it
  // doesn't match.
  /(senha|password|token|api[_ -]?key|secret|chave)[\s:=]+\S{8,}/i,
];

export function looksLikeSecret(content: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(content));
}

export function looksLikeBulkPersonalData(content: string): boolean {
  const phoneMatches = content.match(/\b(\+?\d{2}[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}\b/g) ?? [];
  const emailMatches = content.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [];
  return phoneMatches.length > 15 || emailMatches.length > 15;
}
