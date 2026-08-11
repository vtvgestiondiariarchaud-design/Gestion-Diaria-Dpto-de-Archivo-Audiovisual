import { Worker, Division, ShiftAssignment, TaskCard, TaskBoard, ShiftChangeRequest, FreeDayRequest, PhysicalAudiovisualMaterial, TaskNotification } from './types';
import { getLocalDb } from './supabaseClient';

export interface FullAppData {
  workers: Worker[];
  divisions: Division[];
  assignments: ShiftAssignment[];
  taskCards: TaskCard[];
  taskBoards: TaskBoard[];
  requests: ShiftChangeRequest[];
  freeDayRequests: FreeDayRequest[];
  physicalMaterials: PhysicalAudiovisualMaterial[];
  notifications: TaskNotification[];
}

const SHEET_NAMES = [
  'Personal_y_Usuarios',
  'Divisiones',
  'Turnos_y_Guardias',
  'Tareas_y_Pautas',
  'Tableros_de_Trabajo',
  'Cambios_de_Guardia',
  'Dias_Libres_Solicitados',
  'Archivo_Fisico_Audiovisual',
  'Notificaciones'
];

export const getCachedAccessToken = (): string | null => {
  return localStorage.getItem('vtv_google_access_token') || sessionStorage.getItem('vtv_google_access_token');
};

export const getGoogleAppsScriptUrl = (): string | null => {
  return localStorage.getItem('vtv_google_apps_script_url');
};

export const getGoogleSpreadsheetId = (): string | null => {
  return localStorage.getItem('vtv_google_spreadsheet_id');
};

/**
 * Extracts pure Spreadsheet ID from raw input or full Google Sheets URL
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

// Simple CSV line parser
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

/**
 * Fetch a single sheet from a public Google Sheet using CSV export (gviz)
 */
export async function fetchSheetViaCSV(spreadsheetId: string, sheetName: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo leer la pestaña "${sheetName}" por CSV (${res.status})`);
  }
  const text = await res.text();
  return parseCSV(text);
}

/**
 * Fetch records from Google Sheets into local format
 */
export async function fetchFromGoogleSpreadsheet(
  spreadsheetId: string,
  accessToken?: string | null
): Promise<Partial<FullAppData>> {
  const token = accessToken || getCachedAccessToken();

  if (token) {
    const rangeQuery = SHEET_NAMES.map(n => `ranges=${encodeURIComponent(n)}`).join('&');
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangeQuery}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error leyendo Google Spreadsheet via API: ${errText}`);
    }

    const result = await res.json();
    const valueRanges = result.valueRanges || [];
    const parsedData: Partial<FullAppData> = {};

    valueRanges.forEach((vr: any) => {
      const rangeName = vr.range || '';
      const values = vr.values || [];
      if (values.length <= 1) return;

      const rows = values.slice(1);
      parseSheetRows(rangeName, rows, parsedData);
    });

    return parsedData;
  } else {
    // Fallback: Read via public CSV endpoint for each sheet name
    const parsedData: Partial<FullAppData> = {};

    for (const sheetName of SHEET_NAMES) {
      try {
        const rowsWithHeader = await fetchSheetViaCSV(spreadsheetId, sheetName);
        if (rowsWithHeader.length > 1) {
          const rows = rowsWithHeader.slice(1);
          parseSheetRows(sheetName, rows, parsedData);
        }
      } catch (err) {
        console.warn(`No se pudo cargar la pestaña ${sheetName} por CSV:`, err);
      }
    }

    return parsedData;
  }
}

function parseSheetRows(rangeOrSheetName: string, rows: any[], parsedData: Partial<FullAppData>) {
  if (rangeOrSheetName.includes('Personal_y_Usuarios')) {
    parsedData.workers = rows.map((r: any) => ({
      id: r[0] || `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: r[1] || 'Usuario VTV',
      cedula: r[2] || '',
      email: (r[3] || '').trim().toLowerCase(),
      cargo: r[4] || 'Colaborador VTV',
      divisionId: r[5] || 'div_archivo_prensa',
      role: r[6] || 'worker',
      fixedShift: r[7] || 'pool',
      vacationStart: r[8] || undefined,
      vacationEnd: r[9] || undefined,
      manualFreeDaysAdjustment: Number(r[10]) || 0,
      mustChangePassword: r[11] === 'SI',
      password: r[12] || '12345678'
    }));
  } else if (rangeOrSheetName.includes('Divisiones')) {
    parsedData.divisions = rows.map((r: any) => ({
      id: r[0],
      name: r[1],
      description: r[2] || '',
      coordinatorId: r[3] || null,
      coordinatorName: r[4] || null
    }));
  } else if (rangeOrSheetName.includes('Turnos_y_Guardias')) {
    parsedData.assignments = rows.map((r: any) => ({
      id: r[0] || `asg_${Date.now()}_${Math.random()}`,
      workerId: r[1],
      divisionId: r[2],
      date: r[3],
      shiftType: r[4]
    }));
  } else if (rangeOrSheetName.includes('Tareas_y_Pautas')) {
    parsedData.taskCards = rows.map((r: any) => ({
      id: r[0],
      boardId: r[1],
      title: r[2],
      description: r[3] || '',
      status: r[4] || 'Pendiente',
      priority: r[5] || 'media',
      duration: r[6] || '00:00:00',
      editedDuration: r[7] || '00:00:00',
      isIngested: r[8] === 'SI',
      isEdited: r[9] === 'SI',
      isDocumented: r[10] === 'SI',
      isFinalized: r[11] === 'SI',
      startDate: new Date().toISOString().substring(0, 10),
      dueDate: new Date().toISOString().substring(0, 10),
      assignedWorkerIds: [],
      checklist: [],
      createdAt: r[12] || new Date().toISOString()
    }));
  } else if (rangeOrSheetName.includes('Tableros_de_Trabajo')) {
    parsedData.taskBoards = rows.map((r: any) => ({
      id: r[0],
      name: r[1],
      description: r[2] || '',
      color: r[3] || 'blue',
      createdAt: r[4] || new Date().toISOString()
    }));
  } else if (rangeOrSheetName.includes('Cambios_de_Guardia')) {
    parsedData.requests = rows.map((r: any) => ({
      id: r[0],
      requesterId: r[0] || '',
      requesterName: r[1],
      targetWorkerId: '',
      targetWorkerName: r[2],
      divisionId: 'div_archivo_prensa',
      date: r[3],
      reason: r[4],
      status: r[5],
      createdAt: r[6]
    }));
  } else if (rangeOrSheetName.includes('Dias_Libres_Solicitados')) {
    parsedData.freeDayRequests = rows.map((r: any) => ({
      id: r[0],
      workerId: r[0] || '',
      workerName: r[1],
      divisionId: 'div_archivo_prensa',
      requestedDate: r[2],
      reason: r[3] || '',
      status: r[4],
      createdAt: r[5]
    }));
  } else if (rangeOrSheetName.includes('Archivo_Fisico_Audiovisual')) {
    parsedData.physicalMaterials = rows.map((r: any) => ({
      id: `mat_${r[0] || Date.now()}`,
      code: Number(r[0]) || 1,
      formatId: r[1],
      programId: r[2] || '',
      title: r[3],
      recordingDate: r[4] || '',
      locationId: r[5],
      synopsis: r[6] || '',
      createdAt: new Date().toISOString()
    }));
  } else if (rangeOrSheetName.includes('Notificaciones')) {
    parsedData.notifications = rows.map((r: any) => ({
      id: r[0],
      workerId: r[1],
      taskId: r[2] || '',
      taskTitle: r[2],
      boardName: r[3],
      message: r[4],
      read: r[5] === 'SI',
      createdAt: r[6]
    }));
  }
}

/**
 * Downloads data from Google Spreadsheet and saves it locally
 */
export async function syncLocalDbWithGoogleSheets(
  accessToken?: string | null,
  spreadsheetIdInput?: string | null
): Promise<Partial<FullAppData>> {
  const spreadsheetId = spreadsheetIdInput || getGoogleSpreadsheetId();
  if (!spreadsheetId) return {};

  const remoteData = await fetchFromGoogleSpreadsheet(spreadsheetId, accessToken);

  if (remoteData.workers && remoteData.workers.length > 0) {
    localStorage.setItem('vtv_workers', JSON.stringify(remoteData.workers));
  }
  if (remoteData.divisions && remoteData.divisions.length > 0) {
    localStorage.setItem('vtv_divisions', JSON.stringify(remoteData.divisions));
  }
  if (remoteData.assignments) {
    localStorage.setItem('vtv_assignments', JSON.stringify(remoteData.assignments));
  }
  if (remoteData.taskCards) {
    localStorage.setItem('vtv_task_cards', JSON.stringify(remoteData.taskCards));
  }
  if (remoteData.taskBoards) {
    localStorage.setItem('vtv_task_boards', JSON.stringify(remoteData.taskBoards));
  }
  if (remoteData.requests) {
    localStorage.setItem('vtv_requests', JSON.stringify(remoteData.requests));
  }
  if (remoteData.freeDayRequests) {
    localStorage.setItem('vtv_free_day_requests', JSON.stringify(remoteData.freeDayRequests));
  }
  if (remoteData.physicalMaterials) {
    localStorage.setItem('vtv_physical_materials', JSON.stringify(remoteData.physicalMaterials));
  }
  if (remoteData.notifications) {
    localStorage.setItem('vtv_task_notifications', JSON.stringify(remoteData.notifications));
  }

  return remoteData;
}

export async function pullLatestFromGoogleSheets(): Promise<boolean> {
  const spreadsheetId = getGoogleSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error('No se ha configurado el ID o URL de la Hoja de Google Sheet.');
  }
  try {
    const data = await syncLocalDbWithGoogleSheets(getCachedAccessToken(), spreadsheetId);
    return true;
  } catch (err: any) {
    console.warn('Conexión con Google Sheets falló:', err);
    throw err;
  }
}

/**
 * Creates a brand new Google Spreadsheet in Google Drive with all structured sheets
 */
export async function createGoogleSpreadsheet(
  accessToken: string,
  data: FullAppData
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const sheetsPayload = SHEET_NAMES.map(title => ({
    properties: { title }
  }));

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: 'VTV Guardias y Operaciones - Base de Datos Centralizada'
      },
      sheets: sheetsPayload
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error de la API de Google Sheets (${res.status}): ${errText}`);
  }

  const spreadsheetData = await res.json();
  const spreadsheetId = spreadsheetData.spreadsheetId;
  const spreadsheetUrl = spreadsheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  localStorage.setItem('vtv_google_spreadsheet_id', spreadsheetId);
  localStorage.setItem('vtv_google_spreadsheet_url', spreadsheetUrl);

  await populateAllSheets(accessToken, spreadsheetId, data);

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Populates or overwrites all sheets in the spreadsheet with current state
 */
export async function populateAllSheets(
  accessToken: string,
  spreadsheetId: string,
  data: FullAppData
): Promise<void> {
  const dataValueRanges = [
    {
      range: 'Personal_y_Usuarios!A1',
      values: [
        ['ID', 'Nombre', 'Cédula', 'Email', 'Cargo', 'ID División', 'Rol', 'Turno Fijo', 'Inicio Vacaciones', 'Fin Vacaciones', 'Ajuste Días Libres', 'Requiere Cambio Clave', 'Contraseña'],
        ...data.workers.map(w => [
          w.id,
          w.name,
          w.cedula || '',
          w.email,
          w.cargo,
          w.divisionId,
          w.role,
          w.fixedShift || 'pool',
          w.vacationStart || '',
          w.vacationEnd || '',
          w.manualFreeDaysAdjustment || 0,
          w.mustChangePassword ? 'SI' : 'NO',
          w.password || '12345678'
        ])
      ]
    },
    {
      range: 'Divisiones!A1',
      values: [
        ['ID', 'Nombre', 'Descripción', 'ID Coordinador', 'Nombre Coordinador'],
        ...data.divisions.map(d => [
          d.id,
          d.name,
          d.description || '',
          d.coordinatorId || '',
          d.coordinatorName || ''
        ])
      ]
    },
    {
      range: 'Turnos_y_Guardias!A1',
      values: [
        ['ID', 'ID Trabajador', 'ID División', 'Fecha', 'Tipo de Turno'],
        ...data.assignments.map(a => [
          a.id,
          a.workerId,
          a.divisionId,
          a.date,
          a.shiftType
        ])
      ]
    },
    {
      range: 'Tareas_y_Pautas!A1',
      values: [
        ['ID', 'ID Tablero', 'Título', 'Descripción', 'Estado', 'Prioridad', 'Duración Original', 'Duración Editada', 'Ingestado (SI/NO)', 'Editado (SI/NO)', 'Documentado (SI/NO)', 'Finalizado (SI/NO)', 'Creación'],
        ...data.taskCards.map(t => [
          t.id,
          t.boardId,
          t.title,
          t.description,
          t.status,
          t.priority || 'media',
          t.duration || '00:00:00',
          t.editedDuration || '00:00:00',
          t.isIngested ? 'SI' : 'NO',
          t.isEdited ? 'SI' : 'NO',
          t.isDocumented ? 'SI' : 'NO',
          t.isFinalized ? 'SI' : 'NO',
          t.createdAt
        ])
      ]
    },
    {
      range: 'Tableros_de_Trabajo!A1',
      values: [
        ['ID', 'Nombre', 'Descripción', 'Color', 'Creación'],
        ...data.taskBoards.map(b => [
          b.id,
          b.name,
          b.description || '',
          b.color || 'blue',
          b.createdAt
        ])
      ]
    },
    {
      range: 'Cambios_de_Guardia!A1',
      values: [
        ['ID', 'Solicitante', 'Destino', 'Fecha', 'Motivo', 'Estado', 'Creación'],
        ...data.requests.map(r => [
          r.id,
          r.requesterName,
          r.targetWorkerName,
          r.date,
          r.reason,
          r.status,
          r.createdAt
        ])
      ]
    },
    {
      range: 'Dias_Libres_Solicitados!A1',
      values: [
        ['ID', 'Trabajador', 'Fecha Solicitada', 'Motivo', 'Estado', 'Creación'],
        ...data.freeDayRequests.map(f => [
          f.id,
          f.workerName,
          f.requestedDate,
          f.reason || '',
          f.status,
          f.createdAt
        ])
      ]
    },
    {
      range: 'Archivo_Fisico_Audiovisual!A1',
      values: [
        ['Código', 'Formato', 'Programa', 'Título', 'Fecha Grabación', 'Ubicación', 'Sinopsis'],
        ...data.physicalMaterials.map(m => [
          m.code,
          m.formatId,
          m.programId || '',
          m.title,
          m.recordingDate || '',
          m.locationId,
          m.synopsis || ''
        ])
      ]
    },
    {
      range: 'Notificaciones!A1',
      values: [
        ['ID', 'ID Trabajador', 'Tarea', 'Tablero', 'Mensaje', 'Leído', 'Creación'],
        ...data.notifications.map(n => [
          n.id,
          n.workerId,
          n.taskTitle,
          n.boardName,
          n.message,
          n.read ? 'SI' : 'NO',
          n.createdAt
        ])
      ]
    }
  ];

  const scriptUrl = getGoogleAppsScriptUrl();
  const targetTokenOrUrl = accessToken || scriptUrl;

  if (targetTokenOrUrl && (targetTokenOrUrl.startsWith('http://') || targetTokenOrUrl.startsWith('https://'))) {
    // Send to Google Apps Script Web App Endpoint
    const res = await fetch(targetTokenOrUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        spreadsheetId,
        dataValueRanges
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error al enviar datos a Google Apps Script Web App (${res.status}): ${errText}`);
    }
    return;
  }

  if (!accessToken) {
    throw new Error('Para guardar cambios de vuelta en Google Sheets se requiere configurar una URL de Google Apps Script Web App o un Token de Acceso.');
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: dataValueRanges
      })
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al actualizar valores en Google Sheets: ${errText}`);
  }
}

export async function pushLatestToGoogleSheets(): Promise<boolean> {
  const spreadsheetId = getGoogleSpreadsheetId();
  const token = getCachedAccessToken();
  const scriptUrl = getGoogleAppsScriptUrl();
  const authKey = token || scriptUrl;

  if (!spreadsheetId || !authKey) return false;
  try {
    const workers = getLocalDb.getWorkers();
    const divisions = getLocalDb.getDivisions();
    const assignments = getLocalDb.getAssignments();
    const requests = getLocalDb.getRequests();
    const freeDayRequests = getLocalDb.getFreeDayRequests();
    const physicalMaterials = getLocalDb.getPhysicalMaterials([]);
    const taskCardsRaw = localStorage.getItem('vtv_task_cards');
    const taskCards = taskCardsRaw ? JSON.parse(taskCardsRaw) : [];
    const taskBoardsRaw = localStorage.getItem('vtv_task_boards');
    const taskBoards = taskBoardsRaw ? JSON.parse(taskBoardsRaw) : [];
    const notificationsRaw = localStorage.getItem('vtv_task_notifications');
    const notifications = notificationsRaw ? JSON.parse(notificationsRaw) : [];

    await populateAllSheets(token, spreadsheetId, {
      workers,
      divisions,
      assignments,
      taskCards,
      taskBoards,
      requests,
      freeDayRequests,
      physicalMaterials,
      notifications
    });
    return true;
  } catch (err) {
    console.warn('Auto-push Google Sheets attempt skipped:', err);
    return false;
  }
}
