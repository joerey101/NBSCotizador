import { useState } from "react";
import type { DatosCliente } from "../lib/types";

interface Props {
  abierto: boolean;
  cliente: DatosCliente;
  onGuardar: (c: DatosCliente) => void;
  onCerrar: () => void;
  onDescargarExcel: () => void;
  cantLineas: number;
}

const VENDEDORES_SUGERIDOS = [
  "Stella Diaz Ruiz - Marcelo Castillo",
  "Marcelo Castillo",
  "Stella Diaz Ruiz",
  "Jose Rey",
  "Vendedor NBS",
];

export function ClienteModal(props: Props) {
  const { abierto, cliente, onGuardar, onCerrar, onDescargarExcel, cantLineas } = props;
  const [form, setForm] = useState<DatosCliente>(cliente);

  if (!abierto) return null;

  const handleChange = (campo: keyof DatosCliente, valor: string) => {
    const nuevo = { ...form, [campo]: valor };
    setForm(nuevo);
    onGuardar(nuevo);
  };

  const handleDescargar = (e: React.FormEvent) => {
    e.preventDefault();
    onGuardar(form);
    onDescargarExcel();
  };

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>Datos del Presupuesto Oficial NBS</h3>
            <span className="modal-sub">Estos datos se insertan en la cabecera y pie del archivo Excel oficial</span>
          </div>
          <button type="button" className="btn-close" onClick={onCerrar}>✕</button>
        </div>

        <form onSubmit={handleDescargar} className="modal-form">
          <div className="form-section">
            <h4>Datos del Cliente</h4>
            <div className="form-grid">
              <label className="form-field full">
                <span>Razón Social / Empresa</span>
                <input
                  type="text"
                  placeholder="Ej: Panaderías del Sur S.A. / Nombre"
                  value={form.empresa}
                  onChange={(e) => handleChange("empresa", e.target.value)}
                />
              </label>

              <label className="form-field">
                <span>CUIT</span>
                <input
                  type="text"
                  placeholder="Ej: 30-71234567-9"
                  value={form.cuit}
                  onChange={(e) => handleChange("cuit", e.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Atención (Contacto)</span>
                <input
                  type="text"
                  placeholder="Ej: Daniel Valentín"
                  value={form.nombre}
                  onChange={(e) => handleChange("nombre", e.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Teléfono / WhatsApp</span>
                <input
                  type="text"
                  placeholder="Ej: 11-4567-8900"
                  value={form.telefono}
                  onChange={(e) => handleChange("telefono", e.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="Ej: cliente@empresa.com"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
              </label>

              <label className="form-field full">
                <span>Dirección / Localidad</span>
                <input
                  type="text"
                  placeholder="Ej: Lerma 51, CABA"
                  value={form.direccion}
                  onChange={(e) => handleChange("direccion", e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="form-section">
            <h4>Emisión y Vendedor</h4>
            <div className="form-grid">
              <label className="form-field">
                <span>Vendedor Emisor</span>
                <input
                  type="text"
                  list="lista-vendedores"
                  placeholder="Stella Diaz Ruiz - Marcelo Castillo"
                  value={form.vendedor}
                  onChange={(e) => handleChange("vendedor", e.target.value)}
                />
                <datalist id="lista-vendedores">
                  {VENDEDORES_SUGERIDOS.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </label>

              <label className="form-field">
                <span>Fecha</span>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => handleChange("fecha", e.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Validez de la oferta</span>
                <input
                  type="text"
                  value={form.validez}
                  onChange={(e) => handleChange("validez", e.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Condición de Pago</span>
                <input
                  type="text"
                  value={form.condicionesPago}
                  onChange={(e) => handleChange("condicionesPago", e.target.value)}
                />
              </label>

              <label className="form-field full">
                <span>Tiempo de Entrega</span>
                <input
                  type="text"
                  value={form.tiempoEntrega}
                  onChange={(e) => handleChange("tiempoEntrega", e.target.value)}
                />
              </label>

              <label className="form-field full">
                <span>Lugar de Entrega</span>
                <input
                  type="text"
                  value={form.lugarEntrega}
                  onChange={(e) => handleChange("lugarEntrega", e.target.value)}
                />
              </label>

              <label className="form-field full">
                <span>Observaciones adicionales (opcional)</span>
                <textarea
                  rows={2}
                  placeholder="Comentarios o notas especiales para el cliente..."
                  value={form.observaciones}
                  onChange={(e) => handleChange("observaciones", e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-sec" onClick={onCerrar}>
              Cerrar
            </button>
            <button
              type="submit"
              className="btn-excel-primary"
              disabled={cantLineas === 0}
            >
              📥 Descargar Presupuesto Oficial (.xlsx)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
