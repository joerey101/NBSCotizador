// Dashboards. Comercial (admin y vendedor): presupuestos del mes, embudo, cobrado,
// comisiones a liquidar, próximas acciones y mejores clientes. Inventario (depósito):
// pedidos a preparar, movimientos y stock, SIN un solo monto. Todo sale de las tablas
// que cada rol ya puede leer (RLS); no hay datos nuevos en la base.
import { useEffect, useState } from "react";
import { comisionesDetalle, type ComisionFila } from "../../lib/equipo";
import { accionVencida, ETAPAS, fechaCorta, formatoPesos, NOMBRE_ETAPA, type Etapa } from "../../lib/oportunidades";
import { ir } from "../../lib/ruta";
import { useRol } from "../../lib/sesion";
import {
  listarPedidos,
  listarStock,
  NOMBRE_ESTADO_PEDIDO,
  NOMBRE_TIPO,
  productoPorId,
  SIGNO,
  ultimosMovimientos,
  type MovimientoStock,
  type Pedido,
  type StockFila,
} from "../../lib/stock";
import { supabase } from "../../lib/supabase";

const hoy = () => new Date().toISOString().slice(0, 10);
const mesDe = (fecha: string) => fecha.slice(0, 7);
function mesesAtras(n: number): string[] {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
}
const etiquetaMes = (ym: string) =>
  new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1, 1).toLocaleDateString("es-AR", { month: "short" });

function Kpi({ titulo, valor, detalle, onClick }: { titulo: string; valor: string; detalle?: string; onClick?: () => void }) {
  return (
    <button type="button" className={`kpi ${onClick ? "" : "kpi-fijo"}`} onClick={onClick} disabled={!onClick}>
      <span className="kpi-titulo">{titulo}</span>
      <strong className="kpi-valor">{valor}</strong>
      {detalle && <span className="kpi-detalle">{detalle}</span>}
    </button>
  );
}

// ---------------------------------------------------------------- comercial

interface CotFila {
  id: string;
  numero: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  estado: string;
  total_ars: number | null;
  fecha: string;
}
interface OpFila {
  id: string;
  nombre: string;
  etapa: Etapa;
  monto_estimado: number | null;
  probabilidad: number | null;
  proxima_accion: string | null;
  fecha_proxima_accion: string | null;
  cobrada: boolean;
  fecha_cobro: string | null;
  clientes: { razon_social: string } | null;
}
interface ActFila {
  id: string;
  titulo: string;
  tipo: string;
  fecha_programada: string;
  cliente_id: string;
  clientes: { razon_social: string } | null;
}

function DashboardComercial() {
  const [cots, setCots] = useState<CotFila[] | null>(null);
  const [ops, setOps] = useState<OpFila[]>([]);
  const [acts, setActs] = useState<ActFila[]>([]);
  const [comisiones, setComisiones] = useState<ComisionFila[]>([]);
  const [pedidosAbiertos, setPedidosAbiertos] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const desde = mesesAtras(6)[0] + "-01";
    const en7dias = new Date(Date.now() + 7 * 86400000).toISOString();
    Promise.all([
      supabase.from("cotizaciones").select("id, numero, cliente_id, cliente_nombre, estado, total_ars, fecha").gte("fecha", desde),
      supabase
        .from("oportunidades")
        .select("id, nombre, etapa, monto_estimado, probabilidad, proxima_accion, fecha_proxima_accion, cobrada, fecha_cobro, clientes(razon_social)"),
      supabase
        .from("actividades")
        .select("id, titulo, tipo, fecha_programada, cliente_id, clientes(razon_social)")
        .eq("completada", false)
        .not("fecha_programada", "is", null)
        .lte("fecha_programada", en7dias)
        .order("fecha_programada")
        .limit(15),
      comisionesDetalle().catch(() => [] as ComisionFila[]),
      listarPedidos().catch(() => [] as Pedido[]),
    ])
      .then(([c, o, a, com, ped]) => {
        if (c.error) throw c.error;
        if (o.error) throw o.error;
        setCots(((c.data ?? []) as CotFila[]).map((x) => ({ ...x, total_ars: x.total_ars == null ? null : Number(x.total_ars) })));
        setOps((o.data ?? []) as unknown as OpFila[]);
        setActs((a.data ?? []) as unknown as ActFila[]);
        setComisiones(com);
        setPedidosAbiertos(ped.filter((p) => p.estado !== "entregado" && p.estado !== "cancelado").length);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="crm-panel"><div className="auth-error">{error}</div></div>;
  if (!cots) return <div className="crm-panel"><p className="crm-vacio">Cargando…</p></div>;

  const mes = mesDe(hoy());
  const delMes = cots.filter((c) => mesDe(c.fecha) === mes);
  const suma = (xs: CotFila[]) => xs.reduce((s, c) => s + (c.total_ars ?? 0), 0);
  const aprobadosMes = delMes.filter((c) => c.estado === "aprobada");
  const enviadosOAprob = cots.filter((c) => c.estado !== "borrador");
  const tasa = enviadosOAprob.length ? Math.round((cots.filter((c) => c.estado === "aprobada").length / enviadosOAprob.length) * 100) : 0;

  const abiertas = ops.filter((o) => o.etapa !== "ganado" && o.etapa !== "perdido");
  const pipeline = abiertas.reduce((s, o) => s + (o.monto_estimado ?? 0), 0);
  const ponderado = abiertas.reduce((s, o) => s + ((o.monto_estimado ?? 0) * (o.probabilidad ?? 0)) / 100, 0);
  const cobradoMes = ops.filter((o) => o.cobrada && o.fecha_cobro && mesDe(o.fecha_cobro) === mes);
  const comisionMes = comisiones.filter((c) => c.cobrada && c.fecha_cobro && mesDe(c.fecha_cobro) === mes).reduce((s, c) => s + c.comision, 0);

  const acciones = abiertas
    .filter((o) => o.fecha_proxima_accion && o.fecha_proxima_accion <= hoy())
    .sort((a, b) => (a.fecha_proxima_accion ?? "").localeCompare(b.fecha_proxima_accion ?? ""));

  const porEtapa = ETAPAS.map((e) => ({ ...e, n: ops.filter((o) => o.etapa === e.id).length, monto: ops.filter((o) => o.etapa === e.id).reduce((s, o) => s + (o.monto_estimado ?? 0), 0) }));
  const maxEtapa = Math.max(1, ...porEtapa.map((e) => e.n));

  const meses = mesesAtras(6);
  const serie = meses.map((m) => {
    const xs = cots.filter((c) => mesDe(c.fecha) === m);
    return { mes: m, presupuestado: suma(xs), aprobado: suma(xs.filter((c) => c.estado === "aprobada")) };
  });
  const maxSerie = Math.max(1, ...serie.map((s) => s.presupuestado));

  const topClientes = Object.values(
    cots.reduce<Record<string, { id: string | null; nombre: string; monto: number; n: number }>>((acc, c) => {
      const k = c.cliente_id ?? c.cliente_nombre ?? "—";
      acc[k] ??= { id: c.cliente_id, nombre: c.cliente_nombre ?? "—", monto: 0, n: 0 };
      acc[k].monto += c.total_ars ?? 0;
      acc[k].n++;
      return acc;
    }, {})
  )
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);

  return (
    <div className="dash">
      <div className="kpis">
        <Kpi
          titulo="Presupuestado este mes"
          valor={formatoPesos(suma(delMes))}
          detalle={`${delMes.length} presupuestos`}
          onClick={() => ir("/presupuestos")}
        />
        <Kpi
          titulo="Aprobado este mes"
          valor={formatoPesos(suma(aprobadosMes))}
          detalle={`${aprobadosMes.length} aprobados · ${tasa}% de aprobación (6 meses)`}
          onClick={() => ir("/presupuestos")}
        />
        <Kpi
          titulo="Embudo abierto"
          valor={formatoPesos(pipeline)}
          detalle={`${abiertas.length} oportunidades · ponderado ${formatoPesos(ponderado)}`}
          onClick={() => ir("/oportunidades")}
        />
        <Kpi
          titulo="Cobrado este mes"
          valor={formatoPesos(cobradoMes.reduce((s, o) => s + (o.monto_estimado ?? 0), 0))}
          detalle={`${cobradoMes.length} ventas`}
          onClick={() => ir("/comisiones")}
        />
        <Kpi titulo="Comisiones a liquidar (mes)" valor={formatoPesos(comisionMes)} onClick={() => ir("/comisiones")} />
        <Kpi titulo="Pedidos abiertos" valor={String(pedidosAbiertos)} detalle="sin entregar" onClick={() => ir("/pedidos")} />
      </div>

      <div className="dash-grid">
        <div className="crm-panel">
          <h3 className="dash-h3">Presupuestado vs. aprobado (6 meses)</h3>
          <div className="dash-barras">
            {serie.map((s) => (
              <div key={s.mes} className="dash-barra-col" title={`${etiquetaMes(s.mes)}: ${formatoPesos(s.presupuestado)} / aprobado ${formatoPesos(s.aprobado)}`}>
                <div className="dash-barra-par">
                  <div className="dash-barra pres" style={{ height: `${(s.presupuestado / maxSerie) * 100}%` }} />
                  <div className="dash-barra aprob" style={{ height: `${(s.aprobado / maxSerie) * 100}%` }} />
                </div>
                <span>{etiquetaMes(s.mes)}</span>
              </div>
            ))}
          </div>
          <div className="com-leyenda">
            <span><i style={{ background: "#94a3b8" }} /> Presupuestado</span>
            <span><i style={{ background: "var(--accent)" }} /> Aprobado</span>
          </div>
        </div>

        <div className="crm-panel">
          <h3 className="dash-h3">Embudo por etapa</h3>
          <div className="dash-embudo">
            {porEtapa.map((e) => (
              <button key={e.id} type="button" className="dash-embudo-fila" onClick={() => ir("/oportunidades")}>
                <span>{e.nombre}</span>
                <div className="dash-embudo-barra">
                  <div className={`kb-${e.id}`} style={{ width: `${(e.n / maxEtapa) * 100}%`, background: "var(--etapa)" }} />
                </div>
                <strong>{e.n}</strong>
                <span className="crm-sec">{formatoPesos(e.monto)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="crm-panel">
          <h3 className="dash-h3">Próximas acciones (vencidas y de hoy)</h3>
          {acciones.length === 0 && <p className="crm-vacio">Nada vencido. 👌</p>}
          <div className="crm-tabla">
            {acciones.slice(0, 8).map((o) => (
              <button key={o.id} type="button" className="crm-fila" onClick={() => ir(`/oportunidades/${o.id}`)}>
                <div className="crm-fila-principal">
                  <span className={`kb-accion ${accionVencida(o) ? "vencida" : ""}`}>{fechaCorta(o.fecha_proxima_accion)}</span>
                  <strong>{o.proxima_accion}</strong>
                </div>
                <div className="crm-fila-datos">
                  <span>{o.clientes?.razon_social}</span>
                  <span className={`chip-etapa etapa-${o.etapa}`}>{NOMBRE_ETAPA[o.etapa]}</span>
                </div>
              </button>
            ))}
          </div>
          {acts.length > 0 && (
            <>
              <h3 className="dash-h3" style={{ marginTop: 6 }}>Actividades pendientes (próximos 7 días)</h3>
              <div className="crm-tabla">
                {acts.map((a) => (
                  <button key={a.id} type="button" className="crm-fila" onClick={() => ir(`/clientes/${a.cliente_id}`)}>
                    <div className="crm-fila-principal">
                      <span className={`kb-accion ${a.fecha_programada.slice(0, 10) < hoy() ? "vencida" : ""}`}>{fechaCorta(a.fecha_programada)}</span>
                      <strong>{a.titulo}</strong>
                    </div>
                    <div className="crm-fila-datos">
                      <span>{a.clientes?.razon_social}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="crm-panel">
          <h3 className="dash-h3">Mejores clientes (presupuestado, 6 meses)</h3>
          {topClientes.length === 0 && <p className="crm-vacio">Todavía no hay presupuestos.</p>}
          <div className="crm-tabla">
            {topClientes.map((c, i) => (
              <button key={i} type="button" className="crm-fila" onClick={() => c.id && ir(`/clientes/${c.id}`)}>
                <div className="crm-fila-principal">
                  <strong>{i + 1}.</strong>
                  <span>{c.nombre}</span>
                </div>
                <div className="crm-fila-datos">
                  <span>{c.n} presupuestos</span>
                  <strong>{formatoPesos(c.monto)}</strong>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- inventario (sin montos)

function DashboardInventario() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [movs, setMovs] = useState<MovimientoStock[]>([]);
  const [stock, setStock] = useState<StockFila[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarPedidos(), ultimosMovimientos(100), listarStock()])
      .then(([p, m, s]) => (setPedidos(p), setMovs(m), setStock(s)))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className="crm-panel"><div className="auth-error">{error}</div></div>;
  if (!pedidos) return <div className="crm-panel"><p className="crm-vacio">Cargando…</p></div>;

  const cuenta = (e: Pedido["estado"]) => pedidos.filter((p) => p.estado === e).length;
  const aPreparar = pedidos
    .filter((p) => ["pendiente", "confirmado", "en_preparacion"].includes(p.estado))
    .sort((a, b) => (a.fecha_entrega ?? "9999").localeCompare(b.fecha_entrega ?? "9999"));
  const movsHoy = movs.filter((m) => m.creado_en.slice(0, 10) === hoy() && !m.anulado);
  const entraHoy = movsHoy.filter((m) => SIGNO[m.tipo] > 0).reduce((s, m) => s + m.cantidad, 0);
  const saleHoy = movsHoy.filter((m) => SIGNO[m.tipo] < 0).reduce((s, m) => s + m.cantidad, 0);
  const negativos = stock.filter((s) => s.cantidad < 0);
  const conStock = stock.filter((s) => s.cantidad > 0);

  return (
    <div className="dash">
      <div className="kpis">
        <Kpi titulo="Pedidos pendientes" valor={String(cuenta("pendiente") + cuenta("confirmado"))} detalle="por preparar" onClick={() => ir("/pedidos")} />
        <Kpi titulo="En preparación" valor={String(cuenta("en_preparacion"))} onClick={() => ir("/pedidos")} />
        <Kpi titulo="Despachados sin entregar" valor={String(cuenta("despachado"))} onClick={() => ir("/pedidos")} />
        <Kpi titulo="Movimientos de hoy" valor={String(movsHoy.length)} detalle={`+${entraHoy} entran · −${saleHoy} salen (unidades)`} onClick={() => ir("/movimientos")} />
        <Kpi titulo="Productos con stock" valor={String(conStock.length)} detalle={`${conStock.reduce((s, x) => s + x.cantidad, 0)} unidades`} onClick={() => ir("/stock")} />
        <Kpi titulo="Stock negativo" valor={String(negativos.length)} detalle={negativos.length ? "revisar" : "todo bien"} onClick={() => ir("/stock")} />
      </div>

      <div className="dash-grid">
        <div className="crm-panel">
          <h3 className="dash-h3">Pedidos a preparar</h3>
          {aPreparar.length === 0 && <p className="crm-vacio">No hay pedidos para preparar.</p>}
          <div className="crm-tabla">
            {aPreparar.slice(0, 10).map((p) => (
              <button key={p.id} type="button" className="crm-fila" onClick={() => ir(`/pedidos/${p.id}`)}>
                <div className="crm-fila-principal">
                  <strong>{p.numero}</strong>
                  <span className={`chip-estado ped-${p.estado}`}>{NOMBRE_ESTADO_PEDIDO[p.estado]}</span>
                  <span>{p.cliente_nombre}</span>
                </div>
                <div className="crm-fila-datos">{p.fecha_entrega && <span>Entrega {fechaCorta(p.fecha_entrega)}</span>}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="crm-panel">
          <h3 className="dash-h3">Últimos movimientos</h3>
          {movs.length === 0 && <p className="crm-vacio">Todavía no hay movimientos.</p>}
          <div className="crm-tabla">
            {movs.slice(0, 10).map((m) => (
              <div key={m.id} className={`crm-fila crm-fila-estatica ${m.anulado ? "mov-anulado" : ""}`}>
                <div className="crm-fila-principal">
                  <span className={`chip-mov ${SIGNO[m.tipo] > 0 ? "suma" : "resta"}`}>
                    {SIGNO[m.tipo] > 0 ? "+" : "−"}
                    {m.cantidad}
                  </span>
                  <span>{productoPorId(m.producto_id)?.producto ?? m.descripcion}</span>
                </div>
                <div className="crm-fila-datos">
                  <span>{NOMBRE_TIPO[m.tipo]}</span>
                  <span>{new Date(m.creado_en).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {negativos.length > 0 && (
          <div className="crm-panel">
            <h3 className="dash-h3">Stock negativo (revisar)</h3>
            <div className="crm-tabla">
              {negativos.map((s) => (
                <div key={`${s.producto_id}-${s.deposito_id}`} className="crm-fila crm-fila-estatica">
                  <span>{productoPorId(s.producto_id)?.producto ?? s.descripcion}</span>
                  <strong className="stock-cant negativo">{s.cantidad}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  return useRol() === "deposito" ? <DashboardInventario /> : <DashboardComercial />;
}
