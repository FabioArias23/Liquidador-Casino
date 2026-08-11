/**
 * Helper para generar el PDF del cierre diario.
 *
 * Usa jspdf para componer un PDF simple con:
 * - Header: tenant + fecha del cierre
 * - KPIs: total cargas, total retiros, neto
 * - Tabla: operaciones liquidadas/pagadas del dia
 *
 * Devuelve un Buffer listo para servir como `application/pdf`.
 *
 * No testeamos el contenido exacto (jspdf no es deterministico). Solo
 * que devuelve un Buffer que arranca con la firma `%PDF-` y tiene
 * tamaño razonable. Ver `cierre-pdf.test.ts`.
 */

import { jsPDF } from "jspdf";

export interface CierrePDFOperacion {
  tipo: "carga" | "retiro";
  id: string;
  playerRef: string;
  montoCents: number;
  moneda: string;
  estado: string;
  updatedAt: Date;
}

export interface CierrePDFData {
  tenantNombre: string;
  tenantSlug: string;
  fecha: Date;
  inicioDelDia: Date;
  totalCargasFormateado: string;
  totalRetirosFormateado: string;
  netoFormateado: string;
  cantidadCargas: number;
  cantidadRetiros: number;
  operaciones: CierrePDFOperacion[];
}

const MONEDA_LABEL: Record<string, string> = {
  ARS: "ARS",
  USD: "USD",
};

function formatFechaCorta(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatHora(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMontoCents(cents: number, moneda: string): string {
  const pesos = cents / 100;
  const simbolo = MONEDA_LABEL[moneda] ?? moneda;
  return `${simbolo} ${pesos.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function generarCierrePDF(data: CierrePDFData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  // Header: tenant + fecha del cierre.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Cierre diario — ${data.tenantNombre}`, margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Tenant: ${data.tenantSlug}`, margin, y);
  y += 5;
  doc.text(
    `Periodo: ${formatFechaCorta(data.inicioDelDia)} (cierre generado ${formatHora(data.fecha)})`,
    margin,
    y,
  );
  y += 8;

  doc.setTextColor(0);

  // KPIs: cargas, retiros, neto.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumen del dia", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Cargas liquidadas: ${data.cantidadCargas}   Total: ${data.totalCargasFormateado}`,
    margin,
    y,
  );
  y += 5;
  doc.text(
    `Retiros pagados: ${data.cantidadRetiros}   Total: ${data.totalRetirosFormateado}`,
    margin,
    y,
  );
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(`Neto del dia: ${data.netoFormateado}`, margin, y);
  doc.setFont("helvetica", "normal");
  y += 8;

  // Tabla de operaciones.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Operaciones liquidadas hoy", margin, y);
  y += 6;

  if (data.operaciones.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("Sin operaciones liquidadas hoy.", margin, y);
    doc.setTextColor(0);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90);
    const cols = [
      { label: "Tipo", x: margin, w: 18 },
      { label: "Estado", x: margin + 18, w: 22 },
      { label: "Jugador", x: margin + 40, w: 45 },
      { label: "Monto", x: margin + 85, w: 35 },
      { label: "Hora", x: margin + 120, w: 25 },
      { label: "ID", x: margin + 145, w: 35 },
    ];
    cols.forEach((c) => doc.text(c.label, c.x, y));
    y += 2;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0);

    for (const op of data.operaciones) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(op.tipo.toUpperCase(), cols[0].x, y);
      doc.text(op.estado, cols[1].x, y);
      doc.text(op.playerRef, cols[2].x, y);
      doc.text(formatMontoCents(op.montoCents, op.moneda), cols[3].x, y);
      doc.text(formatHora(op.updatedAt), cols[4].x, y);
      doc.text(op.id, cols[5].x, y);
      y += 5;
    }
  }

  // Footer minimo en cada pagina.
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Liquidador Casino — ${data.tenantSlug} — pagina ${p} de ${totalPages}`,
      margin,
      290,
    );
    doc.setTextColor(0);
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
