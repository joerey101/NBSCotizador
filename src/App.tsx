import { useEffect, useDeferredValue, useMemo, useState } from "react";
import { catalogo } from "./data/catalogo";
import type { DatosCliente, Filtros, Moneda, TipoCambio } from "./lib/types";
import { crearIndice, buscar, opcionesFiltro } from "./lib/search";
import { calcularTotales } from "./lib/cotizacion";
import { RateBar } from "./ui/RateBar";
import { FiltrosBar } from "./ui/Filtros";
import { ResultCard } from "./ui/ResultCard";
import { CotizacionPanel } from "./ui/CotizacionPanel";
import { useLocalStorage } from "./ui/useLocalStorage";
import { useCotizacion } from "./ui/useCotizacion";
import { exportarCotizacion, parseCotizacion } from "./ui/draft";
import { exportarPresupuestoExcel } from "./lib/exportExcel";

const EJEMPLOS = ["germer", "paderno", "neovac", "plato playo", "copa"];

const CLIENTE_DEFAULT: DatosCliente = {
  nombre: "",
  empresa: "",
  cuit: "",
  email: "",
  telefono: "",
  direccion: "",
  vendedor: "Stella Diaz Ruiz - Marcelo Castillo",
  fecha: new Date().toISOString().slice(0, 10),
  validez: "15 días",
  condicionesPago: "Anticipo 50%, saldo contra aviso de entrega.-",
  tiempoEntrega: "21 días aproximados desde acreditado anticipo.-",
  lugarEntrega: "En nuestro depósito sito en Lerma 51, Ciudad Autónoma Bs. As.",
  observaciones: "",
};

export default function App() {
  const productos = catalogo.productos;
  const md = catalogo.metadata;

  const indice = useMemo(() => crearIndice(productos), [productos]);
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const opciones = useMemo(() => opcionesFiltro(productos), [productos]);

  const [query, setQuery] = useState("");
  const [filtros, setFiltros] = useState<Filtros>({ origen: "", categoria: "", moneda: "" });
  const [monedaPresupuesto, setMoneda] = useLocalStorage<Moneda>("nbs_moneda", "ARS");
  const [tc, setTc] = useLocalStorage<TipoCambio>("nbs_tasas", { USD_ARS: null, EUR_ARS: null, fecha: null });
  const [cliente, setCliente] = useLocalStorage<DatosCliente>("nbs_cliente", CLIENTE_DEFAULT);
  const [theme, setTheme] = useLocalStorage<"light" | "dark">("nbs_theme", "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const cot = useCotizacion();

  const queryDef = useDeferredValue(query);
  const { items, total } = useMemo(
    () => buscar(queryDef, filtros, productos, porId, indice),
    [queryDef, filtros, productos, porId, indice]
  );

  const totales = useMemo(
    () => calcularTotales(cot.lineas, cot.descuento, monedaPresupuesto, tc),
    [cot.lineas, cot.descuento, monedaPresupuesto, tc]
  );

  const onImportar = async (file: File) => {
    try {
      const d = parseCotizacion(await file.text());
      cot.reemplazar(d.lineas, d.descuento);
      setMoneda(d.monedaPresupuesto);
      setTc(d.tasas);
      if (d.cliente) {
        setCliente(d.cliente);
      }
    } catch (e) {
      alert("No se pudo importar: " + (e as Error).message);
    }
  };

  const handleDescargarExcel = async () => {
    try {
      await exportarPresupuestoExcel({
        lineas: cot.lineas,
        totales,
        cliente,
        descuento: cot.descuento,
        monedaPresupuesto,
      });
    } catch (err) {
      console.error(err);
      alert("Error al generar el presupuesto Excel: " + (err as Error).message);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>NBS · Catálogo y Cotización</h1>
          <span className="sub">
            {md.total_productos.toLocaleString("es-AR")} productos · {md.archivos_procesados} listas ·
            monedas {md.monedas_detectadas.join(" / ")}
          </span>
        </div>
        <div className="topbar-actions">
          <RateBar monedaPresupuesto={monedaPresupuesto} onMoneda={setMoneda} tc={tc} onTc={setTc} />
          <button
            type="button"
            className="btn-theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            title={theme === "light" ? "Activar Modo Oscuro" : "Activar Modo Claro"}
          >
            {theme === "light" ? "🌙 Modo Oscuro" : "☀️ Modo Claro"}
          </button>
        </div>
      </header>

      <div className="layout">
        <main className="col-buscador">
          <div className="buscador">
            <input
              className="search-input"
              type="search"
              autoFocus
              placeholder="Buscar producto, código, marca u origen…  (tolera acentos y mayúsculas)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="ejemplos">
              <span>Probar desambiguación:</span>
              {EJEMPLOS.map((e) => (
                <button key={e} type="button" className="chip-ejemplo" onClick={() => setQuery(e)}>
                  {e}
                </button>
              ))}
              {query && (
                <button type="button" className="chip-ejemplo limpiar" onClick={() => setQuery("")}>
                  ✕ limpiar
                </button>
              )}
            </div>
            <FiltrosBar filtros={filtros} opciones={opciones} onChange={setFiltros} />
          </div>

          <div className="resultados-info">
            {total === 0 ? (
              <span>Sin resultados.</span>
            ) : (
              <span>
                {total.toLocaleString("es-AR")} resultado{total === 1 ? "" : "s"}
                {items.length < total && ` · mostrando ${items.length}, refiná para ver más`}
              </span>
            )}
          </div>

          <div className="resultados">
            {items.map((p) => (
              <ResultCard key={p.id} p={p} monedaPresupuesto={monedaPresupuesto} tc={tc} onAgregar={cot.agregar} />
            ))}
          </div>
        </main>

        <CotizacionPanel
          lineas={cot.lineas}
          totales={totales}
          monedaPresupuesto={monedaPresupuesto}
          descuento={cot.descuento}
          cliente={cliente}
          onCliente={setCliente}
          onDescuento={cot.setDescuento}
          onCantidad={cot.setCantidad}
          onPrecio={cot.setPrecio}
          onQuitar={cot.quitar}
          onLimpiar={cot.limpiar}
          onExportar={() =>
            exportarCotizacion({
              monedaPresupuesto,
              tasas: tc,
              descuento: cot.descuento,
              cliente,
              lineas: cot.lineas,
            })
          }
          onImportar={onImportar}
          onDescargarExcel={handleDescargarExcel}
        />
      </div>
    </div>
  );
}
