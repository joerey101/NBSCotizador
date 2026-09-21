import { useState } from "react";
import type { Moneda, TipoCambio } from "../lib/types";

interface Props {
  monedaPresupuesto: Moneda;
  onMoneda: (m: Moneda) => void;
  tc: TipoCambio;
  onTc: (tc: TipoCambio) => void;
}

const MONEDAS: Moneda[] = ["ARS", "USD", "EUR"];

type FetchState = "idle" | "loading" | "ok" | "error";

/** Moneda del presupuesto (todo el catálogo y la cotización se expresan en ella)
 *  + tasas cargables. ARS es el pivote. Recálculo en vivo aguas arriba. */
export function RateBar({ monedaPresupuesto, onMoneda, tc, onTc }: Props) {
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [fetchMsg, setFetchMsg] = useState<string>("");

  const set = (k: "USD_ARS" | "EUR_ARS", v: string) => {
    const n = v === "" ? null : Number(v.replace(",", "."));
    onTc({ ...tc, [k]: n != null && isFinite(n) && n > 0 ? n : null });
  };

  const fetchTasas = async () => {
    setFetchState("loading");
    setFetchMsg("");
    try {
      // MonedAPI: scraping oficial de cotizaciones BNA, sin CORS issues
      const [resUsd, resEur] = await Promise.all([
        fetch("https://monedapi.ar/api/v2/usd/bna"),
        fetch("https://monedapi.ar/api/v2/eur/bna"),
      ]);

      if (!resUsd.ok || !resEur.ok) throw new Error("Respuesta inválida de MonedAPI");

      const dataUsd = await resUsd.json();
      const dataEur = await resEur.json();

      // MonedAPI devuelve { venta, compra, ... }
      const usdArs = dataUsd?.venta ?? dataUsd?.sell ?? null;
      const eurArs = dataEur?.venta ?? dataEur?.sell ?? null;

      if (!usdArs || !eurArs) throw new Error("Datos de tasa incompletos");

      const fecha = new Date().toISOString().slice(0, 10);
      onTc({ USD_ARS: Number(usdArs), EUR_ARS: Number(eurArs), fecha });
      setFetchState("ok");
      setFetchMsg(`BNA · ${fecha}`);
    } catch (err) {
      setFetchState("error");
      setFetchMsg("No se pudo obtener. Cargá manualmente.");
      console.error("[RateBar] fetchTasas:", err);
    }
  };

  return (
    <div className="ratebar">
      <div className="moneda-sel">
        <span className="rb-label">Moneda del presupuesto</span>
        <div className="segmented">
          {MONEDAS.map((m) => (
            <button
              key={m}
              className={m === monedaPresupuesto ? "seg activa" : "seg"}
              onClick={() => onMoneda(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="tasas">
        <label>
          USD → ARS
          <input type="number" inputMode="decimal" min={0} placeholder="—"
            value={tc.USD_ARS ?? ""} onChange={(e) => set("USD_ARS", e.target.value)} />
        </label>
        <label>
          EUR → ARS
          <input type="number" inputMode="decimal" min={0} placeholder="—"
            value={tc.EUR_ARS ?? ""} onChange={(e) => set("EUR_ARS", e.target.value)} />
        </label>
      </div>
      <div className="tasas-auto">
        <button
          className={`btn-fetch-tasas${fetchState === "loading" ? " loading" : fetchState === "ok" ? " ok" : fetchState === "error" ? " err" : ""}`}
          onClick={fetchTasas}
          disabled={fetchState === "loading"}
          title="Obtener tasas BNA actuales desde MonedAPI"
        >
          {fetchState === "loading" ? (
            <><span className="spin">⟳</span> Obteniendo…</>
          ) : fetchState === "ok" ? (
            <>✓ Tasas actualizadas</>
          ) : fetchState === "error" ? (
            <>⚠ Reintentar</>
          ) : (
            <>↻ Tasas BNA</>
          )}
        </button>
        {fetchMsg && (
          <span className={`fetch-msg${fetchState === "error" ? " fetch-err" : ""}`}>
            {fetchMsg}
          </span>
        )}
      </div>
    </div>
  );
}
