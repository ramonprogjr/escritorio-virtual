/** Extração e normalização de QR devolvido pela UAZAPI (sem HTTP — seguro para cliente e servidor). */

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function stringifyQrCandidate(c: unknown): string | undefined {
  if (typeof c === "string") {
    const t = c.trim();
    if (t.length < 32) return undefined;
    return t;
  }
  const o = asRecord(c);
  if (!o) return undefined;
  for (const k of ["base64", "image", "data", "qrcode", "qr", "value", "png"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim().length >= 32) return v.trim();
  }
  return undefined;
}

/** Percorre caminhos usuais na resposta JSON de connect / status. */
export function extrairQrcodeDePayloadUazapi(payload: unknown): string | undefined {
  const r = asRecord(payload);
  if (!r) return undefined;

  const nested: unknown[] = [
    r.qrcode,
    r.qr,
    r.qrCode,
    r.Qrcode,
    asRecord(r.instance)?.qrcode,
    asRecord(r.instance)?.qr,
    asRecord(r.data)?.qrcode,
    asRecord(r.data)?.qr,
    asRecord(r.result)?.qrcode,
    asRecord(r.response)?.qrcode,
  ];

  for (const c of nested) {
    const s = stringifyQrCandidate(c);
    if (s) return s;
  }

  return undefined;
}

export function extrairPaircodeDePayloadUazapi(payload: unknown): string | undefined {
  const r = asRecord(payload);
  if (!r) return undefined;
  const nested: unknown[] = [
    r.paircode,
    r.pairingCode,
    r.code,
    asRecord(r.instance)?.paircode,
    asRecord(r.instance)?.pairingCode,
  ];
  for (const c of nested) {
    if (typeof c === "string" && c.trim().length >= 4) return c.trim();
    if (typeof c === "number" && String(c).length >= 4) return String(c);
  }
  return undefined;
}

function mimeForRawBase64(b64: string): "png" | "jpeg" {
  if (b64.startsWith("iVBOR")) return "png";
  if (b64.startsWith("/9j/")) return "jpeg";
  return "png";
}

/**
 * Devolve string utilível em `<img src>`: data-URL, URL http(s) ou base64 cru → data-URL PNG/JPEG.
 */
export function normalizarSrcImagemQrUazapi(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^data:image\/[a-z+.-]+;base64,/i.test(s)) return s.replace(/\s/g, "");
  if (/^https?:\/\//i.test(s)) return s;
  const b64 = s.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(b64) && b64.length >= 64) {
    const mime = mimeForRawBase64(b64);
    return `data:image/${mime};base64,${b64}`;
  }
  return s;
}
