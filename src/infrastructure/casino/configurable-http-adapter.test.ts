/**
 * Tests del ConfigurableHttpAdapter: verifica que notifique al casino con
 * HMAC firmado y maneje errores gracefully (no rompe la operacion interna).
 *
 * Mockeamos `fetch` para no hacer requests reales.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { crearConfigurableHttpAdapter } from "@/infrastructure/casino/configurable-http-adapter";
import { _resetNonceStoreParaTests } from "@/lib/nonce-store";

const TENANT_ID = "00000000-0000-4000-8000-000000000010" as never;
const SECRET = "test-secret-fixture-32-chars-aaaaaa";

describe("ConfigurableHttpAdapter - notificaciones al casino", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    process.env.CASINO_WEBHOOK_SECRET_DEV = SECRET;
    _resetNonceStoreParaTests();
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    consoleWarnSpy.mockRestore();
    delete process.env.CASINO_WEBHOOK_SECRET_DEV;
  });

  it("notificarCargaAcreditada: POSTea al endpoint con HMAC firmado", async () => {
    fetchMock.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const adapter = crearConfigurableHttpAdapter();
    await adapter.notificarCargaAcreditada(TENANT_ID, "casino-casino-demo-1700000000-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    // URL: apunta al endpoint de carga-acreditada del tenant.
    expect(url).toContain("/carga-acreditada");

    // Headers: HMAC + timestamp + nonce presentes.
    const headers = init.headers as Record<string, string>;
    expect(headers["x-casino-signature"]).toMatch(/^[a-f0-9]{64}$/);
    expect(headers["x-casino-timestamp"]).toMatch(/^\d+$/);
    expect(headers["x-casino-nonce"]).toBeTruthy();

    // Body: incluye externalRef.
    const body = JSON.parse(init.body as string);
    expect(body.externalRef).toBe("casino-casino-demo-1700000000-1");
    expect(body.estado).toBe("validated");
  });

  it("notificarPagoRealizado: POSTea al endpoint con HMAC + comprobanteUrl opcional", async () => {
    fetchMock.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const adapter = crearConfigurableHttpAdapter();
    await adapter.notificarPagoRealizado(
      TENANT_ID,
      "casino-casino-demo-1700000000-1",
      "https://banco.com/comp.jpg",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/pago-realizado");

    const body = JSON.parse(init.body as string);
    expect(body.externalRef).toBe("casino-casino-demo-1700000000-1");
    expect(body.estado).toBe("paid");
    expect(body.comprobanteUrl).toBe("https://banco.com/comp.jpg");
  });

  it("notificarPagoRealizado: comprobanteUrl es opcional", async () => {
    fetchMock.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const adapter = crearConfigurableHttpAdapter();
    await adapter.notificarPagoRealizado(TENANT_ID, "ext-1");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.comprobanteUrl).toBeUndefined();
  });

  it("no rompe la operacion si el casino responde 500 (graceful)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }));

    const adapter = crearConfigurableHttpAdapter();
    // No debe tirar — el adapter devuelve void y loguea warning.
    await expect(
      adapter.notificarCargaAcreditada(TENANT_ID, "ext-1"),
    ).resolves.toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("no rompe la operacion si el casino no responde (fetch rechaza)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const adapter = crearConfigurableHttpAdapter();
    await expect(
      adapter.notificarPagoRealizado(TENANT_ID, "ext-1"),
    ).resolves.toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("no hace request si no hay CASINO_WEBHOOK_SECRET_DEV configurado", async () => {
    delete process.env.CASINO_WEBHOOK_SECRET_DEV;
    const adapter = crearConfigurableHttpAdapter();
    await adapter.notificarCargaAcreditada(TENANT_ID, "ext-1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("CASINO_WEBHOOK_SECRET_DEV"),
    );
  });

  it("usa nonces unicos en cada notificacion (anti-replay)", async () => {
    fetchMock.mockResolvedValue(new Response("OK", { status: 200 }));

    const adapter = crearConfigurableHttpAdapter();
    await adapter.notificarCargaAcreditada(TENANT_ID, "ext-1");
    await adapter.notificarCargaAcreditada(TENANT_ID, "ext-2");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const nonce1 = (fetchMock.mock.calls[0]![1]!.headers as Record<string, string>)[
      "x-casino-nonce"
    ];
    const nonce2 = (fetchMock.mock.calls[1]![1]!.headers as Record<string, string>)[
      "x-casino-nonce"
    ];
    expect(nonce1).not.toBe(nonce2);
  });
});
