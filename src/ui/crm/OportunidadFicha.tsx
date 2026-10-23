// Ficha de una oportunidad: etapa, monto (ARS), probabilidad, cierre, próxima acción,
// observaciones, motivo de pérdida y sus actividades. Enlaces al cliente y al presupuesto.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  actualizarOportunidad,
  ETAPAS,
  formatoPesos,
  obtenerOportunidad,
  type Etapa,
  type Oportunidad,
  type OportunidadEditable,
} from "../../lib/oportunidades";
import { ir } from "../../lib/ruta";
import { ComisionOportunidad } from "./ComisionOportunidad";
import { LineaDeTiempo } from "./LineaDeTiempo";
import { abrirEnCotizador } from "./PresupuestosLista";

function editableDe(o: Oportunidad): OportunidadEditable {
  return {
    nombre: o.nombre,
    etapa: o.etapa,
    monto_estimado: o.monto_estimado,
    probabilidad: o.probabilidad,
    fecha_estimada_cierre: o.fecha_estimada_cierre,
    proxima_accion: o.proxima_accion,
    fecha_proxima_accion: o.fecha_proxima_accion,
    observaciones: o.observaciones,
    motivo_perdida: o.motivo_perdida,
  };
}

export function OportunidadFicha({ id }: { id: string }) {
  const [op, setOp] = useState<Oportunidad | null>(null);
  const [form, setForm] = useState<OportunidadEditable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [version, setVersion] = useState(0);

  const cargar = useCallback(async () => {
    try {
      const o = await obtenerOportunidad(id);
      setOp(o);
      setForm(editableDe(o));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error && !op) return <div className="crm-panel"><div className="auth-error">{error}</div></div>;
  if (!op || !form) return <div className="crm-panel"><p className="crm-vacio">Cargando…</p></div>;

  const set = <K extends keyof OportunidadEditable>(k: K, v: OportunidadEditable[K]) => setForm({ ...form, [k]: v });
  const texto = (k: keyof OportunidadEditable) => ({
    value: (form[k] as string | null) ?? "",
    onChange: (e: { target: { value: string } }) => set(k, (e.target.value || null) as never),
  });

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const cambios: Partial<OportunidadEditable> = { ...form };
      // si se cambió la etapa y no la probabilidad, que la base ponga la de la etapa nueva
      if (form.etapa !== op.etapa && form.probabilidad === op.probabilidad) delete cambios.probabilidad;
      await actualizarOportunidad(op.id, cambios);
      await cargar();
      setVersion((v) => v + 1);
      setAviso("Cambios guardados.");
      setTimeout(() => setAviso(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="crm-panel">
      <button type="button" className="auth-link crm-volver" onClick={() => ir("/oportunidades")}>
        ← Oportunidades
      </button>
      <div className="crm-encabezado">
        <div>
          <h2>{op.nombre}</h2>
          <button type="button" className="auth-link" style={{ padding: 0 }} onClick={() => ir(`/clientes/${op.cliente_id}`)}>
            {op.clientes?.razon_social ?? "Cliente"} →
          </button>
        </div>
        {op.cotizacion_id && op.cotizaciones && (
          <button type="button" className="btn-salir" onClick={() => abrirEnCotizador(op.cotizacion_id!)}>
            Abrir {op.cotizaciones.numero} en el cotizador
          </button>
        )}
      </div>

      <form className="crm-form" onSubmit={guardar}>
        <div className="crm-grid">
          <label className="crm-ancho">
            Nombre
            <input required {...texto("nombre")} />
          </label>
          <label>
            Etapa
            <select value={form.etapa} onChange={(e) => set("etapa", e.target.value as Etapa)}>
              {ETAPAS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Monto estimado (ARS)
            <input
              type="number"
              min={0}
              step="any"
              value={form.monto_estimado ?? ""}
              onChange={(e) => set("monto_estimado", e.target.value === "" ? null : Number(e.target.value))}
            />
          </label>
          <label>
            Probabilidad (%)
            <input
              type="number"
              min={0}
              max={100}
              value={form.probabilidad ?? ""}
              onChange={(e) => set("probabilidad", e.target.value === "" ? null : Number(e.target.value))}
            />
          </label>
          <label>
            Cierre estimado
            <input type="date" {...texto("fecha_estimada_cierre")} />
          </label>
          <label className="crm-ancho">
            Próxima acción
            <input placeholder="ej.: Llamar para cerrar medidas" {...texto("proxima_accion")} />
          </label>
          <label>
            Fecha de la próxima acción
            <input type="date" {...texto("fecha_proxima_accion")} />
          </label>
          {form.etapa === "perdido" && (
            <label className="crm-ancho">
              Motivo de pérdida
              <input placeholder="precio, plazo, eligió otro proveedor…" {...texto("motivo_perdida")} />
            </label>
          )}
          <label className="crm-ancho">
            Observaciones
            <textarea rows={3} {...texto("observaciones")} />
          </label>
        </div>
        <div className="crm-acciones">
          {aviso && <span className="crm-sec">{aviso}</span>}
          <span className="crm-sec">Valor ponderado: {formatoPesos(((form.monto_estimado ?? 0) * (form.probabilidad ?? 0)) / 100)}</span>
          <button type="submit" className="crm-btn-primario" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>

      {error && <div className="auth-error">{error}</div>}

      <ComisionOportunidad
        op={op}
        onCambio={() => {
          cargar();
          setVersion((v) => v + 1);
        }}
      />

      <div className="crm-seccion">
        <h3>Actividades</h3>
        <LineaDeTiempo clienteId={op.cliente_id} oportunidadId={op.id} version={version} />
      </div>
    </div>
  );
}
