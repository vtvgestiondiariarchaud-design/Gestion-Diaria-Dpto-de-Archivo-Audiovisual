export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ==============================================================================
 * SISTEMA DE GESTIÓN Y CONTROL DE ARCHIVO AUDIOVISUAL VTV (VENEZOLANA DE TELEVISIÓN)
 * SCRIPT PARA GOOGLE APPS SCRIPT (CONEXIÓN A GOOGLE SHEETS)
 * ==============================================================================
 * 
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Abra su Hoja de Cálculo en Google Sheets (Crear una nueva si es necesario).
 * 2. Vaya a "Extensiones" -> "Apps Script".
 * 3. Borre el código por defecto en "Código.gs" y pegue TODO este contenido.
 * 4. Haga clic en "Guardar" (ícono del disco) o Ctrl+S.
 * 5. Haga clic en el botón azul "Desplegar" -> "Nuevo despliegue".
 * 6. Seleccione el tipo: "Aplicación web".
 * 7. En "Ejecutar como": Seleccione "Yo (su correo)".
 * 8. En "Quién tiene acceso": Seleccione "Cualquier persona" (Anyone).
 * 9. Haga clic en "Desplegar" y autorice los permisos requeridos.
 * 10. Copie la URL de la aplicación web (Web App URL) y péguela en el panel de
 *     Configuración de la Aplicación en la SPA.
 */

// Nombres de las hojas
const SHEET_MATERIALES = "MATERIALES";
const SHEET_PERSONAL = "PERSONAL";
const SHEET_GUARDIAS = "GUARDIAS";

/**
 * Función que inicializa las hojas y sus encabezados si no existen
 */
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Hoja Materiales
  let sheetMat = ss.getSheetByName(SHEET_MATERIALES);
  if (!sheetMat) {
    sheetMat = ss.insertSheet(SHEET_MATERIALES);
    sheetMat.appendRow([
      "ID", "ID Familia", "Tipo Señal", "Título / Descripción", "División", 
      "Duración", "Fecha Creación", "Creado Por", "Rol Creador", "Estado", 
      "Catalogado Por", "Fecha Catalogación", "Finalizado Por", "Fecha Finalizado", "Notas"
    ]);
    sheetMat.getRange(1, 1, 1, 15).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }
  
  // Hoja Personal
  let sheetPer = ss.getSheetByName(SHEET_PERSONAL);
  if (!sheetPer) {
    sheetPer = ss.insertSheet(SHEET_PERSONAL);
    sheetPer.appendRow([
      "ID", "Nombre", "Rol", "División", "Días Guardia Trabajados", 
      "Días Libres Generados", "Días Libres Disfrutados", "Balance Pendiente", "PIN"
    ]);
    sheetPer.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }

  // Hoja Guardias
  let sheetGuard = ss.getSheetByName(SHEET_GUARDIAS);
  if (!sheetGuard) {
    sheetGuard = ss.insertSheet(SHEET_GUARDIAS);
    sheetGuard.appendRow([
      "ID", "ID Personal", "Nombre Personal", "División", "Fecha", "Tipo Turno", "Asignado Por", "Notas", "Fecha Registro"
    ]);
    sheetGuard.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }
}

/**
 * Peticiones GET (Obtener Datos)
 */
function doGet(e) {
  try {
    initSheets();
    const action = e.parameter.action || "getAllData";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === "getAllData") {
      const materials = getSheetData(ss.getSheetByName(SHEET_MATERIALES));
      const personnel = getSheetData(ss.getSheetByName(SHEET_PERSONAL));
      const guardShifts = getSheetData(ss.getSheetByName(SHEET_GUARDIAS));
      
      return responseJSON({
        success: true,
        data: { materials, personnel, guardShifts }
      });
    }
    
    return responseJSON({ success: false, message: "Acción no válida: " + action });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

/**
 * Peticiones POST (Guardar / Actualizar Datos)
 */
function doPost(e) {
  try {
    initSheets();
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === "getAllData") {
      const materials = getSheetData(ss.getSheetByName(SHEET_MATERIALES));
      const personnel = getSheetData(ss.getSheetByName(SHEET_PERSONAL));
      const guardShifts = getSheetData(ss.getSheetByName(SHEET_GUARDIAS));
      
      return responseJSON({
        success: true,
        data: { materials, personnel, guardShifts }
      });
    }

    if (action === "syncAllData") {
      // Reemplazar o actualizar todo con los datos enviados por la App
      if (body.materials) saveListToSheet(ss.getSheetByName(SHEET_MATERIALES), body.materials);
      if (body.personnel) saveListToSheet(ss.getSheetByName(SHEET_PERSONAL), body.personnel);
      if (body.guardShifts) saveListToSheet(ss.getSheetByName(SHEET_GUARDIAS), body.guardShifts);
      
      return responseJSON({ success: true, message: "Sincronización completada con éxito." });
    }
    
    return responseJSON({ success: false, message: "Acción POST no reconocida: " + action });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

// Auxiliares
function getSheetData(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  const headers = rows[0];
  const result = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx];
    });
    result.push(obj);
  }
  return result;
}

function saveListToSheet(sheet, items) {
  if (!sheet || !items || !Array.isArray(items)) return;
  sheet.clearContents();
  
  if (items.length === 0) return;
  
  // Obtener keys del primer objeto
  const keys = Object.keys(items[0]);
  sheet.appendRow(keys);
  sheet.getRange(1, 1, 1, keys.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  
  const rows = items.map(item => keys.map(k => item[k] !== undefined ? item[k] : ""));
  sheet.getRange(2, 1, rows.length, keys.length).setValues(rows);
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
