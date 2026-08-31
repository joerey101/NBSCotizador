import type { Filtros, Moneda } from "../lib/types";

interface Props {
  filtros: Filtros;
  opciones: { origenes: string[]; categorias: string[]; monedas: string[] };
  onChange: (f: Filtros) => void;
}

export function FiltrosBar({ filtros, opciones, onChange }: Props) {
  const hayFiltro = filtros.origen || filtros.categoria || filtros.moneda;
  return (
    <div className="filtros">
      <select
        value={filtros.origen}
        onChange={(e) => onChange({ ...filtros, origen: e.target.value })}
        aria-label="Filtrar por origen"
      >
        <option value="">Todos los orígenes</option>
        {opciones.origenes.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>

      <select
        value={filtros.categoria}
        onChange={(e) => onChange({ ...filtros, categoria: e.target.value })}
        aria-label="Filtrar por categoría"
      >
        <option value="">Todas las categorías</option>
        {opciones.categorias.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        value={filtros.moneda}
        onChange={(e) => onChange({ ...filtros, moneda: e.target.value as Moneda | "" })}
        aria-label="Filtrar por moneda"
      >
        <option value="">Toda moneda</option>
        {opciones.monedas.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      {hayFiltro ? (
        <button
          className="btn-limpiar"
          onClick={() => onChange({ origen: "", categoria: "", moneda: "" })}
        >
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}
