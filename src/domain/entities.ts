/**
 * Entidades de dominio (puras, sin frameworks).
 * Lo que devuelven los repositorios. El schema Drizzle se mapea a estas formas.
 */

import type {
  CasinoCredentialsId,
  CbuAccountId,
  MemberId,
  TenantId,
  UserId,
} from "./ids";
import type { Rol } from "./roles";

export type EstadoTenant = "activo" | "suspendido";

export interface Tenant {
  id: TenantId;
  nombre: string;
  slug: string;
  estado: EstadoTenant;
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile {
  id: UserId;
  email: string;
  isSuperadmin: boolean;
  createdAt: Date;
}

export type EstadoMiembro = "activo" | "inactivo";

export interface Member {
  id: MemberId;
  tenantId: TenantId;
  userId: UserId;
  email: string; // desnormalizado para mostrar en UI
  rol: Rol;
  estado: EstadoMiembro;
  createdAt: Date;
}

export interface CbuAccount {
  id: CbuAccountId;
  tenantId: TenantId;
  cbu: string;
  alias: string | null;
  titular: string;
  moneda: string; // ISO 4217
  activa: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CasinoCredentials {
  id: CasinoCredentialsId;
  tenantId: TenantId;
  adapterType: string;
  baseUrl: string;
  apiKeyCiphertext: string | null;
  webhookSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
}
