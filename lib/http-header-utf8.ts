/** Cabeçalhos do fetch no browser exigem ASCII/Latin-1; acentos e pontuação Unicode precisam de codificação. */
const B64_PREFIX = "b64:";

function needsHeaderEncoding(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 127) return true;
  }
  return false;
}

export function encodeHttpHeaderValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !needsHeaderEncoding(trimmed)) return trimmed;
  const bytes = new TextEncoder().encode(trimmed);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `${B64_PREFIX}${btoa(binary)}`;
}

export function decodeHttpHeaderValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith(B64_PREFIX)) return trimmed;
  const binary = atob(trimmed.slice(B64_PREFIX.length));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
