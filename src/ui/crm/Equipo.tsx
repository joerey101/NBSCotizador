// Equipo de ventas: vendedores con su % de comisión, clientes asignados y ventas ganadas.
// Alta y edición solo para el administrador (la base lo exige igual).
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  guardarVendedor,
  listarVendedores,
  nombreVendedor,
  VENDEDOR_VACIO,
  type Vendedor,
  type VendedorEditable,
} from "../../lib/equipo";
import { formatoPesos } from "../../lib/oportunidades";
import { useRol } from "../../lib/sesion";
import { supabase } from "../../lib/supabase";
import { olvidarVendedores } from "./VendedorSelect";

interface Stats {
  clientes: number;
  ganadas: number;
  montoGanado: number;
}

async function estadisticas(): Promise<Record<string, Stats>> {
  if (!supabase) return {};
  const [{ data: cl }, { data: ops }] = await Promise.all([
    supabase.from("clientes").select("vendedor_id").not("vendedor_id", "is", null),
    supabase.from("oportunidades").select("vendedor_id, monto_estimado").eq("etapa", "ganado").not("vendedor_id", "is", null),
  ]);
  const r: Record<string, Stats> = {};
  const de = (id: string) => (r[id] ??= { clientes: 0, ganadas: 0, montoGanado: 0 });
  for (const c of cl ?? []) de(c.vendedor_id).clientes++;
  for (const o of ops ?? []) {
    de(o.vendedor_id).ganadas++;
    de(o.vendedor_id).montoGanado += Number(o.monto_estimado ?? 0);
  }
  return r;
}

function VendedorForm({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial: VendedorEditable;
  onGuardar: (v: VendedorEditable) => Promise<void>;
  onCancelar: () => void;
}) {
  const [v, setV] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const texto = (k: keyof VendedorEditable) => ({
    value: (v[k] as string | null) ?? "",
    onChange: (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value }),
  });
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(v);
    } catch (err) {
      setError((err as Error).message);
      setGuardando(false);
    }
  };
  return (
    <form className="crm-form crm-subform" onSubmit={enviar}>
      <div className="crm-grid">
        <label>
          Nombre *
          <input required autoFocus {...texto("nombre")} />
        </label>
        <label>
          Apellido
          <input {...texto("apellido")} />
        </label>
        <label>
          Email (el mismo con el que entra)
          <input type="email" {...texto("email")} />
        </label>
        <label>
          Teléfono
          <input type="tel" {...texto("telefono")} />
        </label>
        <label>
          Cargo
          <input {...texto("cargo")} />
        </label>
        <label>
          Comisión (%)
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={v.comision_pct}
            onChange={(e) => setV({ ...v, comision_pct: Number(e.target.value) })}
          />
        </label>
        <label className="crm-check">
          <input type="checkbox" checked={v.activo} onChange={(e) => setV({ ...v, activo: e.target.checked })} />
          Activo
        </label>
      </div>
      {error && <div className="auth-error">{error}</div>}
      <div className="crm-acciones">
        <button type="button" className="btn-salir" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="crm-btn-primario" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar vendedor"}
        </button>
      </div>
    </form>
  );
}

export function Equipo() {
  const rol = useRol();
  const esAdmin = rol === "admin";
  const [vendedores, setVendedores] = useState<Vendedor[] | null>(null);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [editando, setEditando] = useState<Vendedor | "nuevo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [vs, st] = await Promise.all([listarVendedores(true), estadisticas()]);
      setVendedores(vs);
      olvidarVendedores();
      setStats(st);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="crm-panel">
      <div className="crm-encabezado">
        <div>
          <h2>Equipo</h2>
          <span className="crm-sec" style={{ marginLeft: 0 }}>
            El email del vendedor tiene que ser el mismo con el que entra a la app: así ve sus comisiones.
          </span>
        </div>
        {esAdmin && editando === null && (
          <button type="button" className="crm-btn-primario" onClick={() => setEditando("nuevo")}>
            + Nuevo vendedor
          </button>
        )}
      </div>

      {error && <div className="auth-error">{error}</div>}

      {editando === "nuevo" && (
        <VendedorForm
          inicial={VENDEDOR_VACIO}
          onCancelar={() => setEditando(null)}
          onGuardar={async (v) => {
            await guardarVendedor(v);
            setEditando(null);
            await cargar();
          }}
        />
      )}

      {vendedores === null && !error && <p className="crm-vacio">Cargando…</p>}
      {vendedores?.length === 0 && <p className="crm-vacio">Todavía no hay vendedores cargados.</p>}

      {vendedores && vendedores.length > 0 && (
        <div className="crm-tabla">
          {vendedores.map((v) =>
            editando !== null && editando !== "nuevo" && editando.id === v.id ? (
              <VendedorForm
                key={v.id}
                inicial={v}
                onCancelar={() => setEditando(null)}
                onGuardar={async (d) => {
                  await guardarVendedor(d, v.id);
                  setEditando(null);
                  await cargar();
                }}
              />
            ) : (
              <div key={v.id} className="crm-fila crm-fila-estatica">
                <div className="crm-fila-principal">
                  <strong>{nombreVendedor(v)}</strong>
                  {v.cargo && <span className="crm-sec">{v.cargo}</span>}
                  <span className="chip-rol rol-admin">{v.comision_pct}%</span>
                  {!v.activo && <span className="chip-rol">Inactivo</span>}
                </div>
                <div className="crm-fila-datos">
                  {v.email && <span>{v.email}</span>}
                  <span>{stats[v.id]?.clientes ?? 0} clientes</span>
                  <span>
                    {stats[v.id]?.ganadas ?? 0} ventas ganadas · {formatoPesos(stats[v.id]?.montoGanado ?? 0)}
                  </span>
                  {esAdmin && (
                    <button type="button" className="auth-link" onClick={() => setEditando(v)}>
                      Editar
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
