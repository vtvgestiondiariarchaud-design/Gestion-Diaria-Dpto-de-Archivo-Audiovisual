export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ==============================================================================
 * SISTEMA DE GESTIÓN Y CONTROL DE ARCHIVO AUDIOVISUAL VTV (VENEZOLANA DE TELEVISIÓN)
 * SCRIPT PARA GOOGLE APPS SCRIPT (BASE DE DATOS EN LA NUBE & OPERACIONES ATÓMICAS)
 * ==============================================================================
 * 
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Abra su Hoja de Cálculo en Google Sheets (o cree una nueva en su Google Drive).
 * 2. Vaya a "Extensiones" -> "Apps Script".
 * 3. Borre el contenido existente en "Código.gs" y pegue TODO este código.
 * 4. Haga clic en "Guardar" (ícono de disco o Ctrl+S).
 * 5. Haga clic en el botón azul "Desplegar" -> "Nuevo despliegue" (o "Administrar despliegues" -> Editar -> Nueva versión).
 * 6. Seleccione el tipo: "Aplicación web".
 * 7. En "Ejecutar como": Seleccione "Yo (su correo)".
 * 8. En "Quién tiene acceso": Seleccione "Cualquier persona" (Anyone).
 * 9. Haga clic en "Desplegar", autorice los permisos de Google y copie la Web App URL (terminada en /exec).
 * 10. Pegue la URL en la aplicación de VTV Archivo.
 */

// Nombres de hojas maestras
const SHEET_MATERIALES = "MATERIALES";
const SHEET_PERSONAL = "PERSONAL";
const SHEET_GUARDIAS = "GUARDIAS";
const SHEET_CIERRES = "CIERRES_MENSUALES";

/**
 * Encabezados para la hoja maestra de MATERIALES (22 columnas)
 */
const MATERIAL_HEADERS = [
  "ID Material",
  "ID Familia",
  "Título / Descripción",
  "Tipo de Señal",
  "División",
  "Duración",
  "Fecha Creación",
  "Creado Por",
  "Rol Creador",
  "Estado",
  "Es Solicitud / Tarea",
  "Asignado A",
  "Rol Asignado",
  "Fecha Asignación",
  "Ingestado",
  "Catalogado",
  "Catalogado Por",
  "Fecha Catalogación",
  "Finalizado",
  "Finalizado Por",
  "Fecha Finalizado",
  "Notas / Observaciones"
];

/**
 * Encabezados para la hoja de PERSONAL
 */
const PERSONNEL_HEADERS = [
  "ID",
  "Nombre Completo",
  "Rol / Cargo",
  "División",
  "Guardias Trabajadas",
  "Días Libres Generados",
  "Días Libres Tomados",
  "Balance de Días",
  "PIN"
];

/**
 * Encabezados para la hoja de GUARDIAS
 */
const SHIFTS_HEADERS = [
  "ID",
  "ID Personal",
  "Nombre Personal",
  "Fecha Turno",
  "Fecha Fin",
  "Tipo de Guardia",
  "Notas",
  "Fecha Creación"
];

/**
 * Encabezados para la hoja de CIERRES MENSUALES
 */
const ARCHIVE_HEADERS = [
  "ID Reporte",
  "Período Mensual",
  "Fecha Exportación",
  "Exportado Por",
  "Rol Exportador",
  "Total Materiales",
  "Duración Formateada",
  "Segundos Totales"
];

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Hoja MATERIALES
  let sMat = ss.getSheetByName(SHEET_MATERIALES);
  if (!sMat) {
    sMat = ss.insertSheet(SHEET_MATERIALES);
    sMat.appendRow(MATERIAL_HEADERS);
    sMat.getRange(1, 1, 1, MATERIAL_HEADERS.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#38bdf8");
    sMat.setFrozenRows(1);
  }

  // 2. Hoja PERSONAL
  let sPer = ss.getSheetByName(SHEET_PERSONAL);
  if (!sPer) {
    sPer = ss.insertSheet(SHEET_PERSONAL);
    sPer.appendRow(PERSONNEL_HEADERS);
    sPer.getRange(1, 1, 1, PERSONNEL_HEADERS.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#a855f7");
    sPer.setFrozenRows(1);
  }

  // 3. Hoja GUARDIAS
  let sShifts = ss.getSheetByName(SHEET_GUARDIAS);
  if (!sShifts) {
    sShifts = ss.insertSheet(SHEET_GUARDIAS);
    sShifts.appendRow(SHIFTS_HEADERS);
    sShifts.getRange(1, 1, 1, SHIFTS_HEADERS.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#10b981");
    sShifts.setFrozenRows(1);
  }

  // 4. Hoja CIERRES_MENSUALES
  let sArch = ss.getSheetByName(SHEET_CIERRES);
  if (!sArch) {
    sArch = ss.insertSheet(SHEET_CIERRES);
    sArch.appendRow(ARCHIVE_HEADERS);
    sArch.getRange(1, 1, 1, ARCHIVE_HEADERS.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#f59e0b");
    sArch.setFrozenRows(1);
  }
}

/**
 * Peticiones GET: lectura de la base de datos central en Sheets
 */
function doGet(e) {
  try {
    initSheets();
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "readAllData";
    
    if (action === "ping") {
      return responseJSON({ success: true, message: "Servicio Google Apps Script VTV Archivo activo." });
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
 * Función centralizada para leer toda la base de datos de Sheets
 */
function handleReadAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Leer MATERIALES
  const sMat = ss.getSheetByName(SHEET_MATERIALES);
  const materials = [];
  if (sMat && sMat.getLastRow() > 1) {
    const lastCol = Math.max(sMat.getLastColumn(), MATERIAL_HEADERS.length);
    const headerVals = sMat.getRange(1, 1, 1, lastCol).getValues()[0];
    const colMap = {};
    for (let c = 0; c < headerVals.length; c++) {
      const h = String(headerVals[c] || "").trim().toLowerCase();
      if (h) colMap[h] = c;
    }

    const getCol = function(row, headerName, defaultIdx) {
      const lower = headerName.toLowerCase();
      if (colMap[lower] !== undefined && colMap[lower] < row.length) {
        return row[colMap[lower]];
      }
      return row[defaultIdx];
    };

    const values = sMat.getRange(2, 1, sMat.getLastRow() - 1, lastCol).getValues();
    const validSignalTypes = ["limpio", "insert", "master"];

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const idVal = String(getCol(row, "ID Material", 0) || "").trim();
      let famVal = String(getCol(row, "ID Familia", 1) || idVal || "").trim();
      let titleVal = String(getCol(row, "Título / Descripción", 2) || "").trim();
      let signalVal = String(getCol(row, "Tipo de Señal", 3) || "Limpio").trim();

      if (!idVal && !titleVal && !signalVal) continue;

      // Detect and fix inverted Title <-> SignalType
      const isTitleType = validSignalTypes.indexOf(titleVal.toLowerCase()) !== -1;
      const isSignalType = validSignalTypes.indexOf(signalVal.toLowerCase()) !== -1;

      if (isTitleType && !isSignalType && signalVal) {
        const temp = titleVal;
        titleVal = signalVal;
        signalVal = temp;
      }

      // Normalize signal type capitalization
      const lowerSig = signalVal.toLowerCase();
      if (lowerSig.indexOf("limp") !== -1) signalVal = "Limpio";
      else if (lowerSig.indexOf("ins") !== -1) signalVal = "Insert";
      else if (lowerSig.indexOf("mas") !== -1) signalVal = "Master";
      else signalVal = "Limpio";

      let assignedStr = String(getCol(row, "Asignado A", 11) || "");
      let assignedPersons = [];
      if (assignedStr && assignedStr !== "Sin asignar") {
        assignedPersons = assignedStr.split(",").map(function(s) { return s.trim(); });
      }

      materials.push({
        id: idVal || ("MAT-REC-" + (i + 1)),
        familyId: famVal || idVal,
        title: titleVal || ("Material " + idVal),
        signalType: signalVal,
        division: String(getCol(row, "División", 4) || "Prensa"),
        duration: formatDurationString(getCol(row, "Duración", 5)),
        creationDate: formatDateString(getCol(row, "Fecha Creación", 6)),
        createdBy: String(getCol(row, "Creado Por", 7) || ""),
        creatorRole: String(getCol(row, "Rol Creador", 8) || ""),
        status: String(getCol(row, "Estado", 9) || "Registrado"),
        isRequestTask: String(getCol(row, "Es Solicitud / Tarea", 10)).toUpperCase() === "SI" || getCol(row, "Es Solicitud / Tarea", 10) === true,
        assignedTo: assignedStr && assignedStr !== "Sin asignar" ? assignedStr : undefined,
        assignedPersons: assignedPersons.length > 0 ? assignedPersons : undefined,
        assignedToRole: getCol(row, "Rol Asignado", 12) ? String(getCol(row, "Rol Asignado", 12)) : undefined,
        assignedAt: getCol(row, "Fecha Asignación", 13) ? formatDateString(getCol(row, "Fecha Asignación", 13)) : undefined,
        isIngested: String(getCol(row, "Ingestado", 14)).toUpperCase() === "SI" || getCol(row, "Ingestado", 14) === true,
        isCataloged: String(getCol(row, "Catalogado", 15)).toUpperCase() === "SI" || getCol(row, "Catalogado", 15) === true,
        catalogedBy: getCol(row, "Catalogado Por", 16) && getCol(row, "Catalogado Por", 16) !== "N/A" ? String(getCol(row, "Catalogado Por", 16)) : undefined,
        catalogedAt: getCol(row, "Fecha Catalogación", 17) && getCol(row, "Fecha Catalogación", 17) !== "N/A" ? formatDateString(getCol(row, "Fecha Catalogación", 17)) : undefined,
        isFinalized: String(getCol(row, "Finalizado", 18)).toUpperCase() === "SI" || getCol(row, "Finalizado", 18) === true,
        finalizedBy: getCol(row, "Finalizado Por", 19) && getCol(row, "Finalizado Por", 19) !== "N/A" ? String(getCol(row, "Finalizado Por", 19)) : undefined,
        finalizedAt: getCol(row, "Fecha Finalizado", 20) && getCol(row, "Fecha Finalizado", 20) !== "N/A" ? formatDateString(getCol(row, "Fecha Finalizado", 20)) : undefined,
        notes: getCol(row, "Notas / Observaciones", 21) ? String(getCol(row, "Notas / Observaciones", 21)) : ""
      });
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
        id: String(row[0] || "per-" + (i + 1)),
        name: String(row[1] || "Personal"),
        role: String(row[2] || "Documentalista"),
        division: String(row[3] || "Prensa"),
        guardDaysWorked: Number(row[4]) || 0,
        daysOffGenerated: Number(row[5]) || 0,
        daysOffTaken: Number(row[6]) || 0,
        balanceDays: Number(row[7]) || 0,
        pin: row[8] ? String(row[8]) : undefined
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
        id: String(row[0] || "sh-" + (i + 1)),
        personnelId: String(row[1] || ""),
        personnelName: String(row[2] || ""),
        date: formatDateString(row[3]),
        endDate: row[4] ? formatDateString(row[4]) : undefined,
        shiftType: String(row[5] || "Guardia (Fin de semana/Feriado)"),
        notes: row[6] ? String(row[6]) : undefined,
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
        id: String(row[0]),
        monthPeriod: String(row[1]),
        exportDate: formatDateString(row[2]),
        exportedBy: String(row[3]),
        exporterRole: String(row[4]),
        materialsCount: Number(row[5]) || 0,
        formattedDuration: String(row[6] || "00:00:00"),
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
 * Funciones Auxiliares para Operaciones Atómicas en Sheets
 */
function findRowIndexById(sheet, colIndex, targetId) {
  if (!sheet || sheet.getLastRow() <= 1) return -1;
  const numRows = sheet.getLastRow() - 1;
  const values = sheet.getRange(2, colIndex, numRows, 1).getValues();
  const searchId = String(targetId).trim().toLowerCase();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === searchId) {
      return i + 2; // Índice real de fila (1-based)
    }
  }
  return -1;
}

function materialToRowArray(m) {
  let assignedStr = m.assignedTo || "";
  if (m.assignedPersons && m.assignedPersons.length > 0) {
    assignedStr = m.assignedPersons.join(", ");
  }

  return [
    m.id || "",
    m.familyId || m.id || "",
    m.title || "",
    m.signalType || "Limpio",
    m.division || "Prensa",
    m.duration || "00:00:00",
    m.creationDate || "",
    m.createdBy || "",
    m.creatorRole || m.createdByRole || "",
    m.status || "Registrado",
    (m.isRequestTask === true) ? "SI" : "NO",
    assignedStr || "Sin asignar",
    m.assignedToRole || "",
    m.assignedAt || "",
    (m.isIngested === true) ? "SI" : "NO",
    (m.isCataloged === true) ? "SI" : "NO",
    m.catalogedBy || "N/A",
    m.catalogedAt || "N/A",
    (m.isFinalized === true) ? "SI" : "NO",
    m.finalizedBy || "N/A",
    m.finalizedAt || "N/A",
    m.notes || ""
  ];
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
    // 1. OPERACIONES ATÓMICAS EN MATERIALES
    // ==========================================

    // A. Crear o Guardar un lote de Materiales (Tarjetas Nuevas)
    if (action === "createMaterials" || action === "saveMaterialsBatch") {
      const materials = body.materials || (body.material ? [body.material] : []);
      const sMat = ss.getSheetByName(SHEET_MATERIALES);
      let insertedCount = 0;
      let updatedCount = 0;

      materials.forEach(function(m) {
        if (!m || !m.id) return;
        const rowIndex = findRowIndexById(sMat, 1, m.id);
        const rowData = materialToRowArray(m);
        if (rowIndex > 0) {
          sMat.getRange(rowIndex, 1, 1, MATERIAL_HEADERS.length).setValues([rowData]);
          updatedCount++;
        } else {
          sMat.appendRow(rowData);
          insertedCount++;
        }
      });

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
      const rowIndex = findRowIndexById(sMat, 1, materialId);

      if (rowIndex <= 0) {
        // Si no existe, lo insertamos
        if (body.material) {
          sMat.appendRow(materialToRowArray(body.material));
          return responseJSON({ success: true, message: "Material no existía en Sheets; fue creado.", row: sMat.getLastRow() });
        }
        return responseJSON({ success: false, message: "Material con ID '" + materialId + "' no encontrado en Google Sheets." });
      }

      // Si viene el objeto completo de material, actualizamos la fila entera
      if (body.material) {
        sMat.getRange(rowIndex, 1, 1, MATERIAL_HEADERS.length).setValues([materialToRowArray(body.material)]);
      } else if (body.updates) {
        // Actualizaciones específicas de columnas
        const u = body.updates;
        if (u.title !== undefined) sMat.getRange(rowIndex, 3).setValue(u.title);
        if (u.signalType !== undefined) sMat.getRange(rowIndex, 4).setValue(u.signalType);
        if (u.division !== undefined) sMat.getRange(rowIndex, 5).setValue(u.division);
        if (u.duration !== undefined) sMat.getRange(rowIndex, 6).setValue(u.duration);
        if (u.status !== undefined) sMat.getRange(rowIndex, 10).setValue(u.status);
        if (u.isRequestTask !== undefined) sMat.getRange(rowIndex, 11).setValue(u.isRequestTask ? "SI" : "NO");
        if (u.assignedTo !== undefined) sMat.getRange(rowIndex, 12).setValue(u.assignedTo || "Sin asignar");
        if (u.assignedToRole !== undefined) sMat.getRange(rowIndex, 13).setValue(u.assignedToRole || "");
        if (u.assignedAt !== undefined) sMat.getRange(rowIndex, 14).setValue(u.assignedAt || "");
        if (u.isIngested !== undefined) sMat.getRange(rowIndex, 15).setValue(u.isIngested ? "SI" : "NO");
        if (u.isCataloged !== undefined) sMat.getRange(rowIndex, 16).setValue(u.isCataloged ? "SI" : "NO");
        if (u.catalogedBy !== undefined) sMat.getRange(rowIndex, 17).setValue(u.catalogedBy || "N/A");
        if (u.catalogedAt !== undefined) sMat.getRange(rowIndex, 18).setValue(u.catalogedAt || "N/A");
        if (u.isFinalized !== undefined) sMat.getRange(rowIndex, 19).setValue(u.isFinalized ? "SI" : "NO");
        if (u.finalizedBy !== undefined) sMat.getRange(rowIndex, 20).setValue(u.finalizedBy || "N/A");
        if (u.finalizedAt !== undefined) sMat.getRange(rowIndex, 21).setValue(u.finalizedAt || "N/A");
        if (u.notes !== undefined) sMat.getRange(rowIndex, 22).setValue(u.notes || "");
      }

      return responseJSON({
        success: true,
        message: "Tarjeta de material '" + materialId + "' actualizada exitosamente en Google Sheets.",
        rowIndex: rowIndex
      });
    }

    // C. Modificar en Lote toda una Familia de Materiales
    if (action === "batchUpdateFamily") {
      const familyId = body.familyId;
      if (!familyId) return responseJSON({ success: false, message: "familyId no especificado." });

      const sMat = ss.getSheetByName(SHEET_MATERIALES);
      if (!sMat || sMat.getLastRow() <= 1) return responseJSON({ success: true, count: 0 });

      const numRows = sMat.getLastRow() - 1;
      const famValues = sMat.getRange(2, 2, numRows, 1).getValues();
      const idValues = sMat.getRange(2, 1, numRows, 1).getValues();
      const searchFam = String(familyId).trim().toLowerCase();
      const u = body.updates || {};
      let updatedCount = 0;

      for (let i = 0; i < numRows; i++) {
        const rowFam = String(famValues[i][0]).trim().toLowerCase();
        const rowId = String(idValues[i][0]).trim().toLowerCase();
        if (rowFam === searchFam || rowId === searchFam) {
          const r = i + 2;
          if (u.status !== undefined) sMat.getRange(r, 10).setValue(u.status);
          if (u.isIngested !== undefined) sMat.getRange(r, 15).setValue(u.isIngested ? "SI" : "NO");
          if (u.isCataloged !== undefined) sMat.getRange(r, 16).setValue(u.isCataloged ? "SI" : "NO");
          if (u.catalogedBy !== undefined) sMat.getRange(r, 17).setValue(u.catalogedBy || "N/A");
          if (u.catalogedAt !== undefined) sMat.getRange(r, 18).setValue(u.catalogedAt || "N/A");
          if (u.isFinalized !== undefined) sMat.getRange(r, 19).setValue(u.isFinalized ? "SI" : "NO");
          if (u.finalizedBy !== undefined) sMat.getRange(r, 20).setValue(u.finalizedBy || "N/A");
          if (u.finalizedAt !== undefined) sMat.getRange(r, 21).setValue(u.finalizedAt || "N/A");
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
      const rowIndex = findRowIndexById(sMat, 1, materialId);
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
        const idSet = {};
        signalIds.forEach(function(id) { idSet[String(id).trim().toLowerCase()] = true; });

        // Recorrer de abajo hacia arriba para borrar filas con seguridad
        for (let r = sMat.getLastRow(); r >= 2; r--) {
          const val = String(sMat.getRange(r, 1).getValue()).trim().toLowerCase();
          if (idSet[val]) {
            sMat.deleteRow(r);
            deletedCount++;
          }
        }
      }

      // Registrar en CIERRES_MENSUALES si viene el log
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

    // A. Guardar o Crear Personal
    if (action === "savePersonnel" || action === "createPersonnel") {
      const person = body.personnel || body.person;
      if (!person || !person.id) return responseJSON({ success: false, message: "Datos de personal no válidos." });

      const sPer = ss.getSheetByName(SHEET_PERSONAL);
      const rowIndex = findRowIndexById(sPer, 1, person.id);
      const rowData = personnelToRowArray(person);

      if (rowIndex > 0) {
        sPer.getRange(rowIndex, 1, 1, PERSONNEL_HEADERS.length).setValues([rowData]);
        return responseJSON({ success: true, message: "Personal '" + person.name + "' actualizado en Sheets." });
      } else {
        sPer.appendRow(rowData);
        return responseJSON({ success: true, message: "Personal '" + person.name + "' registrado en Sheets." });
      }
    }

    // B. Actualizar Datos / Balance de Personal
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
        } else if (body.updates) {
          const u = body.updates;
          if (u.name !== undefined) sPer.getRange(rowIndex, 2).setValue(u.name);
          if (u.role !== undefined) sPer.getRange(rowIndex, 3).setValue(u.role);
          if (u.division !== undefined) sPer.getRange(rowIndex, 4).setValue(u.division);
          if (u.guardDaysWorked !== undefined) sPer.getRange(rowIndex, 5).setValue(Number(u.guardDaysWorked) || 0);
          if (u.daysOffGenerated !== undefined) sPer.getRange(rowIndex, 6).setValue(Number(u.daysOffGenerated) || 0);
          if (u.daysOffTaken !== undefined) sPer.getRange(rowIndex, 7).setValue(Number(u.daysOffTaken) || 0);
          if (u.balanceDays !== undefined) sPer.getRange(rowIndex, 8).setValue(Number(u.balanceDays) || 0);
          if (u.pin !== undefined) sPer.getRange(rowIndex, 9).setValue(u.pin || "");
        }
        return responseJSON({ success: true, message: "Personal '" + personId + "' actualizado en Sheets." });
      }

      return responseJSON({ success: false, message: "Personal no encontrado en Sheets." });
    }

    // C. Eliminar Personal
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

    // A. Guardar Turno(s) de Guardia
    if (action === "saveGuardShifts" || action === "createGuardShift" || action === "saveBatchGuardShifts") {
      const shifts = body.shifts || (body.shift ? [body.shift] : []);
      const replaceTargetDate = body.replaceTargetDate;
      const sShifts = ss.getSheetByName(SHEET_GUARDIAS);

      // Si se reemplaza una fecha específica, limpiar turnos antiguos de esa fecha
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

      // Insertar nuevos turnos
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

    // B. Eliminar Turno de Guardia
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

    // C. Limpiar Todas las Guardias
    if (action === "clearAllGuardShifts") {
      const sShifts = ss.getSheetByName(SHEET_GUARDIAS);
      if (sShifts) {
        sShifts.clearContents();
        sShifts.appendRow(SHIFTS_HEADERS);
        sShifts.getRange(1, 1, 1, SHIFTS_HEADERS.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#10b981");
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
      return responseJSON({ success: true, message: "Cierre mensual registrado en Sheets." });
    }

    if (action === "clearMonthlyArchives") {
      const sArch = ss.getSheetByName(SHEET_CIERRES);
      if (sArch) {
        sArch.clearContents();
        sArch.appendRow(ARCHIVE_HEADERS);
        sArch.getRange(1, 1, 1, ARCHIVE_HEADERS.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#f59e0b");
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
      sMat.clearContents();
      sMat.appendRow(MATERIAL_HEADERS);
      sMat.getRange(1, 1, 1, MATERIAL_HEADERS.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#38bdf8");
      sMat.setFrozenRows(1);

      if (materials.length > 0) {
        const rowsMat = materials.map(function(m) { return materialToRowArray(m); });
        sMat.getRange(2, 1, rowsMat.length, MATERIAL_HEADERS.length).setValues(rowsMat);
      }

      // B. Personal
      if (personnel.length > 0) {
        let sPer = ss.getSheetByName(SHEET_PERSONAL);
        if (!sPer) sPer = ss.insertSheet(SHEET_PERSONAL);
        sPer.clearContents();
        sPer.appendRow(PERSONNEL_HEADERS);
        sPer.getRange(1, 1, 1, PERSONNEL_HEADERS.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#a855f7");
        sPer.setFrozenRows(1);
        const rowsPer = personnel.map(function(p) { return personnelToRowArray(p); });
        sPer.getRange(2, 1, rowsPer.length, PERSONNEL_HEADERS.length).setValues(rowsPer);
      }

      // C. Guardias
      if (guardShifts.length > 0) {
        let sShifts = ss.getSheetByName(SHEET_GUARDIAS);
        if (!sShifts) sShifts = ss.insertSheet(SHEET_GUARDIAS);
        sShifts.clearContents();
        sShifts.appendRow(SHIFTS_HEADERS);
        sShifts.getRange(1, 1, 1, SHIFTS_HEADERS.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#10b981");
        sShifts.setFrozenRows(1);
        const rowsShifts = guardShifts.map(function(s) { return guardShiftToRowArray(s); });
        sShifts.getRange(2, 1, rowsShifts.length, SHIFTS_HEADERS.length).setValues(rowsShifts);
      }

      // D. Cierres
      if (monthlyArchives.length > 0) {
        let sArch = ss.getSheetByName(SHEET_CIERRES);
        if (!sArch) sArch = ss.insertSheet(SHEET_CIERRES);
        sArch.clearContents();
        sArch.appendRow(ARCHIVE_HEADERS);
        sArch.getRange(1, 1, 1, ARCHIVE_HEADERS.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#f59e0b");
        sArch.setFrozenRows(1);
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

      sheet.getRange("A1:V1").merge().setValue("VENEZOLANA DE TELEVISIÓN (VTV) • RESPALDO DIARIO DE ARCHIVO AUDIOVISUAL")
        .setFontWeight("bold").setFontSize(13).setBackground("#0f172a").setFontColor("#38bdf8").setHorizontalAlignment("center");
      
      sheet.getRange("A2:K2").merge().setValue("FECHA DEL RESPALDO: " + dateStr + " | TOTAL TAREAS/MATERIALES: " + materials.length)
        .setFontWeight("bold").setFontSize(10).setBackground("#1e293b").setFontColor("#ffffff");
      sheet.getRange("L2:V2").merge().setValue("GENERADO POR: " + user + " | FECHA GENERACIÓN: " + Utilities.formatDate(new Date(), "GMT-4", "dd/MM/yyyy HH:mm:ss"))
        .setFontWeight("bold").setFontSize(10).setBackground("#1e293b").setFontColor("#94a3b8").setHorizontalAlignment("right");

      sheet.getRange(4, 1, 1, MATERIAL_HEADERS.length).setValues([MATERIAL_HEADERS])
        .setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff").setHorizontalAlignment("center");

      if (materials.length > 0) {
        const rows = materials.map(function(m) { return materialToRowArray(m); });
        sheet.getRange(5, 1, rows.length, MATERIAL_HEADERS.length).setValues(rows);
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

      sheet.getRange("A1:V1").merge().setValue("VENEZOLANA DE TELEVISIÓN (VTV) • RESPALDO MENSUAL DE ARCHIVO AUDIOVISUAL")
        .setFontWeight("bold").setFontSize(13).setBackground("#0f172a").setFontColor("#10b981").setHorizontalAlignment("center");

      sheet.getRange("A2:F2").merge().setValue("PERÍODO: " + monthPeriod + " | GENERADO POR: " + user)
        .setFontWeight("bold").setFontSize(10).setBackground("#1e293b").setFontColor("#ffffff");
      sheet.getRange("G2:V2").merge().setValue("FECHA GENERACIÓN: " + Utilities.formatDate(new Date(), "GMT-4", "dd/MM/yyyy HH:mm:ss"))
        .setFontWeight("bold").setFontSize(10).setBackground("#1e293b").setFontColor("#94a3b8").setHorizontalAlignment("right");

      sheet.getRange("A3:C3").merge().setValue("Total Materiales: " + (summary.totalCount || materials.length))
        .setFontWeight("bold").setBackground("#064e3b").setFontColor("#6ee7b7");
      sheet.getRange("D3:F3").merge().setValue("Duración Total: " + (summary.formattedDuration || "00:00:00"))
        .setFontWeight("bold").setBackground("#064e3b").setFontColor("#6ee7b7");
      sheet.getRange("G3:V3").merge().setValue("Prensa: " + (summary.prensaCount || 0) + " | Programación: " + (summary.programacionCount || 0) + " | Ingesta: " + (summary.ingestaCount || 0) + " | Finalizados: " + (summary.finalizedCount || 0))
        .setFontWeight("bold").setBackground("#134e4a").setFontColor("#ffffff");

      sheet.getRange(5, 1, 1, MATERIAL_HEADERS.length).setValues([MATERIAL_HEADERS])
        .setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff").setHorizontalAlignment("center");

      if (materials.length > 0) {
        const rows = materials.map(function(m) { return materialToRowArray(m); });
        sheet.getRange(6, 1, rows.length, MATERIAL_HEADERS.length).setValues(rows);
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
  }
}

function formatDateString(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "GMT-4", "dd/MM/yyyy HH:mm");
  }
  return String(val);
}

function formatDurationString(val) {
  if (!val) return "00:00:00";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "GMT", "HH:mm:ss");
  }
  const str = String(val).trim();
  return str || "00:00:00";
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
