import { useEffect, useRef, useState } from "react";

/**
 * Estado persistido en localStorage con fallback a memoria.
 * Desde file:// algunos navegadores bloquean localStorage; en ese caso el valor
 * vive solo en memoria (no rompe). El borrador de cotización del Hito 3 usará,
 * además, exportar/importar JSON como alternativa robusta.
 */
export function useLocalStorage<T>(clave: string, inicial: T) {
  const disponible = useRef<boolean>(true);
  const [valor, setValor] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(clave);
      return raw != null ? (JSON.parse(raw) as T) : inicial;
    } catch {
      disponible.current = false;
      return inicial;
    }
  });

  useEffect(() => {
    if (!disponible.current) return;
    try {
      window.localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      disponible.current = false;
    }
  }, [clave, valor]);

  return [valor, setValor] as const;
}
