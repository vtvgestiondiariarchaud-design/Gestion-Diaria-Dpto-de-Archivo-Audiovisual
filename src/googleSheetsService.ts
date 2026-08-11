import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Worker, Division, ShiftAssignment, TaskCard, TaskBoard, ShiftChangeRequest, FreeDayRequest, PhysicalAudiovisualMaterial, TaskNotification } from './types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Google Auth Provider with Workspace Scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

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
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se obtuvo token de acceso de Google');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

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
        id: r[0],
        workerId: r[1],
        divisionId: r[2],
        date: r[3],
        shiftType: r[4]
      }));
    }
  });

  return parsedData;
}
