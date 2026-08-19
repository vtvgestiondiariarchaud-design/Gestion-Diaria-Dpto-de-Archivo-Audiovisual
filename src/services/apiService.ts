import { MaterialSignal, Personnel, GuardShiftRecord, MaterialFamilyGroup, AppState, MaterialStatus, MonthlyArchiveLog, UserProfile, BackupSnapshot } from '../types';
import { INITIAL_MATERIALS, INITIAL_PERSONNEL, INITIAL_GUARD_SHIFTS, DEFAULT_USERS, DEFAULT_APPS_SCRIPT_URL } from '../data/initialData';

const LOCAL_STORAGE_KEY_MATERIALS = 'vtv_archivo_materials_v1';
const LOCAL_STORAGE_KEY_PERSONNEL = 'vtv_archivo_personnel_v1';
const LOCAL_STORAGE_KEY_SHIFTS = 'vtv_archivo_shifts_v1';
const LOCAL_STORAGE_KEY_APPS_SCRIPT_URL = 'vtv_archivo_apps_script_url_v1';
const LOCAL_STORAGE_KEY_USER = 'vtv_archivo_active_user_v1';
const LOCAL_STORAGE_KEY_PINS = 'vtv_archivo_user_pins_v1';
const LOCAL_STORAGE_KEY_MONTHLY_ARCHIVES = 'vtv_archivo_monthly_archives_v1';
export const LOCAL_STORAGE_KEY_BACKUP_SNAPSHOTS = 'vtv_archivo_backup_snapshots_v1';

// Helper for duration conversions
export function durationToSeconds(durationInput?: string | number | null): number {
  if (durationInput === undefined || durationInput === null || durationInput === '') return 0;
  if (typeof durationInput === 'number') {
    if (isNaN(durationInput) || durationInput < 0) return 0;
    if (durationInput > 86400 * 30) return 0;
    return Math.floor(durationInput);
  }

  const str = String(durationInput).trim();
  if (!str) return 0;

  // Extract time from ISO timestamp or date prefix (e.g., "1899-12-30T01:15:00.000Z")
  const timeMatch = str.match(/(?:[T\s]|^)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch && (str.includes('-') || str.includes('/') || str.toLowerCase().includes('t') || str.toLowerCase().includes('gmt'))) {
    const hh = parseInt(timeMatch[1], 10) || 0;
    const mm = parseInt(timeMatch[2], 10) || 0;
    const ss = parseInt(timeMatch[3], 10) || 0;
    const safeH = hh >= 1800 ? 0 : hh;
    return safeH * 3600 + mm * 60 + ss;
  }

  // Standard split by ":"
  const parts = str.split(':').map((p) => p.trim());
  if (parts.length === 3) {
    let hh = parseInt(parts[0], 10) || 0;
    const mm = parseInt(parts[1], 10) || 0;
    const ss = parseInt(parts[2], 10) || 0;
    if (hh >= 1800) hh = 0; // Guard against corrupt 1899 hours from Sheets epoch
    return hh * 3600 + mm * 60 + ss;
  } else if (parts.length === 2) {
    const mm = parseInt(parts[0], 10) || 0;
    const ss = parseInt(parts[1], 10) || 0;
    return mm * 60 + ss;
  } else if (parts.length === 1 && !isNaN(Number(str))) {
    const val = Number(str);
    if (val > 86400 * 30) return 0;
    return Math.floor(val);
  }

  return 0;
}

export function secondsToDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatDurationHHMMSS(durationInput?: string | number | null): string {
  const secs = durationToSeconds(durationInput);
  return secondsToDuration(secs);
}

export function getLocalDateISOString(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function format12HourTime(h: number, m: number, includeSeconds = false, s = 0): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (includeSeconds) {
    return `${pad(h12)}:${pad(m)}:${pad(s)} ${ampm}`;
  }
  return `${pad(h12)}:${pad(m)} ${ampm}`;
}

export function normalizeDateString(val: any): string {
  if (!val) return '';
  const str = String(val).trim();
  if (!str) return '';

  // 1. If string starts with YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // 2. If DD/MM/YYYY or D/M/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dmyMatch) {
    const pad = (n: string) => n.padStart(2, '0');
    return `${dmyMatch[3]}-${pad(dmyMatch[2])}-${pad(dmyMatch[1])}`;
  }

  // 3. Try parsing JS Date
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    if (year >= 2000) {
      return getLocalDateISOString(d);
    }
  }

  return str.substring(0, 10);
}

export function parseAnyDate(dateInput?: string): Date {
  if (!dateInput) return new Date();
  const str = dateInput.trim();

  // Check for AM/PM suffix
  const isPM = /PM$/i.test(str) || /p\.?\s*m\.?$/i.test(str);
  const isAM = /AM$/i.test(str) || /a\.?\s*m\.?$/i.test(str);

  // Match DD/MM/YYYY hh:mm:ss or DD/MM/YYYY hh:mm
  const ddmmyyyyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ddmmyyyyMatch) {
    const [, day, month, year, rawHh, mm = '0', ss = '0'] = ddmmyyyyMatch;
    let hh = rawHh !== undefined ? Number(rawHh) : 0;
    if (isPM && hh < 12) hh += 12;
    if (isAM && hh === 12) hh = 0;
    return new Date(Number(year), Number(month) - 1, Number(day), hh, Number(mm), Number(ss));
  }

  // Match YYYY-MM-DD hh:mm:ss or YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const [, year, month, day, rawHh, mm = '0', ss = '0'] = isoMatch;
    let hh = rawHh !== undefined ? Number(rawHh) : 0;
    if (isPM && hh < 12) hh += 12;
    if (isAM && hh === 12) hh = 0;
    return new Date(Number(year), Number(month) - 1, Number(day), hh, Number(mm), Number(ss));
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  return new Date();
}

export function getFormattedDateTime(dateInput?: Date | string | number): string {
  const formatObj = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const timeStr = format12HourTime(d.getHours(), d.getMinutes());
    return `${day}/${month}/${year} ${timeStr}`;
  };

  if (!dateInput) {
    return formatObj(new Date());
  }

  if (dateInput instanceof Date) {
    return formatObj(dateInput);
  }

  if (typeof dateInput === 'string') {
    const str = dateInput.trim();
    if (!str) return getFormattedDateTime();

    // Match DD/MM/YYYY with AM/PM already present
    const ddmmyyyyAmPmMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)$/i);
    if (ddmmyyyyAmPmMatch) {
      const [, day, month, year, rawHh, mm, , ampm] = ddmmyyyyAmPmMatch;
      const pad = (n: string) => n.padStart(2, '0');
      let hh = Number(rawHh);
      if (hh === 0) hh = 12;
      return `${pad(day)}/${pad(month)}/${year} ${pad(String(hh))}:${pad(mm)} ${ampm.toUpperCase()}`;
    }

    // Match DD/MM/YYYY HH:mm without AM/PM
    const ddmmyyyyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (ddmmyyyyMatch) {
      const [, day, month, year, rawHh = '0', mm = '0'] = ddmmyyyyMatch;
      const pad = (n: string) => n.padStart(2, '0');
      const timeStr = format12HourTime(Number(rawHh), Number(mm));
      return `${pad(day)}/${pad(month)}/${year} ${timeStr}`;
    }

    // Match YYYY-MM-DD HH:mm or ISO
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{1,2}))?/);
    if (isoMatch) {
      const [, year, month, day, rawHh = '0', mm = '0'] = isoMatch;
      const pad = (n: string) => n.padStart(2, '0');
      const timeStr = format12HourTime(Number(rawHh), Number(mm));
      return `${pad(day)}/${pad(month)}/${year} ${timeStr}`;
    }

    const parsedDate = new Date(str);
    if (!isNaN(parsedDate.getTime())) {
      return formatObj(parsedDate);
    }

    return str;
  }

  const parsedDate = new Date(dateInput);
  if (!isNaN(parsedDate.getTime())) {
    return formatObj(parsedDate);
  }

  return String(dateInput);
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
  groups.sort((a, b) => parseAnyDate(b.creationDate).getTime() - parseAnyDate(a.creationDate).getTime());

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

export function deduplicateGuardShifts(list: GuardShiftRecord[]): GuardShiftRecord[] {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set<string>();
  const seenCombos = new Set<string>();
  const result: GuardShiftRecord[] = [];

  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s) continue;

    const normDate = normalizeDateString(s.date);
    const comboKey = `${s.personnelId}_${normDate}_${s.shiftType}`;

    if (comboKey && seenCombos.has(comboKey)) {
      continue; // Skip duplicate shift assignments for same person and date
    }
    if (comboKey) seenCombos.add(comboKey);

    let cleanId = String(s.id || '').trim();
    if (!cleanId || seenIds.has(cleanId)) {
      cleanId = `sh-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
    }
    seenIds.add(cleanId);

    result.push({
      ...s,
      id: cleanId,
      date: normDate,
      endDate: s.endDate ? normalizeDateString(s.endDate) : undefined,
    });
  }

  return result;
}

/**
 * Fusión inteligente de materiales para evitar pérdida de registros locales no sincronizados.
 * Si un material fue registrado localmente (por ejemplo, del 13/08 en adelante) y aún no está en Google Sheets,
 * se conserva y se marca para sincronizar a Google Sheets en lugar de borrarlo.
 */
export function mergeMaterials(
  local: MaterialSignal[],
  remote: MaterialSignal[]
): { merged: MaterialSignal[]; hasLocalUnsynced: boolean } {
  if (!remote || remote.length === 0) {
    return { merged: local || [], hasLocalUnsynced: (local && local.length > 0) };
  }
  if (!local || local.length === 0) {
    return { merged: remote, hasLocalUnsynced: false };
  }

  const remoteMap = new Map<string, MaterialSignal>();
  remote.forEach((m) => {
    if (m && m.id) remoteMap.set(m.id, m);
  });

  let hasLocalUnsynced = false;
  const mergedMap = new Map<string, MaterialSignal>();

  // 1. Agregar todos los remotos
  remote.forEach((m) => {
    if (m && m.id) mergedMap.set(m.id, m);
  });

  // 2. Revisar locales y preservar registros no existentes en remoto o con cambios recientes
  local.forEach((localItem) => {
    if (!localItem || !localItem.id) return;
    if (!remoteMap.has(localItem.id)) {
      // Registro nuevo creado localmente que no está en Google Sheets: ¡PRESERVAR!
      mergedMap.set(localItem.id, localItem);
      hasLocalUnsynced = true;
    } else {
      const remoteItem = remoteMap.get(localItem.id)!;
      // Si el local tiene un estado más avanzado (ej. finalizado o catalogado) que el remoto
      if (
        (localItem.isFinalized && !remoteItem.isFinalized) ||
        (localItem.isCataloged && !remoteItem.isCataloged)
      ) {
        mergedMap.set(localItem.id, localItem);
        hasLocalUnsynced = true;
      }
    }
  });

  const merged = Array.from(mergedMap.values()).sort(
    (a, b) => parseAnyDate(b.creationDate).getTime() - parseAnyDate(a.creationDate).getTime()
  );

  return { merged, hasLocalUnsynced };
}

/**
 * Fusión inteligente de guardias para evitar sobrescribir turnos agregados recientemente.
 */
export function mergeGuardShifts(
  local: GuardShiftRecord[],
  remote: GuardShiftRecord[]
): { merged: GuardShiftRecord[]; hasLocalUnsynced: boolean } {
  if (!remote || remote.length === 0) {
    return { merged: deduplicateGuardShifts(local || []), hasLocalUnsynced: (local && local.length > 0) };
  }
  if (!local || local.length === 0) {
    return { merged: deduplicateGuardShifts(remote), hasLocalUnsynced: false };
  }

  const remoteIds = new Set(remote.map((s) => s.id));
  let hasLocalUnsynced = false;
  const combined = [...remote];

  local.forEach((l) => {
    if (l && l.id && !remoteIds.has(l.id)) {
      combined.push(l);
      hasLocalUnsynced = true;
    }
  });

  const merged = deduplicateGuardShifts(combined);
  return { merged, hasLocalUnsynced };
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
        duration: formatDurationHHMMSS(m.duration),
        creationDate: getFormattedDateTime(m.creationDate),
        catalogedAt: m.catalogedAt ? getFormattedDateTime(m.catalogedAt) : undefined,
        finalizedAt: m.finalizedAt ? getFormattedDateTime(m.finalizedAt) : undefined,
        assignedAt: m.assignedAt ? getFormattedDateTime(m.assignedAt) : undefined,
        isIngested: m.isIngested !== undefined ? m.isIngested : true,
        isCataloged: m.isCataloged !== undefined ? m.isCataloged : (m.status === 'Por Archivar' || m.status === 'Finalizado'),
        isFinalized: m.isFinalized !== undefined ? m.isFinalized : (m.status === 'Finalizado'),
      }));
    } else {
      materials = INITIAL_MATERIALS.map((m) => ({
        ...m,
        duration: formatDurationHHMMSS(m.duration),
        creationDate: getFormattedDateTime(m.creationDate),
        catalogedAt: m.catalogedAt ? getFormattedDateTime(m.catalogedAt) : undefined,
        finalizedAt: m.finalizedAt ? getFormattedDateTime(m.finalizedAt) : undefined,
        assignedAt: m.assignedAt ? getFormattedDateTime(m.assignedAt) : undefined,
      }));
    }

    const localPer = localStorage.getItem(LOCAL_STORAGE_KEY_PERSONNEL);
    if (localPer) {
      try {
        const parsed: Personnel[] = JSON.parse(localPer);
        personnel = deduplicatePersonnel(parsed);
      } catch (e) {
        personnel = deduplicatePersonnel(INITIAL_PERSONNEL);
      }
    } else {
      personnel = deduplicatePersonnel(INITIAL_PERSONNEL);
    }
    saveLocalPersonnel(personnel);

    const localShifts = localStorage.getItem(LOCAL_STORAGE_KEY_SHIFTS);
    if (localShifts) {
      try {
        const parsed = JSON.parse(localShifts);
        if (Array.isArray(parsed)) {
          guardShifts = deduplicateGuardShifts(parsed);
        }
      } catch (e) {
        guardShifts = [];
      }
    }

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

// Safe localStorage setter that gracefully frees up snapshot space if quota limit is reached
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    // If quota exceeded, clean up old snapshots first to guarantee primary database save
    if (
      e?.name === 'QuotaExceededError' ||
      e?.code === 22 ||
      e?.code === 1014 ||
      String(e).toLowerCase().includes('quota')
    ) {
      console.warn(`Alcanzado límite de cuota en almacenamiento local al guardar '${key}'. Liberando historial de puntos de restauración...`);
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY_BACKUP_SNAPSHOTS);
        localStorage.setItem(key, value);
        return;
      } catch (retryErr) {
        console.error(`No se pudo guardar '${key}' tras liberar snapshots:`, retryErr);
      }
    }
    console.error(`Error guardando '${key}':`, e);
  }
}

export function saveLocalMonthlyArchives(archives: MonthlyArchiveLog[]) {
  safeSetItem(LOCAL_STORAGE_KEY_MONTHLY_ARCHIVES, JSON.stringify(archives));
}

export function generateMonthlyArchiveLog(materials: MaterialSignal[], user: UserProfile): MonthlyArchiveLog {
  const now = new Date();
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const monthPeriod = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const exportDate = getFormattedDateTime(now);

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
  const dateStr = getLocalDateISOString();
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
  const normalized = materials.map((m) => ({
    ...m,
    duration: formatDurationHHMMSS(m.duration),
    creationDate: getFormattedDateTime(m.creationDate),
    catalogedAt: m.catalogedAt ? getFormattedDateTime(m.catalogedAt) : undefined,
    finalizedAt: m.finalizedAt ? getFormattedDateTime(m.finalizedAt) : undefined,
    assignedAt: m.assignedAt ? getFormattedDateTime(m.assignedAt) : undefined,
  }));
  safeSetItem(LOCAL_STORAGE_KEY_MATERIALS, JSON.stringify(normalized));
}

export function saveLocalPersonnel(personnel: Personnel[]) {
  safeSetItem(LOCAL_STORAGE_KEY_PERSONNEL, JSON.stringify(personnel));
}

export function saveLocalGuardShifts(shifts: GuardShiftRecord[]) {
  safeSetItem(LOCAL_STORAGE_KEY_SHIFTS, JSON.stringify(shifts));
}

export function saveLocalAppsScriptUrl(url: string) {
  safeSetItem(LOCAL_STORAGE_KEY_APPS_SCRIPT_URL, url);
}

export function saveLocalActiveUser(user: any) {
  safeSetItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(user));
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
  safeSetItem(LOCAL_STORAGE_KEY_PINS, JSON.stringify(pins));
}

// Backup & Recovery System
export function createBackupSnapshot(
  materials: MaterialSignal[],
  personnel: Personnel[],
  guardShifts: GuardShiftRecord[],
  monthlyArchives: MonthlyArchiveLog[] = [],
  note: string = 'Respaldo automático'
): BackupSnapshot | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_BACKUP_SNAPSHOTS);
    const existing: BackupSnapshot[] = raw ? JSON.parse(raw) : [];

    const newSnapshot: BackupSnapshot = {
      id: `SNP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: getFormattedDateTime(new Date()),
      note,
      materialsCount: materials.length,
      personnelCount: personnel.length,
      shiftsCount: guardShifts.length,
      materials: JSON.parse(JSON.stringify(materials)),
      personnel: JSON.parse(JSON.stringify(personnel)),
      guardShifts: JSON.parse(JSON.stringify(guardShifts)),
      monthlyArchives: JSON.parse(JSON.stringify(monthlyArchives)),
    };

    // Keep at most 3 snapshots in local storage to prevent exceeding browser quota
    const updated = [newSnapshot, ...existing.slice(0, 2)];
    
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_BACKUP_SNAPSHOTS, JSON.stringify(updated));
    } catch (quotaErr) {
      // If quota exceeded, try storing only the single newest snapshot
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY_BACKUP_SNAPSHOTS, JSON.stringify([newSnapshot]));
      } catch (singleErr) {
        console.warn('No hay espacio suficiente para almacenar un snapshot local adicional en localStorage.');
      }
    }

    return newSnapshot;
  } catch (e) {
    console.warn('Advertencia al crear snapshot:', e);
    return null;
  }
}

export function loadBackupSnapshots(): BackupSnapshot[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_BACKUP_SNAPSHOTS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error loading backup snapshots:', e);
    return [];
  }
}

export function clearBackupSnapshots(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY_BACKUP_SNAPSHOTS);
  } catch (e) {
    console.error(e);
  }
}

export function exportStateToJSON(
  materials: MaterialSignal[],
  personnel: Personnel[],
  guardShifts: GuardShiftRecord[],
  monthlyArchives: MonthlyArchiveLog[] = []
): void {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    system: 'VTV Gestión y Archivo Audiovisual',
    materials,
    personnel,
    guardShifts,
    monthlyArchives,
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = getLocalDateISOString();
  link.setAttribute('href', url);
  link.setAttribute('download', `VTV_Respaldo_Completo_${dateStr}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function parseImportedJSON(jsonString: string): {
  success: boolean;
  message: string;
  data?: {
    materials: MaterialSignal[];
    personnel: Personnel[];
    guardShifts: GuardShiftRecord[];
    monthlyArchives?: MonthlyArchiveLog[];
  };
} {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, message: 'El archivo JSON no tiene un formato válido.' };
    }

    const rawMats = Array.isArray(parsed.materials) ? parsed.materials : [];
    const rawPers = Array.isArray(parsed.personnel) ? parsed.personnel : [];
    const rawShifts = Array.isArray(parsed.guardShifts) ? parsed.guardShifts : [];
    const rawArchives = Array.isArray(parsed.monthlyArchives) ? parsed.monthlyArchives : [];

    const materials: MaterialSignal[] = rawMats.map((m: any) => ({
      ...m,
      duration: formatDurationHHMMSS(m.duration),
      creationDate: getFormattedDateTime(m.creationDate),
      catalogedAt: m.catalogedAt ? getFormattedDateTime(m.catalogedAt) : undefined,
      finalizedAt: m.finalizedAt ? getFormattedDateTime(m.finalizedAt) : undefined,
      assignedAt: m.assignedAt ? getFormattedDateTime(m.assignedAt) : undefined,
      isIngested: m.isIngested !== undefined ? m.isIngested : true,
      isCataloged: m.isCataloged !== undefined ? m.isCataloged : (m.status === 'Por Archivar' || m.status === 'Finalizado'),
      isFinalized: m.isFinalized !== undefined ? m.isFinalized : (m.status === 'Finalizado'),
    }));

    const personnel = deduplicatePersonnel(rawPers);
    const guardShifts = deduplicateGuardShifts(rawShifts);

    return {
      success: true,
      message: `Archivo importado exitosamente (${materials.length} materiales, ${personnel.length} personal, ${guardShifts.length} guardias).`,
      data: {
        materials,
        personnel,
        guardShifts,
        monthlyArchives: rawArchives,
      },
    };
  } catch (err: any) {
    return { success: false, message: `Error al leer archivo JSON: ${err.message || err.toString()}` };
  }
}

// Google Apps Script API Services - Respaldos Diarios y Mensuales en Google Drive
export async function createDailyBackupInDrive(
  url: string,
  dateStr: string,
  materials: MaterialSignal[],
  userName: string = 'Operador VTV'
): Promise<{ success: boolean; message: string; sheetName?: string }> {
  if (!url || !url.startsWith('http')) {
    return { 
      success: false, 
      message: 'URL de Google Apps Script no configurada. Configure la URL en el módulo correspondiente para enviar a Google Drive.' 
    };
  }

  try {
    const formattedMaterials = materials.map((m) => {
      let assignedStr = 'Sin asignar';
      if (m.assignedPersons && m.assignedPersons.length > 0) {
        assignedStr = m.assignedPersons.join(', ');
      } else if (m.assignedTo) {
        assignedStr = m.assignedTo;
      }

      return {
        id: m.id,
        familyId: m.familyId || m.id,
        title: m.title,
        signalType: m.signalType,
        division: m.division,
        duration: formatDurationHHMMSS(m.duration),
        creationDate: m.creationDate,
        createdBy: m.createdBy,
        createdByRole: m.creatorRole || m.createdByRole || '',
        status: m.status,
        isRequestTask: m.isRequestTask ? true : false,
        assignedTo: assignedStr,
        assignedToRole: m.assignedToRole || '',
        assignedAt: m.assignedAt || '',
        isIngested: m.isIngested !== undefined ? m.isIngested : true,
        isCataloged: m.isCataloged !== undefined ? m.isCataloged : (m.status === 'Por Archivar' || m.status === 'Finalizado'),
        catalogedBy: m.catalogedBy || 'N/A',
        catalogedAt: m.catalogedAt || 'N/A',
        isFinalized: m.isFinalized !== undefined ? m.isFinalized : (m.status === 'Finalizado'),
        finalizedBy: m.finalizedBy || 'N/A',
        finalizedAt: m.finalizedAt || 'N/A',
        notes: m.notes || '',
      };
    });

    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'createDailyBackupSheet',
        date: dateStr,
        materials: formattedMaterials,
        user: userName,
      }),
    });

    const data = await response.json();
    if (data && data.success) {
      return {
        success: true,
        message: data.message || `Hoja de respaldo diario creada exitosamente en Google Drive.`,
        sheetName: data.sheetName,
      };
    } else {
      return { success: false, message: data?.message || 'Error al crear la hoja en Google Drive.' };
    }
  } catch (err: any) {
    console.error('Error creating daily backup sheet:', err);
    return { success: false, message: `Error de conexión con Google Drive: ${err.message || err.toString()}` };
  }
}

export async function createMonthlyBackupInDrive(
  url: string,
  monthPeriod: string,
  materials: MaterialSignal[],
  summary: {
    totalCount: number;
    formattedDuration: string;
    prensaCount: number;
    programacionCount: number;
    ingestaCount: number;
    finalizedCount: number;
  },
  userName: string = 'Gerencia de Archivo'
): Promise<{ success: boolean; message: string; sheetName?: string }> {
  if (!url || !url.startsWith('http')) {
    return { 
      success: false, 
      message: 'URL de Google Apps Script no configurada. Configure la URL en el módulo correspondiente para enviar a Google Drive.' 
    };
  }

  try {
    const formattedMaterials = materials.map((m) => {
      let assignedStr = 'Sin asignar';
      if (m.assignedPersons && m.assignedPersons.length > 0) {
        assignedStr = m.assignedPersons.join(', ');
      } else if (m.assignedTo) {
        assignedStr = m.assignedTo;
      }

      return {
        id: m.id,
        familyId: m.familyId || m.id,
        title: m.title,
        signalType: m.signalType,
        division: m.division,
        duration: formatDurationHHMMSS(m.duration),
        creationDate: m.creationDate,
        createdBy: m.createdBy,
        createdByRole: m.creatorRole || m.createdByRole || '',
        status: m.status,
        isRequestTask: m.isRequestTask ? true : false,
        assignedTo: assignedStr,
        assignedToRole: m.assignedToRole || '',
        assignedAt: m.assignedAt || '',
        isIngested: m.isIngested !== undefined ? m.isIngested : true,
        isCataloged: m.isCataloged !== undefined ? m.isCataloged : (m.status === 'Por Archivar' || m.status === 'Finalizado'),
        catalogedBy: m.catalogedBy || 'N/A',
        catalogedAt: m.catalogedAt || 'N/A',
        isFinalized: m.isFinalized !== undefined ? m.isFinalized : (m.status === 'Finalizado'),
        finalizedBy: m.finalizedBy || 'N/A',
        finalizedAt: m.finalizedAt || 'N/A',
        notes: m.notes || '',
      };
    });

    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'createMonthlyBackupSheet',
        monthPeriod,
        materials: formattedMaterials,
        summary,
        user: userName,
      }),
    });

    const data = await response.json();
    if (data && data.success) {
      return {
        success: true,
        message: data.message || `Hoja de respaldo mensual creada exitosamente en Google Drive.`,
        sheetName: data.sheetName,
      };
    } else {
      return { success: false, message: data?.message || 'Error al crear la hoja mensual en Google Drive.' };
    }
  } catch (err: any) {
    console.error('Error creating monthly backup sheet:', err);
    return { success: false, message: `Error de conexión con Google Drive: ${err.message || err.toString()}` };
  }
}

// Client-side CSV Exporters with Full Metadata
export function exportDailyBackupToCSV(dateStr: string, materials: MaterialSignal[]): void {
  const headers = [
    'ID Material',
    'ID Familia',
    'Título / Descripción',
    'Tipo de Señal',
    'División',
    'Duración',
    'Fecha Creación',
    'Creado Por',
    'Rol Creador',
    'Estado',
    'Es Solicitud',
    'Asignado A',
    'Rol Asignado',
    'Fecha Asignación',
    'Ingestado',
    'Catalogado',
    'Catalogado Por',
    'Fecha Catalogación',
    'Finalizado',
    'Finalizado Por',
    'Fecha Finalizado',
    'Notas / Observaciones'
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = materials.map((m) => {
    let assignedStr = 'Sin asignar';
    if (m.assignedPersons && m.assignedPersons.length > 0) {
      assignedStr = m.assignedPersons.join(', ');
    } else if (m.assignedTo) {
      assignedStr = m.assignedTo;
    }

    return [
      escapeCSV(m.id),
      escapeCSV(m.familyId || m.id),
      escapeCSV(m.title),
      escapeCSV(m.signalType),
      escapeCSV(m.division),
      escapeCSV(formatDurationHHMMSS(m.duration)),
      escapeCSV(m.creationDate),
      escapeCSV(m.createdBy),
      escapeCSV(m.creatorRole || m.createdByRole || ''),
      escapeCSV(m.status),
      escapeCSV(m.isRequestTask ? 'SI' : 'NO'),
      escapeCSV(assignedStr),
      escapeCSV(m.assignedToRole || ''),
      escapeCSV(m.assignedAt || ''),
      escapeCSV(m.isIngested ? 'SI' : 'NO'),
      escapeCSV(m.isCataloged ? 'SI' : 'NO'),
      escapeCSV(m.catalogedBy || 'N/A'),
      escapeCSV(m.catalogedAt || 'N/A'),
      escapeCSV(m.isFinalized ? 'SI' : 'NO'),
      escapeCSV(m.finalizedBy || 'N/A'),
      escapeCSV(m.finalizedAt || 'N/A'),
      escapeCSV(m.notes || ''),
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanDate = dateStr.replace(/[\/-]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `VTV_Respaldo_Diario_${cleanDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportMonthlyBackupToCSV(
  monthPeriod: string,
  materials: MaterialSignal[],
  summary: { totalCount: number; formattedDuration: string }
): void {
  const headers = [
    'ID Material',
    'ID Familia',
    'Título / Descripción',
    'Tipo de Señal',
    'División',
    'Duración',
    'Fecha Creación',
    'Creado Por',
    'Rol Creador',
    'Estado',
    'Es Solicitud',
    'Asignado A',
    'Rol Asignado',
    'Fecha Asignación',
    'Ingestado',
    'Catalogado',
    'Catalogado Por',
    'Fecha Catalogación',
    'Finalizado',
    'Finalizado Por',
    'Fecha Finalizado',
    'Notas / Observaciones'
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = materials.map((m) => {
    let assignedStr = 'Sin asignar';
    if (m.assignedPersons && m.assignedPersons.length > 0) {
      assignedStr = m.assignedPersons.join(', ');
    } else if (m.assignedTo) {
      assignedStr = m.assignedTo;
    }

    return [
      escapeCSV(m.id),
      escapeCSV(m.familyId || m.id),
      escapeCSV(m.title),
      escapeCSV(m.signalType),
      escapeCSV(m.division),
      escapeCSV(formatDurationHHMMSS(m.duration)),
      escapeCSV(m.creationDate),
      escapeCSV(m.createdBy),
      escapeCSV(m.creatorRole || m.createdByRole || ''),
      escapeCSV(m.status),
      escapeCSV(m.isRequestTask ? 'SI' : 'NO'),
      escapeCSV(assignedStr),
      escapeCSV(m.assignedToRole || ''),
      escapeCSV(m.assignedAt || ''),
      escapeCSV(m.isIngested ? 'SI' : 'NO'),
      escapeCSV(m.isCataloged ? 'SI' : 'NO'),
      escapeCSV(m.catalogedBy || 'N/A'),
      escapeCSV(m.catalogedAt || 'N/A'),
      escapeCSV(m.isFinalized ? 'SI' : 'NO'),
      escapeCSV(m.finalizedBy || 'N/A'),
      escapeCSV(m.finalizedAt || 'N/A'),
      escapeCSV(m.notes || ''),
    ].join(';');
  });

  const summaryHeader = `Respaldo Mensual: ${monthPeriod};Total Materiales: ${summary.totalCount};Duración Total: ${summary.formattedDuration}\r\n`;
  const csvContent = '\uFEFF' + summaryHeader + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanMonth = monthPeriod.replace(/[\/\s-]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `VTV_Respaldo_Mensual_${cleanMonth}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
