// Sección "Venta y comisión" de la ficha de oportunidad: vendedor, cobrada + fecha de cobro
// (solo admin, y solo si está ganada) y reparto de la comisión entre vendedores (solo admin).
import { useEffect, useState } from "react";
import {
  asignarVendedor,
  guardarReparto,
  listarReparto,
  marcarCobrada,
  nombreVendedor,
  type RepartoFila,
} from "../../lib/equipo";
import { formatoPesos, type Oportunidad } from "../../lib/oportunidades";
import { useRol } from "../../lib/sesion";
import { useVendedores, VendedorSelect } from "./VendedorSelect";

interface Props {
  op: Oportunidad & { vendedor_id?: string | null };
  onCambio: () => void;
}

export function ComisionOportunidad({ op, onCambio }: Props) {
  const esAdmin = useRol() === "admin";
  const vendedores = useVendedores();
  const [reparto, setReparto] = useState<RepartoFila[]>([]);
  const [fechaCobro, setFechaCobro] = useState(op.fecha_cobro ?? new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    listarReparto(op.id).then(setReparto).catch(() => setReparto([]));
    setFechaCobro(op.fecha_cobro ?? new Date().toISOString().slice(0, 10));
  }, [op.id, op.fecha_cobro]);

  const accion = async (fn: () => Promise<void>, ok?: string) => {
    setError(null);
    try {
      await fn();
      if (ok) {
        setAviso(ok);
        setTimeout(() => setAviso(null), 3000);
      }
      onCambio();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const vendedor = vendedores.find((v) => v.id === op.vendedor_id);
  const efectivo: RepartoFila[] = reparto.length
    ? reparto
    : vendedor
      ? [{ vendedor_id: vendedor.id, porcentaje: vendedor.comision_pct }]
      : [];
  const base = op.monto_estimado ?? 0;
  const ganada = op.etapa === "ganado";

  return (
    <div className="crm-seccion">
      <h3>Venta y comisión</h3>
      <div className="crm-grid">
        <label>
          Vendedor
          <VendedorSelect
            value={op.vendedor_id ?? null}
            onChange={(id) => accion(() => asignarVendedor("oportunidades", op.id, id), "Vendedor actualizado.")}
          />
        </label>
        <div className="crm-dato">
          <span>Comisión (base {formatoPesos(base)} en pesos)</span>
          {efectivo.length === 0 ? (
            <strong>Sin vendedor asignado</strong>
          ) : (
            efectivo.map((r) => {
              const v = vendedores.find((x) => x.id === r.vendedor_id);
              return (
                <strong key={r.vendedor_id}>
                  {v ? nombreVendedor(v) : "Vendedor"}: {r.porcentaje}% = {formatoPesos((base * r.porcentaje) / 100)}
                </strong>
              );
            })
          )}
        </div>
      </div>

      <div className="com-cobro">
        <label className="crm-check">
          <input
            type="checkbox"
            checked={op.cobrada}
            disabled={!esAdmin || !ganada}
            onChange={(e) =>
              accion(
                () => marcarCobrada(op.id, e.target.checked, fechaCobro),
                e.target.checked ? "Venta marcada como cobrada: la comisión pasa a liquidar." : "Se quitó la marca de cobrada."
              )
            }
          />
          Cobrada
        </label>
        <input
          type="date"
          value={fechaCobro}
          disabled={!esAdmin || !ganada}
          onChange={(e) => {
            setFechaCobro(e.target.value);
            if (op.cobrada) accion(() => marcarCobrada(op.id, true, e.target.value), "Fecha de cobro actualizada.");
          }}
        />
        <span className="crm-sec">
          {!ganada
            ? "Se puede marcar cuando la oportunidad esté Ganada."
            : !esAdmin
              ? "Solo un administrador marca las ventas cobradas."
              : "El mes de cobro es el mes en que se liquida la comisión."}
        </span>
      </div>

      {esAdmin && (
        <div className="com-reparto">
          <span className="crm-sec" style={{ marginLeft: 0 }}>
            Reparto entre vendedores (opcional; vacío = todo al vendedor con su %):
          </span>
          {reparto.map((r, i) => (
            <div key={i} className="com-reparto-fila">
              <VendedorSelect
                value={r.vendedor_id}
                onChange={(id) => setReparto(reparto.map((x, j) => (j === i ? { ...x, vendedor_id: id ?? "" } : x)))}
              />
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={r.porcentaje}
                onChange={(e) => setReparto(reparto.map((x, j) => (j === i ? { ...x, porcentaje: Number(e.target.value) } : x)))}
              />
              <span>%</span>
              <button type="button" className="auth-link crm-peligro" onClick={() => setReparto(reparto.filter((_, j) => j !== i))}>
                Quitar
              </button>
            </div>
          ))}
          <div className="crm-acciones" style={{ justifyContent: "flex-start" }}>
            <button
              type="button"
              className="btn-salir"
              onClick={() => setReparto([...reparto, { vendedor_id: "", porcentaje: 0 }])}
            >
              + Agregar vendedor al reparto
            </button>
            <button
              type="button"
              className="crm-btn-primario"
              onClick={() => accion(() => guardarReparto(op.id, reparto), "Reparto guardado.")}
            >
              Guardar reparto
            </button>
          </div>
        </div>
      )}

      {aviso && <span className="crm-sec">{aviso}</span>}
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}
