// Embudo de ventas en kanban: una columna por etapa, con cantidad y monto (ARS).
// Arrastrar una tarjeta a otra columna cambia la etapa (en el celular: desde la ficha).
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import {
  accionVencida,
  crearOportunidad,
  ETAPAS,
  fechaCorta,
  formatoPesos,
  listarOportunidades,
  moverEtapa,
  actualizarOportunidad,
  type Etapa,
  type Oportunidad,
} from "../../lib/oportunidades";
import { ir } from "../../lib/ruta";
import { ClienteSelector } from "./ClienteSelector";

export function Oportunidades() {
  const [ops, setOps] = useState<Oportunidad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Etapa | null>(null);
  const [eligiendoCliente, setEligiendoCliente] = useState(false);

  const cargar = useCallback(() => {
    listarOportunidades()
      .then((r) => (setOps(r), setError(null)))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtradas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    if (!ops || !t) return ops ?? [];
    return ops.filter(
      (o) =>
        o.nombre.toLowerCase().includes(t) ||
        (o.clientes?.razon_social ?? "").toLowerCase().includes(t) ||
        (o.cotizaciones?.numero ?? "").toLowerCase().includes(t)
    );
  }, [ops, texto]);

  const abiertas = filtradas.filter((o) => o.etapa !== "ganado" && o.etapa !== "perdido");
  const pipeline = abiertas.reduce((s, o) => s + (o.monto_estimado ?? 0), 0);
  const ponderado = abiertas.reduce((s, o) => s + ((o.monto_estimado ?? 0) * (o.probabilidad ?? 0)) / 100, 0);

  const soltar = async (e: DragEvent, etapa: Etapa) => {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData("text/plain") || arrastrando;
    setArrastrando(null);
    const op = ops?.find((o) => o.id === id);
    if (!op || op.etapa === etapa) return;
    let motivo: string | null = null;
    if (etapa === "perdido") {
      motivo = prompt("¿Por qué se perdió? (precio, plazo, eligió otro proveedor…)", op.motivo_perdida ?? "");
      if (motivo === null) return;
    }
    // optimista: se mueve ya y después se relee (la probabilidad la pone la base)
    setOps((xs) => xs?.map((o) => (o.id === op.id ? { ...o, etapa } : o)) ?? null);
    try {
      await moverEtapa(op.id, etapa);
      if (motivo !== null) await actualizarOportunidad(op.id, { motivo_perdida: motivo || null });
    } catch (err) {
      setError((err as Error).message);
    }
    cargar();
  };

  return (
    <div className="crm-panel">
      <div className="crm-encabezado">
        <div>
          <h2>Oportunidades</h2>
          <span className="crm-sec" style={{ marginLeft: 0 }}>
            Abiertas: {abiertas.length} · {formatoPesos(pipeline)} · ponderado {formatoPesos(ponderado)}
          </span>
        </div>
        <button type="button" className="crm-btn-primario" onClick={() => setEligiendoCliente(true)}>
          + Nueva oportunidad
        </button>
      </div>

      <input
        type="search"
        className="search-input"
        placeholder="Buscar por nombre, cliente o número de presupuesto…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />

      {error && <div className="auth-error">{error}</div>}
      {ops === null && !error && <p className="crm-vacio">Cargando…</p>}

      {ops && (
        <div className="kb">
          {ETAPAS.map((etapa) => {
            const col = filtradas.filter((o) => o.etapa === etapa.id);
            const suma = col.reduce((s, o) => s + (o.monto_estimado ?? 0), 0);
            return (
              <div
                key={etapa.id}
                className={`kb-col kb-${etapa.id} ${sobre === etapa.id ? "sobre" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSobre(etapa.id);
                }}
                onDragLeave={() => setSobre((s) => (s === etapa.id ? null : s))}
                onDrop={(e) => soltar(e, etapa.id)}
              >
                <div className="kb-col-cab">
                  <strong>{etapa.nombre}</strong>
                  <span className="kb-cuenta">{col.length}</span>
                  <span className="kb-suma">{formatoPesos(suma)}</span>
                </div>
                <div className="kb-tarjetas">
                  {col.map((o) => (
                    <div
                      key={o.id}
                      className={`kb-tarjeta ${arrastrando === o.id ? "arrastrando" : ""}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", o.id);
                        setArrastrando(o.id);
                      }}
                      onDragEnd={() => setArrastrando(null)}
                      onClick={() => ir(`/oportunidades/${o.id}`)}
                    >
                      <span className="kb-cliente">{o.clientes?.razon_social}</span>
                      <strong className="kb-nombre">{o.nombre}</strong>
                      <div className="kb-datos">
                        <span>{formatoPesos(o.monto_estimado)}</span>
                        <span>{o.probabilidad ?? 0}%</span>
                      </div>
                      {o.proxima_accion && (
                        <span className={`kb-accion ${accionVencida(o) ? "vencida" : ""}`}>
                          → {o.proxima_accion}
                          {o.fecha_proxima_accion && ` (${fechaCorta(o.fecha_proxima_accion)})`}
                        </span>
                      )}
                    </div>
                  ))}
                  {col.length === 0 && <div className="kb-vacia">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {eligiendoCliente && (
        <ClienteSelector
          onCerrar={() => setEligiendoCliente(false)}
          onElegir={async (c) => {
            setEligiendoCliente(false);
            const nombre = prompt("Nombre de la oportunidad:", `Oportunidad ${c.razon_social}`);
            if (!nombre) return;
            try {
              const o = await crearOportunidad(c.id, nombre, null);
              ir(`/oportunidades/${o.id}`);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}
