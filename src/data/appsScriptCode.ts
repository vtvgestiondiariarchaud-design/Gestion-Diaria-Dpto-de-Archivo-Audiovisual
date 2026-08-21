export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ==============================================================================
 * SISTEMA DE GESTIÓN Y CONTROL DE ARCHIVO AUDIOVISUAL VTV (VENEZOLANA DE TELEVISIÓN)
 * SCRIPT PARA GOOGLE APPS SCRIPT (BASE DE DATOS EN LA NUBE & OPERACIONES ATÓMICAS)
 * ==============================================================================
 * 
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Abra su Hoja de Cálculo en Google Sheets (o cree una nueva en su Google Drive).
 * 2. Vaya a "Extensiones" -> "Apps Script".
 * 3. Borre TODO el contenido existente en "Código.gs" y pegue este código completo.
 * 4. Haga clic en "Guardar" (ícono de disco o Ctrl+S).
 * 5. Haga clic en el botón azul "Desplegar" -> "Nuevo despliegue" (o "Administrar despliegues" -> Editar -> Nueva versión).
 * 6. Seleccione el tipo: "Aplicación web".
 * 7. En "Ejecutar como": Seleccione "Yo (su correo)".
 * 8. En "Quién tiene acceso": Seleccione "Cualquier persona" (Anyone).
 * 9. Haga clic en "Desplegar", autorice los permisos de Google y copie la Web App URL (terminada en /exec).
 * 10. Pegue la URL en la aplicación de VTV Archivo (Módulo de Ajustes / Base de Datos).
 * 
 * NOTA: Al recargar su hoja de Google Sheets, aparecerá un nuevo menú superior
 * llamado "🎬 VTV Archivo" que le permite reestructurar y reparar las 4 hojas con un solo clic.
 */

// Nombres oficiales de las hojas maestras
const SHEET_MATERIALES = "MATERIALES";
const SHEET_PERSONAL = "PERSONAL";
const SHEET_GUARDIAS = "GUARDIAS";
const SHEET_CIERRES = "CIERRES_MENSUALES";

/**
 * Encabezados oficiales para la hoja de MATERIALES (23 columnas: A hasta W)
 */
const MATERIAL_HEADERS = [
  "ID Material",            // A (1)
  "ID Familia",             // B (2)
  "Tipo de Señal",          // C (3)
  "Título / Descripción",   // D (4)
  "División",               // E (5)
  "Duración",               // F (6)
  "Fecha Creación",         // G (7)
  "Creado Por",             // H (8)
  "Rol Creador",            // I (9)
  "Estado",                 // J (10)
  "Es Solicitud / Tarea",   // K (11)
  "Asignado A",             // L (12)
  "Rol Asignado",           // M (13)
  "Fecha Asignación",       // N (14)
  "Ingestado",              // O (15)
  "Ingestado Por",          // P (16)
  "Catalogado",             // Q (17)
  "Catalogado Por",         // R (18)
  "Fecha Catalogación",     // S (19)
  "Finalizado",             // T (20)
  "Finalizado Por",         // U (21)
  "Fecha Finalizado",       // V (22)
  "Notas / Observaciones"   // W (23)
];

/**
 * Encabezados oficiales para la hoja de PERSONAL (9 columnas: A hasta I)
 */
const PERSONNEL_HEADERS = [
  "ID",                     // A (1)
  "Nombre Completo",        // B (2)
  "Rol / Cargo",            // C (3)
  "División",               // D (4)
  "Guardias Trabajadas",    // E (5)
  "Días Libres Generados",  // F (6)
  "Días Libres Tomados",    // G (7)
  "Balance de Días",        // H (8)
  "PIN"                     // I (9)
];

/**
 * Encabezados oficiales para la hoja de GUARDIAS (8 columnas: A hasta H)
 */
const SHIFTS_HEADERS = [
  "ID",                     // A (1)
  "ID Personal",            // B (2)
  "Nombre Personal",        // C (3)
  "Fecha Turno",            // D (4)
  "Fecha Fin",              // E (5)
  "Tipo de Guardia",        // F (6)
  "Notas",                  // G (7)
  "Fecha Creación"          // H (8)
];

/**
 * Encabezados oficiales para la hoja de CIERRES MENSUALES (8 columnas: A hasta H)
 */
const ARCHIVE_HEADERS = [
  "ID Reporte",             // A (1)
  "Período Mensual",        // B (2)
  "Fecha Exportación",      // C (3)
  "Exportado Por",          // D (4)
  "Rol Exportador",         // E (5)
  "Total Materiales",       // F (6)
  "Duración Formateada",    // G (7)
  "Segundos Totales"        // H (8)
];

/**
 * Menú contextual en Google Sheets para ejecutar acciones con un solo clic
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("🎬 VTV Archivo")
      .addItem("⚡ Reestructurar y Alinear Todas las Hojas", "reestructurarTodasLasHojas")
      .addItem("🧹 Depurar Duplicados y Formatear Duraciones", "depurarDuplicadosYFormatear")
      .addSeparator()
      .addItem("📥 Inicializar Estructura de Hojas", "initSheets")
      .addToUi();
  } catch (e) {
    // Modo headless / web app
  }
}

/**
 * Función ejecutable directamente desde el editor de Apps Script o el menú
 */
function reestructurarTodasLasHojas() {
  const result = reorganizeAndMigrateAllSheets();
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert("Reestructuración VTV Archivo", result.message, ui.ButtonSet.OK);
  } catch (e) {
    Logger.log(result.message);
  }
  return result;
}

/**
 * Función ejecutable para depuración de duplicados
 */
function depurarDuplicadosYFormatear() {
  const result = cleanAndDeduplicateSheetInternal();
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert("Depuración VTV Archivo", result.message, ui.ButtonSet.OK);
  } catch (e) {
    Logger.log(result.message);
  }
  return result;
}

/**
 * Inicialización segura de las 4 hojas maestras
 */
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Hoja MATERIALES
  let sMat = ss.getSheetByName(SHEET_MATERIALES);
  if (!sMat) {
    sMat = ss.insertSheet(SHEET_MATERIALES);
    sMat.appendRow(MATERIAL_HEADERS);
    formatHeaderRow(sMat, MATERIAL_HEADERS.length, "#0f172a", "#38bdf8");
    sMat.setFrozenRows(1);
  } else if (sMat.getLastRow() === 0) {
    sMat.appendRow(MATERIAL_HEADERS);
    formatHeaderRow(sMat, MATERIAL_HEADERS.length, "#0f172a", "#38bdf8");
    sMat.setFrozenRows(1);
  }

  // 2. Hoja PERSONAL
  let sPer = ss.getSheetByName(SHEET_PERSONAL);
  if (!sPer) {
    sPer = ss.insertSheet(SHEET_PERSONAL);
    sPer.appendRow(PERSONNEL_HEADERS);
    formatHeaderRow(sPer, PERSONNEL_HEADERS.length, "#0f172a", "#a855f7");
    sPer.setFrozenRows(1);
  } else if (sPer.getLastRow() === 0) {
    sPer.appendRow(PERSONNEL_HEADERS);
    formatHeaderRow(sPer, PERSONNEL_HEADERS.length, "#0f172a", "#a855f7");
    sPer.setFrozenRows(1);
  }

  // 3. Hoja GUARDIAS
  let sShifts = ss.getSheetByName(SHEET_GUARDIAS);
  if (!sShifts) {
    sShifts = ss.insertSheet(SHEET_GUARDIAS);
    sShifts.appendRow(SHIFTS_HEADERS);
    formatHeaderRow(sShifts, SHIFTS_HEADERS.length, "#0f172a", "#10b981");
    sShifts.setFrozenRows(1);
  } else if (sShifts.getLastRow() === 0) {
    sShifts.appendRow(SHIFTS_HEADERS);
    formatHeaderRow(sShifts, SHIFTS_HEADERS.length, "#0f172a", "#10b981");
    sShifts.setFrozenRows(1);
  }

  // 4. Hoja CIERRES_MENSUALES
  let sArch = ss.getSheetByName(SHEET_CIERRES);
  if (!sArch) {
    sArch = ss.insertSheet(SHEET_CIERRES);
    sArch.appendRow(ARCHIVE_HEADERS);
    formatHeaderRow(sArch, ARCHIVE_HEADERS.length, "#0f172a", "#f59e0b");
    sArch.setFrozenRows(1);
  } else if (sArch.getLastRow() === 0) {
    sArch.appendRow(ARCHIVE_HEADERS);
    formatHeaderRow(sArch, ARCHIVE_HEADERS.length, "#0f172a", "#f59e0b");
    sArch.setFrozenRows(1);
  }
}

function formatHeaderRow(sheet, numCols, bgColor, fontColor) {
  const range = sheet.getRange(1, 1, 1, numCols);
  range.setFontWeight("bold")
    .setBackground(bgColor)
    .setFontColor(fontColor)
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 28);
}

/**
 * ==============================================================================
 * MOTOR DE REESTRUCTURACIÓN COMPLETA Y REORDENAMIENTO DE TODAS LAS HOJAS
 * ==============================================================================
 * Lee cualquier orden existente de columnas, migra y normaliza los datos, y
 * reescribe las 4 hojas con la disposición canónica exacta de 23 columnas (MATERIALES),
 * 9 columnas (PERSONAL), 8 columnas (GUARDIAS) y 8 columnas (CIERRES).
 */
function reorganizeAndMigrateAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // -------------------------------------------------------------
  // 1. REESTRUCTURAR HOJA MATERIALES (23 Columnas: A - W)
  // -------------------------------------------------------------
  let sMat = ss.getSheetByName(SHEET_MATERIALES);
  const parsedMaterials = [];
  
  if (sMat && sMat.getLastRow() > 1) {
    const lastCol = Math.max(sMat.getLastColumn(), MATERIAL_HEADERS.length);
    const colMap = getMaterialColumnMapping(sMat);
    const numRows = sMat.getLastRow() - 1;
    const values = sMat.getRange(2, 1, numRows, lastCol).getValues();
    const displayValues = sMat.getRange(2, 1, numRows, lastCol).getDisplayValues();
    const validSignals = ["limpio", "insert", "master"];

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const dispRow = displayValues[i] || [];

      const getVal = function(idx, defIdx) {
        const c = (idx !== undefined && idx >= 0) ? idx : defIdx;
        return (c !== undefined && c < row.length) ? row[c] : "";
      };
      const getDispVal = function(idx, defIdx) {
        const c = (idx !== undefined && idx >= 0) ? idx : defIdx;
        return (c !== undefined && c < dispRow.length) ? dispRow[c] : "";
      };

      const idVal = String(getVal(colMap.id, 0) || "").trim();
      let famVal = String(getVal(colMap.familyId, 1) || idVal || "").trim();
      let signalVal = String(getVal(colMap.signalType, 2) || "Limpio").trim();
      let titleVal = String(getVal(colMap.title, 3) || "").trim();

      if (!idVal && !titleVal && !signalVal) continue;

      // Inversión Título <-> Señal
      const isTitleSignal = validSignals.indexOf(titleVal.toLowerCase()) !== -1;
      const isSignalValid = validSignals.indexOf(signalVal.toLowerCase()) !== -1;
      if (isTitleSignal && !isSignalValid && signalVal) {
        const temp = titleVal;
        titleVal = signalVal;
        signalVal = temp;
      }

      // Normalizar tipo de señal
      const lowSig = signalVal.toLowerCase();
      if (lowSig.indexOf("limp") !== -1) signalVal = "Limpio";
      else if (lowSig.indexOf("ins") !== -1) signalVal = "Insert";
      else if (lowSig.indexOf("mas") !== -1) signalVal = "Master";
      else signalVal = signalVal || "Limpio";

      const rawStatus = String(getVal(colMap.status, 9) || "Registrado").trim();
      const isDiscarded = rawStatus.toLowerCase() === "descartado";
      const isFinalizedVal = getVal(colMap.isFinalized, 19);
      const isFinalized = !isDiscarded && (String(isFinalizedVal).toUpperCase() === "SI" || isFinalizedVal === true || rawStatus.toLowerCase() === "finalizado");
      const isCatalogedVal = getVal(colMap.isCataloged, 16);
      const isCataloged = !isDiscarded && (String(isCatalogedVal).toUpperCase() === "SI" || isCatalogedVal === true || rawStatus.toLowerCase() === "por archivar" || isFinalized);

      let cleanStatus = "Registrado";
      if (isDiscarded) cleanStatus = "Descartado";
      else if (isFinalized) cleanStatus = "Finalizado";
      else if (isCataloged) cleanStatus = "Por Archivar";
      else cleanStatus = rawStatus || "Registrado";

      const rawDur = getDispVal(colMap.duration, 5) || getVal(colMap.duration, 5);
      const cleanDuration = formatDurationString(rawDur);

      const isReqVal = getVal(colMap.isRequestTask, 10);
      const isRequestTask = String(isReqVal).toUpperCase() === "SI" || isReqVal === true;

      let assignedStr = String(getVal(colMap.assignedTo, 11) || "").trim();
      if (assignedStr.toUpperCase() === "NO" || assignedStr.toUpperCase() === "SI") assignedStr = "Sin asignar";
      if (!assignedStr) assignedStr = "Sin asignar";

      const isIngVal = getVal(colMap.isIngested, 14);
      const isIngested = String(isIngVal).toUpperCase() === "SI" || isIngVal === true || isIngVal === 1 || isIngVal === "1" || isIngVal === "";

      const rawIngBy = getVal(colMap.ingestedBy, 15);
      const cleanIngBy = (!isDiscarded && isValidName(rawIngBy)) ? String(rawIngBy).trim() : "";

      const rawCatBy = getVal(colMap.catalogedBy, 17);
      const cleanCatBy = (!isDiscarded && isValidName(rawCatBy)) ? String(rawCatBy).trim() : "N/A";

      const rawCatAt = getVal(colMap.catalogedAt, 18);
      const cleanCatAt = (!isDiscarded && isNotEmptyDate(rawCatAt)) ? formatDateString(rawCatAt) : "N/A";

      const rawFinBy = getVal(colMap.finalizedBy, 20);
      const cleanFinBy = (!isDiscarded && isValidName(rawFinBy)) ? String(rawFinBy).trim() : "N/A";

      const rawFinAt = getVal(colMap.finalizedAt, 21);
      const cleanFinAt = (!isDiscarded && isNotEmptyDate(rawFinAt)) ? formatDateString(rawFinAt) : "N/A";

      const rawNotes = getVal(colMap.notes, 22);

      parsedMaterials.push({
        id: idVal || ("MAT-REC-" + (i + 1)),
        familyId: famVal || idVal || ("MAT-REC-" + (i + 1)),
        signalType: signalVal,
        title: titleVal,
        division: String(getVal(colMap.division, 4) || "Prensa").trim(),
        duration: cleanDuration,
        creationDate: formatDateString(getVal(colMap.creationDate, 6)),
        createdBy: String(getVal(colMap.createdBy, 7) || "").trim(),
        creatorRole: String(getVal(colMap.creatorRole, 8) || "").trim(),
        status: cleanStatus,
        isRequestTask: isRequestTask ? "SI" : "NO",
        assignedTo: assignedStr,
        assignedToRole: String(getVal(colMap.assignedToRole, 12) || "").trim(),
        assignedAt: formatDateString(getVal(colMap.assignedAt, 13)),
        isIngested: isIngested ? "SI" : "NO",
        ingestedBy: cleanIngBy,
        isCataloged: isCataloged ? "SI" : "NO",
        catalogedBy: cleanCatBy,
        catalogedAt: cleanCatAt,
        isFinalized: isFinalized ? "SI" : "NO",
        finalizedBy: cleanFinBy,
        finalizedAt: cleanFinAt,
        notes: rawNotes ? String(rawNotes).trim() : ""
      });
    }
  }

  // Deduplicar en memoria
  const dedupedMaterials = [];
  const matSeen = {};
  for (let i = 0; i < parsedMaterials.length; i++) {
    const m = parsedMaterials[i];
    const key = m.id.toLowerCase();
    if (!matSeen[key]) {
      matSeen[key] = true;
      dedupedMaterials.push(m);
    }
  }

  // Re-escribir Hoja MATERIALES desde cero
  if (!sMat) sMat = ss.insertSheet(SHEET_MATERIALES);
  sMat.clear();
  sMat.appendRow(MATERIAL_HEADERS);
  formatHeaderRow(sMat, MATERIAL_HEADERS.length, "#0f172a", "#38bdf8");
  sMat.setFrozenRows(1);

  if (dedupedMaterials.length > 0) {
    const rows = dedupedMaterials.map(function(m) {
      return [
        m.id,
        m.familyId,
        m.signalType,
        m.title,
        m.division,
        m.duration,
        m.creationDate,
        m.createdBy,
        m.creatorRole,
        m.status,
        m.isRequestTask,
        m.assignedTo,
        m.assignedToRole,
        m.assignedAt,
        m.isIngested,
        m.ingestedBy,
        m.isCataloged,
        m.catalogedBy,
        m.catalogedAt,
        m.isFinalized,
        m.finalizedBy,
        m.finalizedAt,
        m.notes
      ];
    });

    sMat.getRange(2, 1, rows.length, MATERIAL_HEADERS.length).setValues(rows);
    // Establecer formato de texto plano '@' en Duración (Columna F / 6)
    sMat.getRange(2, 6, rows.length, 1).setNumberFormat("@");
    // Alineación
    sMat.getRange(2, 1, rows.length, 3).setHorizontalAlignment("center");
    sMat.getRange(2, 6, rows.length, 2).setHorizontalAlignment("center");
    sMat.getRange(2, 10, rows.length, 2).setHorizontalAlignment("center");
    sMat.getRange(2, 14, rows.length, 1).setHorizontalAlignment("center");
    sMat.getRange(2, 15, rows.length, 1).setHorizontalAlignment("center");
    sMat.getRange(2, 17, rows.length, 1).setHorizontalAlignment("center");
    sMat.getRange(2, 19, rows.length, 2).setHorizontalAlignment("center");
    sMat.getRange(2, 22, rows.length, 1).setHorizontalAlignment("center");
  }

  // -------------------------------------------------------------
  // 2. REESTRUCTURAR HOJA PERSONAL (9 Columnas: A - I)
  // -------------------------------------------------------------
  let sPer = ss.getSheetByName(SHEET_PERSONAL);
  const parsedPersonnel = [];
  if (sPer && sPer.getLastRow() > 1) {
    const pValues = sPer.getRange(2, 1, sPer.getLastRow() - 1, Math.max(sPer.getLastColumn(), 9)).getValues();
    for (let i = 0; i < pValues.length; i++) {
      const p = pValues[i];
      if (!p[0] && !p[1]) continue;
      parsedPersonnel.push({
        id: String(p[0] || "per-" + (i + 1)).trim(),
        name: String(p[1] || "Personal").trim(),
        role: String(p[2] || "Documentalista").trim(),
        division: String(p[3] || "Prensa").trim(),
        guardDaysWorked: Number(p[4]) || 0,
        daysOffGenerated: Number(p[5]) || 0,
        daysOffTaken: Number(p[6]) || 0,
        balanceDays: Number(p[7]) || 0,
        pin: p[8] ? String(p[8]).trim() : ""
      });
    }
  }

  if (!sPer) sPer = ss.insertSheet(SHEET_PERSONAL);
  sPer.clear();
  sPer.appendRow(PERSONNEL_HEADERS);
  formatHeaderRow(sPer, PERSONNEL_HEADERS.length, "#0f172a", "#a855f7");
  sPer.setFrozenRows(1);

  if (parsedPersonnel.length > 0) {
    const pRows = parsedPersonnel.map(function(p) {
      return [
        p.id,
        p.name,
        p.role,
        p.division,
        p.guardDaysWorked,
        p.daysOffGenerated,
        p.daysOffTaken,
        p.balanceDays,
        p.pin
      ];
    });
    sPer.getRange(2, 1, pRows.length, PERSONNEL_HEADERS.length).setValues(pRows);
    sPer.getRange(2, 5, pRows.length, 4).setNumberFormat("0");
    sPer.getRange(2, 9, pRows.length, 1).setNumberFormat("@");
  }

  // -------------------------------------------------------------
  // 3. REESTRUCTURAR HOJA GUARDIAS (8 Columnas: A - H)
  // -------------------------------------------------------------
  let sShifts = ss.getSheetByName(SHEET_GUARDIAS);
  const parsedShifts = [];
  if (sShifts && sShifts.getLastRow() > 1) {
    const shValues = sShifts.getRange(2, 1, sShifts.getLastRow() - 1, Math.max(sShifts.getLastColumn(), 8)).getValues();
    for (let i = 0; i < shValues.length; i++) {
      const s = shValues[i];
      if (!s[0] && !s[1]) continue;
      parsedShifts.push({
        id: String(s[0] || "sh-" + (i + 1)).trim(),
        personnelId: String(s[1] || "").trim(),
        personnelName: String(s[2] || "").trim(),
        date: formatDateString(s[3]),
        endDate: s[4] ? formatDateString(s[4]) : "",
        shiftType: String(s[5] || "Guardia (Fin de semana/Feriado)").trim(),
        notes: s[6] ? String(s[6]).trim() : "",
        createdAt: s[7] ? formatDateString(s[7]) : ""
      });
    }
  }

  if (!sShifts) sShifts = ss.insertSheet(SHEET_GUARDIAS);
  sShifts.clear();
  sShifts.appendRow(SHIFTS_HEADERS);
  formatHeaderRow(sShifts, SHIFTS_HEADERS.length, "#0f172a", "#10b981");
  sShifts.setFrozenRows(1);

  if (parsedShifts.length > 0) {
    const shRows = parsedShifts.map(function(s) {
      return [
        s.id,
        s.personnelId,
        s.personnelName,
        s.date,
        s.endDate,
        s.shiftType,
        s.notes,
        s.createdAt
      ];
    });
    sShifts.getRange(2, 1, shRows.length, SHIFTS_HEADERS.length).setValues(shRows);
    sShifts.getRange(2, 4, shRows.length, 2).setHorizontalAlignment("center");
  }

  // -------------------------------------------------------------
  // 4. REESTRUCTURAR HOJA CIERRES MENSUALES (8 Columnas: A - H)
  // -------------------------------------------------------------
  let sArch = ss.getSheetByName(SHEET_CIERRES);
  const parsedArchives = [];
  if (sArch && sArch.getLastRow() > 1) {
    const aValues = sArch.getRange(2, 1, sArch.getLastRow() - 1, Math.max(sArch.getLastColumn(), 8)).getValues();
    for (let i = 0; i < aValues.length; i++) {
      const a = aValues[i];
      if (!a[0] && !a[1]) continue;
      parsedArchives.push({
        id: String(a[0]).trim(),
        monthPeriod: String(a[1]).trim(),
        exportDate: formatDateString(a[2]),
        exportedBy: String(a[3]).trim(),
        exporterRole: String(a[4]).trim(),
        materialsCount: Number(a[5]) || 0,
        formattedDuration: String(a[6] || "00:00:00").trim(),
        totalDurationSeconds: Number(a[7]) || 0
      });
    }
  }

  if (!sArch) sArch = ss.insertSheet(SHEET_CIERRES);
  sArch.clear();
  sArch.appendRow(ARCHIVE_HEADERS);
  formatHeaderRow(sArch, ARCHIVE_HEADERS.length, "#0f172a", "#f59e0b");
  sArch.setFrozenRows(1);

  if (parsedArchives.length > 0) {
    const aRows = parsedArchives.map(function(a) {
      return [
        a.id,
        a.monthPeriod,
        a.exportDate,
        a.exportedBy,
        a.exporterRole,
        a.materialsCount,
        a.formattedDuration,
        a.totalDurationSeconds
      ];
    });
    sArch.getRange(2, 1, aRows.length, ARCHIVE_HEADERS.length).setValues(aRows);
    sArch.getRange(2, 6, aRows.length, 1).setNumberFormat("0");
    sArch.getRange(2, 7, aRows.length, 1).setNumberFormat("@");
    sArch.getRange(2, 8, aRows.length, 1).setNumberFormat("0");
  }

  return {
    success: true,
    message: "Reestructuración y alineación de todas las hojas completada con éxito (" + dedupedMaterials.length + " materiales, " + parsedPersonnel.length + " personal, " + parsedShifts.length + " guardias, " + parsedArchives.length + " cierres).",
    counts: {
      materials: dedupedMaterials.length,
      personnel: parsedPersonnel.length,
      guardShifts: parsedShifts.length,
      monthlyArchives: parsedArchives.length
    }
  };
}

function isValidName(name) {
  if (name === null || name === undefined) return false;
  const str = String(name).trim();
  if (!str) return false;
  const up = str.toUpperCase();
  return up !== "N/A" && up !== "NO" && up !== "SI" && up !== "SIN ASIGNAR" && up !== "UNDEFINED" && up !== "NULL";
}

function isNotEmptyDate(dt) {
  if (dt === null || dt === undefined) return false;
  const str = String(dt).trim();
  if (!str) return false;
  const up = str.toUpperCase();
  return up !== "N/A" && up !== "NO" && up !== "UNDEFINED" && up !== "NULL";
}

/**
 * Peticiones GET: lectura y funciones de diagnóstico
 */
function doGet(e) {
  try {
    initSheets();
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "readAllData";
    
    if (action === "ping") {
      return responseJSON({ success: true, message: "Servicio Google Apps Script VTV Archivo activo." });
    }

    if (action === "reorganizeAllSheets" || action === "rebuildAllSheets" || action === "restructureSheets") {
      const res = reorganizeAndMigrateAllSheets();
      return responseJSON(res);
    }

    if (action === "cleanAndDeduplicateSheet") {
      const res = cleanAndDeduplicateSheetInternal();
      return responseJSON(res);
    }

    if (action === "readAllData" || action === "read" || action === "getAllData") {
      return handleReadAllData();
    }

    return responseJSON({ success: false, message: "Acción GET no válida: " + action });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

/**
 * Lectura centralizada y ultra-resiliente de todas las hojas
 */
function handleReadAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Leer MATERIALES
  const sMat = ss.getSheetByName(SHEET_MATERIALES);
  const materials = [];
  if (sMat && sMat.getLastRow() > 1) {
    const lastCol = Math.max(sMat.getLastColumn(), MATERIAL_HEADERS.length);
    const colMap = getMaterialColumnMapping(sMat);
    const getCol = function(row, colIdx, defaultIdx) {
      const idx = (colIdx !== undefined && colIdx >= 0) ? colIdx : defaultIdx;
      if (idx !== undefined && idx < row.length) {
        return row[idx];
      }
      return "";
    };

    const values = sMat.getRange(2, 1, sMat.getLastRow() - 1, lastCol).getValues();
    const displayValues = sMat.getRange(2, 1, sMat.getLastRow() - 1, lastCol).getDisplayValues();
    const validSignalTypes = ["limpio", "insert", "master"];

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const dispRow = displayValues[i] || [];
      const getDispCol = function(displayRow, colIdx, defaultIdx) {
        const idx = (colIdx !== undefined && colIdx >= 0) ? colIdx : defaultIdx;
        if (idx !== undefined && idx < displayRow.length) {
          return displayRow[idx];
        }
        return "";
      };

      const idVal = String(getCol(row, colMap.id, 0) || "").trim();
      let famVal = String(getCol(row, colMap.familyId, 1) || idVal || "").trim();
      let signalVal = String(getCol(row, colMap.signalType, 2) || "Limpio").trim();
      let titleVal = String(getCol(row, colMap.title, 3) || "").trim();

      if (!idVal && !titleVal && !signalVal) continue;

      // Inversión Título <-> Señal
      const isTitleType = validSignalTypes.indexOf(titleVal.toLowerCase()) !== -1;
      const isSignalType = validSignalTypes.indexOf(signalVal.toLowerCase()) !== -1;

      if (isTitleType && !isSignalType && signalVal) {
        const temp = titleVal;
        titleVal = signalVal;
        signalVal = temp;
      }

      // Normalizar tipo de señal
      const lowerSig = signalVal.toLowerCase();
      if (lowerSig.indexOf("limp") !== -1) signalVal = "Limpio";
      else if (lowerSig.indexOf("ins") !== -1) signalVal = "Insert";
      else if (lowerSig.indexOf("mas") !== -1) signalVal = "Master";
      else signalVal = signalVal || "Limpio";

      let assignedStr = String(getCol(row, colMap.assignedTo, 11) || "").trim();
      let assignedPersons = [];
      if (assignedStr && assignedStr !== "Sin asignar" && assignedStr.toUpperCase() !== "NO" && assignedStr.toUpperCase() !== "SI") {
        assignedPersons = assignedStr.split(",").map(function(s) { return s.trim(); }).filter(function(s) { return Boolean(s); });
      }

      const rawStatus = String(getCol(row, colMap.status, 9) || "Registrado").trim();
      const isDiscarded = rawStatus.toLowerCase() === "descartado";
      const rawIsFin = getCol(row, colMap.isFinalized, 19);
      const isFinalized = !isDiscarded && (String(rawIsFin).toUpperCase() === "SI" || rawIsFin === true || rawStatus.toLowerCase() === "finalizado");
      const rawIsCat = getCol(row, colMap.isCataloged, 16);
      const isCataloged = !isDiscarded && (String(rawIsCat).toUpperCase() === "SI" || rawIsCat === true || rawStatus.toLowerCase() === "por archivar" || isFinalized);
      
      const rawDur = getDispCol(dispRow, colMap.duration, 5) || getCol(row, colMap.duration, 5);
      const formattedDuration = formatDurationString(rawDur);

      const cleanMatId = idVal || ("MAT-REC-" + (i + 1));
      const rawCatBy = getCol(row, colMap.catalogedBy, 17);
      const cleanCatBy = (!isDiscarded && isValidName(rawCatBy)) ? String(rawCatBy).trim() : undefined;

      const rawCatAt = getCol(row, colMap.catalogedAt, 18);
      const cleanCatAt = (!isDiscarded && isNotEmptyDate(rawCatAt)) ? formatDateString(rawCatAt) : undefined;

      const rawFinBy = getCol(row, colMap.finalizedBy, 20);
      const cleanFinBy = (!isDiscarded && isValidName(rawFinBy)) ? String(rawFinBy).trim() : undefined;

      const rawFinAt = getCol(row, colMap.finalizedAt, 21);
      const cleanFinAt = (!isDiscarded && isNotEmptyDate(rawFinAt)) ? formatDateString(rawFinAt) : undefined;

      const isIngestedVal = getCol(row, colMap.isIngested, 14);
      const isIngested = String(isIngestedVal).toUpperCase() === "SI" || isIngestedVal === true || isIngestedVal === 1 || isIngestedVal === "1" || isIngestedVal === "";

      const rawIngBy = getCol(row, colMap.ingestedBy, 15);
      const cleanIngBy = (!isDiscarded && isValidName(rawIngBy)) ? String(rawIngBy).trim() : undefined;

      const rawNotes = getCol(row, colMap.notes, 22);
      const rawReq = getCol(row, colMap.isRequestTask, 10);
      const isRequestTask = String(rawReq).toUpperCase() === "SI" || rawReq === true;

      const matObj = {
        id: cleanMatId,
        familyId: famVal || cleanMatId,
        title: titleVal,
        signalType: signalVal,
        division: String(getCol(row, colMap.division, 4) || "Prensa").trim(),
        duration: formattedDuration,
        creationDate: formatDateString(getCol(row, colMap.creationDate, 6)),
        createdBy: String(getCol(row, colMap.createdBy, 7) || "").trim(),
        creatorRole: String(getCol(row, colMap.creatorRole, 8) || "").trim(),
        status: isDiscarded ? "Descartado" : (isFinalized ? "Finalizado" : (isCataloged ? "Por Archivar" : rawStatus)),
        isDiscarded: isDiscarded,
        isRequestTask: isRequestTask,
        assignedTo: assignedPersons.length > 0 ? assignedPersons.join(", ") : (assignedStr !== "Sin asignar" ? assignedStr : undefined),
        assignedPersons: assignedPersons.length > 0 ? assignedPersons : undefined,
        assignedToRole: getCol(row, colMap.assignedToRole, 12) ? String(getCol(row, colMap.assignedToRole, 12)).trim() : undefined,
        assignedAt: getCol(row, colMap.assignedAt, 13) ? formatDateString(getCol(row, colMap.assignedAt, 13)) : undefined,
        isIngested: isIngested,
        ingestedBy: cleanIngBy,
        isCataloged: isCataloged,
        catalogedBy: cleanCatBy,
        catalogedAt: cleanCatAt,
        isFinalized: isFinalized,
        finalizedBy: cleanFinBy,
        finalizedAt: cleanFinAt,
        notes: rawNotes ? String(rawNotes).trim() : ""
      };

      // Deduplicar en memoria
      const dedupeKey = cleanMatId.toLowerCase();
      const existingIdx = materials.findIndex(function(m) { return m.id.toLowerCase() === dedupeKey; });
      if (existingIdx === -1) {
        materials.push(matObj);
      } else {
        const existing = materials[existingIdx];
        if (matObj.isDiscarded) {
          existing.status = "Descartado";
          existing.isDiscarded = true;
        }
        if (matObj.duration && matObj.duration !== "00:00:00") {
          existing.duration = matObj.duration;
        }
        if (matObj.title && matObj.title !== existing.title) existing.title = matObj.title;
        if (matObj.notes) existing.notes = matObj.notes;
      }
    }
  }

  // 2. Leer PERSONAL
  const sPer = ss.getSheetByName(SHEET_PERSONAL);
  const personnel = [];
  if (sPer && sPer.getLastRow() > 1) {
    const values = sPer.getRange(2, 1, sPer.getLastRow() - 1, PERSONNEL_HEADERS.length).getValues();
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (!row[0] && !row[1]) continue;
      personnel.push({
        id: String(row[0] || "per-" + (i + 1)).trim(),
        name: String(row[1] || "Personal").trim(),
        role: String(row[2] || "Documentalista").trim(),
        division: String(row[3] || "Prensa").trim(),
        guardDaysWorked: Number(row[4]) || 0,
        daysOffGenerated: Number(row[5]) || 0,
        daysOffTaken: Number(row[6]) || 0,
        balanceDays: Number(row[7]) || 0,
        pin: row[8] ? String(row[8]).trim() : undefined
      });
    }
  }

  // 3. Leer GUARDIAS
  const sShifts = ss.getSheetByName(SHEET_GUARDIAS);
  const guardShifts = [];
  if (sShifts && sShifts.getLastRow() > 1) {
    const values = sShifts.getRange(2, 1, sShifts.getLastRow() - 1, SHIFTS_HEADERS.length).getValues();
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (!row[0] && !row[1]) continue;
      guardShifts.push({
        id: String(row[0] || "sh-" + (i + 1)).trim(),
        personnelId: String(row[1] || "").trim(),
        personnelName: String(row[2] || "").trim(),
        date: formatDateString(row[3]),
        endDate: row[4] ? formatDateString(row[4]) : undefined,
        shiftType: String(row[5] || "Guardia (Fin de semana/Feriado)").trim(),
        notes: row[6] ? String(row[6]).trim() : undefined,
        createdAt: row[7] ? formatDateString(row[7]) : undefined
      });
    }
  }

  // 4. Leer CIERRES MENSUALES
  const sArch = ss.getSheetByName(SHEET_CIERRES);
  const monthlyArchives = [];
  if (sArch && sArch.getLastRow() > 1) {
    const values = sArch.getRange(2, 1, sArch.getLastRow() - 1, ARCHIVE_HEADERS.length).getValues();
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (!row[0] && !row[1]) continue;
      monthlyArchives.push({
        id: String(row[0]).trim(),
        monthPeriod: String(row[1]).trim(),
        exportDate: formatDateString(row[2]),
        exportedBy: String(row[3]).trim(),
        exporterRole: String(row[4]).trim(),
        materialsCount: Number(row[5]) || 0,
        formattedDuration: String(row[6] || "00:00:00").trim(),
        totalDurationSeconds: Number(row[7]) || 0,
        exportedItems: []
      });
    }
  }

  return responseJSON({
    success: true,
    data: {
      materials: materials,
      personnel: personnel,
      guardShifts: guardShifts,
      monthlyArchives: monthlyArchives
    },
    counts: {
      materials: materials.length,
      personnel: personnel.length,
      guardShifts: guardShifts.length,
      monthlyArchives: monthlyArchives.length
    },
    message: "Datos leídos correctamente desde Google Sheets."
  });
}

/**
 * ==============================================================================
 * MAPEO DE COLUMNAS ESTRICTO Y ANTI-COLISIÓN
 * ==============================================================================
 */
function getMaterialColumnMapping(sMat) {
  var lastCol = Math.max(sMat ? sMat.getLastColumn() : MATERIAL_HEADERS.length, MATERIAL_HEADERS.length);
  var headerVals = (sMat && sMat.getLastRow() >= 1) ? sMat.getRange(1, 1, 1, lastCol).getValues()[0] : MATERIAL_HEADERS;
  
  // Posiciones canónicas por defecto (0-based)
  var map = {
    id: 0,              // A (1)
    familyId: 1,        // B (2)
    signalType: 2,      // C (3)
    title: 3,           // D (4)
    division: 4,        // E (5)
    duration: 5,        // F (6)
    creationDate: 6,    // G (7)
    createdBy: 7,       // H (8)
    creatorRole: 8,     // I (9)
    status: 9,          // J (10)
    isRequestTask: 10,  // K (11)
    assignedTo: 11,     // L (12)
    assignedToRole: 12, // M (13)
    assignedAt: 13,     // N (14)
    isIngested: 14,     // O (15)
    ingestedBy: 15,     // P (16)
    isCataloged: 16,    // Q (17)
    catalogedBy: 17,    // R (18)
    catalogedAt: 18,    // S (19)
    isFinalized: 19,    // T (20)
    finalizedBy: 20,    // U (21)
    finalizedAt: 21,    // V (22)
    notes: 22           // W (23)
  };

  for (var c = 0; c < headerVals.length; c++) {
    var rawH = String(headerVals[c] || "").trim();
    if (!rawH) continue;
    var h = rawH.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");

    // 1. ID Material (Col A)
    if (h === "id material" || h === "codigo material" || h === "id senal" || h === "id_material" || h === "material id") {
      map.id = c;
    } else if (h === "id" || h === "codigo") {
      map.id = c;
    }
    // 2. ID Familia (Col B)
    else if (h.indexOf("familia") !== -1 || h === "id familia" || h === "familia id" || h === "id_familia") {
      map.familyId = c;
    }
    // 3. Tipo de Señal (Col C)
    else if (h.indexOf("tipo") !== -1 && (h.indexOf("senal") !== -1 || h.indexOf("signal") !== -1 || h.indexOf("senial") !== -1)) {
      map.signalType = c;
    } else if (h === "tipo de senal" || h === "tipo senal" || h === "senal" || h === "senial" || h === "signal" || h === "tipo") {
      map.signalType = c;
    }
    // 4. Título / Descripción (Col D)
    else if (h.indexOf("titulo") !== -1 || h.indexOf("descripcion") !== -1 || h.indexOf("nombre del material") !== -1 || h.indexOf("nombre material") !== -1 || h.indexOf("programa") !== -1 || h === "nombre" || h === "material") {
      map.title = c;
    }
    // 5. División (Col E)
    else if (h.indexOf("division") !== -1 || h.indexOf("area") !== -1 || h.indexOf("departamento") !== -1) {
      map.division = c;
    }
    // 6. Duración (Col F)
    else if (h.indexOf("duracion") !== -1 || h.indexOf("tiempo") !== -1 || h === "tc" || h === "time") {
      map.duration = c;
    }
    // 7. Fecha Creación (Col G)
    else if (h.indexOf("creacion") !== -1 || h.indexOf("fecha registro") !== -1 || (h.indexOf("cread") !== -1 && h.indexOf("fecha") !== -1)) {
      map.creationDate = c;
    }
    // 8. Rol Creador (Col I) - Evaluado ANTES de Creado Por para evitar colisión
    else if (h.indexOf("rol creador") !== -1 || h.indexOf("cargo creador") !== -1 || h.indexOf("rol del creador") !== -1) {
      map.creatorRole = c;
    }
    // 9. Creado Por (Col H)
    else if (h.indexOf("creado por") !== -1 || h.indexOf("creador") !== -1 || h.indexOf("autor") !== -1 || h === "creado") {
      map.createdBy = c;
    }
    // 10. Es Solicitud / Tarea (Col K) - Evaluado ANTES de Estado
    else if (h.indexOf("solicitud") !== -1 || h.indexOf("tarea") !== -1) {
      map.isRequestTask = c;
    }
    // 11. Estado (Col J)
    else if (h === "estado" || h === "status" || h.indexOf("estado") !== -1) {
      map.status = c;
    }
    // 12. Rol Asignado (Col M) - Evaluado ANTES de Asignado A
    else if (h.indexOf("rol asignado") !== -1 || h.indexOf("cargo asignado") !== -1) {
      map.assignedToRole = c;
    }
    // 13. Fecha Asignación (Col N) - Evaluado ANTES de Asignado A
    else if (h.indexOf("fecha asignacion") !== -1 || (h.indexOf("asign") !== -1 && h.indexOf("fecha") !== -1)) {
      map.assignedAt = c;
    }
    // 14. Asignado A (Col L)
    else if (h.indexOf("asignado a") !== -1 || h.indexOf("asignado") !== -1 || h.indexOf("responsable") !== -1 || h === "asignado") {
      map.assignedTo = c;
    }
    // 15. Ingestado Por (Col P) - Evaluado ANTES de Ingestado
    else if (h.indexOf("ingestado por") !== -1 || h.indexOf("ingestador") !== -1 || h.indexOf("operador ingesta") !== -1 || h.indexOf("ingesta por") !== -1) {
      map.ingestedBy = c;
    }
    // 16. Ingestado (Col O)
    else if (h === "ingestado" || h === "ingesta" || h.indexOf("ingestado") !== -1) {
      map.isIngested = c;
    }
    // 17. Catalogado Por (Col R) - Evaluado ANTES de Catalogado & Fecha
    else if (h.indexOf("catalogado por") !== -1 || h.indexOf("catalogador") !== -1 || h.indexOf("archivado por") !== -1 || h.indexOf("documentado por") !== -1 || h.indexOf("archivador") !== -1 || h.indexOf("documentalista") !== -1) {
      map.catalogedBy = c;
    }
    // 18. Fecha Catalogación (Col S) - Evaluado ANTES de Catalogado
    else if (h.indexOf("fecha catalogacion") !== -1 || h.indexOf("fecha de catalogacion") !== -1 || h.indexOf("fecha archivo") !== -1 || h.indexOf("fecha de archivo") !== -1 || (h.indexOf("catalog") !== -1 && h.indexOf("fecha") !== -1)) {
      map.catalogedAt = c;
    }
    // 19. Catalogado (Col Q)
    else if (h === "catalogado" || h === "catalogada" || h === "archivado" || h.indexOf("catalogad") !== -1 || h.indexOf("para archivar") !== -1) {
      map.isCataloged = c;
    }
    // 20. Finalizado Por (Col U) - Evaluado ANTES de Finalizado & Fecha
    else if (h.indexOf("finalizado por") !== -1 || h.indexOf("finalizador") !== -1 || h.indexOf("aprobado por") !== -1 || h.indexOf("cerrado por") !== -1) {
      map.finalizedBy = c;
    }
    // 21. Fecha Finalizado (Col V) - Evaluado ANTES de Finalizado
    else if (h.indexOf("fecha finaliz") !== -1 || h.indexOf("fecha de finaliz") !== -1 || h.indexOf("fecha cierre") !== -1 || (h.indexOf("finaliz") !== -1 && h.indexOf("fecha") !== -1)) {
      map.finalizedAt = c;
    }
    // 22. Finalizado (Col T)
    else if (h === "finalizado" || h === "finalizada" || h.indexOf("finalizad") !== -1) {
      map.isFinalized = c;
    }
    // 23. Notas / Observaciones (Col W)
    else if (h.indexOf("nota") !== -1 || h.indexOf("observaci") !== -1 || h.indexOf("comentario") !== -1 || h.indexOf("detalles") !== -1) {
      map.notes = c;
    }
  }

  return map;
}

function findMatchingMaterialRows(sMat, targetId, familyId, signalType) {
  if (!sMat || sMat.getLastRow() <= 1) return [];
  var colMap = getMaterialColumnMapping(sMat);
  var numRows = sMat.getLastRow() - 1;
  var maxCol = Math.max(sMat.getLastColumn(), MATERIAL_HEADERS.length);
  var allValues = sMat.getRange(2, 1, numRows, maxCol).getValues();

  var cleanTargetId = String(targetId || "").trim().toLowerCase();
  var cleanFamilyId = String(familyId || "").trim().toLowerCase();
  var cleanSignal = String(signalType || "").trim().toLowerCase();

  var matches = [];

  for (var i = 0; i < allValues.length; i++) {
    var row = allValues[i];
    var rowId = String(row[colMap.id] || "").trim().toLowerCase();
    var rowFam = String(row[colMap.familyId] || "").trim().toLowerCase();
    var rowSig = String(row[colMap.signalType] || "").trim().toLowerCase();

    if (cleanTargetId && rowId === cleanTargetId) {
      matches.push(i + 2); // 1-based row index in Sheets
    } else if (cleanFamilyId && cleanSignal && rowFam === cleanFamilyId && rowSig === cleanSignal) {
      matches.push(i + 2);
    }
  }

  return matches;
}

function findRowIndexById(sheet, colIndex, targetId) {
  if (!sheet || sheet.getLastRow() <= 1) return -1;
  const numRows = sheet.getLastRow() - 1;
  const values = sheet.getRange(2, colIndex, numRows, 1).getValues();
  const searchId = String(targetId).trim().toLowerCase();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === searchId) {
      return i + 2;
    }
  }
  return -1;
}

function materialToRowArray(m, colMap) {
  let assignedStr = m.assignedTo || "";
  if (m.assignedPersons && m.assignedPersons.length > 0) {
    assignedStr = m.assignedPersons.join(", ");
  }

  const isDiscarded = m.status === "Descartado" || m.isDiscarded === true;
  const status = isDiscarded ? "Descartado" : (m.status || "Registrado");
  const isFinalized = !isDiscarded && (m.isFinalized === true || status === "Finalizado");
  const isCataloged = !isDiscarded && (m.isCataloged === true || status === "Por Archivar" || isFinalized);
  const cleanDuration = formatDurationString(m.duration);

  const fieldValues = {
    id: m.id || "",
    familyId: m.familyId || m.id || "",
    signalType: m.signalType || "Limpio",
    title: m.title || "",
    division: m.division || "Prensa",
    duration: cleanDuration,
    creationDate: m.creationDate || "",
    createdBy: m.createdBy || "",
    creatorRole: m.creatorRole || m.createdByRole || "",
    status: status,
    isRequestTask: (m.isRequestTask === true || m.isRequestTask === "SI") ? "SI" : "NO",
    assignedTo: assignedStr || "Sin asignar",
    assignedToRole: m.assignedToRole || "",
    assignedAt: m.assignedAt || "",
    isIngested: (m.isIngested === true || m.isIngested === "SI" || m.isIngested === undefined) ? "SI" : "NO",
    ingestedBy: isDiscarded ? "" : (m.ingestedBy || ""),
    isCataloged: (isCataloged) ? "SI" : "NO",
    catalogedBy: isDiscarded ? "N/A" : (m.catalogedBy || "N/A"),
    catalogedAt: isDiscarded ? "N/A" : (m.catalogedAt || "N/A"),
    isFinalized: (isFinalized) ? "SI" : "NO",
    finalizedBy: isDiscarded ? "N/A" : (m.finalizedBy || "N/A"),
    finalizedAt: isDiscarded ? "N/A" : (m.finalizedAt || "N/A"),
    notes: m.notes || ""
  };

  if (!colMap) {
    return [
      fieldValues.id,            // 0: A
      fieldValues.familyId,      // 1: B
      fieldValues.signalType,    // 2: C
      fieldValues.title,         // 3: D
      fieldValues.division,      // 4: E
      fieldValues.duration,      // 5: F
      fieldValues.creationDate,  // 6: G
      fieldValues.createdBy,     // 7: H
      fieldValues.creatorRole,   // 8: I
      fieldValues.status,        // 9: J
      fieldValues.isRequestTask, // 10: K
      fieldValues.assignedTo,    // 11: L
      fieldValues.assignedToRole,// 12: M
      fieldValues.assignedAt,    // 13: N
      fieldValues.isIngested,    // 14: O
      fieldValues.ingestedBy,    // 15: P
      fieldValues.isCataloged,   // 16: Q
      fieldValues.catalogedBy,   // 17: R
      fieldValues.catalogedAt,   // 18: S
      fieldValues.isFinalized,   // 19: T
      fieldValues.finalizedBy,   // 20: U
      fieldValues.finalizedAt,   // 21: V
      fieldValues.notes          // 22: W
    ];
  }

  var maxIdx = 22;
  for (var key in colMap) {
    if (typeof colMap[key] === "number" && colMap[key] > maxIdx) {
      maxIdx = colMap[key];
    }
  }

  var row = new Array(maxIdx + 1);
  for (var i = 0; i < row.length; i++) row[i] = "";
  for (var fieldKey in fieldValues) {
    var cIdx = colMap[fieldKey];
    if (typeof cIdx === "number" && cIdx >= 0) {
      row[cIdx] = fieldValues[fieldKey];
    }
  }

  return row;
}

function personnelToRowArray(p) {
  return [
    p.id || "",
    p.name || "",
    p.role || "",
    p.division || "",
    Number(p.guardDaysWorked) || 0,
    Number(p.daysOffGenerated) || 0,
    Number(p.daysOffTaken) || 0,
    Number(p.balanceDays) || 0,
    p.pin || ""
  ];
}

function guardShiftToRowArray(s) {
  return [
    s.id || "",
    s.personnelId || "",
    s.personnelName || "",
    s.date || "",
    s.endDate || "",
    s.shiftType || "Guardia (Fin de semana/Feriado)",
    s.notes || "",
    s.createdAt || ""
  ];
}

/**
 * Peticiones POST: Operaciones atómicas y funciones dirigidas
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000); // 30 second timeout

  try {
    initSheets();
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 0. LECTURA CENTRALIZADA VÍA POST (FALLBACK DE COMPATIBILIDAD)
    if (action === "readAllData" || action === "read" || action === "getAllData") {
      return handleReadAllData();
    }

    // ==========================================
    // REESTRUCTURACIÓN COMPLETA DE TODAS LAS HOJAS
    // ==========================================
    if (action === "reorganizeAllSheets" || action === "rebuildAllSheets" || action === "restructureSheets") {
      const res = reorganizeAndMigrateAllSheets();
      return responseJSON(res);
    }

    // ==========================================
    // 1. OPERACIONES ATÓMICAS EN MATERIALES
    // ==========================================

    // A. Crear o Guardar un lote de Materiales (Tarjetas Nuevas)
    if (action === "createMaterials" || action === "saveMaterialsBatch") {
      const rawMaterials = body.materials || (body.material ? [body.material] : []);
      const sMat = ss.getSheetByName(SHEET_MATERIALES);
      if (!sMat) return responseJSON({ success: false, message: "Hoja MATERIALES no encontrada." });

      // 1. Pre-deduplicate incoming payload to prevent internal duplicates
      const uniquePayload = [];
      const seenPayloadKeys = {};
      rawMaterials.forEach(function(m) {
        if (!m || !m.id) return;
        const pKey = (m.familyId && m.signalType)
          ? (String(m.familyId).trim().toLowerCase() + "___" + String(m.signalType).trim().toLowerCase())
          : String(m.id).trim().toLowerCase();
        if (!seenPayloadKeys[pKey]) {
          seenPayloadKeys[pKey] = true;
          uniquePayload.push(m);
        }
      });

      const colMap = getMaterialColumnMapping(sMat);
      let insertedCount = 0;
      let updatedCount = 0;

      uniquePayload.forEach(function(m) {
        const matchingRows = findMatchingMaterialRows(sMat, m.id, m.familyId, m.signalType);
        const rowData = materialToRowArray(m, colMap);
        if (matchingRows.length > 0) {
          const targetRow = matchingRows[0];
          sMat.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
          sMat.getRange(targetRow, colMap.duration + 1).setNumberFormat("@").setValue(String(m.duration || "00:00:00"));
          if (matchingRows.length > 1) {
            for (let d = matchingRows.length - 1; d >= 1; d--) {
              sMat.deleteRow(matchingRows[d]);
            }
          }
          updatedCount++;
        } else {
          sMat.appendRow(rowData);
          const lastRow = sMat.getLastRow();
          sMat.getRange(lastRow, colMap.duration + 1).setNumberFormat("@").setValue(String(m.duration || "00:00:00"));
          insertedCount++;
        }
      });

      SpreadsheetApp.flush();

      return responseJSON({
        success: true,
        message: "Materiales procesados en Sheets: " + insertedCount + " insertados, " + updatedCount + " actualizados.",
        inserted: insertedCount,
        updated: updatedCount
      });
    }

    // B. Modificar / Actualizar una Tarjeta de Material por ID
    if (action === "updateMaterial") {
      const materialId = body.id || (body.material && body.material.id);
      if (!materialId) {
        return responseJSON({ success: false, message: "ID de material no especificado." });
      }

      const sMat = ss.getSheetByName(SHEET_MATERIALES);
      if (!sMat) {
        return responseJSON({ success: false, message: "Hoja MATERIALES no encontrada." });
      }

      const famId = (body.material && body.material.familyId) || (body.updates && body.updates.familyId) || "";
      const sigType = (body.material && body.material.signalType) || (body.updates && body.updates.signalType) || "";
      const colMap = getMaterialColumnMapping(sMat);
      const matchingRows = findMatchingMaterialRows(sMat, materialId, famId, sigType);

      let primaryRow = matchingRows.length > 0 ? matchingRows[0] : -1;

      if (primaryRow <= 0) {
        if (body.material) {
          const newRowData = materialToRowArray(body.material, colMap);
          sMat.appendRow(newRowData);
          const newRow = sMat.getLastRow();
          sMat.getRange(newRow, colMap.duration + 1).setNumberFormat("@").setValue(String(body.material.duration || "00:00:00"));
          return responseJSON({ success: true, message: "Material registrado en Sheets.", row: newRow });
        }
        return responseJSON({ success: false, message: "Material con ID '" + materialId + "' no encontrado en Google Sheets." });
      }

      if (body.material) {
        const rowArr = materialToRowArray(body.material, colMap);
        sMat.getRange(primaryRow, 1, 1, rowArr.length).setValues([rowArr]);
        sMat.getRange(primaryRow, colMap.duration + 1).setNumberFormat("@").setValue(String(body.material.duration || "00:00:00"));
      } else if (body.updates) {
        const u = body.updates;
        const isDiscarding = u.status === "Descartado" || u.isDiscarded === true;

        if (u.familyId !== undefined && colMap.familyId !== undefined) sMat.getRange(primaryRow, colMap.familyId + 1).setValue(u.familyId);
        if (u.title !== undefined && colMap.title !== undefined) sMat.getRange(primaryRow, colMap.title + 1).setValue(u.title);
        if (u.signalType !== undefined && colMap.signalType !== undefined) sMat.getRange(primaryRow, colMap.signalType + 1).setValue(u.signalType);
        if (u.division !== undefined && colMap.division !== undefined) sMat.getRange(primaryRow, colMap.division + 1).setValue(u.division);
        if (u.duration !== undefined && colMap.duration !== undefined) {
          sMat.getRange(primaryRow, colMap.duration + 1).setNumberFormat("@").setValue(formatDurationString(u.duration));
        }
        if (u.creationDate !== undefined && colMap.creationDate !== undefined) sMat.getRange(primaryRow, colMap.creationDate + 1).setValue(u.creationDate);
        if (u.createdBy !== undefined && colMap.createdBy !== undefined) sMat.getRange(primaryRow, colMap.createdBy + 1).setValue(u.createdBy);
        if ((u.creatorRole !== undefined || u.createdByRole !== undefined) && colMap.creatorRole !== undefined) {
          sMat.getRange(primaryRow, colMap.creatorRole + 1).setValue(u.creatorRole || u.createdByRole || "");
        }
        if (u.status !== undefined && colMap.status !== undefined) sMat.getRange(primaryRow, colMap.status + 1).setValue(isDiscarding ? "Descartado" : u.status);
        if (u.isRequestTask !== undefined && colMap.isRequestTask !== undefined) sMat.getRange(primaryRow, colMap.isRequestTask + 1).setValue(u.isRequestTask ? "SI" : "NO");
        if (u.assignedTo !== undefined && colMap.assignedTo !== undefined) sMat.getRange(primaryRow, colMap.assignedTo + 1).setValue(u.assignedTo || "Sin asignar");
        if (u.assignedToRole !== undefined && colMap.assignedToRole !== undefined) sMat.getRange(primaryRow, colMap.assignedToRole + 1).setValue(u.assignedToRole || "");
        if (u.assignedAt !== undefined && colMap.assignedAt !== undefined) sMat.getRange(primaryRow, colMap.assignedAt + 1).setValue(u.assignedAt || "");
        if (u.isIngested !== undefined && colMap.isIngested !== undefined) sMat.getRange(primaryRow, colMap.isIngested + 1).setValue(u.isIngested ? "SI" : "NO");
        if (u.ingestedBy !== undefined && colMap.ingestedBy !== undefined) sMat.getRange(primaryRow, colMap.ingestedBy + 1).setValue(u.ingestedBy || "");

        if (isDiscarding) {
          if (colMap.status !== undefined) sMat.getRange(primaryRow, colMap.status + 1).setValue("Descartado");
          if (colMap.isCataloged !== undefined) sMat.getRange(primaryRow, colMap.isCataloged + 1).setValue("NO");
          if (colMap.catalogedBy !== undefined) sMat.getRange(primaryRow, colMap.catalogedBy + 1).setValue("N/A");
          if (colMap.catalogedAt !== undefined) sMat.getRange(primaryRow, colMap.catalogedAt + 1).setValue("N/A");
          if (colMap.isFinalized !== undefined) sMat.getRange(primaryRow, colMap.isFinalized + 1).setValue("NO");
          if (colMap.finalizedBy !== undefined) sMat.getRange(primaryRow, colMap.finalizedBy + 1).setValue("N/A");
          if (colMap.finalizedAt !== undefined) sMat.getRange(primaryRow, colMap.finalizedAt + 1).setValue("N/A");
        } else {
          if (u.isCataloged !== undefined && colMap.isCataloged !== undefined) sMat.getRange(primaryRow, colMap.isCataloged + 1).setValue(u.isCataloged ? "SI" : "NO");
          if (u.catalogedBy !== undefined && colMap.catalogedBy !== undefined) sMat.getRange(primaryRow, colMap.catalogedBy + 1).setValue(u.catalogedBy || "N/A");
          if (u.catalogedAt !== undefined && colMap.catalogedAt !== undefined) sMat.getRange(primaryRow, colMap.catalogedAt + 1).setValue(u.catalogedAt || "N/A");
          if (u.isFinalized !== undefined && colMap.isFinalized !== undefined) sMat.getRange(primaryRow, colMap.isFinalized + 1).setValue(u.isFinalized ? "SI" : "NO");
          if (u.finalizedBy !== undefined && colMap.finalizedBy !== undefined) sMat.getRange(primaryRow, colMap.finalizedBy + 1).setValue(u.finalizedBy || "N/A");
          if (u.finalizedAt !== undefined && colMap.finalizedAt !== undefined) sMat.getRange(primaryRow, colMap.finalizedAt + 1).setValue(u.finalizedAt || "N/A");
        }
        if (u.notes !== undefined && colMap.notes !== undefined) sMat.getRange(primaryRow, colMap.notes + 1).setValue(u.notes || "");
      }

      if (matchingRows.length > 1) {
        for (let m = matchingRows.length - 1; m >= 1; m--) {
          sMat.deleteRow(matchingRows[m]);
        }
      }

      return responseJSON({
        success: true,
        message: "Tarjeta de material '" + materialId + "' actualizada exitosamente en Google Sheets" + (matchingRows.length > 1 ? " (se depuraron " + (matchingRows.length - 1) + " fila(s) duplicada(s))." : "."),
        rowIndex: primaryRow
      });
    }

    // Acción para Depurar Duplicados en Sheets y Reparar Formato de Duración
    if (action === "cleanAndDeduplicateSheet") {
      const res = cleanAndDeduplicateSheetInternal();
      return responseJSON(res);
    }

    // C. Modificar en Lote toda una Familia de Materiales
    if (action === "batchUpdateFamily") {
      const familyId = body.familyId;
      if (!familyId) return responseJSON({ success: false, message: "familyId no especificado." });

      const sMat = ss.getSheetByName(SHEET_MATERIALES);
      if (!sMat || sMat.getLastRow() <= 1) return responseJSON({ success: true, count: 0 });

      const colMap = getMaterialColumnMapping(sMat);
      const numRows = sMat.getLastRow() - 1;
      const famValues = sMat.getRange(2, colMap.familyId + 1, numRows, 1).getValues();
      const idValues = sMat.getRange(2, colMap.id + 1, numRows, 1).getValues();
      const searchFam = String(familyId).trim().toLowerCase();
      const u = body.updates || {};
      let updatedCount = 0;

      let assignedStr = u.assignedTo;
      if (u.assignedPersons && Array.isArray(u.assignedPersons)) {
        assignedStr = u.assignedPersons.length > 0 ? u.assignedPersons.join(", ") : "Sin asignar";
      }

      for (let i = 0; i < numRows; i++) {
        const rowFam = String(famValues[i][0]).trim().toLowerCase();
        const rowId = String(idValues[i][0]).trim().toLowerCase();
        if (rowFam === searchFam || rowId === searchFam) {
          const r = i + 2;
          const isDiscarding = u.status === "Descartado" || u.isDiscarded === true;

          if (isDiscarding) {
            if (colMap.status !== undefined) sMat.getRange(r, colMap.status + 1).setValue("Descartado");
            if (colMap.isCataloged !== undefined) sMat.getRange(r, colMap.isCataloged + 1).setValue("NO");
            if (colMap.catalogedBy !== undefined) sMat.getRange(r, colMap.catalogedBy + 1).setValue("N/A");
            if (colMap.catalogedAt !== undefined) sMat.getRange(r, colMap.catalogedAt + 1).setValue("N/A");
            if (colMap.isFinalized !== undefined) sMat.getRange(r, colMap.isFinalized + 1).setValue("NO");
            if (colMap.finalizedBy !== undefined) sMat.getRange(r, colMap.finalizedBy + 1).setValue("N/A");
            if (colMap.finalizedAt !== undefined) sMat.getRange(r, colMap.finalizedAt + 1).setValue("N/A");
          } else {
            if (u.title !== undefined && colMap.title !== undefined) sMat.getRange(r, colMap.title + 1).setValue(u.title);
            if (u.division !== undefined && colMap.division !== undefined) sMat.getRange(r, colMap.division + 1).setValue(u.division);
            if (u.notes !== undefined && colMap.notes !== undefined) sMat.getRange(r, colMap.notes + 1).setValue(u.notes);
            if (u.status !== undefined && colMap.status !== undefined) sMat.getRange(r, colMap.status + 1).setValue(u.status);
            if (u.isIngested !== undefined && colMap.isIngested !== undefined) sMat.getRange(r, colMap.isIngested + 1).setValue(u.isIngested ? "SI" : "NO");
            if (u.ingestedBy !== undefined && colMap.ingestedBy !== undefined) sMat.getRange(r, colMap.ingestedBy + 1).setValue(u.ingestedBy || "");
            if (u.isCataloged !== undefined && colMap.isCataloged !== undefined) sMat.getRange(r, colMap.isCataloged + 1).setValue(u.isCataloged ? "SI" : "NO");
            if (u.catalogedBy !== undefined && colMap.catalogedBy !== undefined) sMat.getRange(r, colMap.catalogedBy + 1).setValue(u.catalogedBy || "N/A");
            if (u.catalogedAt !== undefined && colMap.catalogedAt !== undefined) sMat.getRange(r, colMap.catalogedAt + 1).setValue(u.catalogedAt || "N/A");
            if (u.isFinalized !== undefined && colMap.isFinalized !== undefined) sMat.getRange(r, colMap.isFinalized + 1).setValue(u.isFinalized ? "SI" : "NO");
            if (u.finalizedBy !== undefined && colMap.finalizedBy !== undefined) sMat.getRange(r, colMap.finalizedBy + 1).setValue(u.finalizedBy || "N/A");
            if (u.finalizedAt !== undefined && colMap.finalizedAt !== undefined) sMat.getRange(r, colMap.finalizedAt + 1).setValue(u.finalizedAt || "N/A");
            if (assignedStr !== undefined && colMap.assignedTo !== undefined) sMat.getRange(r, colMap.assignedTo + 1).setValue(assignedStr || "Sin asignar");
            if (u.assignedToRole !== undefined && colMap.assignedToRole !== undefined) sMat.getRange(r, colMap.assignedToRole + 1).setValue(u.assignedToRole || "");
            if (u.assignedAt !== undefined && colMap.assignedAt !== undefined) sMat.getRange(r, colMap.assignedAt + 1).setValue(u.assignedAt || "");
          }
          updatedCount++;
        }
      }

      return responseJSON({
        success: true,
        message: "Familia '" + familyId + "' actualizada en Sheets (" + updatedCount + " señales).",
        updatedCount: updatedCount
      });
    }

    // D. Eliminar una Señal / Material por ID
    if (action === "deleteMaterial") {
      const materialId = body.id;
      if (!materialId) return responseJSON({ success: false, message: "ID de material no especificado." });

      const sMat = ss.getSheetByName(SHEET_MATERIALES);
      if (!sMat || sMat.getLastRow() <= 1) {
        return responseJSON({ success: true, message: "Hoja de materiales vacía." });
      }

      const matchingRows = findMatchingMaterialRows(sMat, materialId);
      if (matchingRows.length > 0) {
        for (let d = matchingRows.length - 1; d >= 0; d--) {
          sMat.deleteRow(matchingRows[d]);
        }
        return responseJSON({
          success: true,
          message: "Material '" + materialId + "' eliminado de Google Sheets (" + matchingRows.length + " fila(s)).",
          deletedCount: matchingRows.length
        });
      }

      const colMap = getMaterialColumnMapping(sMat);
      const rowIndex = findRowIndexById(sMat, colMap.id + 1, materialId);
      if (rowIndex > 0) {
        sMat.deleteRow(rowIndex);
        return responseJSON({ success: true, message: "Material '" + materialId + "' eliminado de Google Sheets." });
      }

      return responseJSON({ success: true, message: "El material no existía en Sheets." });
    }

    // E. Depuración Mensual: Eliminar lista de IDs finalizados y registrar Cierre Mensual
    if (action === "purgeFinalizedMaterials") {
      const signalIds = body.signalIds || [];
      const monthlyLog = body.monthlyLog;
      const sMat = ss.getSheetByName(SHEET_MATERIALES);
      let deletedCount = 0;

      if (sMat && sMat.getLastRow() > 1 && signalIds.length > 0) {
        const colMap = getMaterialColumnMapping(sMat);
        const idSet = {};
        signalIds.forEach(function(id) { idSet[String(id).trim().toLowerCase()] = true; });

        for (let r = sMat.getLastRow(); r >= 2; r--) {
          const val = String(sMat.getRange(r, colMap.id + 1).getValue()).trim().toLowerCase();
          if (idSet[val]) {
            sMat.deleteRow(r);
            deletedCount++;
          }
        }
      }

      if (monthlyLog) {
        const sArch = ss.getSheetByName(SHEET_CIERRES);
        if (sArch) {
          sArch.appendRow([
            monthlyLog.id || ("MAR-" + Date.now()),
            monthlyLog.monthPeriod || "",
            monthlyLog.exportDate || "",
            monthlyLog.exportedBy || "",
            monthlyLog.exporterRole || "",
            monthlyLog.materialsCount || 0,
            monthlyLog.formattedDuration || "00:00:00",
            monthlyLog.totalDurationSeconds || 0
          ]);
        }
      }

      return responseJSON({
        success: true,
        deletedCount: deletedCount,
        message: "Depuración completada en Sheets: " + deletedCount + " materiales eliminados e historial guardado."
      });
    }

    // ==========================================
    // 2. OPERACIONES ATÓMICAS EN PERSONAL
    // ==========================================
    if (action === "savePersonnel" || action === "createPersonnel") {
      const person = body.personnel || body.person;
      if (!person || !person.id) return responseJSON({ success: false, message: "Datos de personal no válidos." });

      const sPer = ss.getSheetByName(SHEET_PERSONAL);
      const rowIndex = findRowIndexById(sPer, 1, person.id);
      const rowData = personnelToRowArray(person);

      if (rowIndex > 0) {
        sPer.getRange(rowIndex, 1, 1, PERSONNEL_HEADERS.length).setValues([rowData]);
        sPer.getRange(rowIndex, 5, 1, 4).setNumberFormat("0");
        sPer.getRange(rowIndex, 9).setNumberFormat("@");
        return responseJSON({ success: true, message: "Personal '" + person.name + "' actualizado en Sheets." });
      } else {
        sPer.appendRow(rowData);
        const lastRow = sPer.getLastRow();
        sPer.getRange(lastRow, 5, 1, 4).setNumberFormat("0");
        sPer.getRange(lastRow, 9).setNumberFormat("@");
        return responseJSON({ success: true, message: "Personal '" + person.name + "' registrado en Sheets." });
      }
    }

    if (action === "updatePersonnel") {
      const personId = body.id || (body.person && body.person.id);
      if (!personId) return responseJSON({ success: false, message: "ID de personal no especificado." });

      const sPer = ss.getSheetByName(SHEET_PERSONAL);
      let rowIndex = findRowIndexById(sPer, 1, personId);
      if (rowIndex <= 0 && body.name) {
        rowIndex = findRowIndexById(sPer, 2, body.name);
      }

      if (rowIndex > 0) {
        if (body.person) {
          sPer.getRange(rowIndex, 1, 1, PERSONNEL_HEADERS.length).setValues([personnelToRowArray(body.person)]);
          sPer.getRange(rowIndex, 5, 1, 4).setNumberFormat("0");
          sPer.getRange(rowIndex, 9).setNumberFormat("@");
        } else if (body.updates) {
          const u = body.updates;
          if (u.name !== undefined) sPer.getRange(rowIndex, 2).setValue(u.name);
          if (u.role !== undefined) sPer.getRange(rowIndex, 3).setValue(u.role);
          if (u.division !== undefined) sPer.getRange(rowIndex, 4).setValue(u.division);
          if (u.guardDaysWorked !== undefined) sPer.getRange(rowIndex, 5).setNumberFormat("0").setValue(Number(u.guardDaysWorked) || 0);
          if (u.daysOffGenerated !== undefined) sPer.getRange(rowIndex, 6).setNumberFormat("0").setValue(Number(u.daysOffGenerated) || 0);
          if (u.daysOffTaken !== undefined) sPer.getRange(rowIndex, 7).setNumberFormat("0").setValue(Number(u.daysOffTaken) || 0);
          if (u.balanceDays !== undefined) sPer.getRange(rowIndex, 8).setNumberFormat("0").setValue(Number(u.balanceDays) || 0);
          if (u.pin !== undefined) sPer.getRange(rowIndex, 9).setNumberFormat("@").setValue(u.pin || "");
        }
        return responseJSON({ success: true, message: "Personal '" + personId + "' actualizado en Sheets." });
      }

      return responseJSON({ success: false, message: "Personal no encontrado en Sheets." });
    }

    if (action === "deletePersonnel") {
      const personId = body.id;
      const sPer = ss.getSheetByName(SHEET_PERSONAL);
      const rowIndex = findRowIndexById(sPer, 1, personId);
      if (rowIndex > 0) {
        sPer.deleteRow(rowIndex);
        return responseJSON({ success: true, message: "Personal eliminado de Sheets." });
      }
      return responseJSON({ success: true, message: "Personal no existía en Sheets." });
    }

    // ==========================================
    // 3. OPERACIONES ATÓMICAS EN GUARDIAS
    // ==========================================
    if (action === "saveGuardShifts" || action === "createGuardShift" || action === "saveBatchGuardShifts") {
      const shifts = body.shifts || (body.shift ? [body.shift] : []);
      const replaceTargetDate = body.replaceTargetDate;
      const sShifts = ss.getSheetByName(SHEET_GUARDIAS);

      if (replaceTargetDate && sShifts.getLastRow() > 1) {
        const cleanTarget = String(replaceTargetDate).trim().toLowerCase();
        for (let r = sShifts.getLastRow(); r >= 2; r--) {
          const rowDate = String(sShifts.getRange(r, 4).getValue()).trim().toLowerCase();
          const rowType = String(sShifts.getRange(r, 6).getValue());
          if (rowDate === cleanTarget && rowType.indexOf("Guardia") >= 0) {
            sShifts.deleteRow(r);
          }
        }
      }

      shifts.forEach(function(s) {
        if (!s || !s.id) return;
        const rowIndex = findRowIndexById(sShifts, 1, s.id);
        const rowData = guardShiftToRowArray(s);
        if (rowIndex > 0) {
          sShifts.getRange(rowIndex, 1, 1, SHIFTS_HEADERS.length).setValues([rowData]);
        } else {
          sShifts.appendRow(rowData);
        }
      });

      return responseJSON({
        success: true,
        message: "Guardias guardadas exitosamente en Sheets (" + shifts.length + " turnos)."
      });
    }

    if (action === "deleteGuardShift") {
      const shiftId = body.id;
      const sShifts = ss.getSheetByName(SHEET_GUARDIAS);
      const rowIndex = findRowIndexById(sShifts, 1, shiftId);
      if (rowIndex > 0) {
        sShifts.deleteRow(rowIndex);
        return responseJSON({ success: true, message: "Turno de guardia eliminado de Sheets." });
      }
      return responseJSON({ success: true, message: "Turno no existía en Sheets." });
    }

    if (action === "clearAllGuardShifts") {
      const sShifts = ss.getSheetByName(SHEET_GUARDIAS);
      if (sShifts) {
        sShifts.clear();
        sShifts.appendRow(SHIFTS_HEADERS);
        formatHeaderRow(sShifts, SHIFTS_HEADERS.length, "#0f172a", "#10b981");
        sShifts.setFrozenRows(1);
      }
      return responseJSON({ success: true, message: "Todas las guardias han sido eliminadas de Sheets." });
    }

    // ==========================================
    // 4. HISTORIAL Y CIERRES MENSUALES
    // ==========================================
    if (action === "saveMonthlyArchive") {
      const a = body.archive || body.monthlyLog;
      if (a) {
        const sArch = ss.getSheetByName(SHEET_CIERRES);
        if (sArch) {
          sArch.appendRow([
            a.id || ("MAR-" + Date.now()),
            a.monthPeriod || "",
            a.exportDate || "",
            a.exportedBy || "",
            a.exporterRole || "",
            a.materialsCount || 0,
            a.formattedDuration || "00:00:00",
            a.totalDurationSeconds || 0
          ]);
        }
      }
      return responseJSON({ success: true, message: "Cierre mensual registrado en Sheets." });
    }

    if (action === "clearMonthlyArchives") {
      const sArch = ss.getSheetByName(SHEET_CIERRES);
      if (sArch) {
        sArch.clear();
        sArch.appendRow(ARCHIVE_HEADERS);
        formatHeaderRow(sArch, ARCHIVE_HEADERS.length, "#0f172a", "#f59e0b");
        sArch.setFrozenRows(1);
      }
      return responseJSON({ success: true, message: "Historial de cierres limpiado en Sheets." });
    }

    // ==========================================
    // 5. SINCRONIZACIÓN COMPLETA (FALLBACK MASTER)
    // ==========================================
    if (action === "syncAllData" || action === "sync" || action === "saveAll") {
      const materials = body.materials || [];
      const personnel = body.personnel || [];
      const guardShifts = body.guardShifts || [];
      const monthlyArchives = body.monthlyArchives || [];

      // A. Materiales
      let sMat = ss.getSheetByName(SHEET_MATERIALES);
      if (!sMat) sMat = ss.insertSheet(SHEET_MATERIALES);
      sMat.clear();
      sMat.appendRow(MATERIAL_HEADERS);
      formatHeaderRow(sMat, MATERIAL_HEADERS.length, "#0f172a", "#38bdf8");
      sMat.setFrozenRows(1);

      if (materials.length > 0) {
        const rowsMat = materials.map(function(m) { return materialToRowArray(m); });
        sMat.getRange(2, 1, rowsMat.length, MATERIAL_HEADERS.length).setValues(rowsMat);
        sMat.getRange(2, 6, rowsMat.length, 1).setNumberFormat("@");
      }

      // B. Personal
      let sPer = ss.getSheetByName(SHEET_PERSONAL);
      if (!sPer) sPer = ss.insertSheet(SHEET_PERSONAL);
      sPer.clear();
      sPer.appendRow(PERSONNEL_HEADERS);
      formatHeaderRow(sPer, PERSONNEL_HEADERS.length, "#0f172a", "#a855f7");
      sPer.setFrozenRows(1);

      if (personnel.length > 0) {
        const rowsPer = personnel.map(function(p) { return personnelToRowArray(p); });
        sPer.getRange(2, 1, rowsPer.length, PERSONNEL_HEADERS.length).setValues(rowsPer);
        sPer.getRange(2, 5, rowsPer.length, 4).setNumberFormat("0");
        sPer.getRange(2, 9, rowsPer.length, 1).setNumberFormat("@");
      }

      // C. Guardias
      let sShifts = ss.getSheetByName(SHEET_GUARDIAS);
      if (!sShifts) sShifts = ss.insertSheet(SHEET_GUARDIAS);
      sShifts.clear();
      sShifts.appendRow(SHIFTS_HEADERS);
      formatHeaderRow(sShifts, SHIFTS_HEADERS.length, "#0f172a", "#10b981");
      sShifts.setFrozenRows(1);

      if (guardShifts.length > 0) {
        const rowsShifts = guardShifts.map(function(s) { return guardShiftToRowArray(s); });
        sShifts.getRange(2, 1, rowsShifts.length, SHIFTS_HEADERS.length).setValues(rowsShifts);
      }

      // D. Cierres
      let sArch = ss.getSheetByName(SHEET_CIERRES);
      if (!sArch) sArch = ss.insertSheet(SHEET_CIERRES);
      sArch.clear();
      sArch.appendRow(ARCHIVE_HEADERS);
      formatHeaderRow(sArch, ARCHIVE_HEADERS.length, "#0f172a", "#f59e0b");
      sArch.setFrozenRows(1);

      if (monthlyArchives.length > 0) {
        const rowsArch = monthlyArchives.map(function(a) {
          return [
            a.id || "",
            a.monthPeriod || "",
            a.exportDate || "",
            a.exportedBy || "",
            a.exporterRole || "",
            a.materialsCount || 0,
            a.formattedDuration || "00:00:00",
            a.totalDurationSeconds || 0
          ];
        });
        sArch.getRange(2, 1, rowsArch.length, ARCHIVE_HEADERS.length).setValues(rowsArch);
      }

      return responseJSON({
        success: true,
        message: "Base de datos sincronizada exitosamente en Sheets (" + materials.length + " materiales, " + personnel.length + " personal).",
        counts: {
          materials: materials.length,
          personnel: personnel.length,
          guardShifts: guardShifts.length
        }
      });
    }

    // ==========================================
    // 6. CREAR HOJA DE RESPALDO DIARIO EN DRIVE
    // ==========================================
    if (action === "createDailyBackupSheet") {
      const dateStr = body.date || body.formattedDate || Utilities.formatDate(new Date(), "GMT-4", "dd-MM-yyyy");
      const cleanDate = dateStr.replace(/[\\/]/g, "-");
      const sheetName = "Diario_" + cleanDate;
      const materials = body.materials || [];
      const user = body.user || "Operador VTV";

      let sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        const timeStamp = Utilities.formatDate(new Date(), "GMT-4", "_HHmm");
        sheet = ss.insertSheet(sheetName + timeStamp);
      } else {
        sheet = ss.insertSheet(sheetName);
      }

      sheet.getRange("A1:W1").merge().setValue("VENEZOLANA DE TELEVISIÓN (VTV) • RESPALDO DIARIO DE ARCHIVO AUDIOVISUAL")
        .setFontWeight("bold").setFontSize(13).setBackground("#0f172a").setFontColor("#38bdf8").setHorizontalAlignment("center");
      
      sheet.getRange("A2:K2").merge().setValue("FECHA DEL RESPALDO: " + dateStr + " | TOTAL TAREAS/MATERIALES: " + materials.length)
        .setFontWeight("bold").setFontSize(10).setBackground("#1e293b").setFontColor("#ffffff");
      sheet.getRange("L2:W2").merge().setValue("GENERADO POR: " + user + " | FECHA GENERACIÓN: " + Utilities.formatDate(new Date(), "GMT-4", "dd/MM/yyyy HH:mm:ss"))
        .setFontWeight("bold").setFontSize(10).setBackground("#1e293b").setFontColor("#94a3b8").setHorizontalAlignment("right");

      sheet.getRange(4, 1, 1, MATERIAL_HEADERS.length).setValues([MATERIAL_HEADERS])
        .setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff").setHorizontalAlignment("center");

      if (materials.length > 0) {
        const rows = materials.map(function(m) { return materialToRowArray(m); });
        sheet.getRange(5, 1, rows.length, MATERIAL_HEADERS.length).setValues(rows);
        sheet.getRange(5, 6, rows.length, 1).setNumberFormat("@");
        sheet.getRange(4, 1, rows.length + 1, MATERIAL_HEADERS.length).setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
      }

      return responseJSON({
        success: true,
        sheetName: sheet.getName(),
        rowCount: materials.length,
        message: "Hoja '" + sheet.getName() + "' creada exitosamente en Google Drive con " + materials.length + " tareas/materiales."
      });
    }

    // ==========================================
    // 7. CREAR HOJA DE RESPALDO MENSUAL EN DRIVE
    // ==========================================
    if (action === "createMonthlyBackupSheet") {
      const monthPeriod = body.monthPeriod || Utilities.formatDate(new Date(), "GMT-4", "yyyy-MM");
      const cleanMonth = monthPeriod.replace(/[\\/\s]/g, "_");
      const sheetName = "Mensual_" + cleanMonth;
      const materials = body.materials || [];
      const summary = body.summary || {};
      const user = body.user || "Gerencia de Archivo";

      let sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        const timeStamp = Utilities.formatDate(new Date(), "GMT-4", "_HHmm");
        sheet = ss.insertSheet(sheetName + timeStamp);
      } else {
        sheet = ss.insertSheet(sheetName);
      }

      sheet.getRange("A1:W1").merge().setValue("VENEZOLANA DE TELEVISIÓN (VTV) • RESPALDO MENSUAL DE ARCHIVO AUDIOVISUAL")
        .setFontWeight("bold").setFontSize(13).setBackground("#0f172a").setFontColor("#10b981").setHorizontalAlignment("center");

      sheet.getRange("A2:F2").merge().setValue("PERÍODO: " + monthPeriod + " | GENERADO POR: " + user)
        .setFontWeight("bold").setFontSize(10).setBackground("#1e293b").setFontColor("#ffffff");
      sheet.getRange("G2:W2").merge().setValue("FECHA GENERACIÓN: " + Utilities.formatDate(new Date(), "GMT-4", "dd/MM/yyyy HH:mm:ss"))
        .setFontWeight("bold").setFontSize(10).setBackground("#1e293b").setFontColor("#94a3b8").setHorizontalAlignment("right");

      sheet.getRange("A3:C3").merge().setValue("Total Materiales: " + (summary.totalCount || materials.length))
        .setFontWeight("bold").setBackground("#064e3b").setFontColor("#6ee7b7");
      sheet.getRange("D3:F3").merge().setValue("Duración Total: " + (summary.formattedDuration || "00:00:00"))
        .setFontWeight("bold").setBackground("#064e3b").setFontColor("#6ee7b7");
      sheet.getRange("G3:W3").merge().setValue("Prensa: " + (summary.prensaCount || 0) + " | Programación: " + (summary.programacionCount || 0) + " | Ingesta: " + (summary.ingestaCount || 0) + " | Finalizados: " + (summary.finalizedCount || 0))
        .setFontWeight("bold").setBackground("#134e4a").setFontColor("#ffffff");

      sheet.getRange(5, 1, 1, MATERIAL_HEADERS.length).setValues([MATERIAL_HEADERS])
        .setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff").setHorizontalAlignment("center");

      if (materials.length > 0) {
        const rows = materials.map(function(m) { return materialToRowArray(m); });
        sheet.getRange(6, 1, rows.length, MATERIAL_HEADERS.length).setValues(rows);
        sheet.getRange(6, 6, rows.length, 1).setNumberFormat("@");
        sheet.getRange(5, 1, rows.length + 1, MATERIAL_HEADERS.length).setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
      }

      return responseJSON({
        success: true,
        sheetName: sheet.getName(),
        rowCount: materials.length,
        message: "Hoja mensual '" + sheet.getName() + "' creada exitosamente en Google Drive."
      });
    }

    return responseJSON({ success: false, message: "Acción POST no reconocida: " + action });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

function cleanAndDeduplicateSheetInternal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sMat = ss.getSheetByName(SHEET_MATERIALES);
  if (!sMat || sMat.getLastRow() <= 1) {
    return { success: true, message: "Hoja de materiales vacía o sin duplicados.", deletedCount: 0 };
  }

  const colMap = getMaterialColumnMapping(sMat);
  const numRows = sMat.getLastRow() - 1;
  const maxCol = Math.max(sMat.getLastColumn(), MATERIAL_HEADERS.length);
  const values = sMat.getRange(2, 1, numRows, maxCol).getValues();
  const displayValues = sMat.getRange(2, 1, numRows, maxCol).getDisplayValues();
  const seenMap = {};
  const rowsToDelete = [];
  let deletedCount = 0;
  let fixedDurationCount = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const dispRow = displayValues[i] || [];
    const rowIdx = i + 2;
    const idVal = String(row[colMap.id] || "").trim().toLowerCase();
    const famVal = String(row[colMap.familyId] || "").trim().toLowerCase();
    const sigVal = String(row[colMap.signalType] || "").trim().toLowerCase();
    
    // Strict priority: familyId + signalType uniquely identifies a signal inside a family card
    const key = (famVal && sigVal) ? (famVal + "___" + sigVal) : idVal;

    if (!key) continue;

    if (seenMap[key] === undefined) {
      seenMap[key] = rowIdx;
      const currentDurRaw = (dispRow[colMap.duration] !== undefined ? dispRow[colMap.duration] : row[colMap.duration]);
      const cleanDur = formatDurationString(currentDurRaw);
      sMat.getRange(rowIdx, colMap.duration + 1).setNumberFormat("@").setValue(String(cleanDur));
      if (String(currentDurRaw) !== cleanDur) {
        fixedDurationCount++;
      }
    } else {
      rowsToDelete.push(rowIdx);
    }
  }

  for (let d = rowsToDelete.length - 1; d >= 0; d--) {
    sMat.deleteRow(rowsToDelete[d]);
    deletedCount++;
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    deletedCount: deletedCount,
    fixedDurationCount: fixedDurationCount,
    message: "Depuración completada en Sheets: se eliminaron " + deletedCount + " fila(s) duplicada(s) y se normalizaron las duraciones."
  };
}

function formatDateString(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "GMT-4", "dd/MM/yyyy HH:mm");
  }
  return String(val).trim();
}

function formatDurationString(val) {
  if (val === null || val === undefined || val === "") return "00:00:00";
  var pad = function(n) { return (n < 10 ? "0" : "") + n; };
  if (val instanceof Date) {
    var ssTz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || "GMT-4";
    var timeStr = Utilities.formatDate(val, ssTz, "HH:mm:ss");
    var parts = timeStr.split(":");
    var h = parseInt(parts[0], 10) || 0;
    var m = parseInt(parts[1], 10) || 0;
    var s = parseInt(parts[2], 10) || 0;
    if (h >= 19 && h <= 23) {
      h = (h + 4) % 24;
    }
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }
  if (typeof val === "number") {
    if (val > 0 && val < 1) {
      var totalSecs = Math.round(val * 86400);
      var h = Math.floor(totalSecs / 3600);
      var m = Math.floor((totalSecs % 3600) / 60);
      var s = totalSecs % 60;
      if (h >= 19 && h <= 23) {
        h = (h + 4) % 24;
      }
      return pad(h) + ":" + pad(m) + ":" + pad(s);
    }
    if (val >= 1 && val <= 86400 * 30) {
      var totalSecs = Math.floor(val);
      var h = Math.floor(totalSecs / 3600);
      var m = Math.floor((totalSecs % 3600) / 60);
      var s = totalSecs % 60;
      if (h >= 19 && h <= 23) {
        h = (h + 4) % 24;
      }
      return pad(h) + ":" + pad(m) + ":" + pad(s);
    }
  }
  var str = String(val).trim();
  var match = str.match(/(?:[T\s]|^)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match && (str.indexOf('-') !== -1 || str.indexOf('/') !== -1 || str.toLowerCase().indexOf('t') !== -1 || str.toLowerCase().indexOf('gmt') !== -1)) {
    var h = parseInt(match[1], 10) || 0;
    var m = parseInt(match[2], 10) || 0;
    var s = parseInt(match[3], 10) || 0;
    if (h >= 19 && h <= 23) {
      h = (h + 4) % 24;
    }
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }
  var parts = str.split(':');
  if (parts.length === 3) {
    var h = parseInt(parts[0], 10) || 0;
    var m = parseInt(parts[1], 10) || 0;
    var s = parseInt(parts[2], 10) || 0;
    if (h >= 19 && h <= 23) {
      h = (h + 4) % 24;
    }
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  } else if (parts.length === 2) {
    var m = parseInt(parts[0], 10) || 0;
    var s = parseInt(parts[1], 10) || 0;
    return "00:" + pad(m) + ":" + pad(s);
  }
  return str || "00:00:00";
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
