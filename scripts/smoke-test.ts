/**
 * Smoke test end-to-end — ejecuta los 4 escenarios del runbook contra los
 * repositorios mock (sin Next.js, sin clicks) y reporta ✅/❌ por caso.
 *
 * Uso:  npm run smoke
 *
 * El script arranca con un store limpio: borra `.data/mock.json`, deja que el
 * bootstrap reseedee, y corre los 4 escenarios con IDs timestamp-based para
 * que pueda ejecutarse varias veces seguidas sin contaminar el estado.
 *
 * No es un test unitario: es defensa contra "los tests pasan pero la app
 * está rota". Pensado para correr antes de cada demo / release.
 */

import { existsSync, rmSync } from "node:fs";

import { registrarCargaDesdeCasino } from "@/application/cargas/registrar-carga-desde-casino";
import { registrarCargaManual } from "@/application/cargas/registrar-carga-manual";
import { validarCarga } from "@/application/cargas/validar-carga";
import { asentarCarga } from "@/application/cargas/asentar-carga";
import { listarCargas } from "@/application/cargas/listar-cargas";
import { solicitarRetiro } from "@/application/retiros/solicitar-retiro";
import { validarRetiro } from "@/application/retiros/validar-retiro";
import { aprobarRetiro } from "@/application/retiros/aprobar-retiro";
import { pagarPremio } from "@/application/retiros/pagar-premio";
import { rechazarRetiro } from "@/application/retiros/rechazar-retiro";
import { listarRetiros } from "@/application/retiros/listar-retiros";
import { calcularCierreDiario } from "@/application/cierre/calcular-cierre";
import { codigos } from "@/application/errors";
import { calcularDigito } from "@/domain/cbu";
import { generarCierrePDF } from "@/lib/cierre-pdf";
import { tenantId as toTenantId, userId as toUserId } from "@/domain/ids";
import { obtenerRepositorios, _resetRepositoriosParaTests } from "@/infrastructure/repositories";

// IDs sembrados (rango 00000000-0000-4000-8000-000000000NNN).
const OPERADOR_ID = toUserId("00000000-0000-4000-8000-000000000002");
const SUPERVISOR_ID = toUserId("00000000-0000-4000-8000-000000000003");
const ADMIN_ID = toUserId("00000000-0000-4000-8000-000000000004");
const CASINO_DEMO_ID = toTenantId("00000000-0000-4000-8000-000000000010");
const UMBRAL_DOBLE_APROBACION = 1_000_000; // $10.000 ARS

let failures = 0;

function check(label: string, ok: boolean, details = ""): void {
  const mark = ok ? "\x1b[32m✅\x1b[0m" : "\x1b[31m❌\x1b[0m";
  console.log(`  ${mark} ${label}${details ? ` (${details})` : ""}`);
  if (!ok) failures += 1;
}

function cbuValido(bloque1: string, bloque2: string): string {
  return `${bloque1}${calcularDigito(bloque1)}${bloque2}${calcularDigito(bloque2)}`;
}

async function main(): Promise<void> {
  // 0. Reset: borrar snapshot para que el bootstrap re-siempre desde cero.
  const SNAPSHOT = ".data/mock.json";
  if (existsSync(SNAPSHOT)) {
    rmSync(SNAPSHOT, { force: true });
  }
  _resetRepositoriosParaTests();

  const r = await obtenerRepositorios();
  const tenant = await r.tenants.obtenerPorSlug("casino-demo");
  if (!tenant) {
    console.log("\x1b[31m❌ Tenant 'casino-demo' no encontrado.\x1b[0m");
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Escenario 1: carga idempotente
  // ─────────────────────────────────────────────────────────────────────
  console.log("\n\x1b[36mEscenario 1: carga idempotente\x1b[0m");
  {
    const externalRef = `smoke-casino-${Date.now()}-1`;
    const externa = {
      externalRef,
      playerRef: "jugador-smoke-1",
      montoCents: 25_000,
      moneda: "ARS",
      metodo: "tarjeta",
      timestamp: new Date(),
    };

    const r1 = await registrarCargaDesdeCasino(r, CASINO_DEMO_ID, externa);
    check("primera llamada OK", r1.ok, r1.ok ? `id=${r1.data.id.slice(0, 12)}…` : r1.error.mensaje);

    const r2 = await registrarCargaDesdeCasino(r, CASINO_DEMO_ID, externa);
    check("segunda llamada OK", r2.ok);

    check(
      "mismo id (idempotente)",
      r1.ok && r2.ok && r1.data.id === r2.data.id,
      r1.ok && r2.ok ? `${r1.data.id.slice(0, 12)}… == ${r2.data.id.slice(0, 12)}…` : "",
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Escenario 2: retiro cuatro-ojos end-to-end
  // ─────────────────────────────────────────────────────────────────────
  console.log("\n\x1b[36mEscenario 2: retiro cuatro-ojos end-to-end\x1b[0m");
  let retiroId = "";
  {
    const cbu = cbuValido("0000000", `${Date.now()}`.slice(-12).padStart(13, "0"));
    const solicitar = await solicitarRetiro(r, OPERADOR_ID, {
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-a3f9",
      montoCents: 1_500_000, // $15.000 — supera umbral
      moneda: "ARS",
      cbuDestino: cbu,
      titularDestino: "Juan Perez",
    });
    check("solicitar OK", solicitar.ok, solicitar.ok ? `id=${solicitar.data.id.slice(0, 12)}…` : solicitar.error.mensaje);
    if (solicitar.ok) retiroId = solicitar.data.id;

    const validar = await validarRetiro(r, SUPERVISOR_ID, {
      tenantId: CASINO_DEMO_ID,
      retiroId,
      umbralDobleAprobacionCents: UMBRAL_DOBLE_APROBACION,
    });
    check("validar OK", validar.ok);
    check(
      "salta directo a awaiting_approval (monto > umbral)",
      validar.ok && validar.data.estado === "awaiting_approval",
      validar.ok ? validar.data.estado : "",
    );

    const aprobarMismo = await aprobarRetiro(r, SUPERVISOR_ID, {
      tenantId: CASINO_DEMO_ID,
      retiroId,
    });
    check(
      "aprobar como mismo validador FALLA con CUATRO_OJOS_APROBACION",
      !aprobarMismo.ok && aprobarMismo.error.codigo === "CUATRO_OJOS_APROBACION",
      !aprobarMismo.ok ? aprobarMismo.error.codigo : "",
    );

    const aprobarAdmin = await aprobarRetiro(r, ADMIN_ID, {
      tenantId: CASINO_DEMO_ID,
      retiroId,
    });
    check("aprobar como admin OK", aprobarAdmin.ok, aprobarAdmin.ok ? aprobarAdmin.data.estado : aprobarAdmin.error.mensaje);

    const idempKey = `smoke-pago-${Date.now()}`;
    const pagarMismo = await pagarPremio(r, ADMIN_ID, {
      tenantId: CASINO_DEMO_ID,
      retiroId,
      comprobanteUrl: `https://banco.com/comp-${Date.now()}`,
      idempotencyKey: idempKey,
    });
    check(
      "pagar como mismo aprobador FALLA con CUATRO_OJOS_PAGO",
      !pagarMismo.ok && pagarMismo.error.codigo === "CUATRO_OJOS_PAGO",
      !pagarMismo.ok ? pagarMismo.error.codigo : "",
    );

    const pagarSupervisor = await pagarPremio(r, SUPERVISOR_ID, {
      tenantId: CASINO_DEMO_ID,
      retiroId,
      comprobanteUrl: `https://banco.com/comp-${Date.now()}`,
      idempotencyKey: idempKey,
    });
    check("pagar como supervisor OK", pagarSupervisor.ok);
    check(
      "estado final = paid",
      pagarSupervisor.ok && pagarSupervisor.data.estado === "paid",
      pagarSupervisor.ok ? pagarSupervisor.data.estado : "",
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Escenario 3: rechazo + CBU BCRA inválido
  // ─────────────────────────────────────────────────────────────────────
  console.log("\n\x1b[36mEscenario 3: rechazo + CBU BCRA\x1b[0m");
  {
    // 3a. CBU con checksum inválido (dígito verificador real != checksum calculado).
    const cbuMalo = "000000010000000000000001";
    const retMalo = await solicitarRetiro(r, OPERADOR_ID, {
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-a3f9",
      montoCents: 50_000,
      moneda: "ARS",
      cbuDestino: cbuMalo,
      titularDestino: "Juan Perez",
    });
    check(
      "CBU checksum invalido FALLA con CBU_INVALIDO",
      !retMalo.ok && retMalo.error.codigo === codigos.CBU_INVALIDO,
      !retMalo.ok ? retMalo.error.codigo : "",
    );

    // 3b. Rechazo de un retiro nuevo con motivo.
    const cbu = cbuValido("0000000", `${Date.now()}`.slice(-12).padStart(13, "0"));
    const nuevoRetiro = await solicitarRetiro(r, OPERADOR_ID, {
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-b7c2",
      montoCents: 30_000,
      moneda: "ARS",
      cbuDestino: cbu,
      titularDestino: "Maria Lopez",
    });
    check("nuevo retiro para rechazar OK", nuevoRetiro.ok);

    if (nuevoRetiro.ok) {
      const rechazo = await rechazarRetiro(r, OPERADOR_ID, {
        tenantId: CASINO_DEMO_ID,
        retiroId: nuevoRetiro.data.id,
        motivo: "Smoke: CBU no coincide con titular",
      });
      check("rechazo con motivo OK", rechazo.ok);
      check(
        "estado final = rejected",
        rechazo.ok && rechazo.data.estado === "rejected",
        rechazo.ok ? rechazo.data.estado : "",
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Escenario 4: cierre diario + PDF
  // ─────────────────────────────────────────────────────────────────────
  console.log("\n\x1b[36mEscenario 4: cierre diario + PDF\x1b[0m");
  {
    // 4a. Carga manual nueva → validar → asentar (genera asiento ledger).
    const cargaNueva = await registrarCargaManual(r, OPERADOR_ID, {
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-a3f9",
      montoCents: 75_000,
      moneda: "ARS",
      metodo: "tarjeta",
      comprobanteUrl: `https://banco.com/comp-smoke-${Date.now()}`,
    });
    check("registrar carga manual OK", cargaNueva.ok);

    if (cargaNueva.ok) {
      const valCarga = await validarCarga(r, OPERADOR_ID, {
        tenantId: CASINO_DEMO_ID,
        cargaId: cargaNueva.data.id,
        comprobanteUrl: cargaNueva.data.comprobanteUrl ?? `https://banco.com/comp-smoke-${Date.now()}`,
      });
      check("validar carga OK", valCarga.ok);

      const asiento = await asentarCarga(r, OPERADOR_ID, {
        tenantId: CASINO_DEMO_ID,
        cargaId: cargaNueva.data.id,
      });
      check("asentar carga OK", asiento.ok, asiento.ok ? asiento.data.estado : asiento.error.mensaje);
    }

    // 4b. Calcular cierre del dia.
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);
    const finDelDia = new Date();
    const cargas = await listarCargas(r, CASINO_DEMO_ID);
    const retiros = await listarRetiros(r, CASINO_DEMO_ID);
    const cierre = calcularCierreDiario({
      cargas,
      retiros,
      inicio: inicioDelDia,
      fin: finDelDia,
    });
    check(
      "cierre incluye al menos 1 carga del dia",
      cierre.cantidadCargas >= 1,
      `cargas=${cierre.cantidadCargas} retiros=${cierre.cantidadRetiros} neto=${cierre.netoFormateado}`,
    );

    // 4c. Generar PDF.
    const pdf = generarCierrePDF({
      tenantNombre: tenant.nombre,
      tenantSlug: tenant.slug,
      fecha: new Date(),
      inicioDelDia,
      totalCargasFormateado: cierre.totalCargasFormateado,
      totalRetirosFormateado: cierre.totalRetirosFormateado,
      netoFormateado: cierre.netoFormateado,
      cantidadCargas: cierre.cantidadCargas,
      cantidadRetiros: cierre.cantidadRetiros,
      operaciones: cierre.operaciones,
    });
    check("PDF > 500 bytes", pdf.length > 500, `${pdf.length} bytes`);
    check(
      "PDF arranca con firma %PDF-",
      pdf.subarray(0, 5).toString("ascii") === "%PDF-",
    );
  }

  console.log("");
  if (failures === 0) {
    console.log("\x1b[32m✅ Smoke test E2E OK\x1b[0m\n");
    process.exit(0);
  } else {
    console.log(`\x1b[31m❌ Smoke test E2E FAIL (${failures} checks fallaron)\x1b[0m\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\x1b[31m❌ Smoke test ERROR:\x1b[0m", err);
  process.exit(1);
});
