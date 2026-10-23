import type { Filtros, Moneda } from "../lib/types";
import { SIN_FAMILIA } from "../lib/search";

interface Props {
  filtros: Filtros;
  opciones: { origenes: string[]; categorias: string[]; monedas: string[] };
  familias: { valor: string; n: number }[]; // del origen elegido, en orden de lista
  onChange: (f: Filtros) => void;
}

const SIN_FILTROS: Filtros = { origen: "", familia: "", categoria: "", moneda: "" };

export function FiltrosBar({ filtros, opciones, familias, onChange }: Props) {
  const hayFiltro = filtros.origen || filtros.familia || filtros.categoria || filtros.moneda;
  return (
    <>
      <div className="filtros">
        <select
          value={filtros.origen}
          // al cambiar de origen la familia elegida deja de existir
          onChange={(e) => onChange({ ...filtros, origen: e.target.value, familia: "" })}
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
          <button className="btn-limpiar" onClick={() => onChange(SIN_FILTROS)}>
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {filtros.origen && familias.length > 1 ? (
        <div className="filtros filtros-familia">
          <select
            value={filtros.familia}
            onChange={(e) => onChange({ ...filtros, familia: e.target.value })}
            aria-label="Filtrar por familia"
          >
            <option value="">Todas las familias</option>
            {familias.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.valor === SIN_FAMILIA ? "Sin familia" : f.valor} ({f.n})
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}
