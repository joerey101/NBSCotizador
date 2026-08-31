// Conversión y formato de moneda — lógica PURA (sin React), reutilizable Fase B.
// ARS es el PIVOTE: cualquier moneda se convierte a cualquier otra pasando por ARS.
import type { Moneda, TipoCambio } from "./types";

/** ARS por 1 unidad de `m`. ARS => 1. Devuelve null si falta la tasa. */
export function tasaARS(m: Moneda, tc: TipoCambio): number | null {
  if (m === "ARS") return 1;
  const t = m === "USD" ? tc.USD_ARS : tc.EUR_ARS;
  return t != null && t > 0 ? t : null;
}

/**
 * Convierte `monto` de la moneda `de` a la moneda `a` usando ARS como pivote.
 * REGLA DE PRECISIÓN: si `de === a`, devuelve el monto ORIGINAL sin tocar
 * (no hace ida y vuelta). Devuelve null si falta alguna tasa necesaria.
 */
export function convertir(
  monto: number | null,
  de: Moneda,
  a: Moneda,
  tc: TipoCambio
): number | null {
  if (monto == null) return null;
  if (de === a) return monto; // precisión: sin conversión ida y vuelta

  const tDe = tasaARS(de, tc); // ARS por 1 `de`
  const tA = tasaARS(a, tc); // ARS por 1 `a`
  if (tDe == null || tA == null) return null;

  const enArs = monto * tDe; // de -> ARS
  return enArs / tA; // ARS -> a
}

const FMT: Record<Moneda, Intl.NumberFormat> = {
  ARS: new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }),
  USD: new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
  EUR: new Intl.NumberFormat("es-AR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }),
};

export function formatoMoneda(valor: number, moneda: Moneda): string {
  return FMT[moneda].format(valor);
}

export const NOMBRE_MONEDA: Record<Moneda, string> = {
  ARS: "Pesos (ARS)",
  USD: "Dólares (USD)",
  EUR: "Euros (EUR)",
};
