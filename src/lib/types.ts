// Tipos del catálogo y de la cotización. Espejan EXACTAMENTE catalogo_maestro.json.
// Esta capa (lib/) es lógica pura, sin React, reutilizable en Fase B.

export type Moneda = "ARS" | "USD" | "EUR";

export interface Producto {
  id: string;
  origen: string;
  marca: string | null;
  producto: string;
  modelo: string | null;
  linea: string | null;
  codigo_origen: string | null;
  presentacion: string;
  unidades_por_presentacion: number;
  moneda: Moneda;
  precio_lista: number | null;
  categoria: string | null;
  vigencia_lista: string | null;
  archivo_origen: string;
  hoja_origen: string;
  imagen: string | null;  // data URI base64 de la foto del producto, o null
}

export interface CatalogoMetadata {
  generado: string;
  archivos_procesados: number;
  total_productos: number;
  filas_descartadas_subtitulo: number;
  origenes: string[];
  monedas_detectadas: Moneda[];
}

export interface TipoCambio {
  USD_ARS: number | null;
  EUR_ARS: number | null;
  fecha: string | null;
}

export interface Catalogo {
  metadata: CatalogoMetadata;
  tipo_cambio: TipoCambio;
  productos: Producto[];
}

export interface Filtros {
  origen: string | "";
  categoria: string | "";
  moneda: Moneda | "";
}

export interface DatosCliente {
  nombre: string;
  empresa: string;
  cuit: string;
  email: string;
  telefono: string;
  direccion: string;
  vendedor: string;
  fecha: string;
  validez: string;
  condicionesPago: string;
  tiempoEntrega: string;
  lugarEntrega: string;
  observaciones: string;
}
