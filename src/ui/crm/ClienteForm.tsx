// Alta y edición de cliente. Avisa posibles duplicados (mismo CUIT o razón social parecida)
// y si el dígito verificador del CUIT no cierra; la base igual rechaza un CUIT repetido.
import { useState, type FormEvent } from "react";
import {
  actualizarCliente,
  crearCliente,
  cuitValido,
  posiblesDuplicados,
  TIPOS_CLIENTE,
  type Cliente,
  type ClienteEditable,
  type ClienteFila,
} from "../../lib/clientes";
import { ir } from "../../lib/ruta";
import { VendedorSelect } from "./VendedorSelect";

const ETIQUETA_TIPO: Record<(typeof TIPOS_CLIENTE)[number], string> = {
  empresa: "Empresa",
  particular: "Particular",
  hotel: "Hotel",
  restaurante: "Restaurante",
  catering: "Catering",
  otro: "Otro",
};

interface Props {
  inicial: ClienteEditable;
  id?: string; // sin id = alta
  onGuardado: (c: Cliente) => void;
  onCancelar: () => void;
}

export function ClienteForm({ inicial, id, onGuardado, onCancelar }: Props) {
  const [c, setC] = useState<ClienteEditable>(inicial);
  const [dups, setDups] = useState<ClienteFila[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ClienteEditable>(k: K, v: ClienteEditable[K]) => setC((x) => ({ ...x, [k]: v }));
  const texto = (k: keyof ClienteEditable) => ({
    value: (c[k] as string | null) ?? "",
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  });

  const revisarDuplicados = () => {
    posiblesDuplicados(c, id).then(setDups).catch(() => setDups([]));
  };

  const cuit = (c.cuit ?? "").trim();
  const avisoCuit = cuit && !cuitValido(cuit) ? "Ojo: el CUIT no parece válido (11 dígitos con dígito verificador)." : null;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      onGuardado(id ? await actualizarCliente(id, c) : await crearCliente(c));
    } catch (err) {
      setError((err as Error).message);
      setGuardando(false);
    }
  };

  return (
    <form className="crm-form" onSubmit={guardar}>
      <div className="crm-grid">
        <label className="crm-ancho">
          Razón social *
          <input required {...texto("razon_social")} onBlur={revisarDuplicados} />
        </label>
        <label>
          Nombre comercial
          <input {...texto("nombre_comercial")} />
        </label>
        <label>
          CUIT
          <input inputMode="numeric" placeholder="20-12345678-9" {...texto("cuit")} onBlur={revisarDuplicados} />
        </label>
        <label>
          Tipo
          <select value={c.tipo} onChange={(e) => set("tipo", e.target.value as ClienteEditable["tipo"])}>
            {TIPOS_CLIENTE.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_TIPO[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Segmento
          <input placeholder="hotelería, gastronomía, catering…" {...texto("segmento")} />
        </label>
        <label>
          Email
          <input type="email" {...texto("email")} />
        </label>
        <label>
          Teléfono
          <input type="tel" {...texto("telefono")} />
        </label>
        <label className="crm-ancho">
          Dirección
          <input {...texto("direccion")} />
        </label>
        <label>
          Ciudad
          <input {...texto("ciudad")} />
        </label>
        <label>
          Provincia
          <input {...texto("provincia")} />
        </label>
        <label>
          País
          <input {...texto("pais")} />
        </label>
        <label>
          Vendedor
          <VendedorSelect value={c.vendedor_id} onChange={(id) => set("vendedor_id", id)} />
        </label>
        <label className="crm-ancho">
          Notas
          <textarea rows={3} {...texto("notas")} />
        </label>
      </div>

      {avisoCuit && <div className="auth-aviso">{avisoCuit}</div>}
      {dups.length > 0 && (
        <div className="crm-dups">
          <strong>Ya hay clientes parecidos:</strong>
          {dups.map((d) => (
            <button key={d.id} type="button" className="auth-link" onClick={() => ir(`/clientes/${d.id}`)}>
              {d.razon_social}
              {d.cuit ? ` · CUIT ${d.cuit}` : ""} → abrir
            </button>
          ))}
          <span className="crm-sec">Si es otro cliente, podés guardarlo igual.</span>
        </div>
      )}
      {error && <div className="auth-error">{error}</div>}

      <div className="crm-acciones">
        <button type="button" className="btn-salir" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="crm-btn-primario" disabled={guardando}>
          {guardando ? "Guardando…" : id ? "Guardar cambios" : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
