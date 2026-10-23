// Lector de código de barras con la cámara. Usa BarcodeDetector (Chrome/Android) y, si el
// navegador no lo tiene (Safari/iPhone), @zxing/browser, que se carga recién al abrir la cámara.
import { useEffect, useRef, useState } from "react";

interface Props {
  onCodigo: (codigo: string) => void;
  onCerrar: () => void;
}

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

export function CamaraLector({ onCodigo, onCerrar }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    let stream: MediaStream | null = null;
    let detener: (() => void) | null = null;
    const listo = (c: string) => {
      if (!activo) return;
      activo = false;
      navigator.vibrate?.(80);
      onCodigo(c);
    };

    (async () => {
      try {
        const BD = (window as unknown as { BarcodeDetector?: new (o?: unknown) => Detector }).BarcodeDetector;
        if (BD) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          if (!video.current) return;
          video.current.srcObject = stream;
          await video.current.play();
          const detector = new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"] });
          const ciclo = async () => {
            if (!activo || !video.current) return;
            try {
              const r = await detector.detect(video.current);
              if (r[0]?.rawValue) return listo(r[0].rawValue);
            } catch {
              /* cuadro sin código */
            }
            requestAnimationFrame(ciclo);
          };
          ciclo();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const lector = new BrowserMultiFormatReader();
          if (!video.current) return;
          const controles = await lector.decodeFromVideoDevice(undefined, video.current, (res) => {
            if (res) listo(res.getText());
          });
          detener = () => controles.stop();
        }
      } catch (e) {
        const m = (e as Error).message || "";
        setError(
          /permission|denied|NotAllowed/i.test(m)
            ? "No hay permiso para usar la cámara. Habilitalo en el navegador o usá la pistola."
            : "No se pudo abrir la cámara: " + m
        );
      }
    })();

    return () => {
      activo = false;
      detener?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCodigo]);

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-content cam-modal" onClick={(e) => e.stopPropagation()}>
        <div className="crm-encabezado">
          <h2>Escanear con la cámara</h2>
          <button type="button" className="btn-salir" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
        {error ? <div className="auth-error">{error}</div> : <video ref={video} className="cam-video" muted playsInline />}
        <p className="crm-vacio">Apuntá al código de barras; se lee solo.</p>
      </div>
    </div>
  );
}
