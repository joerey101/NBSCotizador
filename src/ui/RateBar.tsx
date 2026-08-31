import type { Moneda, TipoCambio } from "../lib/types";

interface Props {
  monedaPresupuesto: Moneda;
  onMoneda: (m: Moneda) => void;
  tc: TipoCambio;
  onTc: (tc: TipoCambio) => void;
}

const MONEDAS: Moneda[] = ["ARS", "USD", "EUR"];

/** Moneda del presupuesto (todo el catálogo y la cotización se expresan en ella)
 *  + tasas cargables. ARS es el pivote. Recálculo en vivo aguas arriba. */
export function RateBar({ monedaPresupuesto, onMoneda, tc, onTc }: Props) {
  const set = (k: "USD_ARS" | "EUR_ARS", v: string) => {
    const n = v === "" ? null : Number(v.replace(",", "."));
    onTc({ ...tc, [k]: n != null && isFinite(n) && n > 0 ? n : null });
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
    </div>
  );
}
