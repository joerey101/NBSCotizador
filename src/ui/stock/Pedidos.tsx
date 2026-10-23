// Pedidos para preparar (creados desde un presupuesto aprobado). El depósito los ve sin
// precios: los ítems llegan de items_de_pedido(). Al despachar, la base descuenta el stock.
import { useCallback, useEffect, useState } from "react";
import { ir } from "../../lib/ruta";
import {
  actualizarPedido,
  cambiarEstadoPedido,
  ESTADOS_PEDIDO,
  listarPedidos,
  listarStock,
  marcarPicking,
  NOMBRE_ESTADO_PEDIDO,
  obtenerPedido,
  productoPorId,
  type EstadoPedido,
  type ItemPedido,
  type Pedido,
} from "../../lib/stock";
import { fechaCorta } from "../../lib/oportunidades";

// próximo paso de cada estado
const SIGUIENTE: Partial<Record<EstadoPedido, { estado: EstadoPedido; texto: string; confirmar?: string }>> = {
  pendiente: { estado: "confirmado", texto: "Confirmar pedido" },
  confirmado: { estado: "en_preparacion", texto: "Empezar a preparar" },
  en_preparacion: {
    estado: "despachado",
    texto: "Despachar (descuenta stock)",
    confirmar: "¿Despachar? Se descuenta del stock lo preparado (o lo pedido si no se cargó la preparación).",
  },
  despachado: { estado: "entregado", texto: "Marcar entregado" },
};

export function PedidosLista() {
  const [estado, setEstado] = useState<EstadoPedido | "">("");
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPedidos(null);
    listarPedidos(estado)
      .then((r) => (setPedidos(r), setError(null)))
      .catch((e: Error) => setError(e.message));
  }, [estado]);

  return (
    <div className="crm-panel">
      <div className="crm-encabezado">
        <div>
          <h2>Pedidos</h2>
          <span className="crm-sec" style={{ marginLeft: 0 }}>
            Se crean desde un presupuesto Aprobado (en el cotizador: “Crear pedido”).
          </span>
        </div>
        <select className="crm-select" value={estado} onChange={(e) => setEstado(e.target.value as EstadoPedido | "")}>
          <option value="">Todos los estados</option>
          {ESTADOS_PEDIDO.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="auth-error">{error}</div>}
      {pedidos === null && !error && <p className="crm-vacio">Cargando…</p>}
      {pedidos?.length === 0 && <p className="crm-vacio">No hay pedidos.</p>}
      {pedidos && pedidos.length > 0 && (
        <div className="crm-tabla">
          {pedidos.map((p) => (
            <button key={p.id} type="button" className="crm-fila" onClick={() => ir(`/pedidos/${p.id}`)}>
              <div className="crm-fila-principal">
                <strong>{p.numero}</strong>
                <span className={`chip-estado ped-${p.estado}`}>{NOMBRE_ESTADO_PEDIDO[p.estado]}</span>
                <span>{p.cliente_nombre}</span>
              </div>
              <div className="crm-fila-datos">
                {p.cotizacion_numero && <span>{p.cotizacion_numero}</span>}
                <span>Pedido {fechaCorta(p.fecha_pedido)}</span>
                {p.fecha_entrega && <span>Entrega {fechaCorta(p.fecha_entrega)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PedidoFicha({ id }: { id: string }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [items, setItems] = useState<ItemPedido[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [{ pedido, items }, st] = await Promise.all([obtenerPedido(id), listarStock()]);
      setPedido(pedido);
      setItems(items);
      const m: Record<string, number> = {};
      for (const s of st) if (!pedido.deposito_id || s.deposito_id === pedido.deposito_id) m[s.producto_id] = (m[s.producto_id] ?? 0) + s.cantidad;
      setStock(m);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error && !pedido) return <div className="crm-panel"><div className="auth-error">{error}</div></div>;
  if (!pedido) return <div className="crm-panel"><p className="crm-vacio">Cargando…</p></div>;

  const editablePicking = pedido.estado === "confirmado" || pedido.estado === "en_preparacion" || pedido.estado === "pendiente";
  const paso = SIGUIENTE[pedido.estado];
  const preparado = items.filter((i) => i.cantidad_picking >= i.cantidad).length;

  const cambiar = async (estado: EstadoPedido, confirmar?: string) => {
    if (confirmar && !confirm(confirmar)) return;
    setTrabajando(true);
    try {
      await cambiarEstadoPedido(pedido.id, estado);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTrabajando(false);
    }
  };

  const picking = async (it: ItemPedido, cantidad: number) => {
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, cantidad_picking: cantidad } : x)));
    try {
      await marcarPicking(it.id, cantidad);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="crm-panel">
      <button type="button" className="auth-link crm-volver" onClick={() => ir("/pedidos")}>
        ← Pedidos
      </button>
      <div className="crm-encabezado">
        <div>
          <h2>
            {pedido.numero} <span className={`chip-estado ped-${pedido.estado}`}>{NOMBRE_ESTADO_PEDIDO[pedido.estado]}</span>
          </h2>
          <span className="crm-sec" style={{ marginLeft: 0 }}>
            {pedido.cliente_nombre}
            {pedido.cotizacion_numero && ` · ${pedido.cotizacion_numero}`} · {preparado}/{items.length} renglones preparados
          </span>
        </div>
        <div className="crm-acciones">
          {pedido.estado !== "cancelado" && pedido.estado !== "entregado" && (
            <button
              type="button"
              className="btn-salir crm-peligro"
              disabled={trabajando}
              onClick={() =>
                cambiar(
                  "cancelado",
                  pedido.estado === "despachado"
                    ? "¿Cancelar un pedido despachado? Se devuelve la mercadería al stock."
                    : "¿Cancelar el pedido?"
                )
              }
            >
              Cancelar pedido
            </button>
          )}
          {paso && (
            <button type="button" className="crm-btn-primario" disabled={trabajando} onClick={() => cambiar(paso.estado, paso.confirmar)}>
              {paso.texto}
            </button>
          )}
        </div>
      </div>

      <div className="crm-grid">
        <label>
          Fecha de entrega
          <input
            type="date"
            value={pedido.fecha_entrega ?? ""}
            onChange={async (e) => {
              const v = e.target.value || null;
              setPedido({ ...pedido, fecha_entrega: v });
              await actualizarPedido(pedido.id, { fecha_entrega: v }).catch((err: Error) => setError(err.message));
            }}
          />
        </label>
        <label className="crm-ancho">
          Notas
          <textarea
            rows={2}
            defaultValue={pedido.notas ?? ""}
            onBlur={(e) => actualizarPedido(pedido.id, { notas: e.target.value || null }).catch((err: Error) => setError(err.message))}
          />
        </label>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="crm-tabla">
        {items.map((it) => {
          const p = productoPorId(it.producto_id);
          const st = it.producto_id ? stock[it.producto_id] : undefined;
          const listo = it.cantidad_picking >= it.cantidad;
          return (
            <div key={it.id} className={`crm-fila crm-fila-estatica ${listo ? "ped-listo" : ""}`}>
              <div className="crm-fila-principal stock-prod">
                {p?.imagen ? <img src={p.imagen} alt="" className="stock-img" /> : <span className="stock-img" />}
                <div>
                  <strong>{it.descripcion}</strong>
                  <div className="crm-fila-datos">
                    {it.codigo_origen && <span>Cód. {it.codigo_origen}</span>}
                    {p && <span>{p.origen}</span>}
                    <span className={st != null && st < it.cantidad ? "com-negativo" : ""}>Stock: {st ?? 0}</span>
                  </div>
                </div>
              </div>
              <div className="crm-fila-datos ped-cantidades">
                <span>Pedido: <strong>{it.cantidad}</strong></span>
                {editablePicking ? (
                  <label className="crm-check">
                    Preparado
                    <input
                      type="number"
                      min={0}
                      className="ped-picking"
                      value={it.cantidad_picking}
                      onChange={(e) => picking(it, Math.max(0, Number(e.target.value) || 0))}
                    />
                    <button type="button" className="auth-link" onClick={() => picking(it, it.cantidad)}>
                      Todo
                    </button>
                  </label>
                ) : (
                  <span>Preparado: <strong>{it.cantidad_picking}</strong></span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
