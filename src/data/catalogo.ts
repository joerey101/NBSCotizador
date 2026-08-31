// Catálogo EMBEBIDO como JSON (offline, sin backend ni fetch).
// Única dependencia de datos de la app: regenerar con el normalizador y volver
// a copiar catalogo_maestro.json acá (ver scripts/build_all.sh).
import raw from "./catalogo_maestro.json";
import type { Catalogo } from "../lib/types";

export const catalogo = raw as unknown as Catalogo;
