// Comisiones: a liquidar por mes de cobro, pendientes de cobro, gráfico de los últimos 12
// meses y cuenta corriente de cada vendedor (devengado − pagos − consumos ± ajustes).
// Un vendedor ve solo lo suyo (lo filtra la base); el admin ve y carga todo.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  anularMovimiento,
  comisionesDetalle,
  crearMovimiento,
  efectoEnSaldo,
  listarMovimientos,
  listarVendedores,
  nombreMes,
  nombreVendedor,
  TIPO_MOVIMIENTO,
  type ComisionFila,
  type MovimientoComision,
  type TipoMovimiento,
  type Vendedor,
} from "../../lib/equipo";
import { fechaCorta, formatoPesos } from "../../lib/oportunidades";
import { ir } from "../../lib/ruta";
import { useRol } from "../../lib/sesion";

const COLORES = ["#0b6b5e", "#2563eb", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d"];

function mesActual() {
  return new Date().toISOString().slice(0, 7);
}

function ultimosMeses(n: number): string[] {
  const r: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    r.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return r;
}

function MovimientoForm({ vendedorId, onListo }: { vendedorId: string; onListo: () => void }) {
  const [tipo, setTipo] = useState<TipoMovimiento>("pago");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [error, setError] = useState<string | null>(null);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(monto.replace(",", "."));
    if (!n) return setError("Cargá un monto.");
    try {
      await crearMovimiento({
        vendedor_id: vendedorId,
        tipo,
        monto: tipo === "ajuste" ? n : Math.abs(n),
        fecha,
        descripcion: descripcion.trim() || null,
        comprobante: comprobante.trim() || null,
      });
      onListo();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <form className="crm-form crm-subform" onSubmit={enviar}>
      <div className="crm-grid">
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento)}>
            {(Object.keys(TIPO_MOVIMIENTO) as TipoMovimiento[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_MOVIMIENTO[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Monto (ARS){tipo === "ajuste" ? " — negativo descuenta" : ""}
          <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </label>
        <label>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label>
          Comprobante
          <input value={comprobante} onChange={(e) => setComprobante(e.target.value)} />
        </label>
        <label className="crm-ancho">
          Descripción
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>
      </div>
      {error && <div className="auth-error">{error}</div>}
      <div className="crm-acciones">
        <button type="submit" className="crm-btn-primario">
          Registrar movimiento
        </button>
      </div>
    </form>
  );
}

export function Comisiones() {
  const esAdmin = useRol() === "admin";
  const [filas, setFilas] = useState<ComisionFila[] | null>(null);
  const [movs, setMovs] = useState<MovimientoComision[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [mes, setMes] = useState(mesActual());
  const [extracto, setExtracto] = useState<string | null>(null);
  const [cargandoMov, setCargandoMov] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [f, m, v] = await Promise.all([comisionesDetalle(), listarMovimientos(), listarVendedores(true)]);
      setFilas(f);
      setMovs(m);
      setVendedores(v);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cobradas = useMemo(() => (filas ?? []).filter((f) => f.cobrada && f.fecha_cobro), [filas]);
  const pendientes = useMemo(() => (filas ?? []).filter((f) => !f.cobrada), [filas]);
  const delMes = cobradas.filter((f) => f.fecha_cobro!.startsWith(mes));

  // vendedores que aparecen (el vendedor común solo se ve a sí mismo)
  const ids = useMemo(() => {
    const s = new Set<string>([...(filas ?? []).map((f) => f.vendedor_id), ...movs.map((m) => m.vendedor_id)]);
    if (esAdmin) vendedores.filter((v) => v.activo).forEach((v) => s.add(v.id));
    return [...s];
  }, [filas, movs, vendedores, esAdmin]);
  const nombre = (id: string) => {
    const v = vendedores.find((x) => x.id === id);
    return v ? nombreVendedor(v) : (filas ?? []).find((f) => f.vendedor_id === id)?.vendedor ?? "Vendedor";
  };
  const color = (id: string) => COLORES[Math.max(0, ids.indexOf(id)) % COLORES.length];

  const meses = ultimosMeses(12);
  const porMes = meses.map((m) => {
    const porVendedor: Record<string, number> = {};
    for (const f of cobradas) if (f.fecha_cobro!.startsWith(m)) porVendedor[f.vendedor_id] = (porVendedor[f.vendedor_id] ?? 0) + f.comision;
    return { mes: m, porVendedor, total: Object.values(porVendedor).reduce((a, b) => a + b, 0) };
  });
  const maximo = Math.max(1, ...porMes.map((x) => x.total));

  const saldoDe = (id: string) => {
    const devengado = cobradas.filter((f) => f.vendedor_id === id).reduce((s, f) => s + f.comision, 0);
    const mov = movs.filter((m) => m.vendedor_id === id).reduce((s, m) => s + efectoEnSaldo(m), 0);
    return { devengado, mov, saldo: devengado + mov };
  };

  if (error && !filas) return <div className="crm-panel"><div className="auth-error">{error}</div></div>;
  if (!filas) return <div className="crm-panel"><p className="crm-vacio">Cargando…</p></div>;

  return (
    <div className="crm-panel">
      <div className="crm-encabezado">
        <div>
          <h2>Comisiones</h2>
          <span className="crm-sec" style={{ marginLeft: 0 }}>
            Total neto de la venta en pesos × % del vendedor. Se liquida en el mes en que la venta se marca cobrada.
          </span>
        </div>
        <input type="month" className="crm-select" value={mes} onChange={(e) => setMes(e.target.value || mesActual())} />
      </div>
      {error && <div className="auth-error">{error}</div>}

      <div className="crm-seccion">
        <h3>A liquidar en {nombreMes(mes)}</h3>
        {delMes.length === 0 ? (
          <p className="crm-vacio">No hay ventas cobradas en ese mes.</p>
        ) : (
          <>
            <div className="com-resumen">
              {ids
                .map((id) => ({ id, total: delMes.filter((f) => f.vendedor_id === id).reduce((s, f) => s + f.comision, 0) }))
                .filter((x) => x.total > 0)
                .map((x) => (
                  <div key={x.id} className="com-tarjeta" style={{ borderTopColor: color(x.id) }}>
                    <span>{nombre(x.id)}</span>
                    <strong>{formatoPesos(x.total)}</strong>
                  </div>
                ))}
            </div>
            <TablaComisiones filas={delMes} />
          </>
        )}
      </div>

      <div className="crm-seccion">
        <h3>Pendientes de cobro</h3>
        {pendientes.length === 0 ? (
          <p className="crm-vacio">No hay ventas ganadas sin cobrar.</p>
        ) : (
          <TablaComisiones filas={pendientes} />
        )}
      </div>

      <div className="crm-seccion">
        <h3>Últimos 12 meses (comisiones devengadas)</h3>
        <div className="com-grafico">
          {porMes.map((x) => (
            <div key={x.mes} className="com-barra-col" title={`${nombreMes(x.mes)}: ${formatoPesos(x.total)}`}>
              <div className="com-barra" style={{ height: `${(x.total / maximo) * 100}%` }}>
                {Object.entries(x.porVendedor).map(([id, v]) => (
                  <div key={id} style={{ flex: v, background: color(id) }} />
                ))}
              </div>
              <span className="com-barra-mes">{nombreMes(x.mes).slice(0, 3)}</span>
            </div>
          ))}
        </div>
        <div className="com-leyenda">
          {ids.map((id) => (
            <span key={id}>
              <i style={{ background: color(id) }} /> {nombre(id)}
            </span>
          ))}
        </div>
      </div>

      <div className="crm-seccion">
        <h3>Cuenta corriente</h3>
        {ids.length === 0 && <p className="crm-vacio">Todavía no hay vendedores con comisiones.</p>}
        <div className="crm-tabla">
          {ids.map((id) => {
            const s = saldoDe(id);
            const abierto = extracto === id;
            const movsV = movs.filter((m) => m.vendedor_id === id);
            const lineas = [
              ...cobradas
                .filter((f) => f.vendedor_id === id)
                .map((f) => ({ fecha: f.fecha_cobro!, texto: `Comisión ${f.numero ?? ""} ${f.cliente}`.trim(), monto: f.comision, mov: null as MovimientoComision | null })),
              ...movsV.map((m) => ({
                fecha: m.fecha,
                texto: `${TIPO_MOVIMIENTO[m.tipo]}${m.descripcion ? ` — ${m.descripcion}` : ""}${m.comprobante ? ` (${m.comprobante})` : ""}`,
                monto: efectoEnSaldo({ ...m, anulado: false }),
                mov: m,
              })),
            ].sort((a, b) => a.fecha.localeCompare(b.fecha));
            let acumulado = 0;
            return (
              <div key={id} className="com-cc">
                <button type="button" className="crm-fila" onClick={() => setExtracto(abierto ? null : id)}>
                  <div className="crm-fila-principal">
                    <i className="com-punto" style={{ background: color(id) }} />
                    <strong>{nombre(id)}</strong>
                  </div>
                  <div className="crm-fila-datos">
                    <span>Devengado {formatoPesos(s.devengado)}</span>
                    <span>Pagos/consumos/ajustes {formatoPesos(s.mov)}</span>
                    <strong>Saldo {formatoPesos(s.saldo)}</strong>
                    <span>{abierto ? "▲" : "▼ Extracto"}</span>
                  </div>
                </button>
                {abierto && (
                  <div className="com-extracto">
                    {lineas.length === 0 && <p className="crm-vacio">Sin movimientos.</p>}
                    {lineas.map((l, i) => {
                      if (!l.mov?.anulado) acumulado += l.monto;
                      return (
                        <div key={i} className={`com-ext-fila ${l.mov?.anulado ? "anulado" : ""}`}>
                          <span>{fechaCorta(l.fecha)}</span>
                          <span className="com-ext-texto">
                            {l.texto}
                            {l.mov?.anulado && " (anulado)"}
                          </span>
                          <span className={l.monto < 0 ? "com-negativo" : ""}>{formatoPesos(l.monto)}</span>
                          <strong>{formatoPesos(acumulado)}</strong>
                          {esAdmin && l.mov && !l.mov.anulado ? (
                            <button
                              type="button"
                              className="auth-link crm-peligro"
                              onClick={() => confirm("¿Anular este movimiento? Queda registrado como anulado.") && anularMovimiento(l.mov!.id).then(cargar)}
                            >
                              Anular
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      );
                    })}
                    {esAdmin &&
                      (cargandoMov === id ? (
                        <MovimientoForm
                          vendedorId={id}
                          onListo={() => {
                            setCargandoMov(null);
                            cargar();
                          }}
                        />
                      ) : (
                        <button type="button" className="btn-salir" onClick={() => setCargandoMov(id)}>
                          + Pago, consumo o ajuste
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TablaComisiones({ filas }: { filas: ComisionFila[] }) {
  return (
    <div className="crm-tabla">
      {filas.map((f) => (
        <button key={`${f.oportunidad_id}-${f.vendedor_id}`} type="button" className="crm-fila" onClick={() => ir(`/oportunidades/${f.oportunidad_id}`)}>
          <div className="crm-fila-principal">
            {f.numero && <strong>{f.numero}</strong>}
            <span>{f.cliente}</span>
            <span className="crm-sec">{f.vendedor}</span>
          </div>
          <div className="crm-fila-datos">
            {f.fecha_cobro && <span>Cobrada {fechaCorta(f.fecha_cobro)}</span>}
            <span>Base {formatoPesos(f.base_ars)}</span>
            <span>{f.porcentaje}%</span>
            <strong>{formatoPesos(f.comision)}</strong>
          </div>
        </button>
      ))}
    </div>
  );
}
