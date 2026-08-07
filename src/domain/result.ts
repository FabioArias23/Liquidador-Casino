export type Result<T, E = ErrorNegocio> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export class ErrorNegocio {
  constructor(
    public readonly codigo: string,
    public readonly mensaje: string,
  ) {}
}

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function errorNegocio(codigo: string, mensaje: string): ErrorNegocio {
  return new ErrorNegocio(codigo, mensaje);
}
