/**
 * Zod schema del payload de un webhook de carga entrante del casino.
 *
 * Es la versión JSON-wire del `CargaExterna`. La diferencia principal:
 * los timestamps vienen como ISO string (no Date). El handler del webhook
 * se encarga de transformarlos.
 *
 * Esto es defensa en profundidad: aunque el casino mande cualquier cosa,
 * no entra al dominio si no pasa este schema.
 */

import { z } from "zod";

export const webhookCargaPayloadSchema = z.object({
  externalRef: z.string().trim().min(1, "Falta externalRef."),
  playerRef: z.string().trim().min(1, "Falta playerRef."),
  montoCents: z
    .number()
    .int("montoCents debe ser entero.")
    .positive("montoCents debe ser positivo."),
  moneda: z.string().trim().length(3, "moneda debe tener 3 letras (ISO 4217)."),
  metodo: z.string().trim().min(1, "Falta metodo."),
  timestamp: z
    .string()
    .datetime({ message: "timestamp debe ser ISO 8601." }),
  comprobanteUrl: z.string().trim().url().optional(),
});

export type WebhookCargaPayload = z.infer<typeof webhookCargaPayloadSchema>;
