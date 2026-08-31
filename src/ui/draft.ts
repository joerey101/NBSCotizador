// Export / import de la cotización como archivo JSON (alternativa robusta a
// localStorage desde file://). Incluye cliente, moneda del presupuesto y tasas usadas.
import type { DatosCliente, Moneda, TipoCambio } from "../lib/types";
import type { Descuento, LineaCotizacion } from "../lib/cotizacion";

export interface DraftCotizacion {
  app: "nbs-cotizacion";
  version: 1;
  exportado: string;
  monedaPresupuesto: Moneda;
  tasas: TipoCambio;
  descuento: Descuento;
  cliente?: DatosCliente;
  lineas: LineaCotizacion[];
}

export function exportarCotizacion(d: Omit<DraftCotizacion, "app" | "version" | "exportado">) {
  const draft: DraftCotizacion = {
    app: "nbs-cotizacion",
    version: 1,
    exportado: new Date().toISOString(),
    ...d,
  };
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const clienteLimpio = (d.cliente?.empresa || d.cliente?.nombre || "Borrador").replace(/[^a-zA-Z0-9_-]/g, "_");
  const stamp = draft.exportado.slice(0, 10);
  a.href = url;
  a.download = `cotizacion_NBS_${clienteLimpio}_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseCotizacion(texto: string): DraftCotizacion {
  const d = JSON.parse(texto);
  if (d?.app !== "nbs-cotizacion" || !Array.isArray(d.lineas)) {
    throw new Error("El archivo no es una cotización NBS válida.");
  }
  return d as DraftCotizacion;
}
