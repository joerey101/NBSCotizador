// Línea de tiempo: actividades automáticas (⚙️ presupuesto guardado, etapa…) y manuales
// (llamada, reunión, email, WhatsApp, nota). Con fecha programada quedan pendientes.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  borrarActividad,
  completarActividad,
  crearActividad,
  fechaCorta,
  ICONO_ACTIVIDAD,
  listarActividades,
  TIPOS_ACTIVIDAD,
  type Actividad,
  type TipoActividad,
} from "../../lib/oportunidades";

interface Props {
  clienteId: string;
  oportunidadId?: string;
  /** cambia cuando hay que releer (p. ej. después de mover la etapa) */
  version?: number;
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function LineaDeTiempo({ clienteId, oportunidadId, version = 0 }: Props) {
  const [items, setItems] = useState<Actividad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoActividad>("llamada");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [programada, setProgramada] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    listarActividades(oportunidadId ? { oportunidadId } : { clienteId })
      .then((r) => (setItems(r), setError(null)))
      .catch((e: Error) => setError(e.message));
  }, [clienteId, oportunidadId]);

  useEffect(() => {
    cargar();
  }, [cargar, version]);

  const accion = async (fn: () => Promise<void>) => {
    try {
      await fn();
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const agregar = async (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    setGuardando(true);
    await accion(() =>
      crearActividad({
        cliente_id: clienteId,
        oportunidad_id: oportunidadId ?? null,
        tipo,
        titulo: titulo.trim(),
        descripcion,
        fecha_programada: programada ? new Date(programada + "T09:00:00").toISOString() : null,
      })
    );
    setTitulo("");
    setDescripcion("");
    setProgramada("");
    setGuardando(false);
  };

  const pendientes = items?.filter((a) => !a.completada) ?? [];
  const hechas = items?.filter((a) => a.completada) ?? [];

  return (
    <div className="ldt">
      <form className="ldt-form" onSubmit={agregar}>
        <div className="ldt-tipos">
          {TIPOS_ACTIVIDAD.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ldt-tipo ${tipo === t.id ? "activo" : ""}`}
              onClick={() => setTipo(t.id)}
            >
              {t.icono} {t.nombre}
            </button>
          ))}
        </div>
        <input
          className="ldt-input"
          placeholder="¿Qué pasó o qué hay que hacer? (ej.: Llamar para confirmar medidas)"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <textarea
          className="ldt-input"
          rows={2}
          placeholder="Detalle (opcional)"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
        <div className="ldt-form-pie">
          <label className="crm-check">
            Para el día
            <input type="date" value={programada} onChange={(e) => setProgramada(e.target.value)} />
          </label>
          <span className="crm-sec">{programada ? "Queda como pendiente" : "Se registra como hecha ahora"}</span>
          <button type="submit" className="crm-btn-primario" disabled={guardando || !titulo.trim()}>
            {guardando ? "Guardando…" : "Registrar"}
          </button>
        </div>
      </form>

      {error && <div className="auth-error">{error}</div>}
      {items === null && !error && <p className="crm-vacio">Cargando…</p>}
      {items?.length === 0 && <p className="crm-vacio">Todavía no hay actividades.</p>}

      {pendientes.length > 0 && (
        <div className="ldt-grupo">
          <div className="ldt-grupo-titulo">Pendientes</div>
          {pendientes.map((a) => (
            <div key={a.id} className="ldt-item pendiente">
              <span className="ldt-icono">{ICONO_ACTIVIDAD[a.tipo]}</span>
              <div className="ldt-cuerpo">
                <strong>{a.titulo}</strong>
                {a.descripcion && <p>{a.descripcion}</p>}
                <span className="ldt-fecha">Para el {fechaCorta(a.fecha_programada)}</span>
              </div>
              <div className="crm-acciones">
                <button type="button" className="auth-link" onClick={() => accion(() => completarActividad(a.id))}>
                  ✓ Hecha
                </button>
                <button
                  type="button"
                  className="auth-link crm-peligro"
                  onClick={() => confirm("¿Borrar esta actividad?") && accion(() => borrarActividad(a.id))}
                >
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {hechas.length > 0 && (
        <div className="ldt-grupo">
          {pendientes.length > 0 && <div className="ldt-grupo-titulo">Historial</div>}
          {hechas.map((a) => (
            <div key={a.id} className={`ldt-item ${a.tipo === "sistema" ? "sistema" : ""}`}>
              <span className="ldt-icono">{ICONO_ACTIVIDAD[a.tipo]}</span>
              <div className="ldt-cuerpo">
                <strong>{a.titulo}</strong>
                {a.descripcion && <p>{a.descripcion}</p>}
                <span className="ldt-fecha">
                  {fechaCorta(a.fecha_realizada ?? a.creado_en)} · {hora(a.fecha_realizada ?? a.creado_en)}
                </span>
              </div>
              {a.tipo !== "sistema" && (
                <button
                  type="button"
                  className="auth-link crm-peligro"
                  onClick={() => confirm("¿Borrar esta actividad?") && accion(() => borrarActividad(a.id))}
                >
                  Borrar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
