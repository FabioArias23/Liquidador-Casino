/**
 * Calcular el cierre diario de un tenant.
 *
 * Función pura (sin IO). Toma las cargas y retiros del tenant y devuelve
 * los totales del día + el listado de operaciones para la tabla.
 *
 * Cargas: solo cuentan las que están en estado `settled` (terminal).
 * Retiros: solo cuentan los que están en estado `paid` (terminal).
 * Filtra por rango de fechas (inicio, fin) usando `updatedAt`.
 *
 * El server component pasa `inicio = new Date()` (medianoche de hoy) y
 * `fin = ahora`. El smoke test usa rangos arbitrarios.
 */

import type { Carga, Retiro } from "@/domain/entities";
import { formatear } from "@/domain/money";

export type OperacionCierre = {
  tipo: "carga" | "retiro";
  id: string;
  playerRef: string;
  montoCents: number;
  moneda: string;
  estado: string;
  updatedAt: Date;
};

export interface CierreDiario {
  inicio: Date;
  fin: Date;
  totalCargasCents: number;
  totalRetirosCents: number;
  netoCents: number;
  cantidadCargas: number;
  cantidadRetiros: number;
  operaciones: OperacionCierre[];
  /** Texto formateado para mostrar en UI. */
  totalCargasFormateado: string;
  totalRetirosFormateado: string;
  netoFormateado: string;
}

export interface CalcularCierreInput {
  cargas: Carga[];
  retiros: Retiro[];
  inicio: Date;
  fin: Date;
  /** Moneda del cierre (default: ARS). */
  moneda?: string;
}

export function calcularCierreDiario(input: CalcularCierreInput): CierreDiario {
  const { cargas, retiros, inicio, fin } = input;
  const moneda = input.moneda ?? "ARS";

  const cargasDelDia = cargas.filter(
    (c) => c.estado === "settled" && c.updatedAt >= inicio && c.updatedAt <= fin,
  );
  const retirosDelDia = retiros.filter(
    (r) => r.estado === "paid" && r.updatedAt >= inicio && r.updatedAt <= fin,
  );

  const totalCargasCents = cargasDelDia.reduce((acc, c) => acc + c.montoCents, 0);
  const totalRetirosCents = retirosDelDia.reduce((acc, r) => acc + r.montoCents, 0);
  const netoCents = totalCargasCents - totalRetirosCents;

  const operaciones: OperacionCierre[] = [
    ...cargasDelDia.map<OperacionCierre>((c) => ({
      tipo: "carga",
      id: c.id,
      playerRef: c.playerRef,
      montoCents: c.montoCents,
      moneda: c.moneda,
      estado: c.estado,
      updatedAt: c.updatedAt,
    })),
    ...retirosDelDia.map<OperacionCierre>((r) => ({
      tipo: "retiro",
      id: r.id,
      playerRef: r.playerRef,
      montoCents: r.montoCents,
      moneda: r.moneda,
      estado: r.estado,
      updatedAt: r.updatedAt,
    })),
  ];
  // Más recientes primero.
  operaciones.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return {
    inicio,
    fin,
    totalCargasCents,
    totalRetirosCents,
    netoCents,
    cantidadCargas: cargasDelDia.length,
    cantidadRetiros: retirosDelDia.length,
    operaciones,
    totalCargasFormateado: formatear(totalCargasCents, moneda),
    totalRetirosFormateado: formatear(totalRetirosCents, moneda),
    netoFormateado: formatear(netoCents, moneda),
  };
}
