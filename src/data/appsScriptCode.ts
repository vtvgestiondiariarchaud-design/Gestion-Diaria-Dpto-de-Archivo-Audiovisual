export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ==============================================================================
 * SISTEMA DE GESTIÓN Y CONTROL DE ARCHIVO AUDIOVISUAL VTV (VENEZOLANA DE TELEVISIÓN)
 * SCRIPT PARA GOOGLE APPS SCRIPT (CREACIÓN DE RESPALDOS DIARIOS Y MENSUALES EN DRIVE)
 * ==============================================================================
 * 
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Abra su Hoja de Cálculo en Google Sheets (o cree una nueva en su Google Drive).
 * 2. Vaya a "Extensiones" -> "Apps Script".
 * 3. Borre el código por defecto en "Código.gs" y pegue TODO este contenido.
 * 4. Haga clic en "Guardar" (ícono del disco) o Ctrl+S.
 * 5. Haga clic en el botón azul "Desplegar" -> "Nuevo despliegue".
 * 6. Seleccione el tipo: "Aplicación web".
 * 7. En "Ejecutar como": Seleccione "Yo (su correo)".
 * 8. En "Quién tiene acceso": Seleccione "Cualquier persona" (Anyone).
 * 9. Haga clic en "Desplegar", autorice los permisos requeridos y copie la Web App URL obtenida.
 * 10. Pegue la URL en la aplicación de VTV Archivo.
 */

// Nombres de hojas maestras
const SHEET_MATERIALES = "MATERIALES";
const SHEET_PERSONAL = "PERSONAL";
const SHEET_GUARDIAS = "GUARDIAS";
const SHEET_CIERRES = "CIERRES_MENSUALES";

/**
 * Encabezados completos con toda la metadata requerida para respaldos
 */
const METADATA_HEADERS = [
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

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetMat = ss.getSheetByName(SHEET_MATERIALES);
  if (!sheetMat) {
    sheetMat = ss.insertSheet(SHEET_MATERIALES);
    sheetMat.appendRow(METADATA_HEADERS);
    sheetMat.getRange(1, 1, 1, METADATA_HEADERS.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }
}

/**
 * Peticiones GET
 */
function doGet(e) {
  try {
    initSheets();
    const action = e.parameter.action || "ping";
    if (action === "ping") {
      return responseJSON({ success: true, message: "Servicio Google Apps Script VTV Archivo activo." });
    }
    return responseJSON({ success: false, message: "Acción no válida: " + action });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

/**
 * Peticiones POST
 */
function doPost(e) {
  try {
    initSheets();
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. CREAR RESPALDO DIARIO: Crea una hoja nueva en el Google Drive / Sheets por fecha seleccionada
    if (action === "createDailyBackupSheet") {
      const dateStr = body.date || body.formattedDate || Utilities.formatDate(new Date(), "GMT-4", "dd-MM-yyyy");
      const cleanDate = dateStr.replace(/[\\/]/g, "-");
      const sheetName = "Diario_" + cleanDate;
      const materials = body.materials || [];
      const user = body.user || "Operador VTV";

      // Si ya existe la hoja, agregar marca de tiempo o reutilizar
      let sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        // Renombrar existente o crear con hora
        const timeStamp = Utilities.formatDate(new Date(), "GMT-4", "_HHmm");
        sheet = ss.insertSheet(sheetName + timeStamp);
      } else {
        sheet = ss.insertSheet(sheetName);
      }

      // Banner superior de información
      sheet.getRange("A1:V1").merge().setValue("VENEZOLANA DE TELEVISIÓN (VTV) • RESPALDO DIARIO DE ARCHIVO AUDIOVISUAL")
        .setFontWeight("bold").setFontSize(13).setBackground("#0f172a").setFontColor("#38bdf8").setHorizontalAlignment("center");
      
      sheet.getRange("A2:K2").merge().setValue("FECHA DEL RESPALDO: " + dateStr + " | TOTAL TAREAS/MATERIALES: " + materials.length)
        .setFontWeight("bold").setFontSize(10).setBackground("#1e293b").setFontColor("#ffffff");
      sheet.getRange("L2:V2").merge().setValue("GENERADO POR: " + user + " | FECHA GENERACIÓN: " + Utilities.formatDate(new Date(), "GMT-4", "dd/MM/yyyy HH:mm:ss"))
        .setFontWeight("bold").setFontSize(10).setBackground("#1e293b").setFontColor("#94a3b8").setHorizontalAlignment("right");

      // Encabezados en fila 4
      sheet.getRange(4, 1, 1, METADATA_HEADERS.length).setValues([METADATA_HEADERS])
        .setFontWeight("bold").setBackground("#334155").setFontColor("#ffffff").setHorizontalAlignment("center");

      // Filas de datos
      if (materials.length > 0) {
        const rows = materials.map(function(m) {
          return [
            m.id || m.ID || "",
            m.familyId || m["ID Familia"] || "",
            m.title || m["Título / Descripción"] || "",
            m.signalType || m["Tipo Señal"] || "Limpio",
            m.division || m["División"] || "Prensa",
            m.duration || m["Duración"] || "00:00:00",
            m.creationDate || m["Fecha Creación"] || "",
            m.createdBy || m["Creado Por"] || "",
            m.createdByRole || m.creatorRole || m["Rol Creador"] || "",
            m.status || m["Estado"] || "Registrado",
            (m.isRequestTask === true || m["Es Solicitud"] === "SI") ? "SI" : "NO",
            m.assignedTo || m["Asignado A"] || "Sin asignar",
            m.assignedToRole || m["Rol Asignado"] || "",
            m.assignedAt || m["Fecha Asignación"] || "",
            (m.isIngested === true || m["Ingestado"] === "SI") ? "SI" : "NO",
            (m.isCataloged === true || m["Catalogado"] === "SI") ? "SI" : "NO",
            m.catalogedBy || m["Catalogado Por"] || "N/A",
            m.catalogedAt || m["Fecha Catalogación"] || "N/A",
            (m.isFinalized === true || m["Finalizado"] === "SI") ? "SI" : "NO",
            m.finalizedBy || m["Finalizado Por"] || "N/A",
            m.finalizedAt || m["Fecha Finalizado"] || "N/A",
            m.notes || m["Notas"] || ""
          ];
        });

        sheet.getRange(5, 1, rows.length, METADATA_HEADERS.length).setValues(rows);
        
        // Bordes y estilo de celdas
        sheet.getRange(4, 1, rows.length + 1, METADATA_HEADERS.length).setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
      } else {
        sheet.getRange("A5:V5").merge().setValue("No se registraron materiales para la fecha seleccionada.")
          .setFontStyle("italic").setFontColor("#64748b").setHorizontalAlignment("center");
      }

      // Auto-ajustar columnas principales
      for (let c = 1; c <= 8; c++) {
        sheet.autoResizeColumn(c);
      }

      return responseJSON({
        success: true,
        sheetName: sheet.getName(),
        rowCount: materials.length,
        message: "Hoja '" + sheet.getName() + "' creada exitosamente en Google Drive con " + materials.length + " tareas/materiales."
      });
    }

    // 2. CREAR RESPALDO MENSUAL: Crea una hoja nueva de cierre mensual con resumen ejecutivo
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

      // Banner superior
      sheet.getRange("A1:V1").merge().setValue("VENEZOLANA DE TELEVISIÓN (VTV) • RESPALDO MENSUAL DE ARCHIVO AUDIOVISUAL")
        .setFontWeight("bold").setFontSize(13).setBackground("#0f172a").setFontColor("#10b981").setHorizontalAlignment("center");

      // Resumen ejecutivo
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

      // Encabezados en fila 5
      sheet.getRange(5, 1, 1, METADATA_HEADERS.length).setValues([METADATA_HEADERS])
        .setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff").setHorizontalAlignment("center");

      if (materials.length > 0) {
        const rows = materials.map(function(m) {
          return [
            m.id || m.ID || "",
            m.familyId || m["ID Familia"] || "",
            m.title || m["Título / Descripción"] || "",
            m.signalType || m["Tipo Señal"] || "Limpio",
            m.division || m["División"] || "Prensa",
            m.duration || m["Duración"] || "00:00:00",
            m.creationDate || m["Fecha Creación"] || "",
            m.createdBy || m["Creado Por"] || "",
            m.createdByRole || m.creatorRole || m["Rol Creador"] || "",
            m.status || m["Estado"] || "Registrado",
            (m.isRequestTask === true || m["Es Solicitud"] === "SI") ? "SI" : "NO",
            m.assignedTo || m["Asignado A"] || "Sin asignar",
            m.assignedToRole || m["Rol Asignado"] || "",
            m.assignedAt || m["Fecha Asignación"] || "",
            (m.isIngested === true || m["Ingestado"] === "SI") ? "SI" : "NO",
            (m.isCataloged === true || m["Catalogado"] === "SI") ? "SI" : "NO",
            m.catalogedBy || m["Catalogado Por"] || "N/A",
            m.catalogedAt || m["Fecha Catalogación"] || "N/A",
            (m.isFinalized === true || m["Finalizado"] === "SI") ? "SI" : "NO",
            m.finalizedBy || m["Finalizado Por"] || "N/A",
            m.finalizedAt || m["Fecha Finalizado"] || "N/A",
            m.notes || m["Notas"] || ""
          ];
        });

        sheet.getRange(6, 1, rows.length, METADATA_HEADERS.length).setValues(rows);
        sheet.getRange(5, 1, rows.length + 1, METADATA_HEADERS.length).setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
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

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
