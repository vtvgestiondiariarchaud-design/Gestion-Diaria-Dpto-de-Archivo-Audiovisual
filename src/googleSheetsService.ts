import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Worker, Division, ShiftAssignment, TaskCard, TaskBoard, ShiftChangeRequest, FreeDayRequest, PhysicalAudiovisualMaterial, TaskNotification } from './types';
import { getLocalDb } from './supabaseClient';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Google Auth Provider with Workspace Scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = sessionStorage.getItem('vtv_google_access_token');

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem('vtv_google_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogle = async (forcePopup = false): Promise<{ user: User | null; accessToken: string } | null> => {
  const existingToken = getCachedAccessToken();
  if (!forcePopup && existingToken) {
    return { user: auth.currentUser, accessToken: existingToken };
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se obtuvo token de acceso de Google');
    }
    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem('vtv_google_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      console.warn('El usuario cerró la ventana emergente de autenticación de Google.');
      throw new Error('Inicio de sesión cancelado. Por favor completa la autenticación en la ventana emergente de Google.');
    }
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken || sessionStorage.getItem('vtv_google_access_token');
};

export async function pullLatestFromGoogleSheets(): Promise<boolean> {
  const spreadsheetId = localStorage.getItem('vtv_google_spreadsheet_id');
  const token = getCachedAccessToken();
  if (!spreadsheetId || !token) return false;
  try {
    await syncLocalDbWithGoogleSheets(token, spreadsheetId);
    return true;
  } catch (err) {
    console.warn('Auto-pull Google Sheets attempt failed:', err);
    return false;
  }
}

export async function pushLatestToGoogleSheets(): Promise<boolean> {
  const spreadsheetId = localStorage.getItem('vtv_google_spreadsheet_id');
  const token = getCachedAccessToken();
  if (!spreadsheetId || !token) return false;
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
    console.warn('Auto-push Google Sheets attempt failed:', err);
    return false;
  }
}


// Spreadsheet metadata and sync functions
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

/**
 * Creates a brand new Google Spreadsheet in Google Drive with all structured sheets
 */
export async function createGoogleSpreadsheet(
  accessToken: string,
  data: FullAppData
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Create spreadsheet body with individual tabs
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

  // Save to localStorage
  localStorage.setItem('vtv_google_spreadsheet_id', spreadsheetId);
  localStorage.setItem('vtv_google_spreadsheet_url', spreadsheetUrl);

  // 2. Populate data into all sheets
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
        ['ID', 'Nombre', 'Cédula', 'Email', 'Cargo', 'ID División', 'Rol', 'Turno Fijo', 'Inicio Vacaciones', 'Fin Vacaciones', 'Ajuste Días Libres', 'Requiere Cambio Clave'],
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
          w.mustChangePassword ? 'SI' : 'NO'
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

/**
 * Fetch records from Google Sheets into local format
 */
export async function fetchFromGoogleSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<Partial<FullAppData>> {
  const rangeQuery = SHEET_NAMES.map(n => `ranges=${encodeURIComponent(n)}`).join('&');
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangeQuery}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error leyendo Google Spreadsheet: ${errText}`);
  }

  const result = await res.json();
  const valueRanges = result.valueRanges || [];

  const parsedData: Partial<FullAppData> = {};

  valueRanges.forEach((vr: any) => {
    const rangeName = vr.range || '';
    const values = vr.values || [];
    if (values.length <= 1) return; // Only headers or empty

    const rows = values.slice(1);

    if (rangeName.startsWith('Personal_y_Usuarios')) {
      parsedData.workers = rows.map((r: any) => ({
        id: r[0],
        name: r[1],
        cedula: r[2],
        email: r[3],
        cargo: r[4],
        divisionId: r[5],
        role: r[6],
        fixedShift: r[7] || 'pool',
        vacationStart: r[8] || undefined,
        vacationEnd: r[9] || undefined,
        manualFreeDaysAdjustment: Number(r[10]) || 0,
        mustChangePassword: r[11] === 'SI',
        password: '12345678'
      }));
    } else if (rangeName.startsWith('Divisiones')) {
      parsedData.divisions = rows.map((r: any) => ({
        id: r[0],
        name: r[1],
        description: r[2] || '',
        coordinatorId: r[3] || null,
        coordinatorName: r[4] || null
      }));
    } else if (rangeName.startsWith('Turnos_y_Guardias')) {
      parsedData.assignments = rows.map((r: any) => ({
        id: r[0] || `asg_${Date.now()}_${Math.random()}`,
        workerId: r[1],
        divisionId: r[2],
        date: r[3],
        shiftType: r[4]
      }));
    } else if (rangeName.startsWith('Tareas_y_Pautas')) {
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
        createdAt: r[12] || new Date().toISOString()
      }));
    } else if (rangeName.startsWith('Tableros_de_Trabajo')) {
      parsedData.taskBoards = rows.map((r: any) => ({
        id: r[0],
        name: r[1],
        description: r[2] || '',
        color: r[3] || 'blue',
        createdAt: r[4] || new Date().toISOString()
      }));
    } else if (rangeName.startsWith('Cambios_de_Guardia')) {
      parsedData.requests = rows.map((r: any) => ({
        id: r[0],
        requesterName: r[1],
        targetWorkerName: r[2],
        date: r[3],
        reason: r[4],
        status: r[5],
        createdAt: r[6]
      }));
    } else if (rangeName.startsWith('Dias_Libres_Solicitados')) {
      parsedData.freeDayRequests = rows.map((r: any) => ({
        id: r[0],
        workerName: r[1],
        requestedDate: r[2],
        reason: r[3] || '',
        status: r[4],
        createdAt: r[5]
      }));
    } else if (rangeName.startsWith('Archivo_Fisico_Audiovisual')) {
      parsedData.physicalMaterials = rows.map((r: any) => ({
        code: r[0],
        formatId: r[1],
        programId: r[2] || '',
        title: r[3],
        recordingDate: r[4] || '',
        locationId: r[5],
        synopsis: r[6] || ''
      }));
    } else if (rangeName.startsWith('Notificaciones')) {
      parsedData.notifications = rows.map((r: any) => ({
        id: r[0],
        workerId: r[1],
        taskTitle: r[2],
        boardName: r[3],
        message: r[4],
        read: r[5] === 'SI',
        createdAt: r[6]
      }));
    }
  });

  return parsedData;
}

/**
 * Downloads data from Google Spreadsheet and saves it locally
 */
export async function syncLocalDbWithGoogleSheets(
  accessToken: string,
  spreadsheetId: string
): Promise<Partial<FullAppData>> {
  const remoteData = await fetchFromGoogleSpreadsheet(accessToken, spreadsheetId);

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

