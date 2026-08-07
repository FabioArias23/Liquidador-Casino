/**
 * Branded types para IDs.
 * Evita que un UserId se cuele donde va un TenantId (el TS compiler lo cazaría).
 * Se construyen con `tenantId("uuid")`, `userId("uuid")`, etc.
 */

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type TenantId = Brand<string, "TenantId">;
export type UserId = Brand<string, "UserId">;
export type MemberId = Brand<string, "MemberId">;
export type CbuAccountId = Brand<string, "CbuAccountId">;
export type CasinoCredentialsId = Brand<string, "CasinoCredentialsId">;
export type CargaId = Brand<string, "CargaId">;
export type LedgerEntryId = Brand<string, "LedgerEntryId">;
export type AuditLogId = Brand<string, "AuditLogId">;
export type TenantConfigId = Brand<string, "TenantConfigId">;

export const tenantId = (s: string): TenantId => s as TenantId;
export const userId = (s: string): UserId => s as UserId;
export const memberId = (s: string): MemberId => s as MemberId;
export const cbuAccountId = (s: string): CbuAccountId => s as CbuAccountId;
export const casinoCredentialsId = (s: string): CasinoCredentialsId =>
  s as CasinoCredentialsId;
export const cargaId = (s: string): CargaId => s as CargaId;
export const ledgerEntryId = (s: string): LedgerEntryId => s as LedgerEntryId;
export const auditLogId = (s: string): AuditLogId => s as AuditLogId;
export const tenantConfigId = (s: string): TenantConfigId => s as TenantConfigId;

/** Genera un UUID v4 nativo (Node 22+). */
export function nuevoId(): string {
  return crypto.randomUUID();
}
