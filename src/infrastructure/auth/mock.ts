/**
 * Auth provider mock (cookie-based).
 *
 * Hoy: cookie `mock-user-id` con el id del profile activo. El sidebar tiene
 * un selector para cambiar de usuario (para validar permisos en dev sin auth real).
 *
 * Mañana: este archivo se reemplaza por la impl con `@supabase/ssr` que lee
 * la sesión real. La interface `AuthProvider` no cambia.
 */

import { cookies } from "next/headers";

import type { AuthProvider, Sesion } from "@/application/ports/auth";
import type { Profile } from "@/domain/entities";
import { userId as toUserId } from "@/domain/ids";

import { obtenerRepositorios } from "../repositories";

const COOKIE_NAME = "mock-user-id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export function crearAuthMock(): AuthProvider {
  return {
    async obtenerSesion(): Promise<Sesion | null> {
      const jar = await cookies();
      const raw = jar.get(COOKIE_NAME)?.value;
      if (!raw) return null;
      const repos = await obtenerRepositorios();
      const profile = await repos.profiles.obtenerPorId(toUserId(raw));
      if (!profile) return null;
      return { userId: profile.id, profile };
    },

    async listarPerfilesParaSelector(): Promise<Profile[]> {
      const repos = await obtenerRepositorios();
      return repos.profiles.listar();
    },

    async iniciarSesionComo(id) {
      const jar = await cookies();
      jar.set(COOKIE_NAME, id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });
    },

    async cerrarSesion() {
      const jar = await cookies();
      jar.delete(COOKIE_NAME);
    },
  };
}
