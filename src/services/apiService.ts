import { MaterialSignal, Personnel, GuardShiftRecord, MaterialFamilyGroup, AppState, MaterialStatus, MonthlyArchiveLog, UserProfile } from '../types';
import { INITIAL_MATERIALS, INITIAL_PERSONNEL, INITIAL_GUARD_SHIFTS, DEFAULT_USERS, DEFAULT_APPS_SCRIPT_URL } from '../data/initialData';

const LOCAL_STORAGE_KEY_MATERIALS = 'vtv_archivo_materials_v1';
const LOCAL_STORAGE_KEY_PERSONNEL = 'vtv_archivo_personnel_v1';
const LOCAL_STORAGE_KEY_SHIFTS = 'vtv_archivo_shifts_v1';
const LOCAL_STORAGE_KEY_APPS_SCRIPT_URL = 'vtv_archivo_apps_script_url_v1';
const LOCAL_STORAGE_KEY_USER = 'vtv_archivo_active_user_v1';
const LOCAL_STORAGE_KEY_PINS = 'vtv_archivo_user_pins_v1';
const LOCAL_STORAGE_KEY_MONTHLY_ARCHIVES = 'vtv_archivo_monthly_archives_v1';

// Helper for duration conversions
export function durationToSeconds(duration: string): number {
  if (!duration) return 0;
  const parts = duration.trim().split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  } else if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  return 0;
}

export function secondsToDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatHoursVerbose(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

// Group materials by Family ID
export function groupMaterialsByFamily(materials: MaterialSignal[]): MaterialFamilyGroup[] {
  const familyMap = new Map<string, MaterialSignal[]>();

  materials.forEach((mat) => {
    const fid = mat.familyId || mat.id;
    if (!familyMap.has(fid)) {
      familyMap.set(fid, []);
    }
    familyMap.get(fid)!.push(mat);
  });

  const groups: MaterialFamilyGroup[] = [];

  familyMap.forEach((signals, familyId) => {
    // Sort signals in logical order: Limpio, Insert, Master
    const orderScore: Record<string, number> = { Limpio: 1, Insert: 2, Master: 3 };
    signals.sort((a, b) => (orderScore[a.signalType] || 4) - (orderScore[b.signalType] || 4));

    const mainSignal = signals[0];
    const totalDurationSecs = signals.reduce((acc, s) => acc + durationToSeconds(s.duration), 0);

    // Calculate overall status
    let overallStatus: MaterialSignal['status'] = 'Registrado';
    const allFinalized = signals.every((s) => s.isFinalized || s.status === 'Finalizado');
    const anyPorArchivar = signals.some((s) => s.isCataloged || s.status === 'Por Archivar');

    if (allFinalized) {
      overallStatus = 'Finalizado';
    } else if (anyPorArchivar || signals.some((s) => s.isFinalized)) {
      overallStatus = 'Por Archivar';
    }

    const hasIngested = signals.some((s) => s.isIngested !== false);
    const hasCataloged = signals.some((s) => s.isCataloged);
    const hasFinalizedSignal = signals.some((s) => s.isFinalized);
    const isAllFinalized = signals.every((s) => s.isFinalized);

    groups.push({
      familyId,
      title: mainSignal.title,
      division: mainSignal.division,
      creationDate: mainSignal.creationDate,
      createdBy: mainSignal.createdBy,
      signals,
      totalDurationSeconds: totalDurationSecs,
      overallStatus,
      hasIngested,
      hasCataloged,
      isAllFinalized,
      hasFinalizedSignal,
    });
  });

  // Sort groups by creation date descending
  groups.sort((a, b) => b.creationDate.localeCompare(a.creationDate));

  return groups;
}

export function deduplicatePersonnel(list: Personnel[]): Personnel[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const result: Personnel[] = [];

  for (const item of list) {
    if (!item) continue;
    const cleanId = String(item.id || '').trim();
    const cleanName = String(item.name || '').trim().toLowerCase();

    if (!cleanId && !cleanName) continue;

    if (cleanId && seenIds.has(cleanId)) continue;
    if (cleanName && seenNames.has(cleanName)) continue;

    if (cleanId) seenIds.add(cleanId);
    if (cleanName) seenNames.add(cleanName);

    result.push({
      ...item,
      id: cleanId || `per-${Math.random().toString(36).substring(2, 9)}`,
      name: item.name ? item.name.trim() : 'Personal',
    });
  }

  return result;
}

// Local Storage API methods
export function loadInitialState(): AppState {
  let materials: MaterialSignal[] = INITIAL_MATERIALS;
  let personnel: Personnel[] = INITIAL_PERSONNEL;
  let guardShifts: GuardShiftRecord[] = INITIAL_GUARD_SHIFTS;
  let appsScriptUrl = DEFAULT_APPS_SCRIPT_URL;
  let currentUser = DEFAULT_USERS[0];
  let monthlyArchives: MonthlyArchiveLog[] = [];

  try {
    const localMats = localStorage.getItem(LOCAL_STORAGE_KEY_MATERIALS);
    if (localMats) {
      const parsed = JSON.parse(localMats);
      materials = parsed.map((m: any) => ({
        ...m,
        isIngested: m.isIngested !== undefined ? m.isIngested : true,
        isCataloged: m.isCataloged !== undefined ? m.isCataloged : (m.status === 'Por Archivar' || m.status === 'Finalizado'),
        isFinalized: m.isFinalized !== undefined ? m.isFinalized : (m.status === 'Finalizado'),
      }));
    }

    const localPer = localStorage.getItem(LOCAL_STORAGE_KEY_PERSONNEL);
    if (localPer) {
      const parsed: Personnel[] = JSON.parse(localPer);
      personnel = deduplicatePersonnel([...parsed, ...INITIAL_PERSONNEL]);
    } else {
      personnel = deduplicatePersonnel(INITIAL_PERSONNEL);
    }
    saveLocalPersonnel(personnel);

    const localShifts = localStorage.getItem(LOCAL_STORAGE_KEY_SHIFTS);
    if (localShifts) guardShifts = JSON.parse(localShifts);

    const localUrl = localStorage.getItem(LOCAL_STORAGE_KEY_APPS_SCRIPT_URL);
    if (localUrl && localUrl.trim()) {
      appsScriptUrl = localUrl.trim();
    } else {
      appsScriptUrl = DEFAULT_APPS_SCRIPT_URL;
      saveLocalAppsScriptUrl(DEFAULT_APPS_SCRIPT_URL);
    }

    const localUser = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
    if (localUser) currentUser = JSON.parse(localUser);

    const localArchives = localStorage.getItem(LOCAL_STORAGE_KEY_MONTHLY_ARCHIVES);
    if (localArchives) monthlyArchives = JSON.parse(localArchives);
  } catch (err) {
    console.error('Error loading local state:', err);
  }

  return {
    currentUser,
    materials,
    personnel,
    guardShifts,
    monthlyArchives,
    appsScriptUrl,
    isSyncing: false,
  };
}

export function loadLocalMonthlyArchives(): MonthlyArchiveLog[] {
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY_MONTHLY_ARCHIVES);
    return local ? JSON.parse(local) : [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

export function saveLocalMonthlyArchives(archives: MonthlyArchiveLog[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_MONTHLY_ARCHIVES, JSON.stringify(archives));
  } catch (e) {
    console.error(e);
  }
}

export function generateMonthlyArchiveLog(materials: MaterialSignal[], user: UserProfile): MonthlyArchiveLog {
  const now = new Date();
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const monthPeriod = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const exportDate = now.toISOString().replace('T', ' ').substring(0, 16);

  let totalSecs = 0;
  const divisionMap: Record<string, { count: number; seconds: number }> = {};

  const exportedItems = materials.map((m) => {
    const secs = durationToSeconds(m.duration);
    totalSecs += secs;

    if (!divisionMap[m.division]) {
      divisionMap[m.division] = { count: 0, seconds: 0 };
    }
    divisionMap[m.division].count += 1;
    divisionMap[m.division].seconds += secs;

    return {
      id: m.id,
      familyId: m.familyId,
      title: m.title,
      division: m.division,
      signalType: m.signalType,
      duration: m.duration,
    };
  });

  return {
    id: `MAR-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 899 + 100)}`,
    monthPeriod,
    exportDate,
    exportedBy: user.name,
    exporterRole: user.role,
    materialsCount: materials.length,
    totalDurationSeconds: totalSecs,
    formattedDuration: formatHoursVerbose(totalSecs),
    divisionBreakdown: divisionMap,
    exportedItems,
  };
}

export function exportMaterialsToCSV(materials: MaterialSignal[], customFilename?: string): void {
  const dateStr = new Date().toISOString().substring(0, 10);
  const filename = customFilename || `VTV_Materiales_Finalizados_Export_${dateStr}.csv`;

  const headers = [
    'ID Señal',
    'ID Familia',
    'Tipo Señal',
    'Título / Descripción',
    'División',
    'Duración',
    'Estado',
    'Fecha Creación',
    'Creado Por',
    'Rol Creador',
    'Catalogado Por',
    'Fecha Catalogación',
    'Finalizado Por',
    'Fecha Finalización',
    'Notas'
  ];

  const escapeCSV = (val: string | undefined | null) => {
    if (!val) return '""';
    const clean = String(val).replace(/"/g, '""');
    return `"${clean}"`;
  };

  const rows = materials.map((m) => [
    escapeCSV(m.id),
    escapeCSV(m.familyId),
    escapeCSV(m.signalType),
    escapeCSV(m.title),
    escapeCSV(m.division),
    escapeCSV(m.duration),
    escapeCSV(m.status),
    escapeCSV(m.creationDate),
    escapeCSV(m.createdBy),
    escapeCSV(m.creatorRole),
    escapeCSV(m.catalogedBy || 'N/A'),
    escapeCSV(m.catalogedAt || 'N/A'),
    escapeCSV(m.finalizedBy || 'N/A'),
    escapeCSV(m.finalizedAt || 'N/A'),
    escapeCSV(m.notes || ''),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function saveLocalMaterials(materials: MaterialSignal[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_MATERIALS, JSON.stringify(materials));
  } catch (e) {
    console.error(e);
  }
}

export function saveLocalPersonnel(personnel: Personnel[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PERSONNEL, JSON.stringify(personnel));
  } catch (e) {
    console.error(e);
  }
}

export function saveLocalGuardShifts(shifts: GuardShiftRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_SHIFTS, JSON.stringify(shifts));
  } catch (e) {
    console.error(e);
  }
}

export function saveLocalAppsScriptUrl(url: string) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_APPS_SCRIPT_URL, url);
  } catch (e) {
    console.error(e);
  }
}

export function saveLocalActiveUser(user: any) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(user));
  } catch (e) {
    console.error(e);
  }
}

export function loadLocalUserPins(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PINS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error(e);
    return {};
  }
}

export function saveLocalUserPins(pins: Record<string, string>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PINS, JSON.stringify(pins));
  } catch (e) {
    console.error(e);
  }
}

// Google Apps Script API Services
export async function fetchFromGoogleSheets(
  url: string
): Promise<{
  success: boolean;
  message: string;
  data?: {
    materials: MaterialSignal[];
    personnel: Personnel[];
    guardShifts: GuardShiftRecord[];
    monthlyArchives?: MonthlyArchiveLog[];
  };
}> {
  if (!url || !url.startsWith('http')) {
    return { success: false, message: 'URL de Google Apps Script no configurada o inválida.' };
  }

  try {
    let resData: any = null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getAllData' }),
      });
      resData = await response.json();
    } catch (e) {
      const getUrl = url + (url.includes('?') ? '&' : '?') + 'action=getAllData';
      const response = await fetch(getUrl, { method: 'GET', mode: 'cors' });
      resData = await response.json();
    }

    if (resData && resData.success && resData.data) {
      const rawMats = Array.isArray(resData.data.materials) ? resData.data.materials : [];
      const parsedMaterials: MaterialSignal[] = rawMats.map((m: any) => {
        const status = (m['Estado'] || m.status || 'Registrado') as MaterialStatus;
        return {
          id: String(m.ID || m.id || ''),
          familyId: String(m['ID Familia'] || m.familyId || m.id || ''),
          signalType: (m['Tipo Señal'] || m.signalType || 'Limpio') as any,
          title: String(m['Título / Descripción'] || m.title || ''),
          division: (m['División'] || m.division || 'Prensa') as any,
          duration: String(m['Duración'] || m.duration || '00:00:00'),
          creationDate: String(m['Fecha Creación'] || m.creationDate || new Date().toISOString().split('T')[0]),
          createdBy: String(m['Creado Por'] || m.createdBy || 'Sistema'),
          createdByRole: String(m['Rol Creador'] || m.createdByRole || ''),
          status,
          catalogedBy: m['Catalogado Por'] || m.catalogedBy || undefined,
          catalogedAt: m['Fecha Catalogación'] || m.catalogedAt || undefined,
          finalizedBy: m['Finalizado Por'] || m.finalizedBy || undefined,
          finalizedAt: m['Fecha Finalizado'] || m.finalizedAt || undefined,
          notes: m['Notas'] || m.notes || undefined,
          isIngested: m.isIngested !== undefined ? (m.isIngested === true || m.isIngested === 'true') : true,
          isCataloged: m.isCataloged !== undefined ? (m.isCataloged === true || m.isCataloged === 'true') : (status === 'Por Archivar' || status === 'Finalizado'),
          isFinalized: m.isFinalized !== undefined ? (m.isFinalized === true || m.isFinalized === 'true') : (status === 'Finalizado'),
        };
      }).filter((m) => m.id);

      const rawPer = Array.isArray(resData.data.personnel) ? resData.data.personnel : [];
      const parsedPersonnel: Personnel[] = deduplicatePersonnel(rawPer.map((p: any) => {
        const pinVal = p.PIN !== undefined && p.PIN !== null ? String(p.PIN).trim() : (p.pin !== undefined && p.pin !== null ? String(p.pin).trim() : '');
        return {
          id: String(p.ID || p.id || ''),
          name: String(p['Nombre'] || p.name || ''),
          role: (p['Rol'] || p.role || 'Operador') as any,
          division: (p['División'] || p.division || 'Prensa') as any,
          guardDaysWorked: Number(p['Días Guardia Trabajados'] ?? p.guardDaysWorked) || 0,
          daysOffGenerated: Number(p['Días Libres Generados'] ?? p.daysOffGenerated) || 0,
          daysOffTaken: Number(p['Días Libres Disfrutados'] ?? p.daysOffTaken) || 0,
          balanceDays: Number(p['Balance Pendiente'] ?? p.balanceDays) || 0,
          pin: pinVal ? pinVal : undefined,
        };
      }).filter((p) => p.name));

      const rawShifts = Array.isArray(resData.data.guardShifts) ? resData.data.guardShifts : [];
      const parsedShifts: GuardShiftRecord[] = rawShifts.map((s: any) => ({
        id: String(s.ID || s.id || ''),
        personnelId: String(s['ID Personal'] || s.personnelId || ''),
        personnelName: String(s['Nombre Personal'] || s.personnelName || ''),
        division: (s['División'] || s.division || 'Prensa') as any,
        date: String(s['Fecha'] || s.date || ''),
        shiftType: (s['Tipo Turno'] || s.shiftType || '24h') as any,
        assignedBy: String(s['Asignado Por'] || s.assignedBy || ''),
        notes: s['Notas'] || s.notes || undefined,
        createdDate: String(s['Fecha Registro'] || s.createdDate || ''),
      })).filter((s) => s.id);

      const rawArchives = Array.isArray(resData.data.monthlyArchives) 
        ? resData.data.monthlyArchives 
        : (Array.isArray(resData.data.cierresMensuales) ? resData.data.cierresMensuales : []);
      const parsedArchives: MonthlyArchiveLog[] = rawArchives.map((a: any) => {
        let breakdown = {};
        if (typeof a.divisionBreakdown === 'object' && a.divisionBreakdown) {
          breakdown = a.divisionBreakdown;
        } else if (a['Detalle Desglose']) {
          try { breakdown = typeof a['Detalle Desglose'] === 'string' ? JSON.parse(a['Detalle Desglose']) : a['Detalle Desglose']; } catch (e) {}
        }

        let items = [];
        if (Array.isArray(a.exportedItems)) {
          items = a.exportedItems;
        } else if (a['Materiales Exportados']) {
          try { items = typeof a['Materiales Exportados'] === 'string' ? JSON.parse(a['Materiales Exportados']) : a['Materiales Exportados']; } catch (e) {}
        }

        return {
          id: String(a['ID Cierre'] || a.id || ''),
          monthPeriod: String(a['Período'] || a.monthPeriod || ''),
          exportDate: String(a['Fecha Exportación'] || a.exportDate || ''),
          exportedBy: String(a['Exportado Por'] || a.exportedBy || ''),
          exporterRole: String(a['Rol Exporter'] || a.exporterRole || ''),
          materialsCount: Number(a['Cantidad Materiales'] ?? a.materialsCount) || 0,
          totalDurationSeconds: Number(a['Total Segundos'] ?? a.totalDurationSeconds) || 0,
          formattedDuration: String(a['Total Horas Formato'] || a.formattedDuration || ''),
          divisionBreakdown: breakdown,
          exportedItems: items,
        };
      }).filter((a) => a.id);

      return {
        success: true,
        message: 'Datos sincronizados desde Google Sheets.',
        data: {
          materials: parsedMaterials,
          personnel: parsedPersonnel,
          guardShifts: parsedShifts,
          monthlyArchives: parsedArchives,
        },
      };
    } else {
      return { success: false, message: resData?.message || 'Error al obtener datos de Google Sheets.' };
    }
  } catch (err: any) {
    console.error('Fetch Google Sheets Error:', err);
    return { success: false, message: `Error de lectura: ${err.message || err.toString()}` };
  }
}

export async function syncWithGoogleSheets(
  url: string,
  state: { 
    materials: MaterialSignal[]; 
    personnel: Personnel[]; 
    guardShifts: GuardShiftRecord[];
    monthlyArchives?: MonthlyArchiveLog[];
  }
): Promise<{ success: boolean; message: string }> {
  if (!url || !url.startsWith('http')) {
    return { success: false, message: 'URL de Google Apps Script no configurada o inválida.' };
  }

  try {
    const formattedPersonnel = state.personnel.map((p) => ({
      'ID': p.id,
      'Nombre': p.name,
      'Rol': p.role,
      'División': p.division,
      'Días Guardia Trabajados': p.guardDaysWorked,
      'Días Libres Generados': p.daysOffGenerated,
      'Días Libres Disfrutados': p.daysOffTaken,
      'Balance Pendiente': p.balanceDays,
      'PIN': p.pin || '',
    }));

    const formattedArchives = (state.monthlyArchives || []).map((a) => ({
      'ID Cierre': a.id,
      'Período': a.monthPeriod,
      'Fecha Exportación': a.exportDate,
      'Exportado Por': a.exportedBy,
      'Rol Exporter': a.exporterRole,
      'Cantidad Materiales': a.materialsCount,
      'Total Horas Formato': a.formattedDuration,
      'Total Segundos': a.totalDurationSeconds,
      'Detalle Desglose': JSON.stringify(a.divisionBreakdown || {}),
      'Materiales Exportados': JSON.stringify(a.exportedItems || []),
    }));

    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'syncAllData',
        materials: state.materials,
        personnel: formattedPersonnel,
        guardShifts: state.guardShifts,
        monthlyArchives: formattedArchives,
      }),
    });

    const data = await response.json();
    if (data && data.success) {
      return { success: true, message: data.message || 'Sincronización exitosa con Google Sheets.' };
    } else {
      return { success: false, message: data.message || 'Error en respuesta de Google Apps Script.' };
    }
  } catch (err: any) {
    console.error('Apps Script Sync Error:', err);
    return { success: false, message: `Error de conexión: ${err.message || err.toString()}` };
  }
}
