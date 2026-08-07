/**
 * Server actions de auth (mock por ahora).
 * Cuando llegue Supabase real, se reemplaza el contenido (la firma no cambia).
 */

"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/server";

export async function accionIniciarSesionComo(formData: FormData) {
  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) return;
  await auth().iniciarSesionComo(userId as never);
  revalidatePath("/", "layout");
}

export async function accionCerrarSesion() {
  await auth().cerrarSesion();
  revalidatePath("/", "layout");
}
