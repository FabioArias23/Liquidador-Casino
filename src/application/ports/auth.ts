/**
 * Puerto de autenticación. Hoy mockeado (cookie + selector de usuario en sidebar);
 * mañana Supabase Auth real (@supabase/ssr). Los casos de uso y la UI consumen
 * esta interfaz, no el cliente concreto.
 */

import type { Profile } from "@/domain/entities";
import type { UserId } from "@/domain/ids";

export interface Sesion {
  userId: UserId;
  profile: Profile;
}

export interface AuthProvider {
  /** Devuelve la sesión actual o null si no hay. */
  obtenerSesion(): Promise<Sesion | null>;

  /** Lista todos los profiles disponibles (solo para el selector del mock). */
  listarPerfilesParaSelector(): Promise<Profile[]>;

  /** Cambia la sesión activa (mock: setea cookie; Supabase: hace signIn). */
  iniciarSesionComo(userId: UserId): Promise<void>;

  /** Cierra la sesión activa. */
  cerrarSesion(): Promise<void>;
}
