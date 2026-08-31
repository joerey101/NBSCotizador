// Tests del núcleo de conversión y totales. Correr: npx tsx test/pricing.test.mts
import assert from "node:assert";
import { convertir, tasaARS } from "../src/lib/pricing.ts";
import { calcularTotales, type LineaCotizacion } from "../src/lib/cotizacion.ts";
import type { TipoCambio } from "../src/lib/types.ts";

const tc: TipoCambio = { USD_ARS: 1460, EUR_ARS: 1715, fecha: null };
const sinTC: TipoCambio = { USD_ARS: null, EUR_ARS: null, fecha: null };
let ok = 0;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
function t(nombre: string, cond: boolean) {
  assert.ok(cond, "FALLO: " + nombre);
  ok++;
}

// --- convertir ---
t("ARS->ARS identidad", convertir(100, "ARS", "ARS", tc) === 100);
t("USD->USD intacto (precisión)", convertir(554, "USD", "USD", tc) === 554);
t("USD->ARS", convertir(554, "USD", "ARS", tc) === 554 * 1460);
t("ARS->USD inverso", near(convertir(554 * 1460, "ARS", "USD", tc)!, 554));
t("USD->EUR via ARS", near(convertir(554, "USD", "EUR", tc)!, (554 * 1460) / 1715));
t("EUR->USD via ARS", near(convertir(471.66, "EUR", "USD", tc)!, (471.66 * 1715) / 1460));
t("falta tasa USD->ARS => null", convertir(100, "USD", "ARS", sinTC) === null);
t("falta tasa ARS->USD => null", convertir(100, "ARS", "USD", sinTC) === null);
t("monto null => null", convertir(null, "USD", "ARS", tc) === null);
t("tasaARS ARS=1", tasaARS("ARS", tc) === 1);
t("tasaARS USD", tasaARS("USD", tc) === 1460);

// --- calcularTotales ---
function linea(over: Partial<LineaCotizacion>): LineaCotizacion {
  return {
    uid: over.uid ?? "u" + Math.random(),
    productoId: "x", producto: "p", origen: "o", marca: null, codigo_origen: null,
    presentacion: "Unidad", unidades_por_presentacion: 1, monedaOriginal: "ARS",
    precioListaOriginal: 0, ivaAlicuota: 21, cantidad: 1, precioUnitarioOriginal: 0,
    ...over,
  };
}

const L = [
  linea({ uid: "a", monedaOriginal: "ARS", precioUnitarioOriginal: 1000, cantidad: 2 }), // 2000 ARS
  linea({ uid: "b", monedaOriginal: "USD", precioUnitarioOriginal: 10, cantidad: 3 }), // 30 USD
];

// Presupuesto ARS
let r = calcularTotales(L, { modo: "porcentaje", valor: 10 }, "ARS", tc);
t("subtotal ARS", r.subtotal === 2000 + 30 * 1460);
t("descuento 10%", near(r.descuentoMonto, r.subtotal * 0.1));
t("total = base (IVA off)", near(r.total, r.subtotal * 0.9));
t("IVA apagado", r.iva === 0);

// Presupuesto USD (precisión: la línea USD queda intacta)
r = calcularTotales(L, { modo: "porcentaje", valor: 0 }, "USD", tc);
t("subtotal USD intacto + ARS convertido", near(r.subtotal, 30 + 2000 / 1460));
t("línea USD subtotal intacto", r.porLinea["b"].subtotalPresupuesto === 30);

// Pendiente de precio
const Lp = [linea({ uid: "c", precioUnitarioOriginal: null })];
r = calcularTotales(Lp, { modo: "monto", valor: 0 }, "ARS", tc);
t("pendiente no suma", r.subtotal === 0 && r.nPendientesPrecio === 1);
t("estado pendiente_precio", r.porLinea["c"].estado === "pendiente_precio");

// Falta tasa
r = calcularTotales([linea({ uid: "d", monedaOriginal: "USD", precioUnitarioOriginal: 10, cantidad: 1 })],
  { modo: "monto", valor: 0 }, "ARS", sinTC);
t("falta tasa no suma", r.subtotal === 0 && r.nFaltaTasa === 1);
t("estado falta_tasa", r.porLinea["d"].estado === "falta_tasa");

// Descuento monto fijo no supera subtotal + aviso > 30%
r = calcularTotales(L, { modo: "monto", valor: 99_999_999 }, "ARS", tc);
t("descuento clamp a subtotal", r.descuentoMonto === r.subtotal && r.total === 0);
t("aviso descuento >30%", r.avisoDescuento === true);

console.log(`\n✅ ${ok} asserts OK — núcleo de conversión y totales correcto`);
