// Generador oficial de Presupuestos Excel de NBS Bazar Profesional (Client-Side / 100% Offline)
// Calibrado: Hoja A4, logo 1:1 circular, altura de fila ajustada sin márgenes excesivos y solo familia genérica en Col B.
import ExcelJS from "exceljs";
import type { Moneda, DatosCliente } from "./types";
import type { Descuento, LineaCotizacion, Totales } from "./cotizacion";
import { LOGO_NBS_BASE64 } from "./logoBase64";

const NOMBRES_MONEDA: Record<Moneda, string> = {
  ARS: "Pesos Argentinos",
  USD: "Dólares Estadounidenses",
  EUR: "Euros",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Glosario genérico por familia/origen
export const MAPEO_FAMILIAS: Record<string, string> = {
  "Acermel": "Acero Inox.",
  "Arthur Krupp": "Arthur Krupp",
  "Rational": "Rational",
  "CAMBRO": "Cambro",
  "Chaffing Dish": "Chaffing Dish",
  "Turboblender": "Imp.",
  "Inoxriv": "Acero Inox.",
  "GN Acero Inox.": "Acero Inox.",
  "Paderno Italia": "Paderno",
  "Paderno Lacor": "Lacor",
  "Porcelana Germer": "Germer",
  "Porcelana Kutahya": "Kutahya",
  "Porcelana Verbano": "Verbano",
  "Pasabahce": "Vidrio",
  "Nude (Copas Cristal)": "Cristal",
  "Cristalería Barra": "Vidrio",
  "Melamina Profesional": "Melamina",
  "Tablas de Corte (Polipropileno)": "Tablas",
  "Neovac (Bolsas de Vacío)": "Neovac",
  "Neovac (Envasadoras / Roners)": "Neovac",
  "Hamilton Beach Commercial": "Hamilton Beach",
  "Nemco": "Nemco",
  "Metvisa": "Metvisa",
  "Lista Vajilla Baralee": "Baralee",
  "Baralee": "Baralee",
  "Nicols": "Nicols",
  "Sartenes Antiadherentes": "Sartenes",
  "Jarras Térmicas": "Jarras",
  "Nadir": "Vidrio",
  "Radici": "Radici",
  "Sambonet": "Sambonet",
};

function obtenerFamilia(origen: string, marca?: string | null): string {
  if (origen && MAPEO_FAMILIAS[origen]) {
    return MAPEO_FAMILIAS[origen];
  }
  if (marca && MAPEO_FAMILIAS[marca]) {
    return MAPEO_FAMILIAS[marca];
  }
  return marca || origen || "";
}

function formatearFecha(fechaStr?: string): string {
  const d = fechaStr ? new Date(fechaStr) : new Date();
  const dia = isNaN(d.getDate()) ? new Date().getDate() : d.getDate();
  const mes = isNaN(d.getMonth()) ? MESES[new Date().getMonth()] : MESES[d.getMonth()];
  const anio = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
  return `Buenos Aires, ${dia} de ${mes} de ${anio}`;
}

function obtenerDatosImagen(raw?: string | null): { base64: string; extension: "png" | "jpeg" } | null {
  if (!raw) return null;
  const isJpeg = raw.includes("image/jpeg") || raw.includes("image/jpg") || raw.startsWith("/9j/");
  const extension: "png" | "jpeg" = isJpeg ? "jpeg" : "png";
  const base64 = raw.includes(",") ? raw.split(",")[1] : raw;
  return { base64, extension };
}

export async function exportarPresupuestoExcel({
  lineas,
  totales,
  cliente,
  descuento,
  monedaPresupuesto,
}: ExportExcelParams): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "NBS Bazar Profesional";
  wb.lastModifiedBy = "NBS Cotizador";
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet("Presupuesto", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
    views: [{ showGridLines: true }],
  });

  // Configuración de anchos de columna calibrados
  ws.getColumn("A").width = 2.5;
  ws.getColumn("B").width = 17.0;
  ws.getColumn("C").width = 33.0;
  ws.getColumn("D").width = 10.0;
  ws.getColumn("E").width = 14.0;
  ws.getColumn("F").width = 14.0;

  // 1. Incrustar Logo oficial NBS con PROPORCIÓN 1:1 PERFECTA (Círculo redondo)
  try {
    const logoData = obtenerDatosImagen(LOGO_NBS_BASE64);
    if (logoData) {
      const logoId = wb.addImage({
        base64: logoData.base64,
        extension: logoData.extension,
      });
      ws.addImage(logoId, {
        tl: { col: 4.2, row: 0.2 },
        ext: { width: 105, height: 105 },
        editAs: "oneCell",
      });
    }
  } catch (err) {
    console.warn("No se pudo agregar logo en Excel:", err);
  }

  // Estilos tipográficos
  const fontHeader = { name: "Times New Roman", size: 10, bold: true };
  const fontDesc = { name: "Times New Roman", size: 11, bold: false };
  const fontNum = { name: "Calibri", size: 11, bold: false };
  const fontTableHead = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } };

  // Bordes
  const thinSide = { style: "thin" as const, color: { argb: "FF000000" } };
  const mediumSide = { style: "medium" as const, color: { argb: "FF000000" } };
  const doubleSide = { style: "double" as const, color: { argb: "FF000000" } };

  const cellBorder: Partial<ExcelJS.Borders> = {
    top: thinSide,
    left: thinSide,
    bottom: thinSide,
    right: thinSide,
  };

  // 2. Cabecera (Fecha y Datos del Cliente)
  ws.getCell("B1").value = formatearFecha(cliente.fecha);
  ws.getCell("B1").font = fontHeader;

  const clienteTexto = `Cliente: ${cliente.empresa || cliente.nombre || ""}${cliente.cuit ? ` - CUIT ${cliente.cuit}` : ""}`;
  ws.getCell("B3").value = clienteTexto;
  ws.getCell("B3").font = fontHeader;

  ws.getCell("B4").value = `Atte: ${cliente.nombre || ""}`;
  ws.getCell("B4").font = fontHeader;

  ws.getCell("B5").value = `Teléfono: ${cliente.telefono || ""}`;
  ws.getCell("B5").font = fontHeader;

  ws.getCell("B6").value = `Email: ${cliente.email || ""}`;
  ws.getCell("B6").font = fontHeader;

  ws.getCell("B7").value = `Dirección: ${cliente.direccion || ""}`;
  ws.getCell("B7").font = fontHeader;

  ws.getCell("B8").value = `De: ${cliente.vendedor || "Stella Diaz Ruiz - Marcelo Castillo"}`;
  ws.getCell("B8").font = fontHeader;

  // 3. Banner "Presupuesto" (Fila 10)
  ws.mergeCells("B10:F10");
  const bannerCell = ws.getCell("B10");
  bannerCell.value = "Presupuesto";
  bannerCell.font = { name: "Times New Roman", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  bannerCell.alignment = { horizontal: "center", vertical: "middle" };
  bannerCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF365F91" },
  };
  bannerCell.border = {
    top: mediumSide,
    left: mediumSide,
    right: mediumSide,
    bottom: thinSide,
  };
  ws.getRow(10).height = 24;

  // 4. Encabezados de Tabla
  const headers = [
    { col: "B", label: "Código/ Observaciones" },
    { col: "C", label: "Descripción" },
    { col: "D", label: "Cantidad" },
    { col: "E", label: "Precio Unitario" },
    { col: "F", label: "Importe" },
  ];

  ws.getRow(11).height = 32;
  for (const h of headers) {
    const cell = ws.getCell(`${h.col}11`);
    cell.value = h.label;
    cell.font = fontTableHead;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F81BD" },
    };
    cell.border = {
      top: thinSide,
      left: h.col === "B" ? mediumSide : thinSide,
      right: h.col === "F" ? mediumSide : thinSide,
      bottom: thinSide,
    };
  }

  // 5. Filas de productos
  let rowIdx = 12;
  for (const linea of lineas) {
    const row = ws.getRow(rowIdx);
    const familia = obtenerFamilia(linea.origen, linea.marca);

    const textoDesc = linea.producto || "";
    const cantCaracteres = textoDesc.length;
    const saltosLinea = (textoDesc.match(/\n/g) || []).length;
    const lineasEstimadas = Math.max(1, Math.ceil(cantCaracteres / 38) + saltosLinea);
    
    // Altura según presencia de imagen y longitud de descripción
    if (linea.imagen) {
      row.height = Math.max(48, lineasEstimadas * 15 + 6);
    } else {
      row.height = Math.max(22, lineasEstimadas * 15 + 4);
    }

    // Celda B (Familia genérica)
    const cellB = ws.getCell(`B${rowIdx}`);
    cellB.value = familia;
    cellB.font = fontDesc;
    cellB.alignment = { horizontal: "center", vertical: "bottom", wrapText: true };
    cellB.border = {
      top: thinSide,
      left: mediumSide,
      bottom: thinSide,
      right: thinSide,
    };

    // Foto embebida en la parte superior de la celda B si existe
    if (linea.imagen) {
      try {
        const imgData = obtenerDatosImagen(linea.imagen);
        if (imgData) {
          const imgId = wb.addImage({
            base64: imgData.base64,
            extension: imgData.extension,
          });
          ws.addImage(imgId, {
            tl: { col: 1.1, row: (rowIdx - 1) + 0.05 },
            ext: { width: 70, height: 44 },
            editAs: "oneCell",
          });
        }
      } catch (e) {
        console.warn("No se pudo incrustar imagen en fila:", rowIdx, e);
      }
    }

    // Celda C (Descripción)
    const cellC = ws.getCell(`C${rowIdx}`);
    cellC.value = linea.producto;
    cellC.font = fontDesc;
    cellC.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    cellC.border = cellBorder;

    // Celda D (Cantidad)
    const cellD = ws.getCell(`D${rowIdx}`);
    const cantVal = Number(linea.cantidad) || 1;
    cellD.value = cantVal;
    cellD.font = fontNum;
    cellD.alignment = { horizontal: "center", vertical: "middle" };
    cellD.numFmt = "#,##0";
    cellD.border = cellBorder;

    // Celda E (Precio Unitario)
    const calc = totales.porLinea[linea.uid];
    const pu = calc?.precioUnitarioPresupuesto ?? (linea.precioUnitarioOriginal ?? 0);
    const cellE = ws.getCell(`E${rowIdx}`);
    cellE.value = pu;
    cellE.font = fontNum;
    cellE.alignment = { horizontal: "right", vertical: "middle" };
    cellE.numFmt = "#,##0.00";
    cellE.border = cellBorder;

    // Celda F (Fórmula de Importe con result precalculado)
    const subLinea = calc?.subtotalPresupuesto ?? (pu * cantVal);
    const cellF = ws.getCell(`F${rowIdx}`);
    cellF.value = { formula: `E${rowIdx}*D${rowIdx}`, result: subLinea };
    cellF.font = fontNum;
    cellF.alignment = { horizontal: "right", vertical: "middle" };
    cellF.numFmt = "#,##0.00";
    cellF.border = {
      top: thinSide,
      left: thinSide,
      bottom: thinSide,
      right: mediumSide,
    };

    rowIdx++;
  }

  const subtotalRow = rowIdx;
  ws.getRow(subtotalRow).height = 24;

  // 6. Sub-Total
  for (const c of ["B", "C", "D"]) {
    const cell = ws.getCell(`${c}${subtotalRow}`);
    cell.border = {
      top: thinSide,
      left: c === "B" ? mediumSide : thinSide,
      bottom: totales.descuentoMonto === 0 ? doubleSide : thinSide,
      right: thinSide,
    };
  }

  const subLbl = ws.getCell(`E${subtotalRow}`);
  subLbl.value = "Sub-Total";
  subLbl.font = { name: "Times New Roman", size: 11, bold: true };
  subLbl.alignment = { horizontal: "center", vertical: "middle" };
  subLbl.border = {
    top: thinSide,
    left: thinSide,
    bottom: totales.descuentoMonto === 0 ? doubleSide : thinSide,
    right: thinSide,
  };

  const subVal = ws.getCell(`F${subtotalRow}`);
  subVal.value = { formula: `SUM(F12:F${subtotalRow - 1})`, result: totales.subtotal };
  subVal.font = { name: "Calibri", size: 11, bold: true };
  subVal.alignment = { horizontal: "right", vertical: "middle" };
  subVal.numFmt = "#,##0.00";
  subVal.border = {
    top: thinSide,
    left: thinSide,
    bottom: totales.descuentoMonto === 0 ? doubleSide : thinSide,
    right: mediumSide,
  };

  let cursorRow = subtotalRow + 1;

  if (totales.descuentoMonto > 0) {
    ws.getRow(cursorRow).height = 20;
    for (const c of ["B", "C", "D"]) {
      ws.getCell(`${c}${cursorRow}`).border = {
        top: thinSide,
        left: c === "B" ? mediumSide : thinSide,
        bottom: thinSide,
        right: thinSide,
      };
    }
    const descLbl = ws.getCell(`E${cursorRow}`);
    descLbl.value = descuento.modo === "porcentaje" ? `Descuento (${descuento.valor}%)` : "Descuento";
    descLbl.font = { name: "Times New Roman", size: 10, bold: true };
    descLbl.alignment = { horizontal: "center", vertical: "middle" };
    descLbl.border = cellBorder;

    const descVal = ws.getCell(`F${cursorRow}`);
    descVal.value = totales.descuentoMonto;
    descVal.font = fontNum;
    descVal.alignment = { horizontal: "right", vertical: "middle" };
    descVal.numFmt = "#,##0.00";
    descVal.border = {
      top: thinSide,
      left: thinSide,
      bottom: thinSide,
      right: mediumSide,
    };
    cursorRow++;

    ws.getRow(cursorRow).height = 24;
    for (const c of ["B", "C", "D"]) {
      ws.getCell(`${c}${cursorRow}`).border = {
        top: thinSide,
        left: c === "B" ? mediumSide : thinSide,
        bottom: doubleSide,
        right: thinSide,
      };
    }
    const totLbl = ws.getCell(`E${cursorRow}`);
    totLbl.value = "TOTAL";
    totLbl.font = { name: "Times New Roman", size: 11, bold: true };
    totLbl.alignment = { horizontal: "center", vertical: "middle" };
    totLbl.border = {
      top: thinSide,
      left: thinSide,
      bottom: doubleSide,
      right: thinSide,
    };

    const totVal = ws.getCell(`F${cursorRow}`);
    totVal.value = { formula: `F${subtotalRow}-F${cursorRow - 1}`, result: totales.total };
    totVal.font = { name: "Calibri", size: 11, bold: true };
    totVal.alignment = { horizontal: "right", vertical: "middle" };
    totVal.numFmt = "#,##0.00";
    totVal.border = {
      top: thinSide,
      left: thinSide,
      bottom: doubleSide,
      right: mediumSide,
    };
    cursorRow++;
  }

  cursorRow += 2;

  // 7. Condiciones Comerciales
  const nombreMoneda = NOMBRES_MONEDA[monedaPresupuesto] || "Pesos Argentinos";
  const notas = [
    "Los Precios No Incluyen IVA .-",
    `Todos los precios expresados en ${nombreMoneda}.-`,
    `Condición de pago: ${cliente.condicionesPago || "Anticipo 50%, saldo contra aviso de entrega.-"}`,
    `Tiempo de entrega: ${cliente.tiempoEntrega || "21 días aproximados desde acreditado anticipo.-"}`,
    `Lugar de entrega: ${cliente.lugarEntrega || "En nuestro depósito sito en Lerma 51, Ciudad Autónoma Bs. As."}`,
  ];

  if (cliente.observaciones) {
    notas.push(`Observaciones: ${cliente.observaciones}`);
  }
  notas.push("Los precios pueden variar sin previo aviso.");

  for (const nota of notas) {
    const cell = ws.getCell(`B${cursorRow}`);
    cell.value = nota;
    cell.font = fontHeader;
    cursorRow += 2;
  }

  // 8. Generar y disparar descarga en el navegador
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const clienteLimpio = (cliente.empresa || cliente.nombre || "Cliente").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fechaStamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Presupuesto_NBS_${clienteLimpio}_${fechaStamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
