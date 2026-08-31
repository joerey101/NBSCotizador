// Motor de búsqueda — lógica pura (sin React). Tolerante a acentos y may/min.
import MiniSearch from "minisearch";
import type { Producto, Filtros } from "./types";

/** Folding: minúsculas + sin acentos. Hace la búsqueda tolerante a tildes. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const CAMPOS_BUSQUEDA = [
  "producto",
  "modelo",
  "marca",
  "codigo_origen",
  "origen",
  "categoria",
  "linea",
];

export function crearIndice(productos: Producto[]): MiniSearch<Producto> {
  const mini = new MiniSearch<Producto>({
    idField: "id",
    fields: CAMPOS_BUSQUEDA,
    storeFields: ["id"],
    processTerm: (term) => {
      const f = fold(term);
      return f.length ? f : null;
    },
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      // El origen pesa: ayuda a la desambiguación cuando se tipea el proveedor.
      boost: { producto: 3, marca: 2, origen: 2, codigo_origen: 2 },
      combineWith: "AND",
    },
  });
  mini.addAll(productos);
  return mini;
}

function pasaFiltros(p: Producto, f: Filtros): boolean {
  if (f.origen && p.origen !== f.origen) return false;
  if (f.categoria && (p.categoria ?? "") !== f.categoria) return false;
  if (f.moneda && p.moneda !== f.moneda) return false;
  return true;
}

export interface ResultadoBusqueda {
  items: Producto[];
  total: number; // total que matchea (antes de recortar)
}

/**
 * Busca por texto (opcional) + filtros. Sin texto => devuelve todo lo filtrado
 * ordenado por origen y producto. `limite` recorta para no renderizar miles.
 */
export function buscar(
  query: string,
  filtros: Filtros,
  productos: Producto[],
  porId: Map<string, Producto>,
  indice: MiniSearch<Producto>,
  limite = 300
): ResultadoBusqueda {
  const q = query.trim();
  let base: Producto[];

  if (q.length === 0) {
    base = productos
      .filter((p) => pasaFiltros(p, filtros))
      .sort(
        (a, b) =>
          a.origen.localeCompare(b.origen, "es") ||
          a.producto.localeCompare(b.producto, "es")
      );
  } else {
    const hits = indice.search(q);
    base = [];
    for (const h of hits) {
      const p = porId.get(h.id as string);
      if (p && pasaFiltros(p, filtros)) base.push(p);
    }
  }

  return { items: base.slice(0, limite), total: base.length };
}

/** Valores únicos para poblar los filtros, ordenados en español. */
export function opcionesFiltro(productos: Producto[]) {
  const origenes = new Set<string>();
  const categorias = new Set<string>();
  const monedas = new Set<string>();
  for (const p of productos) {
    origenes.add(p.origen);
    if (p.categoria) categorias.add(p.categoria);
    monedas.add(p.moneda);
  }
  const ord = (a: string, b: string) => a.localeCompare(b, "es");
  return {
    origenes: [...origenes].sort(ord),
    categorias: [...categorias].sort(ord),
    monedas: [...monedas].sort(ord),
  };
}
