// Stock propio por depósito (suma de movimientos). Aparte se muestra el stock que informa el
// proveedor (hoy solo Verbano), que NO es de NBS. Sin precios.
import { useEffect, useMemo, useState } from "react";
import { listarDepositos, listarStock, productoPorId, type Deposito, type StockFila } from "../../lib/stock";
import { ir } from "../../lib/ruta";

export function Stock() {
  const [filas, setFilas] = useState<StockFila[] | null>(null);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [texto, setTexto] = useState("");
  const [soloConStock, setSoloConStock] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarStock(), listarDepositos()])
      .then(([s, d]) => (setFilas(s), setDepositos(d)))
      .catch((e: Error) => setError(e.message));
  }, []);

  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return (filas ?? [])
      .filter((f) => !soloConStock || f.cantidad !== 0)
      .map((f) => ({ f, p: productoPorId(f.producto_id) }))
      .filter(
        ({ f, p }) =>
          !t ||
          (p?.producto ?? f.descripcion ?? "").toLowerCase().includes(t) ||
          (p?.origen ?? "").toLowerCase().includes(t) ||
          (p?.codigo_origen ?? "").toLowerCase().includes(t)
      );
  }, [filas, texto, soloConStock]);

  const unidades = visibles.reduce((s, x) => s + x.f.cantidad, 0);
  const nombreDeposito = (id: string) => depositos.find((d) => d.id === id)?.nombre ?? "";

  return (
    <div className="crm-panel">
      <div className="crm-encabezado">
        <div>
          <h2>Stock</h2>
          <span className="crm-sec" style={{ marginLeft: 0 }}>
            {visibles.length} productos · {unidades.toLocaleString("es-AR")} unidades en depósito
          </span>
        </div>
        <button type="button" className="crm-btn-primario" onClick={() => ir("/movimientos")}>
          Escanear / cargar movimiento
        </button>
      </div>
      <div className="crm-busqueda">
        <input
          type="search"
          className="search-input"
          placeholder="Buscar por producto, proveedor o código…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <label className="crm-check">
          <input type="checkbox" checked={soloConStock} onChange={(e) => setSoloConStock(e.target.checked)} />
          Ocultar en cero
        </label>
      </div>

      {error && <div className="auth-error">{error}</div>}
      {filas === null && !error && <p className="crm-vacio">Cargando…</p>}
      {filas?.length === 0 && <p className="crm-vacio">Todavía no hay movimientos de stock. Empezá cargando entradas con el escáner.</p>}

      {visibles.length > 0 && (
        <div className="crm-tabla">
          {visibles.map(({ f, p }) => (
            <div key={`${f.producto_id}-${f.deposito_id}`} className="crm-fila crm-fila-estatica">
              <div className="crm-fila-principal stock-prod">
                {p?.imagen ? <img src={p.imagen} alt="" className="stock-img" /> : <span className="stock-img" />}
                <div>
                  <strong>{p?.producto ?? f.descripcion}</strong>
                  <div className="crm-fila-datos">
                    {p && <span>{p.origen}</span>}
                    {p?.codigo_origen && <span>Cód. {p.codigo_origen}</span>}
                    {depositos.length > 1 && <span>{nombreDeposito(f.deposito_id)}</span>}
                  </div>
                </div>
              </div>
              <div className="crm-fila-datos">
                {p?.stock != null && <span title="Stock informado por el proveedor (no es de NBS)">Proveedor: {p.stock}</span>}
                <strong className={`stock-cant ${f.cantidad < 0 ? "negativo" : f.cantidad === 0 ? "cero" : ""}`}>
                  {f.cantidad.toLocaleString("es-AR")}
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
