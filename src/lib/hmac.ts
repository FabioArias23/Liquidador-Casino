/**
 * Helper de firma HMAC para webhooks del casino.
 *
 * Formato de la firma: HMAC-SHA256(secret, `${timestamp}.${nonce}.${body}`)
 * en hex. Cubre body + timestamp + nonce para que un atacante no pueda
 * reutilizar un webhook viejo cambiando solo uno de los campos.
 *
 * Headers esperados en el request:
 *   X-Casino-Signature: <hex>
 *   X-Casino-Timestamp: <unix seconds>
 *   X-Casino-Nonce: <string unico por envio>
 *
 * La verificación usa `timingSafeEqual` para evitar timing attacks.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const FIRMA_HEADER = "x-casino-signature";
export const TIMESTAMP_HEADER = "x-casino-timestamp";
export const NONCE_HEADER = "x-casino-nonce";

/**
 * Calcula la firma HMAC-SHA256 sobre `timestamp.nonce.body` en hex.
 */
export function calcularFirma(
  secret: string,
  body: string,
  timestamp: string,
  nonce: string,
): string {
  const data = `${timestamp}.${nonce}.${body}`;
  return createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

/**
 * Verifica la firma de un webhook en tiempo constante.
 * Devuelve true solo si la firma es exactamente la esperada.
 */
export function verificarFirma(
  secret: string,
  body: string,
  firmaHex: string,
  timestamp: string,
  nonce: string,
): boolean {
  if (!firmaHex || firmaHex.length !== 64) return false;
  const esperada = calcularFirma(secret, body, timestamp, nonce);
  const a = Buffer.from(firmaHex, "hex");
  const b = Buffer.from(esperada, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Valida que el timestamp está dentro de la ventana permitida (±ventanaSegundos).
 * Default: 5 minutos (300s). Esto es anti-replay: si el atacante manda un
 * webhook viejo capturado, falla acá.
 */
export function timestampFresco(
  timestampUnixSeg: string,
  ahoraMs: number = Date.now(),
  ventanaSegundos: number = 300,
): boolean {
  const t = Number(timestampUnixSeg);
  if (!Number.isFinite(t) || t <= 0) return false;
  const diffSeg = Math.abs(ahoraMs / 1000 - t);
  return diffSeg <= ventanaSegundos;
}
