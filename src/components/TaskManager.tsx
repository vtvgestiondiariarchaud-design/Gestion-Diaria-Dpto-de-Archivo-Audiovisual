import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Kanban, Plus, Search, Filter, Calendar, CheckSquare, Users,
  Clock, AlertCircle, CheckCircle2, ChevronRight, ChevronDown, X, Edit3, Trash2,
  Bell, Check, Tag, Sparkles, FolderPlus, ShieldAlert, ArrowRight,
  UserCheck, AlertTriangle, Layers, FileText, Printer, Copy, Database,
  Code2, Download, ExternalLink, BarChart3, Eye, Lock, Crown, Scissors,
  FileCheck, Archive, Award, CheckCheck, BellOff, Link2, History,
  ChevronUp, RotateCcw, Unlock, Sliders, Building2
} from 'lucide-react';
import { TaskBoard, TaskCard, TaskNotification, TaskStatus, Worker, Division, UserRole } from '../types';

interface TaskManagerProps {
  boards: TaskBoard[];
  cards: TaskCard[];
  notifications: TaskNotification[];
  workers: Worker[];
  divisions: Division[];
  currentSession: {
    userId: string;
    name: string;
    role: UserRole;
    divisionId?: string;
    email: string;
    cargo: string;
  } | null;
  onAddBoard: (board: TaskBoard) => void;
  onDeleteBoard: (boardId: string) => void;
  onSaveCard: (card: TaskCard) => void;
  onDeleteCard: (cardId: string) => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead?: (workerId?: string) => void;
  onClearAllNotifications?: (workerId?: string) => void;
  onDeleteNotification?: (id: string) => void;
  onAddNotificationToast: (title: string, desc: string, type: 'success' | 'info') => void;
  onManualSync?: () => Promise<void> | void;
  isSyncing?: boolean;
}

// Helper para obtener YYYY-MM-DD local en zona horaria Venezuela (America/Caracas, UTC-4)
const getLocalYMD = (d: Date = new Date()): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  } catch {
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
};

// Helper para normalizar cualquier string de fecha a YYYY-MM-DD respetando la hora local (00:00 a 23:59)
const normalizeToYMD = (dateStr?: string): string => {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    let parseable = trimmed;
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
      parseable = trimmed.replace(' ', 'T') + '-04:00';
    }
    const d = new Date(parseable);
    if (!isNaN(d.getTime())) {
      return getLocalYMD(d);
    }
  } catch {}

  return trimmed.slice(0, 10);
};

// Helper para determinar si una tarea está asociada o fue procesada por un usuario (asignado, creador, ingestado por, editado por, documentado por o finalizado por)
const isCardAssociatedWithWorker = (card: TaskCard, workerId: string, workerName?: string): boolean => {
  if (!workerId) return false;

  // 1. Asignado explícitamente en el arreglo
  if (card.assignedWorkerIds && card.assignedWorkerIds.includes(workerId)) return true;

  // 2. Creador de la tarea
  if (card.createdByWorkerId === workerId) return true;

  // 3. Procesador explícito por ID de usuario en cualquiera de las etapas
  if (card.ingestedByWorkerId === workerId) return true;
  if (card.editedByWorkerId === workerId) return true;
  if (card.documentedByWorkerId === workerId) return true;
  if (card.finalizedByWorkerId === workerId) return true;
  if (card.discardedByWorkerId === workerId) return true;

  // 4. Coincidencia por nombre completo del usuario si está registrado en la etapa
  if (workerName && workerName.trim()) {
    const wLower = workerName.toLowerCase().trim();
    if (card.ingestedByWorkerName && card.ingestedByWorkerName.toLowerCase().trim() === wLower) return true;
    if (card.editedByWorkerName && card.editedByWorkerName.toLowerCase().trim() === wLower) return true;
    if (card.documentedByWorkerName && card.documentedByWorkerName.toLowerCase().trim() === wLower) return true;
    if (card.finalizedByWorkerName && card.finalizedByWorkerName.toLowerCase().trim() === wLower) return true;
  }

  return false;
};

// Helpers para cálculo y formateo de duración de material audiovisual
const parseDurationToSeconds = (durStr?: string): number => {
  if (!durStr) return 0;
  const clean = durStr.trim().toLowerCase();
  if (!clean || clean === '0' || clean === '00:00:00') return 0;

  // Handle formats like "1h 30m", "90m", "1.5h", "30s"
  if (clean.includes('h') || clean.includes('m') || clean.includes('s')) {
    let totalSec = 0;
    const hMatch = clean.match(/([\d.]+)\s*h/);
    const mMatch = clean.match(/([\d.]+)\s*m/);
    const sMatch = clean.match(/([\d.]+)\s*s/);
    if (hMatch) totalSec += parseFloat(hMatch[1]) * 3600;
    if (mMatch) totalSec += parseFloat(mMatch[1]) * 60;
    if (sMatch) totalSec += parseFloat(sMatch[1]);
    return Math.round(totalSec);
  }

  // Split by colon
  const parts = clean.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  } else if (parts.length === 2) {
    // HH:MM format (e.g. "01:30" = 1h 30m = 5400s)
    return (parts[0] * 3600) + (parts[1] * 60);
  } else if (parts.length === 1) {
    const num = parseFloat(clean);
    if (!isNaN(num)) return Math.round(num * 60); // minutes
  }
  return 0;
};

const formatSecondsToHHMMSS = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return '00:00:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Helper para determinar el estilo y etiqueta de resaltado según el rol/cargo del colaborador:
// - Jefe/Coordinadores: Resaltado Amarillo (amber)
// - La Adjunta: Resaltado Morado (purple)
// - El Gerente / Director / Superadmin: Resaltado Blanco (white)
export const getWorkerHighlightInfo = (w: Worker) => {
  const cargoLower = (w.cargo || '').toLowerCase();
  const nameLower = (w.name || '').toLowerCase();

  // 1. Gerente / Director / Superadmin -> Blanco
  if (
    w.role === 'superadmin' ||
    cargoLower.includes('gerente') ||
    cargoLower.includes('director') ||
    cargoLower.includes('directora') ||
    cargoLower.includes('gerencia')
  ) {
    return {
      type: 'gerente' as const,
      label: 'Gerencia',
      listClass: 'bg-white/10 text-white border-white/40 hover:bg-white/20 font-bold shadow-[0_0_8px_rgba(255,255,255,0.2)]',
      assignedClass: 'bg-white text-slate-950 border-white font-black shadow-[0_0_12px_rgba(255,255,255,0.5)]',
      chipClass: 'bg-white/15 text-white border border-white/50 shadow-[0_0_8px_rgba(255,255,255,0.25)]',
      badgeClass: 'bg-white/25 text-white border border-white/60 text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider',
      dotClass: 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]'
    };
  }

  // 2. La Adjunta / Subdirectora -> Morado
  if (
    cargoLower.includes('adjunt') ||
    cargoLower.includes('subdirector') ||
    cargoLower.includes('subdirectora') ||
    nameLower.includes('adjunt')
  ) {
    return {
      type: 'adjunta' as const,
      label: 'Adjunta',
      listClass: 'bg-purple-500/20 text-purple-200 border-purple-500/40 hover:bg-purple-500/30 font-bold shadow-[0_0_8px_rgba(168,85,247,0.2)]',
      assignedClass: 'bg-purple-500 text-white border-purple-400 font-black shadow-[0_0_12px_rgba(168,85,247,0.5)]',
      chipClass: 'bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.25)]',
      badgeClass: 'bg-purple-500/30 text-purple-200 border border-purple-500/50 text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider',
      dotClass: 'bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.9)]'
    };
  }

  // 3. Jefe / Coordinadores -> Amarillo
  if (
    w.role === 'coordinator' ||
    w.role === 'deputy' ||
    cargoLower.includes('jef') ||
    cargoLower.includes('coordinador') ||
    cargoLower.includes('coordinadora')
  ) {
    return {
      type: 'jefe_coordinador' as const,
      label: w.role === 'coordinator' ? 'Coordinación' : 'Jefatura',
      listClass: 'bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30 font-bold shadow-[0_0_8px_rgba(245,158,11,0.2)]',
      assignedClass: 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-[0_0_12px_rgba(245,158,11,0.5)]',
      chipClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.25)]',
      badgeClass: 'bg-amber-500/30 text-amber-300 border border-amber-500/50 text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider',
      dotClass: 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.9)]'
    };
  }

  // 4. Regular
  return {
    type: 'regular' as const,
    label: '',
    listClass: 'bg-slate-900 text-slate-400 border-white/5 hover:border-white/20',
    assignedClass: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40 font-bold',
    chipClass: 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30',
    badgeClass: '',
    dotClass: 'bg-slate-600'
  };
};

// Componente interactivo de ruleta / temporizador para horas, minutos y segundos con candado de seguridad
interface DurationPickerWheelProps {
  label: string;
  value: string; // HH:MM:SS format
  onChange: (val: string) => void;
  accentColor?: 'cyan' | 'blue';
  syncFromValue?: string;
  syncLabel?: string;
}

const DurationPickerWheel: React.FC<DurationPickerWheelProps> = ({
  label,
  value,
  onChange,
  accentColor = 'cyan',
  syncFromValue,
  syncLabel = 'Copiar de Ingestado'
}) => {
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Parse string into H, M, S
  const parseVal = (str: string) => {
    if (!str) return { h: 0, m: 0, s: 0 };
    const clean = str.trim();
    if (clean.includes(':')) {
      const parts = clean.split(':').map(p => parseInt(p, 10) || 0);
      if (parts.length === 3) return { h: parts[0], m: parts[1], s: parts[2] };
      if (parts.length === 2) return { h: parts[0], m: parts[1], s: 0 };
    }
    const mins = parseFloat(clean) || 0;
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return { h, m, s: 0 };
  };

  const { h, m, s } = parseVal(value);

  const updateParts = (newH: number, newM: number, newS: number) => {
    if (isLocked) return;
    const safeH = Math.max(0, Math.min(99, newH));
    const safeM = Math.max(0, Math.min(59, newM));
    const safeS = Math.max(0, Math.min(59, newS));

    const hh = safeH.toString().padStart(2, '0');
    const mm = safeM.toString().padStart(2, '0');
    const ss = safeS.toString().padStart(2, '0');
    onChange(`${hh}:${mm}:${ss}`);
  };

  const adjustUnit = (unit: 'h' | 'm' | 's', delta: number) => {
    if (isLocked) return;
    if (unit === 'h') {
      updateParts(h + delta, m, s);
    } else if (unit === 'm') {
      let totalMins = h * 60 + m + delta;
      if (totalMins < 0) totalMins = 0;
      const nextH = Math.floor(totalMins / 60);
      const nextM = totalMins % 60;
      updateParts(nextH, nextM, s);
    } else if (unit === 's') {
      let totalSecs = h * 3600 + m * 60 + s + delta;
      if (totalSecs < 0) totalSecs = 0;
      const nextH = Math.floor(totalSecs / 3600);
      const nextM = Math.floor((totalSecs % 3600) / 60);
      const nextS = totalSecs % 60;
      updateParts(nextH, nextM, nextS);
    }
  };

  const colorStyles = accentColor === 'cyan' ? {
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-950/20',
    text: 'text-cyan-300',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    focus: 'focus:border-cyan-400 focus:ring-cyan-400/20',
    btn: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border-cyan-500/40',
    wheelBg: 'bg-slate-900 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
  } : {
    border: 'border-blue-500/40',
    bg: 'bg-blue-950/20',
    text: 'text-blue-300',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    focus: 'focus:border-blue-400 focus:ring-blue-400/20',
    btn: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border-blue-500/40',
    wheelBg: 'bg-slate-900 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
  };

  return (
    <div className={`p-2.5 rounded-xl border ${colorStyles.border} ${colorStyles.bg} space-y-2 transition-all relative`}>
      {/* Header with Title & Safety Lock / Sync Controls */}
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <div className="flex items-center gap-1">
          <Clock className={`w-3.5 h-3.5 ${colorStyles.text}`} />
          <span className={`text-[11px] font-extrabold uppercase tracking-tight ${colorStyles.text}`}>{label}</span>
        </div>

        <div className="flex items-center gap-1">
          {syncFromValue !== undefined && (
            <button
              type="button"
              disabled={isLocked}
              onClick={() => {
                if (!isLocked) onChange(syncFromValue || '00:00:00');
              }}
              title={syncLabel}
              className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                isLocked ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border-white/5' : colorStyles.btn
              }`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>{syncLabel}</span>
            </button>
          )}

          {/* Candado de Seguridad */}
          <button
            type="button"
            onClick={() => setIsLocked(!isLocked)}
            className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
              isLocked
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800/80 text-slate-400 border-white/10 hover:text-white'
            }`}
            title={isLocked ? 'Desbloquear edición de tiempo' : 'Bloquear con candado de seguridad'}
          >
            {isLocked ? (
              <>
                <Lock className="w-2.5 h-2.5 text-amber-400" />
                <span>Bloqueado</span>
              </>
            ) : (
              <>
                <Unlock className="w-2.5 h-2.5 text-slate-400" />
                <span>Candado</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Timer Wheel / Spinner Wheels for HH : MM : SS */}
      <div className={`p-1.5 sm:p-2 rounded-lg ${colorStyles.wheelBg} border flex items-center justify-center gap-1.5 sm:gap-3`}>
        {/* HORAS COLUMN */}
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Horas</span>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => adjustUnit('h', 1)}
            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Aumentar Hora (+1h)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <input
            type="number"
            min={0}
            max={99}
            disabled={isLocked}
            value={h.toString().padStart(2, '0')}
            onChange={(e) => updateParts(parseInt(e.target.value, 10) || 0, m, s)}
            className={`w-11 sm:w-12 h-7 sm:h-8 text-center bg-slate-950 border border-white/10 rounded-lg text-sm font-mono font-extrabold text-white focus:outline-none ${colorStyles.focus} ${isLocked ? 'opacity-60 cursor-not-allowed bg-slate-900' : ''}`}
          />
          <button
            type="button"
            disabled={isLocked}
            onClick={() => adjustUnit('h', -1)}
            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Disminuir Hora (-1h)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="text-base font-mono font-bold text-slate-500 self-center pt-2">:</span>

        {/* MINUTOS COLUMN */}
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Minutos</span>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => adjustUnit('m', 1)}
            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Aumentar Minuto (+1m)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <input
            type="number"
            min={0}
            max={59}
            disabled={isLocked}
            value={m.toString().padStart(2, '0')}
            onChange={(e) => updateParts(h, parseInt(e.target.value, 10) || 0, s)}
            className={`w-11 sm:w-12 h-7 sm:h-8 text-center bg-slate-950 border border-white/10 rounded-lg text-sm font-mono font-extrabold text-white focus:outline-none ${colorStyles.focus} ${isLocked ? 'opacity-60 cursor-not-allowed bg-slate-900' : ''}`}
          />
          <button
            type="button"
            disabled={isLocked}
            onClick={() => adjustUnit('m', -1)}
            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Disminuir Minuto (-1m)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="text-base font-mono font-bold text-slate-500 self-center pt-2">:</span>

        {/* SEGUNDOS COLUMN */}
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Segundos</span>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => adjustUnit('s', 1)}
            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Aumentar Segundo (+1s)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <input
            type="number"
            min={0}
            max={59}
            disabled={isLocked}
            value={s.toString().padStart(2, '0')}
            onChange={(e) => updateParts(h, m, parseInt(e.target.value, 10) || 0)}
            className={`w-11 sm:w-12 h-7 sm:h-8 text-center bg-slate-950 border border-white/10 rounded-lg text-sm font-mono font-extrabold text-white focus:outline-none ${colorStyles.focus} ${isLocked ? 'opacity-60 cursor-not-allowed bg-slate-900' : ''}`}
          />
          <button
            type="button"
            disabled={isLocked}
            onClick={() => adjustUnit('s', -1)}
            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Disminuir Segundo (-1s)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick preset buttons */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <span className="text-[9px] text-slate-400 font-medium">Atajos:</span>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            disabled={isLocked}
            onClick={() => adjustUnit('m', 15)}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-[9px] font-mono text-slate-300 transition-colors cursor-pointer border border-white/5"
          >
            +15m
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => adjustUnit('m', 30)}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-[9px] font-mono text-slate-300 transition-colors cursor-pointer border border-white/5"
          >
            +30m
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => adjustUnit('h', 1)}
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-[9px] font-mono text-slate-300 transition-colors cursor-pointer border border-white/5"
          >
            +1h
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => onChange('00:00:00')}
            className="px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-[9px] font-mono text-rose-300 transition-colors cursor-pointer border border-rose-500/20"
          >
            00:00:00
          </button>
        </div>
      </div>
    </div>
  );
};

export interface CardTaskGroup {
  groupId: string;
  primaryCard: TaskCard;
  linkedCards: TaskCard[];
  isLinkedGroup: boolean;
  totalDurationSeconds: number;
  totalDurationHHMMSS: string;
  totalEditedDurationSeconds: number;
  totalEditedDurationHHMMSS: string;
}

// Helper to group linked tasks for report consolidation
const buildCardTaskGroups = (listCards: TaskCard[], allCards: TaskCard[]): CardTaskGroup[] => {
  if (!listCards || listCards.length === 0) return [];

  // Mapear todas las tarjetas y relaciones padre-hijo en Map de O(1)
  const cardById = new Map<string, TaskCard>();
  const parentsMap = new Map<string, TaskCard[]>();
  const childCardIds = new Set<string>();

  for (let i = 0; i < allCards.length; i++) {
    const c = allCards[i];
    cardById.set(c.id, c);
    const links = c.linkedTaskIds;
    if (links && links.length > 0) {
      for (let j = 0; j < links.length; j++) {
        const childId = links[j];
        if (childId !== c.id) {
          childCardIds.add(childId);
          let pList = parentsMap.get(childId);
          if (!pList) {
            pList = [];
            parentsMap.set(childId, pList);
          }
          pList.push(c);
        }
      }
    }
  }

  const listCardIds = new Set(listCards.map(c => c.id));
  const visitedIds = new Set<string>();
  const groups: CardTaskGroup[] = [];

  for (let i = 0; i < listCards.length; i++) {
    const card = listCards[i];
    if (visitedIds.has(card.id)) continue;

    const clusterMap = new Map<string, TaskCard>();
    const queue: TaskCard[] = [card];
    clusterMap.set(card.id, card);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const linkedIds = current.linkedTaskIds;
      if (linkedIds && linkedIds.length > 0) {
        for (let j = 0; j < linkedIds.length; j++) {
          const neighbor = cardById.get(linkedIds[j]);
          if (neighbor && !clusterMap.has(neighbor.id)) {
            clusterMap.set(neighbor.id, neighbor);
            queue.push(neighbor);
          }
        }
      }
      const parents = parentsMap.get(current.id);
      if (parents && parents.length > 0) {
        for (let j = 0; j < parents.length; j++) {
          const neighbor = parents[j];
          if (!clusterMap.has(neighbor.id)) {
            clusterMap.set(neighbor.id, neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    clusterMap.forEach((c) => {
      if (listCardIds.has(c.id)) {
        visitedIds.add(c.id);
      }
    });

    const groupCardsInPeriod: TaskCard[] = [];
    clusterMap.forEach((c) => {
      if (listCardIds.has(c.id)) {
        groupCardsInPeriod.push(c);
      }
    });

    if (groupCardsInPeriod.length === 0) continue;

    // Designar Tarea Raíz (primaryCard):
    let primaryCard = groupCardsInPeriod.find(c => !childCardIds.has(c.id) && (c.linkedTaskIds || []).length > 0);
    if (!primaryCard) {
      primaryCard = groupCardsInPeriod.find(c => (c.linkedTaskIds || []).length > 0);
    }
    if (!primaryCard) {
      primaryCard = groupCardsInPeriod.find(c => !childCardIds.has(c.id));
    }
    if (!primaryCard) {
      groupCardsInPeriod.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      primaryCard = groupCardsInPeriod[0];
    }

    const subTasks = groupCardsInPeriod.filter(c => c.id !== primaryCard.id);
    let totalDurationSeconds = 0;
    let totalEditedDurationSeconds = 0;

    for (let j = 0; j < groupCardsInPeriod.length; j++) {
      const c = groupCardsInPeriod[j];
      const origSec = parseDurationToSeconds(c.duration);
      const editSec = c.isEdited && c.editedDuration ? parseDurationToSeconds(c.editedDuration) : origSec;
      totalDurationSeconds += origSec;
      totalEditedDurationSeconds += editSec;
    }

    groups.push({
      groupId: primaryCard.id,
      primaryCard,
      linkedCards: subTasks,
      isLinkedGroup: groupCardsInPeriod.length > 1,
      totalDurationSeconds,
      totalDurationHHMMSS: formatSecondsToHHMMSS(totalDurationSeconds),
      totalEditedDurationSeconds,
      totalEditedDurationHHMMSS: formatSecondsToHHMMSS(totalEditedDurationSeconds)
    });
  }

  return groups;
};

// Helper to filter card list so ONLY root tasks (Tarea Raíz) are returned in task views
const filterRootCardsOnly = (cardList: TaskCard[], allCards: TaskCard[]): TaskCard[] => {
  // Una tarjeta es sub-tarea (hija) si su ID está contenido dentro del linkedTaskIds de OTRA tarjeta
  const childCardIds = new Set<string>();

  allCards.forEach(parentCard => {
    (parentCard.linkedTaskIds || []).forEach(childId => {
      if (childId !== parentCard.id) {
        childCardIds.add(childId);
      }
    });
  });

  // Retornar en las vistas principales únicamente las Tareas Raíz
  return cardList.filter(card => !childCardIds.has(card.id));
};

// Custom Mini Calendar DatePicker Popover
interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  accentColor?: 'cyan' | 'purple' | 'amber' | 'emerald' | 'red' | 'rose' | 'blue' | 'indigo' | 'violet' | string;
  clearable?: boolean;
  className?: string;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Seleccionar fecha...',
  accentColor = 'cyan',
  clearable = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = React.useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 260;
      const popoverHeight = 310;
      
      let top = rect.bottom + 6;
      if (top + popoverHeight > window.innerHeight) {
        top = Math.max(10, rect.top - popoverHeight - 6);
      }
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth) {
        left = Math.max(10, window.innerWidth - popoverWidth - 16);
      }
      setPopoverPos({ top, left });
    }
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  React.useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  const initialYearMonth = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  }, [value]);

  const [viewYear, setViewYear] = useState(initialYearMonth.year);
  const [viewMonth, setViewMonth] = useState(initialYearMonth.month);

  React.useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [value]);

  const monthNamesEs = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (dayNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const selectedYmd = `${viewYear}-${pad(viewMonth + 1)}-${pad(dayNum)}`;
    onChange(selectedYmd);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const ymd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    onChange(ymd);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  const formattedDisplay = useMemo(() => {
    if (!value) return placeholder;
    try {
      const [y, m, d] = value.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      if (!isNaN(dt.getTime())) {
        return dt.toLocaleDateString('es-VE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
    } catch {}
    return value;
  }, [value, placeholder]);

  const colorStylesMap = {
    cyan: {
      border: 'border-cyan-500/40',
      text: 'text-cyan-300',
      hover: 'hover:border-cyan-500/50 hover:bg-cyan-500/10',
      bgActive: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
      icon: 'text-cyan-400'
    },
    purple: {
      border: 'border-purple-500/40',
      text: 'text-purple-300',
      hover: 'hover:border-purple-500/50 hover:bg-purple-500/10',
      bgActive: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
      icon: 'text-purple-400'
    },
    amber: {
      border: 'border-amber-500/40',
      text: 'text-amber-300',
      hover: 'hover:border-amber-500/50 hover:bg-amber-500/10',
      bgActive: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
      icon: 'text-amber-400'
    },
    emerald: {
      border: 'border-emerald-500/40',
      text: 'text-emerald-300',
      hover: 'hover:border-emerald-500/50 hover:bg-emerald-500/10',
      bgActive: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
      icon: 'text-emerald-400'
    },
    red: {
      border: 'border-rose-500/40',
      text: 'text-rose-300',
      hover: 'hover:border-rose-500/50 hover:bg-rose-500/10',
      bgActive: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
      icon: 'text-rose-400'
    },
    rose: {
      border: 'border-rose-500/40',
      text: 'text-rose-300',
      hover: 'hover:border-rose-500/50 hover:bg-rose-500/10',
      bgActive: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
      icon: 'text-rose-400'
    },
    blue: {
      border: 'border-blue-500/40',
      text: 'text-blue-300',
      hover: 'hover:border-blue-500/50 hover:bg-blue-500/10',
      bgActive: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
      icon: 'text-blue-400'
    },
    indigo: {
      border: 'border-indigo-500/40',
      text: 'text-indigo-300',
      hover: 'hover:border-indigo-500/50 hover:bg-indigo-500/10',
      bgActive: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
      icon: 'text-indigo-400'
    },
    violet: {
      border: 'border-violet-500/40',
      text: 'text-violet-300',
      hover: 'hover:border-violet-500/50 hover:bg-violet-500/10',
      bgActive: 'bg-violet-500/20 text-violet-300 border-violet-500/50',
      icon: 'text-violet-400'
    }
  };

  const colorStyles = colorStylesMap[accentColor as keyof typeof colorStylesMap] || colorStylesMap.cyan;

  return (
    <div className={`relative inline-block ${className}`}>
      {label && <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">{label}</label>}

      <div className="flex items-center gap-1">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className={`w-full bg-slate-950 border ${isOpen ? colorStyles.border : 'border-white/10'} rounded-xl px-3 py-2 text-xs font-mono text-slate-200 flex items-center justify-between gap-2 cursor-pointer transition-all ${colorStyles.hover}`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Calendar className={`w-3.5 h-3.5 ${colorStyles.icon} shrink-0`} />
            <span className={value ? `${colorStyles.text} font-bold` : 'text-slate-500'}>
              {formattedDisplay}
            </span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {clearable && value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl border border-rose-500/30 text-xs font-bold cursor-pointer shrink-0"
            title="Limpiar fecha"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[999998]" onClick={() => setIsOpen(false)} />
          <div
            style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
            className="fixed z-[999999] w-64 bg-slate-900 border border-cyan-500/50 rounded-2xl p-3 shadow-[0_0_30px_rgba(0,0,0,0.95)] backdrop-blur-2xl space-y-2 text-slate-100"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer font-bold text-xs"
              >
                ◀
              </button>
              <span className="text-xs font-bold text-white font-sans">
                {monthNamesEs[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer font-bold text-xs"
              >
                ▶
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase font-mono">
              <span>Do</span><span>Lu</span><span>Ma</span><span>Mi</span><span>Ju</span><span>Vi</span><span>Sá</span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center font-mono">
              {calendarCells.map((cell, idx) => {
                if (cell === null) {
                  return <div key={`empty_${idx}`} className="h-7" />;
                }

                const pad = (n: number) => n < 10 ? '0' + n : n;
                const cellYmd = `${viewYear}-${pad(viewMonth + 1)}-${pad(cell)}`;
                const isSelected = value === cellYmd;
                const isToday = (() => {
                  const t = new Date();
                  return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === cell;
                })();

                return (
                  <button
                    key={`day_${cell}`}
                    type="button"
                    onClick={(e) => handleSelectDay(cell, e)}
                    className={`h-7 w-7 mx-auto rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer border ${
                      isSelected
                        ? colorStyles.bgActive
                        : isToday
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'text-slate-300 border-transparent hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {cell}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold cursor-pointer transition-all"
              >
                Hoy
              </button>
              {clearable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                    setIsOpen(false);
                  }}
                  className="text-slate-400 hover:text-rose-400 text-[10px] underline cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

// Helper to format ISO or Date string for <input type="datetime-local" /> in Venezuela time (America/Caracas, UTC-4)
const formatForDatetimeLocal = (isoStr?: string) => {
  if (!isoStr) return '';
  try {
    const trimmed = isoStr.trim();
    if (!trimmed) return '';
    let parseable = trimmed;
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed)) {
      parseable = trimmed.replace(' ', 'T') + '-04:00';
    }
    const d = new Date(parseable);
    if (isNaN(d.getTime())) return '';

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    let hour = getPart('hour');
    if (hour === '24') hour = '00';
    const minute = getPart('minute');

    return `${year}-${month}-${day}T${hour}:${minute}`;
  } catch {
    return '';
  }
};

// Helper to convert datetime-local input string (YYYY-MM-DDTHH:mm) entered in Venezuela time into a valid ISO string
const parseDatetimeLocalToIso = (datetimeLocalVal?: string): string | undefined => {
  if (!datetimeLocalVal) return undefined;
  const trimmed = datetimeLocalVal.trim();
  if (!trimmed) return undefined;

  const formatted = trimmed.length === 16 ? `${trimmed}:00-04:00` : (trimmed.length === 19 ? `${trimmed}-04:00` : trimmed);
  const d = new Date(formatted);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
};

function TaskManager({
  boards,
  cards,
  notifications,
  workers,
  divisions,
  currentSession,
  onAddBoard,
  onDeleteBoard,
  onSaveCard,
  onDeleteCard,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onClearAllNotifications,
  onDeleteNotification,
  onAddNotificationToast,
  onManualSync,
  isSyncing
}: TaskManagerProps) {
  const currentWorker = useMemo(() => {
    return workers.find(w => w.id === currentSession?.userId) || null;
  }, [workers, currentSession]);

  // Check if current user belongs to Gerencia (Gerente, Adjunta, Superadmin)
  const isGerenciaUser = useMemo(() => {
    const role = currentSession?.role || currentWorker?.role || '';
    const cargo = (currentSession?.cargo || currentWorker?.cargo || '').toLowerCase();
    const email = (currentSession?.email || currentWorker?.email || '').toLowerCase();
    return (
      role === 'superadmin' ||
      role === 'deputy' ||
      cargo.includes('gerente') ||
      cargo.includes('adjunt') ||
      email === 'vtvgestiondiariarchaud@gmail.com'
    );
  }, [currentSession, currentWorker]);

  // Check if current user is SuperUser (SuperAdmin or Gerente principal)
  const isSuperUser = useMemo(() => {
    const role = currentSession?.role || currentWorker?.role || '';
    const cargo = (currentSession?.cargo || currentWorker?.cargo || '').toLowerCase();
    const email = (currentSession?.email || currentWorker?.email || '').toLowerCase();
    return (
      role === 'superadmin' ||
      cargo.includes('gerente') ||
      email === 'vtvgestiondiariarchaud@gmail.com'
    );
  }, [currentSession, currentWorker]);

  // Check if current user is a Division Head / Coordinator (Jefe de División)
  const isDivisionHeadUser = useMemo(() => {
    if (isGerenciaUser) return true;
    const role = currentSession?.role || currentWorker?.role || '';
    const cargo = (currentSession?.cargo || currentWorker?.cargo || '').toLowerCase();
    return role === 'coordinator' || cargo.includes('coordinador') || cargo.includes('jefe');
  }, [isGerenciaUser, currentSession, currentWorker]);

  // Permission check: Only jefes / gerencia can finalize tasks, delete boards or edit gerencia tasks
  const canManageTasks = isGerenciaUser || isDivisionHeadUser;
  const currentWorkerId = currentSession?.userId;

  // Active Main Navigation Tab ('produccion' | 'solicitudes' | 'finalizadas' | 'descartados' | 'reportes')
  const [activeMainTab, setActiveMainTab] = useState<'produccion' | 'solicitudes' | 'finalizadas' | 'descartados' | 'reportes'>('produccion');

  // Selected Board Filter within Producción ('todos' | 'board_ingesta' | 'board_prensa' | 'board_programacion')
  const [selectedBoardId, setSelectedBoardId] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [onlyMyTasks, setOnlyMyTasks] = useState<boolean>(false);

  // Stage Filter States ('Ingestado', 'Editado', 'Por Archivar')
  const [stageFilterIngested, setStageFilterIngested] = useState<boolean>(false);
  const [stageFilterEdited, setStageFilterEdited] = useState<boolean>(false);
  const [stageFilterDocumented, setStageFilterDocumented] = useState<boolean>(false);
  const [stageFilterLogic, setStageFilterLogic] = useState<'AND' | 'ONLY'>('AND');

  // Modals state
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);
  const [showBoardModal, setShowBoardModal] = useState<boolean>(false);
  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<TaskCard | null>(null);

  // New Board Form State
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');
  const [newBoardColor, setNewBoardColor] = useState('cyan');

  // Task Modal Form State
  const [taskBoardId, setTaskBoardId] = useState<string>('board_ingesta');
  const [taskDivisionId, setTaskDivisionId] = useState<string>('');
  const [taskIsOtherRequest, setTaskIsOtherRequest] = useState<boolean>(false);
  const [taskIsGerenciaOnly, setTaskIsGerenciaOnly] = useState<boolean>(false);
  const [taskDuration, setTaskDuration] = useState<string>('00:00:00');
  const [taskEditedDuration, setTaskEditedDuration] = useState<string>('00:00:00');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'baja' | 'media' | 'alta' | 'urgente'>('media');
  const [taskStartDate, setTaskStartDate] = useState(() => getLocalYMD());
  const [taskDueDate, setTaskDueDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return getLocalYMD(nextWeek);
  });
  const [taskAssignedWorkerIds, setTaskAssignedWorkerIds] = useState<string[]>([]);
  const [taskChecklist, setTaskChecklist] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [newChecklistItemText, setNewChecklistItemText] = useState('');
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');

  const filteredWorkersForAssignment = useMemo(() => {
    if (!workerSearchTerm.trim()) return workers;
    const q = workerSearchTerm.toLowerCase().trim();
    return workers.filter(w => {
      const divName = (divisions.find(d => d.id === w.divisionId)?.name || '').toLowerCase();
      return (
        w.name.toLowerCase().includes(q) ||
        (w.cargo || '').toLowerCase().includes(q) ||
        divName.includes(q)
      );
    });
  }, [workers, workerSearchTerm, divisions]);

  // Form Stage Booleans
  const [taskIsIngested, setTaskIsIngested] = useState(false);
  const [taskIngestedAt, setTaskIngestedAt] = useState<string | undefined>(undefined);
  const [taskIsEdited, setTaskIsEdited] = useState(false);
  const [taskEditedAt, setTaskEditedAt] = useState<string | undefined>(undefined);
  const [taskIsDocumented, setTaskIsDocumented] = useState(false);
  const [taskDocumentedAt, setTaskDocumentedAt] = useState<string | undefined>(undefined);
  const [taskIsFinalized, setTaskIsFinalized] = useState(false);
  const [taskFinalizedAt, setTaskFinalizedAt] = useState<string | undefined>(undefined);
  const [taskIsDepartmentAchievement, setTaskIsDepartmentAchievement] = useState<boolean>(true);
  const [taskIsDiscarded, setTaskIsDiscarded] = useState<boolean>(false);
  const [taskDiscardedAt, setTaskDiscardedAt] = useState<string | undefined>(undefined);
  const [taskLinkedTaskIds, setTaskLinkedTaskIds] = useState<string[]>([]);
  const [linkSearchQuery, setLinkSearchQuery] = useState<string>('');

  // Report Generator Filters State
  const [reportType, setReportType] = useState<'diario' | 'mensual' | 'anual'>('diario');
  const [reportDate, setReportDate] = useState<string>(() => getLocalYMD());
  const [reportMonth, setReportMonth] = useState<string>(() => getLocalYMD().slice(0, 7));
  const [reportYear, setReportYear] = useState<string>(() => getLocalYMD().slice(0, 4));
  const [reportBoardFilter, setReportBoardFilter] = useState<string>('todos');
  const [reportDivisionFilter, setReportDivisionFilter] = useState<string>('todos');
  const [reportWorkerFilter, setReportWorkerFilter] = useState<string>('todos');
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});
  const [superUserSearch, setSuperUserSearch] = useState<string>('');
  const [selectedWorkerDetailId, setSelectedWorkerDetailId] = useState<string | null>(null);

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroupIds(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Quick checklist input state for individual cards in "Otras Solicitudes"
  const [cardQuickCheckInput, setCardQuickCheckInput] = useState<{ [cardId: string]: string }>({});

  // Expanded state for linked tasks accordion on root cards
  const [expandedLinkedCardIds, setExpandedLinkedCardIds] = useState<Set<string>>(new Set());

  const toggleLinkedExpanded = (cardId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedLinkedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const renderLinkedTasksAccordion = (card: TaskCard) => {
    const linkedChildCards = cards.filter(c =>
      c.id !== card.id &&
      ((card.linkedTaskIds || []).includes(c.id) || (c.linkedTaskIds || []).includes(card.id))
    );

    if (linkedChildCards.length === 0) return null;

    const isExpanded = expandedLinkedCardIds.has(card.id);

    return (
      <div className="pt-2 border-t border-cyan-500/20 space-y-2">
        <button
          type="button"
          onClick={(e) => toggleLinkedExpanded(card.id, e)}
          className="w-full py-1.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-bold text-cyan-300 flex items-center justify-between transition-all cursor-pointer shadow-sm group/linkbtn"
        >
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Tareas Vinculadas ({linkedChildCards.length})</span>
          </div>
          <div className="flex items-center gap-1.5 text-cyan-400">
            <span className="text-[10px] opacity-80">{isExpanded ? 'Ocultar' : 'Ver'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isExpanded && (
          <div className="space-y-1.5 pl-2 border-l-2 border-cyan-500/40 py-1 font-sans">
            {linkedChildCards.map(childCard => {
              const childBoard = productionBoards.find(b => b.id === childCard.boardId) || boards.find(b => b.id === childCard.boardId);
              return (
                <div
                  key={childCard.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditTask(childCard);
                  }}
                  className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-white/10 hover:border-cyan-500/40 transition-all text-xs cursor-pointer space-y-1 group/child"
                >
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {childBoard?.name || 'Vinculada'}
                    </span>
                    {childCard.duration && childCard.duration !== '00:00:00' && (
                      <span className="text-[10px] font-mono text-cyan-400 font-bold">
                        Duración: {childCard.duration}
                      </span>
                    )}
                  </div>

                  <div className="font-bold text-slate-200 group-hover/child:text-cyan-300 transition-colors line-clamp-1">
                    {childCard.title}
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-0.5 font-mono flex-wrap">
                    <span className={childCard.isIngested ? 'text-cyan-400 font-bold' : 'text-slate-600'}>
                      Ingested {childCard.isIngested ? '✓' : '✗'}
                    </span>
                    <span className={childCard.isEdited ? 'text-blue-400 font-bold' : 'text-slate-600'}>
                      Editado {childCard.isEdited ? '✓' : '✗'}
                    </span>
                    <span className={childCard.isDocumented ? 'text-amber-400 font-bold' : 'text-slate-600'}>
                      Archivar {childCard.isDocumented ? '✓' : '✗'}
                    </span>
                    <span className={childCard.isFinalized ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                      Finalizado {childCard.isFinalized ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Renderizador de Filtro por Etapas de Trabajo (Ingestado, Editado, Por Archivar) con selector "Y (AND)" / "SÓLO (ONLY)"
  const renderStageFilter = () => {
    const isAnyStageActive = stageFilterIngested || stageFilterEdited || stageFilterDocumented;

    return (
      <div className="flex items-center gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-white/10 shadow-inner flex-wrap">
        <div className="flex items-center gap-1 px-1.5 text-[10px] font-mono text-slate-400 uppercase font-bold">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Etapa:</span>
        </div>

        {/* Ingestado */}
        <button
          type="button"
          onClick={() => setStageFilterIngested(!stageFilterIngested)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
            stageFilterIngested
              ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
              : 'bg-slate-900/80 text-slate-400 border-white/5 hover:text-slate-200 hover:border-white/20'
          }`}
          title="Filtrar por material Ingestado"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${stageFilterIngested ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
          Ingestado
        </button>

        {/* Editado */}
        <button
          type="button"
          onClick={() => setStageFilterEdited(!stageFilterEdited)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
            stageFilterEdited
              ? 'bg-blue-500/25 text-blue-200 border-blue-400/50 shadow-[0_0_8px_rgba(59,130,246,0.3)]'
              : 'bg-slate-900/80 text-slate-400 border-white/5 hover:text-slate-200 hover:border-white/20'
          }`}
          title="Filtrar por material Editado"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${stageFilterEdited ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
          Editado
        </button>

        {/* Por Archivar */}
        <button
          type="button"
          onClick={() => setStageFilterDocumented(!stageFilterDocumented)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
            stageFilterDocumented
              ? 'bg-amber-500/25 text-amber-200 border-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
              : 'bg-slate-900/80 text-slate-400 border-white/5 hover:text-slate-200 hover:border-white/20'
          }`}
          title="Filtrar por material Por Archivar (Documentado)"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${stageFilterDocumented ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
          Por Archivar
        </button>

        {/* Selector de Lógica: AND vs ONLY */}
        {isAnyStageActive && (
          <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-white/10 ml-0.5">
            <button
              type="button"
              onClick={() => setStageFilterLogic('AND')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-black transition-all cursor-pointer ${
                stageFilterLogic === 'AND'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Y (AND): Muestra tareas que contengan TODAS las etapas seleccionadas"
            >
              Y (AND)
            </button>
            <button
              type="button"
              onClick={() => setStageFilterLogic('ONLY')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-black transition-all cursor-pointer ${
                stageFilterLogic === 'ONLY'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo SÓLO (ONLY): Muestra tareas que estén EXCLUSIVAMENTE en las etapas seleccionadas"
            >
              SÓLO (ONLY)
            </button>
          </div>
        )}

        {/* Botón de Limpieza */}
        {isAnyStageActive && (
          <button
            type="button"
            onClick={() => {
              setStageFilterIngested(false);
              setStageFilterEdited(false);
              setStageFilterDocumented(false);
            }}
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
            title="Limpiar filtro de etapas"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  // Resolved list of production boards (Excludes "Otras Solicitudes" & "Administración")
  const productionBoards = useMemo(() => {
    const defaults: TaskBoard[] = [
      { id: 'board_ingesta', name: 'Ingesta', description: 'Recepción, digitalización y control de material', color: 'cyan', createdAt: new Date().toISOString() },
      { id: 'board_prensa', name: 'Prensa', description: 'Archivo de notas e informativos de Prensa', color: 'blue', createdAt: new Date().toISOString() },
      { id: 'board_programacion', name: 'Programación', description: 'Archivo de programas y transmisiones', color: 'indigo', createdAt: new Date().toISOString() }
    ];

    const merged = [...boards];
    defaults.forEach(d => {
      if (!merged.some(b => b.id === d.id || b.name.toLowerCase() === d.name.toLowerCase())) {
        merged.push(d);
      }
    });
    return merged.filter(b => 
      b.id !== 'board_otras_solicitudes' && 
      b.id !== 'board_administracion' && 
      !b.name.toLowerCase().includes('otras solicitudes') &&
      !b.name.toLowerCase().includes('administración') &&
      !b.name.toLowerCase().includes('administracion')
    );
  }, [boards]);

  // Notification tab filter state: 'todas', 'unread', 'read'
  const [notificationTab, setNotificationTab] = useState<'todas' | 'unread' | 'read'>('todas');

  // Notifications for current user (or all if workerId matches or general)
  const userNotifications = useMemo(() => {
    if (!currentWorkerId) return notifications;
    return notifications.filter(n => !n.workerId || n.workerId === currentWorkerId);
  }, [notifications, currentWorkerId]);

  const unreadCount = useMemo(() => {
    return userNotifications.filter(n => !n.read).length;
  }, [userNotifications]);

  const readCount = useMemo(() => {
    return userNotifications.filter(n => n.read).length;
  }, [userNotifications]);

  const filteredNotifications = useMemo(() => {
    if (notificationTab === 'unread') {
      return userNotifications.filter(n => !n.read);
    }
    if (notificationTab === 'read') {
      return userNotifications.filter(n => n.read);
    }
    return userNotifications;
  }, [userNotifications, notificationTab]);

  // Helper to extract numeric timestamp for strictly sorting cards newest-first
  const getCardTimestamp = (card: TaskCard): number => {
    if (card.createdAt) {
      const t = new Date(card.createdAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    const match = card.id ? card.id.match(/^task_(\d{10,13})/) : null;
    if (match) {
      const ts = parseInt(match[1], 10);
      if (!isNaN(ts) && ts > 0) return ts;
    }
    if (card.ingestedAt) {
      const t = new Date(card.ingestedAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (card.editedAt) {
      const t = new Date(card.editedAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (card.documentedAt) {
      const t = new Date(card.documentedAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (card.finalizedAt) {
      const t = new Date(card.finalizedAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (card.discardedAt) {
      const t = new Date(card.discardedAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (card.startDate) {
      const t = new Date(card.startDate).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    return 0;
  };

  // Sorted cards by date descending (newest created tasks always on top)
  const sortedCardsDescending = useMemo(() => {
    const mapped = cards.map(c => ({ card: c, ts: getCardTimestamp(c) }));
    mapped.sort((a, b) => b.ts - a.ts);
    return mapped.map(x => x.card);
  }, [cards]);

  // Helper to match card dates against dateFilter (YYYY-MM-DD)
  const cardMatchesDateFilter = (card: TaskCard, filterDate: string) => {
    if (!filterDate) return true;

    // Para la lista de Ingesta
    if (card.boardId === 'board_ingesta') {
      const dateStr = card.isIngested ? (card.ingestedAt || card.createdAt) : (card.createdAt || card.startDate);
      return normalizeToYMD(dateStr) === filterDate;
    }

    // Para Archivo de Prensa y Archivo de Programación
    if (card.boardId === 'board_prensa' || card.boardId === 'board_programacion') {
      const dateStr = (card.isDocumented || card.isFinalized) ? (card.documentedAt || card.finalizedAt || card.createdAt) : (card.createdAt || card.startDate);
      return normalizeToYMD(dateStr) === filterDate;
    }

    // Para Gerencia / Administración / Otras Solicitudes
    if (card.isOtherRequest || card.boardId === 'board_otras_solicitudes' || card.boardId === 'board_administracion' || card.isGerenciaOnly) {
      const dateStr = card.isFinalized ? (card.finalizedAt || card.createdAt) : (card.createdAt || card.startDate);
      return normalizeToYMD(dateStr) === filterDate;
    }

    // Para otras listas
    const targetStr = (card.isFinalized ? card.finalizedAt : undefined) ||
                      (card.isDocumented ? card.documentedAt : undefined) ||
                      (card.isIngested ? card.ingestedAt : undefined) ||
                      card.createdAt || card.startDate;
    return normalizeToYMD(targetStr) === filterDate;
  };

  // Helper para filtrar tarjetas según las etapas de proceso seleccionadas (Ingestado, Editado, Por Archivar)
  const cardMatchesStageFilter = (card: TaskCard) => {
    if (!stageFilterIngested && !stageFilterEdited && !stageFilterDocumented) {
      return true;
    }

    const hasIngested = Boolean(card.isIngested);
    const hasEdited = Boolean(card.isEdited);
    const hasDocumented = Boolean(card.isDocumented);

    if (stageFilterLogic === 'AND') {
      if (stageFilterIngested && !hasIngested) return false;
      if (stageFilterEdited && !hasEdited) return false;
      if (stageFilterDocumented && !hasDocumented) return false;
      return true;
    } else {
      // Modo 'ONLY': Coincidencia exacta de booleanos de etapa
      if (hasIngested !== stageFilterIngested) return false;
      if (hasEdited !== stageFilterEdited) return false;
      if (hasDocumented !== stageFilterDocumented) return false;
      return true;
    }
  };

  // Filtered cards for active Production Tab (Ingesta, Prensa, Programación)
  const productionCards = useMemo(() => {
    const list = sortedCardsDescending.filter(card => {
      // 0. Hide discarded tasks
      if (card.isDiscarded) return false;

      // 1. Hide finalized tasks (they belong to Tareas Finalizadas tab)
      if (card.isFinalized) return false;

      // 2. Hide "Otras Solicitudes" & "Administración"
      if (card.isOtherRequest || card.boardId === 'board_otras_solicitudes' || card.boardId === 'board_administracion') return false;

      // 3. Privacy: Gerencia Exclusive tasks only visible to Gerencia
      if (card.isGerenciaOnly && !isGerenciaUser) return false;

      // 4. Board filter
      if (selectedBoardId !== 'todos' && card.boardId !== selectedBoardId) return false;

      // 5. Only my tasks filter
      if (onlyMyTasks && currentWorkerId) {
        const activeObj = workers.find(w => w.id === currentWorkerId);
        if (!isCardAssociatedWithWorker(card, currentWorkerId, activeObj?.name)) return false;
      }

      // 6. Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesTitle = card.title.toLowerCase().includes(q);
        const matchesDesc = card.description.toLowerCase().includes(q);
        const matchesAssignee = card.assignedWorkerIds.some(id => {
          const w = workers.find(work => work.id === id);
          return w && w.name.toLowerCase().includes(q);
        });
        if (!matchesTitle && !matchesDesc && !matchesAssignee) return false;
      }

      // 7. Date filter
      if (dateFilter && !cardMatchesDateFilter(card, dateFilter)) return false;

      // 8. Stage filter (Ingestado, Editado, Por Archivar)
      if (!cardMatchesStageFilter(card)) return false;

      return true;
    });
    return filterRootCardsOnly(list, cards);
  }, [sortedCardsDescending, selectedBoardId, onlyMyTasks, searchQuery, dateFilter, currentWorkerId, isGerenciaUser, workers, cards, stageFilterIngested, stageFilterEdited, stageFilterDocumented, stageFilterLogic]);

  // Filtered cards for "Otras Solicitudes" Tab (Includes Administración and general requests)
  const otherRequestsCards = useMemo(() => {
    const list = sortedCardsDescending.filter(card => {
      // 0. Hide discarded tasks
      if (card.isDiscarded) return false;

      // 1. Hide finalized tasks (they belong to Tareas Finalizadas tab)
      if (card.isFinalized || card.status === 'Finalizado') return false;

      // 2. Must be "Otras Solicitudes", "Administración", flagged isOtherRequest, or NOT in standard production boards
      const isOther = Boolean(
        card.isOtherRequest ||
        card.boardId === 'board_otras_solicitudes' ||
        card.boardId === 'board_administracion' ||
        !productionBoards.some(pb => pb.id === card.boardId)
      );
      if (!isOther) return false;

      // 3. Privacy: Gerencia Exclusive tasks remain hidden except for Gerente & Adjunta
      if (card.isGerenciaOnly && !isGerenciaUser) return false;

      // 4. Only my tasks filter (matches assigned workers, creator or processing steps)
      if (onlyMyTasks && currentWorkerId) {
        const activeObj = workers.find(w => w.id === currentWorkerId);
        if (!isCardAssociatedWithWorker(card, currentWorkerId, activeObj?.name)) return false;
      }

      // 5. Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesTitle = card.title.toLowerCase().includes(q);
        const matchesDesc = card.description.toLowerCase().includes(q);
        const matchesAssignee = (card.assignedWorkerIds || []).some(id => {
          const w = workers.find(work => work.id === id);
          return w && w.name.toLowerCase().includes(q);
        });
        if (!matchesTitle && !matchesDesc && !matchesAssignee) return false;
      }

      // 6. Date filter
      if (dateFilter && !cardMatchesDateFilter(card, dateFilter)) return false;

      return true;
    });
    return filterRootCardsOnly(list, cards);
  }, [sortedCardsDescending, onlyMyTasks, searchQuery, dateFilter, currentWorkerId, isGerenciaUser, cards, workers, productionBoards]);

  // Filtered cards for "Tareas Finalizadas" Tab (Hidden section / Apartado)
  const finalizedCards = useMemo(() => {
    const list = sortedCardsDescending.filter(card => {
      // Hide discarded tasks
      if (card.isDiscarded) return false;

      // Must be finalized
      if (!card.isFinalized) return false;

      // Privacy check
      if (card.isGerenciaOnly && !isGerenciaUser) return false;

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return card.title.toLowerCase().includes(q) || card.description.toLowerCase().includes(q);
      }

      // Date filter
      if (dateFilter && !cardMatchesDateFilter(card, dateFilter)) return false;

      // Stage filter (Ingestado, Editado, Por Archivar)
      if (!cardMatchesStageFilter(card)) return false;

      return true;
    });
    return filterRootCardsOnly(list, cards);
  }, [sortedCardsDescending, searchQuery, dateFilter, isGerenciaUser, cards, stageFilterIngested, stageFilterEdited, stageFilterDocumented, stageFilterLogic]);

  // Filtered cards for "Material Descartado" Tab
  const discardedCards = useMemo(() => {
    const list = sortedCardsDescending.filter(card => {
      // Must be discarded
      if (!card.isDiscarded) return false;

      // Privacy check
      if (card.isGerenciaOnly && !isGerenciaUser) return false;

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return card.title.toLowerCase().includes(q) || card.description.toLowerCase().includes(q);
      }

      // Date filter
      if (dateFilter && !cardMatchesDateFilter(card, dateFilter)) return false;

      // Stage filter (Ingestado, Editado, Por Archivar)
      if (!cardMatchesStageFilter(card)) return false;

      return true;
    });
    return filterRootCardsOnly(list, cards);
  }, [sortedCardsDescending, searchQuery, dateFilter, isGerenciaUser, cards, stageFilterIngested, stageFilterEdited, stageFilterDocumented, stageFilterLogic]);

  // Pagination State for Task Management (30 items per page)
  const TASKS_PER_PAGE = 30;
  const [currentPageProduccion, setCurrentPageProduccion] = useState<number>(1);
  const [currentPageSolicitudes, setCurrentPageSolicitudes] = useState<number>(1);
  const [currentPageFinalizadas, setCurrentPageFinalizadas] = useState<number>(1);
  const [currentPageDescartados, setCurrentPageDescartados] = useState<number>(1);

  useEffect(() => {
    setCurrentPageProduccion(1);
    setCurrentPageSolicitudes(1);
    setCurrentPageFinalizadas(1);
    setCurrentPageDescartados(1);
  }, [selectedBoardId, searchQuery, dateFilter, onlyMyTasks, activeMainTab, stageFilterIngested, stageFilterEdited, stageFilterDocumented, stageFilterLogic]);

  const totalPagesProduccion = useMemo(() => Math.ceil(productionCards.length / TASKS_PER_PAGE) || 1, [productionCards.length]);
  const paginatedProductionCards = useMemo(() => {
    const start = (currentPageProduccion - 1) * TASKS_PER_PAGE;
    return productionCards.slice(start, start + TASKS_PER_PAGE);
  }, [productionCards, currentPageProduccion]);

  const totalPagesSolicitudes = useMemo(() => Math.ceil(otherRequestsCards.length / TASKS_PER_PAGE) || 1, [otherRequestsCards.length]);
  const paginatedOtherRequestsCards = useMemo(() => {
    const start = (currentPageSolicitudes - 1) * TASKS_PER_PAGE;
    return otherRequestsCards.slice(start, start + TASKS_PER_PAGE);
  }, [otherRequestsCards, currentPageSolicitudes]);

  const totalPagesFinalizadas = useMemo(() => Math.ceil(finalizedCards.length / TASKS_PER_PAGE) || 1, [finalizedCards.length]);
  const paginatedFinalizedCards = useMemo(() => {
    const start = (currentPageFinalizadas - 1) * TASKS_PER_PAGE;
    return finalizedCards.slice(start, start + TASKS_PER_PAGE);
  }, [finalizedCards, currentPageFinalizadas]);

  const totalPagesDescartados = useMemo(() => Math.ceil(discardedCards.length / TASKS_PER_PAGE) || 1, [discardedCards.length]);
  const paginatedDiscardedCards = useMemo(() => {
    const start = (currentPageDescartados - 1) * TASKS_PER_PAGE;
    return discardedCards.slice(start, start + TASKS_PER_PAGE);
  }, [discardedCards, currentPageDescartados]);

  // Memoized Header & Board card counters for zero-overhead rendering
  const cardHeaderCounts = useMemo(() => {
    let finalized = 0;
    let discarded = 0;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (c.isDiscarded) discarded++;
      else if (c.isFinalized) finalized++;
    }
    return { finalized, discarded };
  }, [cards]);

  const productionBoardCardCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < productionCards.length; i++) {
      const bId = productionCards[i].boardId;
      counts[bId] = (counts[bId] || 0) + 1;
    }
    return counts;
  }, [productionCards]);

  // Helper to resolve documentation technician details for documented tasks
  const getDocumentedInfo = (card: TaskCard) => {
    if (!card.isDocumented) {
      return { workerName: 'No documentado', formattedDateTime: '-' };
    }

    const assigned = (card.assignedWorkerIds || [])
      .map(wId => workers.find(w => w.id === wId))
      .filter((w): w is Worker => Boolean(w));

    const archiveDivisions = divisions.filter(d => {
      const dName = d.name.toLowerCase();
      return d.id === 'div_archivo_prensa' || d.id === 'div_archivo_programacion' ||
             dName.includes('prensa') || dName.includes('programacion') || dName.includes('programación') || dName.includes('archivo');
    });

    const archiveDivIds = new Set(archiveDivisions.map(d => d.id));

    // Filter assigned workers belonging to Archivo de Prensa or Archivo de Programación with cargo/role of 'Técnico' or 'worker'
    const techWorkers = assigned.filter(w => {
      const isArchiveDiv = archiveDivIds.has(w.divisionId);
      const cargoLower = (w.cargo || '').toLowerCase();
      const isTech = cargoLower.includes('tecnico') || cargoLower.includes('técnico') || w.role === 'worker';
      return isArchiveDiv && isTech;
    });

    let workerName = '';
    if (techWorkers.length > 0) {
      workerName = techWorkers.map(w => {
        const divObj = divisions.find(d => d.id === w.divisionId);
        return `${w.name} (${divObj?.name || 'Archivo'} - ${w.cargo || 'Técnico'})`;
      }).join(', ');
    } else {
      const archiveWorkers = assigned.filter(w => archiveDivIds.has(w.divisionId));
      if (archiveWorkers.length > 0) {
        workerName = archiveWorkers.map(w => {
          const divObj = divisions.find(d => d.id === w.divisionId);
          return `${w.name} (${divObj?.name || 'Archivo'})`;
        }).join(', ');
      } else if (assigned.length > 0) {
        workerName = assigned.map(w => w.name).join(', ');
      } else {
        workerName = card.createdByName || 'Personal de Archivo';
      }
    }

    const formattedDateTime = card.documentedAt
      ? new Date(card.documentedAt).toLocaleString('es-VE', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        })
      : 'Fecha no registrada';

    return { workerName, formattedDateTime };
  };

  // Metrics for Report Generator based on dates, stage timestamps & duration math
  const reportMetrics = useMemo(() => {
    // Filter relevant cards by Division/Worker/Board filters
    const baseCards = cards.filter(card => {
      if (card.isGerenciaOnly && !isGerenciaUser) return false;

      if (reportBoardFilter !== 'todos' && card.boardId !== reportBoardFilter) return false;

      if (reportDivisionFilter !== 'todos') {
        const matchesCardDiv = card.divisionId === reportDivisionFilter;
        const matchesWorkerDiv = card.assignedWorkerIds.some(id => {
          const w = workers.find(work => work.id === id);
          return w && w.divisionId === reportDivisionFilter;
        });
        if (!matchesCardDiv && !matchesWorkerDiv) return false;
      }

      if (reportWorkerFilter !== 'todos') {
        const wObj = workers.find(w => w.id === reportWorkerFilter);
        if (!isCardAssociatedWithWorker(card, reportWorkerFilter, wObj?.name)) return false;
      }

      return true;
    });

    const matchesPeriod = (dateStr?: string) => {
      if (!dateStr) return false;
      const trimmed = dateStr.trim();
      if (!trimmed) return false;

      const ymdLocal = normalizeToYMD(trimmed);

      if (reportType === 'diario') {
        return ymdLocal === reportDate;
      }
      if (reportType === 'mensual') {
        return ymdLocal.slice(0, 7) === reportMonth;
      }
      if (reportType === 'anual') {
        return ymdLocal.slice(0, 4) === reportYear;
      }
      return true;
    };

    const getCardIngestedYMD = (c: TaskCard) => {
      return normalizeToYMD(c.ingestedAt || c.startDate || c.createdAt);
    };

    // 1. LISTA 1: Material Ingestado y Editado en el período
    // Regla estricta: Todo material que NO esté marcado como ingestado NO puede ser contado para el total de horas ingestadas
    // Si fue descartado PERO está ingestado, aparece en la lista de ingesta
    const ingestadosEnPeriodo = baseCards.filter(c => {
      if (!c.isIngested) return false;
      const ingStr = c.ingestedAt || c.createdAt;
      return matchesPeriod(ingStr);
    });
    
    // Horas de Ingesta: se suman TODAS las tareas marcadas como ingestadas en el período
    const totalIngestaSeconds = ingestadosEnPeriodo.reduce((sum, c) => sum + parseDurationToSeconds(c.duration), 0);

    // Editados en el período (excluyendo descartados)
    const editadosEnPeriodo = baseCards.filter(c => c.isEdited && !c.isDiscarded && matchesPeriod(c.editedAt || c.createdAt));
    
    // Tiempo Ahorrado por Filtro de Ingesta: resta de (tiempo material original - tiempo material editado)
    const tiempoAhorradoSeconds = editadosEnPeriodo.reduce((sum, c) => {
      if (c.isOtherRequest) return sum;
      const origSec = parseDurationToSeconds(c.duration);
      const editSec = c.isEdited && c.editedDuration ? parseDurationToSeconds(c.editedDuration) : origSec;
      const diff = Math.max(0, origSec - editSec);
      return sum + diff;
    }, 0);

    // Combinar para Lista 1: Material Ingestado y Editado
    const ingestedAndEditedMap = new Map<string, TaskCard>();
    ingestadosEnPeriodo.forEach(c => ingestedAndEditedMap.set(c.id, c));
    editadosEnPeriodo.forEach(c => ingestedAndEditedMap.set(c.id, c));
    const ingestedAndEditedList = Array.from(ingestedAndEditedMap.values());
    // Conteo para Lista 1: TODAS las tareas individuales
    const ingestadosYEditadosCount = ingestedAndEditedList.length;
    const ingestedAndEditedGroups = buildCardTaskGroups(ingestedAndEditedList, cards);

    // 2. LISTA 2: Material Archivado ("Por Archivar" para Prensa y Programación, "Ingestado" para Ingesta, "Finalizado" para Gerencia)
    const documentadosEnPeriodo = baseCards.filter(c => {
      if (c.isDiscarded) return false;

      // Ingesta: basta estar Ingestado
      if (c.boardId === 'board_ingesta') {
        if (!c.isIngested) return false;
        return matchesPeriod(c.ingestedAt || c.createdAt);
      }

      // Archivo de Prensa y Archivo de Programación: basta estar Por Archivar
      if (c.boardId === 'board_prensa' || c.boardId === 'board_programacion') {
        if (!c.isDocumented && !c.isFinalized) return false;
        return matchesPeriod(c.documentedAt || c.finalizedAt || c.createdAt);
      }

      // Gerencia / Administración / Otras Solicitudes: Requiere estar Finalizado
      const isFin = Boolean(c.isFinalized || c.status === 'Finalizado');
      if (!isFin) return false;
      const archDateStr = c.finalizedAt || c.documentedAt || c.createdAt;
      return matchesPeriod(archDateStr);
    });

    // Materiales Descartados en el período
    const descartadosEnPeriodo = baseCards.filter(c => c.isDiscarded && matchesPeriod(c.discardedAt || c.createdAt));

    // Finalizados en el período (excluyendo descartados)
    const finalizadosEnPeriodo = baseCards.filter(c => (c.isFinalized || c.status === 'Finalizado') && !c.isDiscarded && matchesPeriod(c.finalizedAt || c.createdAt));

    // Logros de solicitudes (no administrativas ni gerenciales, excluyendo descartados, requiriendo estar finalizados)
    const departmentAchievements = baseCards.filter(c => {
      if (c.boardId === 'board_administracion') return false;
      if (c.isGerenciaOnly) return false;
      if (c.isDiscarded) return false;
      const isFin = Boolean(c.isFinalized || c.status === 'Finalizado');
      if (!isFin) return false; // Requisito estricto: estar marcado como finalizado
      const achDateStr = c.documentedAt || c.finalizedAt || c.createdAt;
      if (!matchesPeriod(achDateStr)) return false;
      return Boolean(c.isDepartmentAchievement || c.isOtherRequest);
    });

    // Combinar para Lista 2: Material Archivado + Logros
    const archivadosAndLogrosMap = new Map<string, TaskCard>();
    documentadosEnPeriodo.forEach(c => archivadosAndLogrosMap.set(c.id, c));
    departmentAchievements.forEach(c => archivadosAndLogrosMap.set(c.id, c));
    const archivadosAndLogrosList = Array.from(archivadosAndLogrosMap.values());
    const archivadosAndLogrosGroups = buildCardTaskGroups(archivadosAndLogrosList, cards);

    // Conteo para Lista 2: SOLO 1 POR FAMILIA/CLUSTER DE TAREAS VINCULADAS
    const materialArchivadoCount = buildCardTaskGroups(documentadosEnPeriodo, cards).length;
    const materialArchivadoYLogrosCount = archivadosAndLogrosGroups.length;
    const logrosOtrasSolicitudesCount = buildCardTaskGroups(departmentAchievements, cards).length;

    // 6. Cálculo de días del Calendario Mensual (para informe mensual)
    const [mY, mM] = reportMonth.split('-').map(Number);
    const mYear = mY || new Date().getFullYear();
    const mMonth = mM || (new Date().getMonth() + 1);
    const daysInMonth = new Date(mYear, mMonth, 0).getDate();

    const dayNamesFull = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const monthlyCalendarDays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const padDay = String(d).padStart(2, '0');
      const padMonth = String(mMonth).padStart(2, '0');
      const dateStr = `${mYear}-${padMonth}-${padDay}`;
      const dt = new Date(mYear, mMonth - 1, d);
      const dayOfWeekIndex = dt.getDay();

      // Buscar tareas ingestadas en esta fecha basada en su fecha/hora de ingesta
      // Regla estricta: Solo contar tareas con c.isIngested marcado como true
      const dayTasks = baseCards.filter(c => {
        if (!c.isIngested) return false;
        const ingStr = (c.ingestedAt || c.createdAt || '').trim();
        if (!ingStr) return false;
        return normalizeToYMD(ingStr) === dateStr;
      });

      const dayIngestedSeconds = dayTasks.reduce((sum, c) => sum + parseDurationToSeconds(c.duration), 0);

      monthlyCalendarDays.push({
        dayNum: d,
        dateStr,
        dayOfWeekFull: dayNamesFull[dayOfWeekIndex],
        dayOfWeekShort: dayNamesShort[dayOfWeekIndex],
        dayOfWeekIndex,
        ingestedSeconds: dayIngestedSeconds,
        ingestedHHMMSS: formatSecondsToHHMMSS(dayIngestedSeconds),
        tasksCount: dayTasks.length,
        tasks: dayTasks
      });
    }

    // 7. Desglose del ahorro de tiempo por filtro (por tablero)
    const savingsByFilter = productionBoards.map(board => {
      const boardCards = editadosEnPeriodo.filter(c => c.boardId === board.id);
      const savedSeconds = boardCards.reduce((sum, c) => {
        const origSec = parseDurationToSeconds(c.duration);
        const editSec = parseDurationToSeconds(c.editedDuration);
        return sum + Math.max(0, origSec - editSec);
      }, 0);
      return {
        boardId: board.id,
        boardName: board.name,
        count: boardCards.length,
        savedSeconds,
        savedHHMMSS: formatSecondsToHHMMSS(savedSeconds)
      };
    });

    // 8. Cantidad de material entregado / finalizado y duración total editada
    const deliveredTotalEditedSeconds = finalizadosEnPeriodo.reduce((sum, c) => sum + parseDurationToSeconds(c.editedDuration || c.duration), 0);

    // 9. Agrupación de tareas vinculadas para reportes (Consolidación)
    const documentadosGroups = buildCardTaskGroups(documentadosEnPeriodo, cards);
    const ingestadosGroups = buildCardTaskGroups(ingestadosEnPeriodo, cards);

    // 10. Registro Desglosado de Actualizaciones y Actividades del Día
    const dailyActivityEvents: Array<{
      id: string;
      cardId: string;
      title: string;
      type: 'Ingesta' | 'Edición' | 'Por Archivar' | 'Finalizado' | 'Descartado';
      typeLabel: string;
      badgeColor: string;
      boardName: string;
      timestamp: string;
      formattedDateTime: string;
      workerName: string;
      duration: string;
      card: TaskCard;
    }> = [];

    const formatEventDate = (isoStr?: string) => {
      if (!isoStr) return 'Sin Fecha/Hora';
      try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const pad = (n: number) => n < 10 ? '0' + n : n;
        let hours = d.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(hours)}:${pad(d.getMinutes())} ${ampm}`;
      } catch {
        return isoStr;
      }
    };

    const getWorkerNames = (card: TaskCard, fieldName: 'ingested' | 'edited' | 'documented' | 'finalized' | 'discarded') => {
      if (fieldName === 'ingested' && card.ingestedByWorkerName) return card.ingestedByWorkerName;
      if (fieldName === 'edited' && card.editedByWorkerName) return card.editedByWorkerName;
      if (fieldName === 'documented' && card.documentedByWorkerName) return card.documentedByWorkerName;
      if (fieldName === 'finalized' && card.finalizedByWorkerName) return card.finalizedByWorkerName;
      if (fieldName === 'discarded' && card.discardedByWorkerName) return card.discardedByWorkerName;

      if (fieldName === 'documented') {
        const docInfo = getDocumentedInfo(card);
        if (docInfo.workerName && docInfo.workerName !== 'No documentado') return docInfo.workerName;
      }

      if (card.assignedWorkerIds && card.assignedWorkerIds.length > 0) {
        const names = card.assignedWorkerIds
          .map(id => workers.find(w => w.id === id)?.name)
          .filter(Boolean);
        if (names.length > 0) return names.join(', ');
      }
      if (card.createdByName) return card.createdByName;
      return 'Personal VTV';
    };

    baseCards.forEach(c => {
      const boardObj = productionBoards.find(b => b.id === c.boardId) || boards.find(b => b.id === c.boardId);
      const bName = boardObj?.name || (c.isOtherRequest ? 'Otras Solicitudes' : 'VTV');

      // 1. Ingestado
      if (c.isIngested && matchesPeriod(c.ingestedAt || c.createdAt)) {
        const ts = c.ingestedAt || c.createdAt;
        dailyActivityEvents.push({
          id: `ing_${c.id}_${ts}`,
          cardId: c.id,
          title: c.title,
          type: 'Ingesta',
          typeLabel: 'Ingesta de Material',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          boardName: bName,
          timestamp: ts,
          formattedDateTime: formatEventDate(ts),
          workerName: getWorkerNames(c, 'ingested'),
          duration: c.duration || '00:00:00',
          card: c
        });
      }

      // 2. Editado
      if (c.isEdited && !c.isDiscarded && matchesPeriod(c.editedAt || c.createdAt)) {
        const ts = c.editedAt || c.createdAt;
        dailyActivityEvents.push({
          id: `edit_${c.id}_${ts}`,
          cardId: c.id,
          title: c.title,
          type: 'Edición',
          typeLabel: 'Edición de Material',
          badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          boardName: bName,
          timestamp: ts,
          formattedDateTime: formatEventDate(ts),
          workerName: getWorkerNames(c, 'edited'),
          duration: c.editedDuration || c.duration || '00:00:00',
          card: c
        });
      }

      // 3. Documentado / Por Archivar
      if (c.isDocumented && !c.isDiscarded && matchesPeriod(c.documentedAt || c.createdAt)) {
        const ts = c.documentedAt || c.createdAt;
        dailyActivityEvents.push({
          id: `doc_${c.id}_${ts}`,
          cardId: c.id,
          title: c.title,
          type: 'Por Archivar',
          typeLabel: 'Por Archivar (Documentado)',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          boardName: bName,
          timestamp: ts,
          formattedDateTime: formatEventDate(ts),
          workerName: getWorkerNames(c, 'documented'),
          duration: c.duration || '00:00:00',
          card: c
        });
      }

      // 4. Finalizado
      if (c.isFinalized && !c.isDiscarded && matchesPeriod(c.finalizedAt || c.createdAt)) {
        const ts = c.finalizedAt || c.createdAt;
        dailyActivityEvents.push({
          id: `fin_${c.id}_${ts}`,
          cardId: c.id,
          title: c.title,
          type: 'Finalizado',
          typeLabel: 'Autorizado y Finalizado',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          boardName: bName,
          timestamp: ts,
          formattedDateTime: formatEventDate(ts),
          workerName: getWorkerNames(c, 'finalized'),
          duration: c.editedDuration || c.duration || '00:00:00',
          card: c
        });
      }

      // 5. Descartado
      if (c.isDiscarded && matchesPeriod(c.discardedAt || c.createdAt)) {
        const ts = c.discardedAt || c.createdAt;
        dailyActivityEvents.push({
          id: `disc_${c.id}_${ts}`,
          cardId: c.id,
          title: c.title,
          type: 'Descartado',
          typeLabel: 'Material Descartado',
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          boardName: bName,
          timestamp: ts,
          formattedDateTime: formatEventDate(ts),
          workerName: getWorkerNames(c, 'discarded'),
          duration: c.duration || '00:00:00',
          card: c
        });
      }
    });

    // Sort daily activity events descending by timestamp
    dailyActivityEvents.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    return {
      totalBaseCards: baseCards.length,
      ingestadosCount: ingestadosEnPeriodo.length,
      totalIngestaHHMMSS: formatSecondsToHHMMSS(totalIngestaSeconds),
      editadosCount: editadosEnPeriodo.length,
      tiempoAhorradoHHMMSS: formatSecondsToHHMMSS(tiempoAhorradoSeconds),
      documentadosCount: documentadosEnPeriodo.length,
      descartadosCount: descartadosEnPeriodo.length,
      finalizadosCount: finalizadosEnPeriodo.length,
      materialArchivadoCount,
      materialArchivadoYLogrosCount,
      logrosOtrasSolicitudesCount: departmentAchievements.length,
      ingestadosEnPeriodo,
      ingestadosGroups,
      ingestedAndEditedList,
      ingestedAndEditedGroups,
      ingestadosYEditadosCount,
      editadosEnPeriodo,
      documentadosEnPeriodo,
      documentadosGroups,
      archivadosAndLogrosList,
      archivadosAndLogrosGroups,
      descartadosEnPeriodo,
      finalizadosEnPeriodo,
      departmentAchievements,
      monthlyCalendarDays,
      savingsByFilter,
      dailyActivityEvents,
      deliveredCount: finalizadosEnPeriodo.length,
      deliveredTotalEditedHHMMSS: formatSecondsToHHMMSS(deliveredTotalEditedSeconds)
    };
  }, [cards, reportType, reportDate, reportMonth, reportYear, reportBoardFilter, reportDivisionFilter, reportWorkerFilter, isGerenciaUser, isDivisionHeadUser, currentSession, currentWorker, workers, productionBoards]);

  // Raw Superuser Metrics Memo (heavy computation independent of search filters)
  const superuserRawWorkerMetrics = useMemo(() => {
    if (!isSuperUser) return null;

    const matchesPeriod = (dateStr?: string) => {
      if (!dateStr) return false;
      const trimmed = dateStr.trim();
      if (!trimmed) return false;
      const ymdLocal = normalizeToYMD(trimmed);

      if (reportType === 'diario') return ymdLocal === reportDate;
      if (reportType === 'mensual') return ymdLocal.slice(0, 7) === reportMonth;
      if (reportType === 'anual') return ymdLocal.slice(0, 4) === reportYear;
      return true;
    };

    const isCoordinatorRole = (w: Worker) => {
      const role = w.role || '';
      const cargo = (w.cargo || '').toLowerCase();
      return (
        role === 'coordinator' ||
        role === 'deputy' ||
        role === 'superadmin' ||
        cargo.includes('coordinador') ||
        cargo.includes('jefe') ||
        cargo.includes('gerente')
      );
    };

    const calculateForUser = (w: Worker) => {
      const division = divisions.find(d => d.id === w.divisionId);
      const divName = (division ? division.name : '').toLowerCase();

      const userCards = cards.filter(c => {
        if (c.isGerenciaOnly && !isGerenciaUser) return false;
        return isCardAssociatedWithWorker(c, w.id, w.name);
      });

      const totalCompletedCards = userCards.filter(c => {
        if (c.isDiscarded) return false;
        if (c.boardId === 'board_ingesta' || divName.includes('ingesta')) {
          return Boolean(c.isIngested);
        }
        if (c.boardId === 'board_prensa' || c.boardId === 'board_programacion' || divName.includes('prensa') || divName.includes('programaci')) {
          return Boolean(c.isDocumented || c.isFinalized || c.status === 'Finalizado');
        }
        return Boolean(c.isFinalized || c.status === 'Finalizado');
      });

      const periodCompletedCards = totalCompletedCards.filter(c => {
        let dateStr = c.createdAt;
        if (c.boardId === 'board_ingesta' || divName.includes('ingesta')) {
          dateStr = c.ingestedAt || c.createdAt;
        } else if (c.boardId === 'board_prensa' || c.boardId === 'board_programacion' || divName.includes('prensa') || divName.includes('programaci')) {
          dateStr = c.documentedAt || c.finalizedAt || c.createdAt;
        } else {
          dateStr = c.finalizedAt || c.documentedAt || c.ingestedAt || c.createdAt;
        }
        return matchesPeriod(dateStr);
      });

      const inProgressCards = userCards.filter(c => {
        if (c.isDiscarded) return false;
        if (c.boardId === 'board_ingesta' || divName.includes('ingesta')) {
          return !c.isIngested;
        }
        if (c.boardId === 'board_prensa' || c.boardId === 'board_programacion' || divName.includes('prensa') || divName.includes('programaci')) {
          return !c.isDocumented && !c.isFinalized && c.status !== 'Finalizado';
        }
        return !c.isFinalized && c.status !== 'Finalizado';
      });

      // Consolidación por familia de tareas vinculadas (cuenta 1 por familia)
      const totalCompletedGroups = buildCardTaskGroups(totalCompletedCards, cards);
      const periodCompletedGroups = buildCardTaskGroups(periodCompletedCards, cards);
      const inProgressGroups = buildCardTaskGroups(inProgressCards, cards);

      return {
        worker: w,
        divisionName: division ? division.name : 'Sin Área',
        totalCompletedCount: totalCompletedGroups.length,
        periodCompletedCount: periodCompletedGroups.length,
        inProgressCount: inProgressGroups.length,
        periodGroups: periodCompletedGroups,
        totalGroups: totalCompletedGroups,
        totalItemCardsCount: totalCompletedCards.length
      };
    };

    const allTechs = workers.filter(w => !isCoordinatorRole(w)).map(calculateForUser);
    const allCoords = workers.filter(w => isCoordinatorRole(w)).map(calculateForUser);

    return { allTechs, allCoords };
  }, [isSuperUser, workers, cards, divisions, reportType, reportDate, reportMonth, reportYear, isGerenciaUser]);

  // Superuser Metrics Memo: Fast filtering by search query and division filter
  const superuserWorkerMetrics = useMemo(() => {
    if (!isSuperUser || !superuserRawWorkerMetrics) return null;

    const { allTechs, allCoords } = superuserRawWorkerMetrics;
    const q = superUserSearch.toLowerCase().trim();

    const filteredTechs = allTechs
      .filter(item => {
        if (!q) return true;
        return (
          item.worker.name.toLowerCase().includes(q) ||
          item.worker.cargo.toLowerCase().includes(q) ||
          item.divisionName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.periodCompletedCount - a.periodCompletedCount || b.totalCompletedCount - a.totalCompletedCount || a.worker.name.localeCompare(b.worker.name));

    const filteredCoords = allCoords
      .filter(item => {
        if (!q) return true;
        return (
          item.worker.name.toLowerCase().includes(q) ||
          item.worker.cargo.toLowerCase().includes(q) ||
          item.divisionName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.periodCompletedCount - a.periodCompletedCount || b.totalCompletedCount - a.totalCompletedCount || a.worker.name.localeCompare(b.worker.name));

    const totalTechPeriod = allTechs.reduce((sum, t) => sum + t.periodCompletedCount, 0);
    const totalTechAllTime = allTechs.reduce((sum, t) => sum + t.totalCompletedCount, 0);
    const totalCoordPeriod = allCoords.reduce((sum, c) => sum + c.periodCompletedCount, 0);
    const totalCoordAllTime = allCoords.reduce((sum, c) => sum + c.totalCompletedCount, 0);

    // Agrupamiento por división
    const byDivision = divisions.map(div => {
      const divTechs = filteredTechs.filter(t => t.worker.divisionId === div.id);
      const divCoords = filteredCoords.filter(c => c.worker.divisionId === div.id);
      const periodTechCount = divTechs.reduce((sum, t) => sum + t.periodCompletedCount, 0);
      const periodCoordCount = divCoords.reduce((sum, c) => sum + c.periodCompletedCount, 0);
      return {
        division: div,
        techs: divTechs,
        coords: divCoords,
        totalPeriodCount: periodTechCount + periodCoordCount,
        totalAllTimeCount: divTechs.reduce((sum, t) => sum + t.totalCompletedCount, 0) + divCoords.reduce((sum, c) => sum + c.totalCompletedCount, 0)
      };
    }).filter(d => {
      if (reportDivisionFilter !== 'todos' && d.division.id !== reportDivisionFilter) return false;
      if (!q) return d.techs.length > 0 || d.coords.length > 0;
      return d.techs.length > 0 || d.coords.length > 0 || d.division.name.toLowerCase().includes(q);
    });

    // Personal sin división explícita asignada
    const unassignedTechs = filteredTechs.filter(t => !divisions.some(d => d.id === t.worker.divisionId));
    const unassignedCoords = filteredCoords.filter(c => !divisions.some(d => d.id === c.worker.divisionId));
    if ((unassignedTechs.length > 0 || unassignedCoords.length > 0) && (reportDivisionFilter === 'todos')) {
      byDivision.push({
        division: { id: 'sin_division', name: 'General / Sin Área Asignada', description: 'Personal de apoyo o sin división específica' } as Division,
        techs: unassignedTechs,
        coords: unassignedCoords,
        totalPeriodCount: unassignedTechs.reduce((sum, t) => sum + t.periodCompletedCount, 0) + unassignedCoords.reduce((sum, c) => sum + c.periodCompletedCount, 0),
        totalAllTimeCount: unassignedTechs.reduce((sum, t) => sum + t.totalCompletedCount, 0) + unassignedCoords.reduce((sum, c) => sum + c.totalCompletedCount, 0)
      });
    }

    return {
      technicians: filteredTechs,
      coordinators: filteredCoords,
      byDivision,
      totalTechPeriod,
      totalTechAllTime,
      totalCoordPeriod,
      totalCoordAllTime,
      allTechsCount: allTechs.length,
      allCoordsCount: allCoords.length
    };
  }, [isSuperUser, superuserRawWorkerMetrics, superUserSearch, reportDivisionFilter, divisions]);

  // Stage Toggle Handler for Cards directly from view or modal
  const handleToggleStage = (card: TaskCard, stage: 'ingested' | 'edited' | 'documented' | 'finalized' | 'discarded', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const nowIso = new Date().toISOString();
    const updatedCard: TaskCard = { ...card };
    const currentWorkerObj = workers.find(w => w.id === currentWorkerId);
    const activeWorkerName = currentWorkerObj?.name || currentSession?.name || 'Personal VTV';

    if (stage === 'finalized') {
      if (!canManageTasks) {
        onAddNotificationToast(
          'Acceso Restringido',
          'Solo los Jefes de División, Coordinadores o Gerencia pueden autorizar, finalizar o desmarcar la tarea.',
          'info'
        );
        return;
      }
      const nextVal = !card.isFinalized;
      updatedCard.isFinalized = nextVal;
      updatedCard.finalizedAt = nextVal ? (card.finalizedAt || nowIso) : undefined;
      updatedCard.finalizedByWorkerId = nextVal ? (card.finalizedByWorkerId || currentWorkerId) : undefined;
      updatedCard.finalizedByWorkerName = nextVal ? (card.finalizedByWorkerName || activeWorkerName) : undefined;
      if (nextVal) {
        updatedCard.status = 'Finalizado';
      }
    } else if (stage === 'ingested') {
      const nextVal = !card.isIngested;
      if (!nextVal && !canManageTasks) {
        onAddNotificationToast(
          'Acceso Restringido',
          'Solo los Jefes de División, Coordinadores o Gerencia pueden desmarcar una etapa completada.',
          'info'
        );
        return;
      }
      updatedCard.isIngested = nextVal;
      updatedCard.ingestedAt = nextVal ? (card.ingestedAt || nowIso) : undefined;
      updatedCard.ingestedByWorkerId = nextVal ? (card.ingestedByWorkerId || currentWorkerId) : undefined;
      updatedCard.ingestedByWorkerName = nextVal ? (card.ingestedByWorkerName || activeWorkerName) : undefined;
      if (nextVal) {
        updatedCard.status = 'Ingested' as any;
      }
    } else if (stage === 'edited') {
      const nextVal = !card.isEdited;
      if (!nextVal && !canManageTasks) {
        onAddNotificationToast(
          'Acceso Restringido',
          'Solo los Jefes de División, Coordinadores o Gerencia pueden desmarcar una etapa completada.',
          'info'
        );
        return;
      }
      updatedCard.isEdited = nextVal;
      updatedCard.editedAt = nextVal ? (card.editedAt || nowIso) : undefined;
      updatedCard.editedByWorkerId = nextVal ? (card.editedByWorkerId || currentWorkerId) : undefined;
      updatedCard.editedByWorkerName = nextVal ? (card.editedByWorkerName || activeWorkerName) : undefined;
      if (nextVal) {
        updatedCard.status = 'Editado' as any;
      }
    } else if (stage === 'documented') {
      const nextVal = !card.isDocumented;
      if (!nextVal && !canManageTasks) {
        onAddNotificationToast(
          'Acceso Restringido',
          'Solo los Jefes de División, Coordinadores o Gerencia pueden desmarcar una etapa completada.',
          'info'
        );
        return;
      }
      updatedCard.isDocumented = nextVal;
      updatedCard.documentedAt = nextVal ? (card.documentedAt || nowIso) : undefined;
      updatedCard.documentedByWorkerId = nextVal ? (card.documentedByWorkerId || currentWorkerId) : undefined;
      updatedCard.documentedByWorkerName = nextVal ? (card.documentedByWorkerName || activeWorkerName) : undefined;
      if (nextVal) {
        updatedCard.status = 'Archivando' as any;
      }
    } else if (stage === 'discarded') {
      if (!canManageTasks) {
        onAddNotificationToast(
          'Acceso Restringido',
          'Solo los Jefes de División, Coordinadores o Gerencia pueden marcar como descartar o restaurar el material.',
          'info'
        );
        return;
      }
      const nextVal = !card.isDiscarded;
      updatedCard.isDiscarded = nextVal;
      updatedCard.discardedAt = nextVal ? (card.discardedAt || nowIso) : undefined;
      updatedCard.discardedByWorkerId = nextVal ? (card.discardedByWorkerId || currentWorkerId) : undefined;
      updatedCard.discardedByWorkerName = nextVal ? (card.discardedByWorkerName || activeWorkerName) : undefined;
    }

    // Auto self-assign on modification
    if (currentWorkerId) {
      const arr = updatedCard.assignedWorkerIds || [];
      if (!arr.includes(currentWorkerId)) {
        updatedCard.assignedWorkerIds = [...arr, currentWorkerId];
      }
    }

    onSaveCard(updatedCard);

    // Propagate stage changes to all linked tasks in the cluster
    const clusterCards = cards.filter(c => {
      if (c.id === card.id) return false;
      const isDirectlyLinked = (card.linkedTaskIds || []).includes(c.id);
      const isPointingToCard = (c.linkedTaskIds || []).includes(card.id);
      const sharesLink = (card.linkedTaskIds || []).some(id => (c.linkedTaskIds || []).includes(id));
      return isDirectlyLinked || isPointingToCard || sharesLink;
    });

    clusterCards.forEach(linkedCard => {
      const syncCard = { ...linkedCard };
      if (currentWorkerId) {
        const arr = syncCard.assignedWorkerIds || [];
        if (!arr.includes(currentWorkerId)) syncCard.assignedWorkerIds = [...arr, currentWorkerId];
      }

      if (stage === 'ingested') {
        syncCard.isIngested = updatedCard.isIngested;
        syncCard.ingestedAt = updatedCard.ingestedAt;
        syncCard.ingestedByWorkerId = updatedCard.ingestedByWorkerId;
        syncCard.ingestedByWorkerName = updatedCard.ingestedByWorkerName;
        if (updatedCard.isIngested) syncCard.status = 'Ingested' as any;
      } else if (stage === 'edited') {
        syncCard.isEdited = updatedCard.isEdited;
        syncCard.editedAt = updatedCard.editedAt;
        syncCard.editedByWorkerId = updatedCard.editedByWorkerId;
        syncCard.editedByWorkerName = updatedCard.editedByWorkerName;
        if (updatedCard.isEdited) syncCard.status = 'Editado' as any;
      } else if (stage === 'documented') {
        syncCard.isDocumented = updatedCard.isDocumented;
        syncCard.documentedAt = updatedCard.documentedAt;
        syncCard.documentedByWorkerId = updatedCard.documentedByWorkerId;
        syncCard.documentedByWorkerName = updatedCard.documentedByWorkerName;
        if (updatedCard.isDocumented) syncCard.status = 'Archivando' as any;
      } else if (stage === 'finalized') {
        syncCard.isFinalized = updatedCard.isFinalized;
        syncCard.finalizedAt = updatedCard.finalizedAt;
        syncCard.finalizedByWorkerId = updatedCard.finalizedByWorkerId;
        syncCard.finalizedByWorkerName = updatedCard.finalizedByWorkerName;
        if (updatedCard.isFinalized) syncCard.status = 'Finalizado' as any;
      } else if (stage === 'discarded') {
        syncCard.isDiscarded = updatedCard.isDiscarded;
        syncCard.discardedAt = updatedCard.discardedAt;
        syncCard.discardedByWorkerId = updatedCard.discardedByWorkerId;
        syncCard.discardedByWorkerName = updatedCard.discardedByWorkerName;
      }

      onSaveCard(syncCard);
    });
    onAddNotificationToast(
      'Etapa Actualizada',
      `Se actualizó el estado de la etapa en "${card.title}".`,
      'success'
    );
  };

  // Checklist Helper Functions
  const handleAddChecklistItemInModal = () => {
    if (!newChecklistItemText.trim()) return;
    const newItem = {
      id: `chk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      text: newChecklistItemText.trim(),
      completed: false
    };
    setTaskChecklist(prev => [...prev, newItem]);
    setNewChecklistItemText('');
  };

  const handleToggleChecklistItemOnCard = (card: TaskCard, itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentList = card.checklist || [];
    const targetItem = currentList.find(i => i.id === itemId);

    if (targetItem?.completed && !canManageTasks) {
      onAddNotificationToast(
        'Acceso Restringido',
        'Solo los Jefes de División, Coordinadores o Gerencia pueden desmarcar ítems completados.',
        'info'
      );
      return;
    }

    const updatedList = currentList.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    const updatedCard = { ...card, checklist: updatedList };
    onSaveCard(updatedCard);
  };

  const handleAddChecklistItemOnCard = (card: TaskCard, e: React.FormEvent) => {
    e.preventDefault();
    const text = cardQuickCheckInput[card.id] || '';
    if (!text.trim()) return;
    const currentList = card.checklist || [];
    const newItem = {
      id: `chk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      text: text.trim(),
      completed: false
    };
    const updatedCard = { ...card, checklist: [...currentList, newItem] };
    onSaveCard(updatedCard);
    setCardQuickCheckInput(prev => ({ ...prev, [card.id]: '' }));
  };

  // Handle Board Creation Submit
  const handleCreateBoardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) {
      onAddNotificationToast('Nombre Requerido', 'Por favor ingresa un nombre para la nueva lista.', 'info');
      return;
    }

    const newBoard: TaskBoard = {
      id: `board_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newBoardName.trim(),
      description: newBoardDesc.trim(),
      color: newBoardColor || 'cyan',
      createdAt: new Date().toISOString()
    };

    onAddBoard(newBoard);
    setNewBoardName('');
    setNewBoardDesc('');
    setNewBoardColor('cyan');
    setShowBoardModal(false);
    onAddNotificationToast('Lista Creada', `Se creó la lista "${newBoard.name}" con éxito.`, 'success');
  };

  // Open Create Task Modal
  const handleOpenCreateTask = (defaultBoardId?: string, isOtherReq: boolean = false) => {
    setEditingCard(null);
    const initialIsOtherReq = isOtherReq || defaultBoardId === 'board_otras_solicitudes' || defaultBoardId === 'board_administracion';
    let targetBoard = defaultBoardId;
    if (!targetBoard) {
      if (initialIsOtherReq) {
        targetBoard = 'board_otras_solicitudes';
      } else if (selectedBoardId && selectedBoardId !== 'todos') {
        targetBoard = selectedBoardId;
      } else {
        targetBoard = 'board_ingesta';
      }
    }
    setTaskBoardId(targetBoard);
    setTaskDivisionId(currentSession?.divisionId || currentWorker?.divisionId || '');
    setTaskIsOtherRequest(initialIsOtherReq);
    setTaskIsGerenciaOnly(false);
    setTaskDuration('00:00:00');
    setTaskEditedDuration('00:00:00');
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('media');
    
    setTaskIsIngested(false);
    setTaskIngestedAt(undefined);
    setTaskIsEdited(false);
    setTaskEditedAt(undefined);
    setTaskIsDocumented(false);
    setTaskDocumentedAt(undefined);
    setTaskIsFinalized(false);
    setTaskFinalizedAt(undefined);
    setTaskIsDepartmentAchievement(true);
    setTaskIsDiscarded(false);
    setTaskDiscardedAt(undefined);
    setTaskLinkedTaskIds([]);

    const today = getLocalYMD();
    setTaskStartDate(today);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setTaskDueDate(getLocalYMD(nextWeek));
    
    if (currentWorkerId) {
      setTaskAssignedWorkerIds([currentWorkerId]);
    } else {
      setTaskAssignedWorkerIds([]);
    }

    setTaskChecklist([]);
    setNewChecklistItemText('');
    setLinkSearchQuery('');
    setWorkerSearchTerm('');
    setShowTaskModal(true);
  };

  // Open Edit Task Modal
  const handleOpenEditTask = (card: TaskCard) => {
    setEditingCard(card);
    setTaskBoardId(card.boardId);
    setTaskDivisionId(card.divisionId || '');
    const isOther = Boolean(card.isOtherRequest || card.boardId === 'board_otras_solicitudes' || card.boardId === 'board_administracion');
    setTaskIsOtherRequest(isOther);
    setTaskIsGerenciaOnly(card.isGerenciaOnly || false);
    setTaskDuration(card.duration || '00:00:00');
    setTaskEditedDuration(card.editedDuration || '00:00:00');
    setTaskTitle(card.title);
    setTaskDesc(card.description);
    setTaskPriority(card.priority || 'media');
    setTaskStartDate(card.startDate || getLocalYMD());
    setTaskDueDate(card.dueDate || getLocalYMD());
    setTaskAssignedWorkerIds(card.assignedWorkerIds || []);
    setTaskChecklist(card.checklist || []);
    setNewChecklistItemText('');

    setTaskIsIngested(Boolean(card.isIngested));
    setTaskIngestedAt(card.ingestedAt);
    setTaskIsEdited(Boolean(card.isEdited));
    setTaskEditedAt(card.editedAt);
    setTaskIsDocumented(Boolean(card.isDocumented));
    setTaskDocumentedAt(card.documentedAt);
    setTaskIsFinalized(Boolean(card.isFinalized));
    setTaskFinalizedAt(card.finalizedAt);
    setTaskIsDepartmentAchievement(card.isDepartmentAchievement !== undefined ? Boolean(card.isDepartmentAchievement) : true);
    setTaskIsDiscarded(Boolean(card.isDiscarded));
    setTaskDiscardedAt(card.discardedAt);
    setTaskLinkedTaskIds(card.linkedTaskIds || []);
    setLinkSearchQuery('');

    setShowTaskModal(true);

    if (currentWorkerId && notifications && notifications.length > 0) {
      const pendingNotifs = notifications.filter(
        n => n.workerId === currentWorkerId && (n.taskId === card.id || n.taskTitle === card.title) && !n.read
      );
      pendingNotifs.forEach(notif => onMarkNotificationRead(notif.id));
    }
  };

  // Save Task Form Handler
  const handleSaveTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      onAddNotificationToast('Título Requerido', 'Por favor ingresa un título para la tarea.', 'info');
      return;
    }

    const nowIso = new Date().toISOString();
    const cardId = editingCard ? editingCard.id : `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const isOther = taskIsOtherRequest || taskBoardId === 'board_otras_solicitudes' || taskBoardId === 'board_administracion';

    let finalAssigned = [...taskAssignedWorkerIds];
    if (currentWorkerId && !finalAssigned.includes(currentWorkerId)) {
      finalAssigned.push(currentWorkerId);
    }

    const activeWorkerObj = workers.find(w => w.id === currentWorkerId);
    const activeWorkerName = activeWorkerObj?.name || currentSession?.name || 'Personal VTV';

    const cardData: TaskCard = {
      id: cardId,
      boardId: taskBoardId,
      divisionId: taskDivisionId || undefined,
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      status: taskIsFinalized ? 'Finalizado' : isOther ? 'Pendiente' : taskIsDocumented ? 'Archivando' : taskIsEdited ? 'Editado' : taskIsIngested ? 'Ingestado' : 'Pendiente',
      priority: taskPriority,
      isOtherRequest: isOther,
      isGerenciaOnly: taskIsGerenciaOnly,
      isDepartmentAchievement: taskIsDepartmentAchievement,
      duration: isOther ? '00:00:00' : (taskDuration.trim() || '00:00:00'),
      editedDuration: isOther ? '00:00:00' : (taskEditedDuration.trim() || '00:00:00'),
      isIngested: isOther ? false : taskIsIngested,
      ingestedAt: isOther ? undefined : (taskIsIngested ? (taskIngestedAt || nowIso) : undefined),
      ingestedByWorkerId: isOther ? undefined : (taskIsIngested ? (editingCard?.ingestedByWorkerId || currentWorkerId) : undefined),
      ingestedByWorkerName: isOther ? undefined : (taskIsIngested ? (editingCard?.ingestedByWorkerName || activeWorkerName) : undefined),

      isEdited: isOther ? false : taskIsEdited,
      editedAt: isOther ? undefined : (taskIsEdited ? (taskEditedAt || nowIso) : undefined),
      editedByWorkerId: isOther ? undefined : (taskIsEdited ? (editingCard?.editedByWorkerId || currentWorkerId) : undefined),
      editedByWorkerName: isOther ? undefined : (taskIsEdited ? (editingCard?.editedByWorkerName || activeWorkerName) : undefined),

      isDocumented: isOther ? false : taskIsDocumented,
      documentedAt: isOther ? undefined : (taskIsDocumented ? (taskDocumentedAt || nowIso) : undefined),
      documentedByWorkerId: isOther ? undefined : (taskIsDocumented ? (editingCard?.documentedByWorkerId || currentWorkerId) : undefined),
      documentedByWorkerName: isOther ? undefined : (taskIsDocumented ? (editingCard?.documentedByWorkerName || activeWorkerName) : undefined),

      isDiscarded: taskIsDiscarded,
      discardedAt: taskIsDiscarded ? (taskDiscardedAt || nowIso) : undefined,
      discardedByWorkerId: taskIsDiscarded ? (editingCard?.discardedByWorkerId || currentWorkerId) : undefined,
      discardedByWorkerName: taskIsDiscarded ? (editingCard?.discardedByWorkerName || activeWorkerName) : undefined,

      isFinalized: taskIsFinalized,
      finalizedAt: taskIsFinalized ? (taskFinalizedAt || nowIso) : undefined,
      finalizedByWorkerId: taskIsFinalized ? (editingCard?.finalizedByWorkerId || currentWorkerId) : undefined,
      finalizedByWorkerName: taskIsFinalized ? (editingCard?.finalizedByWorkerName || activeWorkerName) : undefined,

      startDate: taskStartDate,
      dueDate: taskDueDate,
      assignedWorkerIds: finalAssigned,
      checklist: taskChecklist,
      createdAt: editingCard ? editingCard.createdAt : nowIso,
      createdByWorkerId: editingCard ? editingCard.createdByWorkerId : currentSession?.userId,
      createdByName: editingCard ? editingCard.createdByName : currentSession?.name,
      linkedTaskIds: taskLinkedTaskIds
    };

    if (!canManageTasks) {
      if (!editingCard?.isDiscarded && cardData.isDiscarded) {
        onAddNotificationToast('Acceso Restringido', 'Solo los Jefes de División, Coordinadores o Gerencia pueden descartar el material.', 'info');
        return;
      }
      if (!editingCard?.isFinalized && cardData.isFinalized) {
        onAddNotificationToast('Acceso Restringido', 'Solo los Jefes de División, Coordinadores o Gerencia pueden colocar tareas como finalizadas.', 'info');
        return;
      }
    }

    if (editingCard && !canManageTasks) {
      if (editingCard.isIngested && !cardData.isIngested) {
        onAddNotificationToast('Acceso Restringido', 'Solo Jefes, Coordinadores o Gerencia pueden desmarcar la etapa de Ingesta.', 'info');
        return;
      }
      if (editingCard.isEdited && !cardData.isEdited) {
        onAddNotificationToast('Acceso Restringido', 'Solo Jefes, Coordinadores o Gerencia pueden desmarcar la etapa de Edición.', 'info');
        return;
      }
      if (editingCard.isDocumented && !cardData.isDocumented) {
        onAddNotificationToast('Acceso Restringido', 'Solo Jefes, Coordinadores o Gerencia pueden desmarcar la etapa de Por Archivar.', 'info');
        return;
      }
      if (editingCard.isDiscarded && !cardData.isDiscarded) {
        onAddNotificationToast('Acceso Restringido', 'Solo Jefes, Coordinadores o Gerencia pueden restaurar el material descartado.', 'info');
        return;
      }
      if (editingCard.isFinalized && !cardData.isFinalized) {
        onAddNotificationToast('Acceso Restringido', 'Solo Jefes, Coordinadores o Gerencia pueden desmarcar la etapa de Finalizado.', 'info');
        return;
      }
      if (editingCard.isDepartmentAchievement && !cardData.isDepartmentAchievement) {
        onAddNotificationToast('Acceso Restringido', 'Solo Jefes, Coordinadores o Gerencia pueden desmarcar un Logro del Departamento.', 'info');
        return;
      }
    }

    // Save main card
    onSaveCard(cardData);

    // Sync linked tasks
    // 1. Limpiar referencias en tareas que fueron desvinculadas durante la edición
    const previousLinkedIds = editingCard?.linkedTaskIds || [];
    const removedLinkedIds = previousLinkedIds.filter(id => !taskLinkedTaskIds.includes(id));
    removedLinkedIds.forEach(remId => {
      const remCard = cards.find(c => c.id === remId);
      if (remCard && remCard.linkedTaskIds && remCard.linkedTaskIds.includes(cardId)) {
        onSaveCard({
          ...remCard,
          linkedTaskIds: remCard.linkedTaskIds.filter(id => id !== cardId)
        });
      }
    });

    // 2. Sincronizar sub-tareas vinculadas a esta Tarea Raíz
    taskLinkedTaskIds.forEach(linkedId => {
      const linkedCard = cards.find(c => c.id === linkedId);
      if (linkedCard) {
        // Limpiar cardId de la sub-tarea para mantener jerarquía unilateral Tarea Raíz -> Sub-tarea
        const cleanedLinks = (linkedCard.linkedTaskIds || []).filter(id => id !== cardId);
        const updatedLinkedCard: TaskCard = {
          ...linkedCard,
          linkedTaskIds: cleanedLinks
        };
        if (currentWorkerId && !updatedLinkedCard.assignedWorkerIds.includes(currentWorkerId)) {
          updatedLinkedCard.assignedWorkerIds = [...updatedLinkedCard.assignedWorkerIds, currentWorkerId];
        }
        if (cardData.isIngested) {
          updatedLinkedCard.isIngested = true;
          updatedLinkedCard.ingestedAt = updatedLinkedCard.ingestedAt || cardData.ingestedAt || nowIso;
        }
        if (cardData.isEdited) {
          updatedLinkedCard.isEdited = true;
          updatedLinkedCard.editedAt = updatedLinkedCard.editedAt || cardData.editedAt || nowIso;
        }
        if (cardData.isDocumented) {
          updatedLinkedCard.isDocumented = true;
          updatedLinkedCard.documentedAt = updatedLinkedCard.documentedAt || cardData.documentedAt || nowIso;
          updatedLinkedCard.status = 'Archivando' as any;
        }
        if (cardData.isFinalized) {
          updatedLinkedCard.isFinalized = true;
          updatedLinkedCard.finalizedAt = updatedLinkedCard.finalizedAt || cardData.finalizedAt || nowIso;
          updatedLinkedCard.status = 'Finalizado';
        }
        if (cardData.isDiscarded) {
          updatedLinkedCard.isDiscarded = true;
          updatedLinkedCard.discardedAt = updatedLinkedCard.discardedAt || cardData.discardedAt || nowIso;
        }
        onSaveCard(updatedLinkedCard);
      }
    });
    setShowTaskModal(false);
    setCurrentPageProduccion(1);
    setCurrentPageSolicitudes(1);
    setCurrentPageFinalizadas(1);
    setCurrentPageDescartados(1);
    onAddNotificationToast(
      editingCard ? 'Tarea Actualizada' : 'Tarea Creada',
      `Se ${editingCard ? 'modificó' : 'registró'} con éxito la tarea "${taskTitle}".`,
      'success'
    );
  };

  // Reassign Board quick dropdown
  const handleQuickBoardChange = (card: TaskCard, targetBoardId: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const bObj = productionBoards.find(b => b.id === targetBoardId);
    const updatedCard: TaskCard = {
      ...card,
      boardId: targetBoardId
    };
    onSaveCard(updatedCard);

    // Sync board change to linked cards
    const clusterCards = cards.filter(c => {
      if (c.id === card.id) return false;
      const isDirectlyLinked = (card.linkedTaskIds || []).includes(c.id);
      const isPointingToCard = (c.linkedTaskIds || []).includes(card.id);
      const sharesLink = (card.linkedTaskIds || []).some(id => (c.linkedTaskIds || []).includes(id));
      return isDirectlyLinked || isPointingToCard || sharesLink;
    });

    clusterCards.forEach(linkedCard => {
      onSaveCard({
        ...linkedCard,
        boardId: targetBoardId
      });
    });

    onAddNotificationToast(
      'Lista Actualizada',
      `La tarea "${card.title}" ${clusterCards.length > 0 ? 'y sus vinculadas fueron asignadas' : 'fue asignada'} a "${bObj?.name || targetBoardId}".`,
      'info'
    );
  };

  // Self-assignment toggle on card
  const handleToggleSelfAssignment = (card: TaskCard, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentWorkerId) {
      onAddNotificationToast('Sesión Requerida', 'Debes tener una sesión activa para asignarte tareas.', 'info');
      return;
    }
    const isAssigned = card.assignedWorkerIds.includes(currentWorkerId);
    let updatedAssignees: string[];
    if (isAssigned) {
      updatedAssignees = card.assignedWorkerIds.filter(id => id !== currentWorkerId);
    } else {
      updatedAssignees = [...card.assignedWorkerIds, currentWorkerId];
    }
    const updatedCard: TaskCard = {
      ...card,
      assignedWorkerIds: updatedAssignees
    };
    onSaveCard(updatedCard);
    onAddNotificationToast(
      isAssigned ? 'Desasignado/a' : 'Te has asignado a la tarea',
      `Actualizaste tu participación en "${card.title}".`,
      'success'
    );
  };

  // Quick toggle for Department Achievement
  const handleToggleDepartmentAchievement = (card: TaskCard, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextVal = !card.isDepartmentAchievement;

    if (!nextVal && !canManageTasks) {
      onAddNotificationToast(
        'Acceso Restringido',
        'Solo los Jefes de División, Coordinadores o Gerencia pueden desmarcar un Logro del Departamento.',
        'info'
      );
      return;
    }

    const updatedCard: TaskCard = {
      ...card,
      isDepartmentAchievement: nextVal
    };
    onSaveCard(updatedCard);
    onAddNotificationToast(
      nextVal ? 'Marcado como Logro' : 'Desmarcado como Logro',
      `"${card.title}" ${nextVal ? 'ahora cuenta' : 'ya no cuenta'} como logro del departamento.`,
      'info'
    );
  };

  // Print Report Handler (Soporta Formato de Calendario Mensual en PDF)
  const handlePrintReport = () => {
    if (reportType === 'mensual') {
      const printWin = window.open('', '_blank');
      if (!printWin) {
        window.print();
        return;
      }

      const [mY, mM] = reportMonth.split('-').map(Number);
      const monthsEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const monthName = monthsEs[(mM || 1) - 1] || 'Seleccionado';
      const yearNum = mY || new Date().getFullYear();

      const selectedDivName = divisions.find(d => d.id === reportDivisionFilter)?.name || 'Todas las Divisiones';
      const selectedWorkerName = workers.find(w => w.id === reportWorkerFilter)?.name || 'Todos los Colaboradores';

      // Build printable calendar table HTML
      let calendarHtml = `
        <table class="calendar-grid">
          <thead>
            <tr>
              <th>Lunes</th>
              <th>Martes</th>
              <th>Miércoles</th>
              <th>Jueves</th>
              <th>Viernes</th>
              <th>Sábado</th>
              <th>Domingo</th>
            </tr>
          </thead>
          <tbody>
      `;

      const daysInMonth = new Date(yearNum, mM, 0).getDate();
      const firstDayObj = new Date(yearNum, mM - 1, 1);
      let firstDayOfWeek = (firstDayObj.getDay() + 6) % 7;

      let currentDay = 1;
      let weekRow = 0;

      while (currentDay <= daysInMonth) {
        calendarHtml += `<tr>`;
        for (let col = 0; col < 7; col++) {
          if ((weekRow === 0 && col < firstDayOfWeek) || currentDay > daysInMonth) {
            calendarHtml += `<td class="empty-cell"></td>`;
          } else {
            const dayData = reportMetrics.monthlyCalendarDays.find(d => d.dayNum === currentDay);
            const hhmmss = dayData ? dayData.ingestedHHMMSS : '00:00:00';
            const hasHours = dayData && dayData.ingestedSeconds > 0;

            calendarHtml += `
              <td class="day-cell ${hasHours ? 'has-hours' : ''}">
                <div class="day-header">
                  <span class="day-name">${dayData?.dayOfWeekShort || ''}</span>
                  <span class="day-num">${currentDay}</span>
                </div>
                <div class="day-body">
                  <span class="label">Horas Ingestadas:</span>
                  <span class="value">${hhmmss}</span>
                </div>
              </td>
            `;
            currentDay++;
          }
        }
        calendarHtml += `</tr>`;
        weekRow++;
      }
      calendarHtml += `</tbody></table>`;

      // Build Savings breakdown HTML
      let savingsHtml = `
        <div class="section">
          <h3>DESGLOSE DEL AHORRO DE TIEMPO POR FILTRO DE INGESTA</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Área / Filtro</th>
                <th>Materiales Procesados</th>
                <th>Tiempo Ahorrado</th>
              </tr>
            </thead>
            <tbody>
      `;
      reportMetrics.savingsByFilter.forEach(sf => {
        savingsHtml += `
          <tr>
            <td>${sf.boardName}</td>
            <td>${sf.count} items</td>
            <td><strong>${sf.savedHHMMSS}</strong></td>
          </tr>
        `;
      });
      savingsHtml += `
            <tr class="total-row">
              <td>TOTAL AHORRO ACUMULADO</td>
              <td>${reportMetrics.editadosCount} items</td>
              <td><strong>${reportMetrics.tiempoAhorradoHHMMSS}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      `;

      // Build Documented materials HTML
      let documentedHtml = `
        <div class="section">
          <h3>MATERIALES MARCADOS POR ARCHIVAR / DOCUMENTADOS (REGISTRO TÉCNICO DE ARCHIVO)</h3>
          <p style="font-size: 11px; margin-bottom: 8px;">Total de materiales documentados: <strong>${reportMetrics.documentadosEnPeriodo.length}</strong> (Organizados en <strong>${reportMetrics.documentadosGroups.length}</strong> registros)</p>
      `;
      if (reportMetrics.documentadosGroups.length === 0) {
        documentedHtml += `<p class="italic-text">(Sin materiales archivados/documentados en este período)</p>`;
      } else {
        documentedHtml += `<table class="data-table"><thead><tr><th>Título del Material</th><th>Área / Tablero</th><th>Documentado por (Personal Técnico)</th><th>Fecha y Hora</th><th>Duración</th></tr></thead><tbody>`;
        reportMetrics.documentadosGroups.forEach(group => {
          const docCard = group.primaryCard;
          const bObj = productionBoards.find(b => b.id === docCard.boardId);
          const docInfo = getDocumentedInfo(docCard);

          if (group.isLinkedGroup) {
            documentedHtml += `
              <tr style="background-color: #fffbeb;">
                <td><strong>${docCard.title}</strong><br/><small style="color: #0284c7; font-weight: bold;">[${group.linkedCards.length} tareas vinculadas - Duración Sumada]</small></td>
                <td>${bObj?.name || 'VTV'}</td>
                <td>${docInfo.workerName}</td>
                <td>${docInfo.formattedDateTime}</td>
                <td><strong>${group.totalDurationHHMMSS}</strong></td>
              </tr>
            `;
            group.linkedCards.forEach((subCard, idx) => {
              const subBoard = productionBoards.find(b => b.id === subCard.boardId);
              documentedHtml += `
                <tr style="background-color: #f8fafc; font-size: 11px;">
                  <td style="padding-left: 20px; color: #334155;">↳ [${idx + 1}] ${subCard.title}</td>
                  <td style="color: #64748b;">${subBoard?.name || 'VTV'}</td>
                  <td colspan="2" style="color: #94a3b8; font-style: italic;">(Desglose - Duración individual real)</td>
                  <td><em>${subCard.duration || '00:00:00'}</em></td>
                </tr>
              `;
            });
          } else {
            documentedHtml += `
              <tr>
                <td><strong>${docCard.title}</strong></td>
                <td>${bObj?.name || 'VTV'}</td>
                <td>${docInfo.workerName}</td>
                <td>${docInfo.formattedDateTime}</td>
                <td>${docCard.duration || '00:00:00'}</td>
              </tr>
            `;
          }
        });
        documentedHtml += `</tbody></table>`;
      }
      documentedHtml += `</div>`;

      // Build Delivered materials HTML
      let deliveredHtml = `
        <div class="section">
          <h3>CANTIDAD DE MATERIAL ENTREGADO / FINALIZADO</h3>
          <div class="summary-box">
            <p><strong>Total Materiales Entregados:</strong> ${reportMetrics.finalizadosCount} items</p>
            <p><strong>Duración Total Editada Entregada:</strong> ${reportMetrics.deliveredTotalEditedHHMMSS}</p>
          </div>
        </div>
      `;

      // Build Achievements HTML
      let achievementsHtml = `
        <div class="section">
          <h3>LOGROS DE SOLICITUDES DEL DEPARTAMENTO (No Administrativas ni Gerenciales)</h3>
          <p style="font-size: 11px; margin-bottom: 8px;">Total de logros alcanzados: <strong>${reportMetrics.departmentAchievements.length}</strong></p>
      `;
      if (reportMetrics.departmentAchievements.length === 0) {
        achievementsHtml += `<p class="italic-text">(Sin logros registrados para el departamento en este período)</p>`;
      } else {
        achievementsHtml += `<table class="data-table"><thead><tr><th>Título de la Tarea</th><th>Área</th><th>Fecha</th><th>Descripción / Detalle</th></tr></thead><tbody>`;
        reportMetrics.departmentAchievements.forEach(ach => {
          const bObj = productionBoards.find(b => b.id === ach.boardId);
          achievementsHtml += `
            <tr>
              <td><strong>${ach.title}</strong></td>
              <td>${bObj?.name || (ach.isOtherRequest ? 'Otras Solicitudes' : 'VTV')}</td>
              <td>${ach.finalizedAt ? new Date(ach.finalizedAt).toLocaleDateString('es-VE') : ach.dueDate}</td>
              <td>${ach.description || '-'}</td>
            </tr>
          `;
        });
        achievementsHtml += `</tbody></table>`;
      }
      achievementsHtml += `</div>`;

      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Reporte Mensual Operativo - ${monthName} ${yearNum}</title>
            <style>
              @page { size: landscape; margin: 10mm; }
              body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; padding: 15px; color: #0f172a; line-height: 1.4; font-size: 11px; }
              .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; }
              .header h2 { margin: 0; font-size: 16px; font-weight: 800; text-transform: uppercase; color: #0f172a; }
              .header h3 { margin: 4px 0 0 0; font-size: 13px; font-weight: 700; color: #0284c7; text-transform: uppercase; }
              .meta-info { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 11px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
              
              .calendar-grid { width: 100%; border-collapse: collapse; margin-bottom: 15px; page-break-inside: avoid; }
              .calendar-grid th { background: #0f172a; color: #ffffff; text-align: center; padding: 6px; font-size: 10px; text-transform: uppercase; border: 1px solid #0f172a; }
              .calendar-grid td { border: 1px solid #cbd5e1; height: 55px; vertical-align: top; padding: 4px; width: 14.28%; }
              .calendar-grid td.empty-cell { background: #f8fafc; border: 1px solid #e2e8f0; }
              .calendar-grid td.has-hours { background: #f0fdf4; border: 1.5px solid #16a34a; }
              .day-header { display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; margin-bottom: 4px; }
              .day-name { text-transform: uppercase; color: #64748b; font-size: 8px; }
              .day-num { font-size: 11px; color: #0f172a; font-weight: 800; }
              .day-body { font-size: 9px; line-height: 1.2; }
              .day-body .label { display: block; color: #64748b; font-size: 8px; }
              .day-body .value { font-weight: bold; font-family: monospace; font-size: 11px; color: #0284c7; }
              
              .section { margin-top: 12px; page-break-inside: avoid; }
              .section h3 { font-size: 11px; font-weight: 800; border-bottom: 1.5px solid #0284c7; padding-bottom: 3px; margin-bottom: 6px; text-transform: uppercase; color: #0f172a; }
              .data-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
              .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 10px; text-align: left; }
              .data-table th { background: #f1f5f9; font-weight: bold; }
              .total-row { font-weight: bold; background: #e2e8f0; }
              .summary-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 6px; }
              .summary-box p { margin: 2px 0; }
              .italic-text { font-style: italic; color: #64748b; font-size: 10px; }
              .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 6px; text-align: center; font-size: 9px; color: #64748b; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>VENEZOLANA DE TELEVISIÓN - VTV</h2>
              <h3>REPORTE MENSUAL OPERATIVO Y MÉTRICAS DE TIEMPOS DE INGESTA</h3>
            </div>
            
            <div class="meta-info">
              <div><strong>MES Y AÑO:</strong> ${monthName.toUpperCase()} ${yearNum}</div>
              <div><strong>DIVISIÓN:</strong> ${selectedDivName}</div>
              <div><strong>COLABORADOR:</strong> ${selectedWorkerName}</div>
              <div><strong>FECHA EMISIÓN:</strong> ${new Date().toLocaleDateString('es-VE')}</div>
            </div>

            ${calendarHtml}
            ${savingsHtml}
            ${documentedHtml}
            ${deliveredHtml}
            ${achievementsHtml}

            <div class="footer">
              Documento Oficial generado por el Sistema de Asistencia y Gestión de Guardia VTV • ${new Date().toLocaleString('es-VE')}
            </div>
            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    } else {
      window.print();
    }
  };

  // Copy Text Report Handler
  const handleCopyTextReport = () => {
    const selectedDiv = divisions.find(d => d.id === reportDivisionFilter)?.name || 'Todas las Divisiones';
    const selectedWork = workers.find(w => w.id === reportWorkerFilter)?.name || 'Todos los Colaboradores';
    const periodLabel = reportType === 'diario' ? `Diario (${reportDate})` : reportType === 'mensual' ? `Mensual (${reportMonth})` : `Anual (${reportYear})`;

    let reportText = `==================================================\n`;
    reportText += `REPORTE OPERATIVO Y MÉTRICAS DE TIEMPOS - VTV\n`;
    reportText += `==================================================\n`;
    reportText += `Período: ${periodLabel}\n`;
    reportText += `División: ${selectedDiv}\n`;
    reportText += `Colaborador: ${selectedWork}\n`;
    reportText += `Fecha de Generación: ${new Date().toLocaleString('es-VE')}\n`;
    reportText += `--------------------------------------------------\n\n`;

    reportText += `--- RESUMEN DE MÉTRICAS ---\n`;
    reportText += `• Total Horas Ingesta: ${reportMetrics.totalIngestaHHMMSS}\n`;
    reportText += `• Ahorro por Filtro de Ingesta: ${reportMetrics.tiempoAhorradoHHMMSS}\n`;
    reportText += `• Materiales Editados: ${reportMetrics.editadosCount} items\n`;
    reportText += `• Logros Otras Solicitudes: ${reportMetrics.logrosOtrasSolicitudesCount} completados\n`;
    reportText += `• Material Archivado (Finalizados): ${reportMetrics.materialArchivadoCount} items (consolidados)\n`;
    reportText += `• Materiales Ingestados: ${reportMetrics.ingestadosCount} items\n`;
    reportText += `• Materiales Archivados/Documentados: ${reportMetrics.documentadosCount} items\n`;
    reportText += `• Tareas Finalizadas: ${reportMetrics.finalizadosCount} items\n`;
    reportText += `• Logros Otras Solicitudes: ${reportMetrics.logrosOtrasSolicitudesCount} completados\n\n`;

    reportText += `--- TAREAS MARCADAS POR ARCHIVAR / DOCUMENTADAS (${reportMetrics.documentadosEnPeriodo.length} materiales) ---\n`;
    if (reportMetrics.documentadosGroups.length === 0) {
      reportText += `(Sin tareas marcadas por archivar en este período)\n\n`;
    } else {
      reportMetrics.documentadosGroups.forEach((group, idx) => {
        const c = group.primaryCard;
        const bObj = productionBoards.find(b => b.id === c.boardId);
        const docInfo = getDocumentedInfo(c);

        if (group.isLinkedGroup) {
          reportText += `${idx + 1}. ${c.title} [GRUPO DE ${group.linkedCards.length} TAREAS VINCULADAS]\n`;
          reportText += `   - Área/Lista: ${bObj?.name || 'VTV'}\n`;
          reportText += `   - Documentado por: ${docInfo.workerName}\n`;
          reportText += `   - Fecha y Hora de Documentación: ${docInfo.formattedDateTime}\n`;
          reportText += `   - Duración Total Sumada: ${group.totalDurationHHMMSS}\n`;
          reportText += `   - Desglose de Tareas Vinculadas:\n`;
          group.linkedCards.forEach((sub, sIdx) => {
            const subBoard = productionBoards.find(b => b.id === sub.boardId);
            reportText += `     * [${sIdx + 1}] ${sub.title} (${subBoard?.name || 'VTV'}) - Duración Real: ${sub.duration || '00:00:00'}\n`;
          });
          reportText += `\n`;
        } else {
          reportText += `${idx + 1}. ${c.title}\n`;
          reportText += `   - Área/Lista: ${bObj?.name || 'VTV'}\n`;
          reportText += `   - Documentado por: ${docInfo.workerName}\n`;
          reportText += `   - Fecha y Hora de Documentación: ${docInfo.formattedDateTime}\n`;
          reportText += `   - Duración: ${c.duration || '00:00:00'}\n\n`;
        }
      });
    }

    reportText += `--- DETALLE DE MATERIALES Y TAREAS (${reportMetrics.ingestadosEnPeriodo.length} materiales) ---\n`;
    if (reportMetrics.ingestadosGroups.length === 0) {
      reportText += `(Sin registros para la fecha o filtros seleccionados)\n`;
    } else {
      reportMetrics.ingestadosGroups.forEach((group, idx) => {
        const c = group.primaryCard;
        const bObj = productionBoards.find(b => b.id === c.boardId);
        const orig = group.totalDurationSeconds;
        const edit = group.totalEditedDurationSeconds;
        const diff = Math.max(0, orig - edit);

        const assignedNames = (c.assignedWorkerIds || [])
          .map(wId => workers.find(w => w.id === wId)?.name)
          .filter(Boolean)
          .join(', ');

        const fmtDate = (isoStr?: string) => {
          if (!isoStr) return 'Marcado';
          return new Date(isoStr).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        };

        const stageTimes = [];
        if (c.isIngested) stageTimes.push(`Ingestado (${fmtDate(c.ingestedAt)})`);
        if (c.isEdited) stageTimes.push(`Editado (${fmtDate(c.editedAt)})`);
        if (c.isDocumented) {
          const docInfo = getDocumentedInfo(c);
          stageTimes.push(`Documentado por ${docInfo.workerName} [${docInfo.formattedDateTime}]`);
        }
        if (c.isFinalized) stageTimes.push(`Finalizado (${fmtDate(c.finalizedAt)})`);

        if (group.isLinkedGroup) {
          reportText += `${idx + 1}. ${c.title} [GRUPO DE ${group.linkedCards.length} TAREAS VINCULADAS]\n`;
          reportText += `   - Área/Lista: ${bObj?.name || 'VTV'}\n`;
          reportText += `   - Personal Asignado: ${assignedNames || 'Sin asignar'}\n`;
          reportText += `   - Etapas y Tiempos: ${stageTimes.length > 0 ? stageTimes.join(' | ') : 'Pendiente'}\n`;
          reportText += `   - Duración Original Sumada: ${group.totalDurationHHMMSS} | Duración Editada Sumada: ${group.totalEditedDurationHHMMSS}\n`;
          reportText += `   - Tiempo Ahorrado Acumulado: ${formatSecondsToHHMMSS(diff)}\n`;
          reportText += `   - Desglose de Tareas Vinculadas:\n`;
          group.linkedCards.forEach((sub, sIdx) => {
            const subBoard = productionBoards.find(b => b.id === sub.boardId);
            reportText += `     * [${sIdx + 1}] ${sub.title} (${subBoard?.name || 'VTV'}) - Duración Orig. Real: ${sub.duration || '00:00:00'} | Editada Real: ${sub.editedDuration || '00:00:00'}\n`;
          });
          reportText += `\n`;
        } else {
          reportText += `${idx + 1}. ${c.title}\n`;
          reportText += `   - Área/Lista: ${bObj?.name || 'VTV'}\n`;
          reportText += `   - Personal Asignado: ${assignedNames || 'Sin asignar'}\n`;
          reportText += `   - Etapas y Tiempos: ${stageTimes.length > 0 ? stageTimes.join(' | ') : 'Pendiente'}\n`;
          reportText += `   - Duración Original: ${c.duration || '00:00:00'} | Duración Editada: ${c.editedDuration || '00:00:00'}\n`;
          reportText += `   - Tiempo Ahorrado: ${formatSecondsToHHMMSS(diff)}\n`;
          if (c.description) {
            reportText += `   - Nota: ${c.description}\n`;
          }
          reportText += `\n`;
        }
      });
    }

    if (isSuperUser && superuserWorkerMetrics) {
      reportText += `\n--- DESGLOSE SUPERUSUARIO: METRICAS POR DIVISION (1 FAMILIA POR TAREA) ---\n`;
      superuserWorkerMetrics.byDivision.forEach((dGroup) => {
        reportText += `\n[ DIVISIÓN: ${dGroup.division.name.toUpperCase()} ] - ${dGroup.totalPeriodCount} familias completadas en el período (${dGroup.totalAllTimeCount} histórico)\n`;
        if (dGroup.coords.length > 0) {
          reportText += `  • Coordinadores / Jefes:\n`;
          dGroup.coords.forEach((c) => {
            reportText += `    - ${c.worker.name} (${c.worker.cargo}): ${c.periodCompletedCount} en período | ${c.totalCompletedCount} histórico\n`;
          });
        }
        if (dGroup.techs.length > 0) {
          reportText += `  • Personal Técnico:\n`;
          dGroup.techs.forEach((t) => {
            reportText += `    - ${t.worker.name} (${t.worker.cargo}): ${t.periodCompletedCount} en período | ${t.totalCompletedCount} histórico\n`;
          });
        }
      });
      reportText += `\n`;
    }

    reportText += `--------------------------------------------------\n`;
    reportText += `Gerencia de Archivo y Gestión Diaria - VTV\n`;

    navigator.clipboard.writeText(reportText).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
      onAddNotificationToast('Copiado al Portapapeles', 'El informe operativo en formato texto ha sido copiado.', 'success');
    }).catch(() => {
      onAddNotificationToast('Error al Copiar', 'No se pudo copiar el informe al portapapeles.', 'info');
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Main Section Header */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-white/10 bg-slate-900/80 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                <Kanban className="w-3 h-3 text-cyan-400" />
                Flujo Operativo VTV
              </span>
              <span className="text-xs text-slate-400 font-mono">Control y Trazabilidad</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              Gestión de Tareas, Archivo y Solicitudes
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Flujos integrados para Ingesta, Archivo de Prensa, Archivo de Programación, Otras Solicitudes y Tareas Finalizadas.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Manual Sync Button */}
            <button
              onClick={() => {
                if (onManualSync) onManualSync();
              }}
              disabled={isSyncing}
              className="px-3 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/5 disabled:opacity-50"
              title="Forzar actualización manual con la base de datos Supabase"
            >
              <RotateCcw className={`w-4 h-4 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Actualizando...' : 'Actualizar Datos'}</span>
            </button>

            {/* Notification Center Trigger */}
            <button
              onClick={() => setShowNotificationCenter(true)}
              className="relative p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-200 transition-all flex items-center gap-2 cursor-pointer"
              title="Centro de Notificaciones"
            >
              <Bell className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold hidden sm:inline">Notificaciones</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.6)]">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Create Task Button */}
            <button
              onClick={() => handleOpenCreateTask(undefined, activeMainTab === 'solicitudes')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{activeMainTab === 'solicitudes' ? 'Nueva Solicitud' : 'Nueva Tarea de Producción'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Mode Navigation Bar (4 Primary Tabs) */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/90 border border-white/10 rounded-2xl shadow-xl">
        <button
          onClick={() => setActiveMainTab('produccion')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'produccion'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Producción Audiovisual</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/10 text-cyan-300 font-mono font-bold">
            {productionCards.length}
          </span>
        </button>

        <button
          onClick={() => setActiveMainTab('solicitudes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'solicitudes'
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Award className="w-4 h-4 text-amber-400" />
          <span>Otras Solicitudes</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/10 text-amber-300 font-mono font-bold">
            {otherRequestsCards.length}
          </span>
        </button>

        <button
          onClick={() => setActiveMainTab('finalizadas')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'finalizadas'
              ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Tareas Finalizadas</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/10 text-emerald-300 font-mono font-bold">
            {cardHeaderCounts.finalized}
          </span>
        </button>

        <button
          onClick={() => setActiveMainTab('descartados')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'descartados'
              ? 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-300 border border-red-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Trash2 className="w-4 h-4 text-red-400" />
          <span>Material Descartado</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500/10 text-red-300 font-mono font-bold">
            {cardHeaderCounts.discarded}
          </span>
        </button>

        <button
          onClick={() => setActiveMainTab('reportes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === 'reportes'
              ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-purple-400" />
          <span>Reporte & Tiempos</span>
        </button>
      </div>

      {/* TAB 1: PRODUCCIÓN AUDIOVISUAL (3 BOARDS: Ingesta, Prensa, Programación) */}
      {activeMainTab === 'produccion' && (
        <div className="space-y-4">
          {/* Sub-bar filter by Board within Producción */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-card p-3.5 rounded-xl border border-white/10 bg-slate-900/60 relative z-20">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
              <button
                onClick={() => setSelectedBoardId('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  selectedBoardId === 'todos'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white'
                }`}
              >
                <span>Todas las Listas ({productionBoards.length})</span>
              </button>

              {productionBoards.map(b => (
                <div
                  key={b.id}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                    selectedBoardId === b.id
                      ? 'bg-cyan-500/20 text-white border-cyan-500/40'
                      : 'bg-slate-800/50 text-slate-300 border-white/5 hover:border-white/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedBoardId(b.id)}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>{b.name}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 text-slate-400 font-mono">
                      {productionBoardCardCounts[b.id] || 0}
                    </span>
                  </button>

                  {/* Permitir borrar listas SOLO al Superadmin */}
                  {currentSession?.role === 'superadmin' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`¿Estás seguro de eliminar la lista "${b.name}"? Esta acción desasociará las tareas asociadas a esta lista.`)) {
                          onDeleteBoard(b.id);
                          if (selectedBoardId === b.id) setSelectedBoardId('todos');
                          onAddNotificationToast('Lista Eliminada', `La lista "${b.name}" ha sido eliminada por el Superadmin.`, 'info');
                        }
                      }}
                      title={`Eliminar lista "${b.name}" (Solo Superadmin)`}
                      className="ml-1 p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {/* Botón Crear Nueva Lista para Superadmin / Gerencia */}
              {canManageTasks && (
                <button
                  type="button"
                  onClick={() => setShowBoardModal(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/50 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
                  title="Crear Nueva Lista de Producción"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Nueva Lista</span>
                </button>
              )}
            </div>

            {/* Search, Date Filter, Stage Filter & My Tasks */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar en producción..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Date Search Filter */}
              <CustomDatePicker
                value={dateFilter}
                onChange={setDateFilter}
                placeholder="Filtrar fecha..."
                accentColor="cyan"
                clearable
              />

              {/* Stage Filter (Ingestado, Editado, Por Archivar) with AND / ONLY logic */}
              {renderStageFilter()}

              {currentWorkerId && (
                <button
                  onClick={() => setOnlyMyTasks(!onlyMyTasks)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                    onlyMyTasks
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-slate-950 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mis Tareas</span>
                </button>
              )}
            </div>
          </div>

          {/* PRODUCTION CARDS GRID - SORTED NEWEST FIRST */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {productionCards.length === 0 ? (
              <div className="col-span-full text-center py-12 glass-card rounded-2xl border border-white/10 bg-slate-900/50 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-slate-500 mx-auto opacity-50" />
                <p className="text-sm font-bold text-slate-300">No hay tareas de producción pendientes</p>
                <p className="text-xs text-slate-500">Crea una tarea nueva en Ingesta o revisa el apartado de Tareas Finalizadas.</p>
              </div>
            ) : (
              paginatedProductionCards.map(card => {
                const bObj = productionBoards.find(b => b.id === card.boardId);
                const isSelfAssigned = currentWorkerId ? card.assignedWorkerIds.includes(currentWorkerId) : false;

                // Duration difference
                const origSec = parseDurationToSeconds(card.duration);
                const editSec = parseDurationToSeconds(card.editedDuration);
                const savedSec = Math.max(0, origSec - editSec);

                return (
                  <div
                    key={card.id}
                    className="glass-card p-4 rounded-2xl border border-white/10 bg-slate-900/90 hover:border-cyan-500/40 transition-all space-y-3 relative group"
                  >
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {bObj?.name || 'Ingesta'}
                        </span>
                        {(card.isOtherRequest || card.boardId === 'board_otras_solicitudes' || card.boardId === 'board_administracion') && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5 text-amber-400" /> Otras Solicitudes
                          </span>
                        )}
                        {card.linkedTaskIds && card.linkedTaskIds.length > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm flex items-center gap-1">
                            <Link2 className="w-2.5 h-2.5 text-cyan-400" /> {card.linkedTaskIds.length} vinculada{card.linkedTaskIds.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {card.duration && card.duration !== '00:00:00' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-slate-950 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            Orig: {card.duration}
                          </span>
                        )}
                        {card.editedDuration && card.editedDuration !== '00:00:00' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-slate-950 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                            <Scissors className="w-3 h-3 text-blue-400" />
                            Edit: {card.editedDuration}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {card.priority && (
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase font-mono ${
                            card.priority === 'urgente' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' :
                            card.priority === 'alta' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            'bg-blue-500/20 text-blue-300'
                          }`}>
                            {card.priority}
                          </span>
                        )}

                        {(canManageTasks || isDivisionHeadUser || isGerenciaUser || card.createdByWorkerId === currentWorkerId) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`¿Estás seguro de eliminar permanentemente la tarea "${card.title}"?`)) {
                                onDeleteCard(card.id);
                                onAddNotificationToast('Tarea Eliminada', 'Se eliminó la tarea permanentemente.', 'info');
                              }
                            }}
                            title="Eliminar tarea permanentemente"
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div className="cursor-pointer" onClick={() => handleOpenEditTask(card)}>
                      <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2">
                        {card.title}
                      </h4>
                      {card.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {card.description}
                        </p>
                      )}
                    </div>

                    {/* Time Saved info badge */}
                    {savedSec > 0 && (
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center justify-between">
                        <span className="flex items-center gap-1 font-bold">
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          Ahorro por Filtro de Ingesta:
                        </span>
                        <span className="font-mono font-black">{formatSecondsToHHMMSS(savedSec)}</span>
                      </div>
                    )}

                    {/* Desplegable de Tareas Vinculadas */}
                    {renderLinkedTasksAccordion(card)}

                    {/* WORKFLOW STAGE TOGGLE BUTTONS (BOOLEANS) */}
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>Etapas del Proceso:</span>
                        <span className="text-[9px] text-slate-500">Haz clic para marcar</span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {/* 1. Ingestado */}
                        <button
                          onClick={(e) => handleToggleStage(card, 'ingested', e)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            card.isIngested
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                              : 'bg-slate-950/60 text-slate-400 border-white/5 hover:border-white/20'
                          }`}
                        >
                          <Check className={`w-3 h-3 ${card.isIngested ? 'text-cyan-400' : 'opacity-30'}`} />
                          <span>Ingestado</span>
                        </button>

                        {/* 2. Editado */}
                        <button
                          onClick={(e) => handleToggleStage(card, 'edited', e)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            card.isEdited
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.2)]'
                              : 'bg-slate-950/60 text-slate-400 border-white/5 hover:border-white/20'
                          }`}
                        >
                          <Scissors className={`w-3 h-3 ${card.isEdited ? 'text-blue-400' : 'opacity-30'}`} />
                          <span>Editado</span>
                        </button>

                        {/* 3. Por Archivar */}
                        <button
                          onClick={(e) => handleToggleStage(card, 'documented', e)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            card.isDocumented
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                              : 'bg-slate-950/60 text-slate-400 border-white/5 hover:border-white/20'
                          }`}
                        >
                          <Archive className={`w-3 h-3 ${card.isDocumented ? 'text-amber-400' : 'opacity-30'}`} />
                          <span>Por Archivar</span>
                        </button>

                        {/* 4. Finalizado (Solo Jefes) */}
                        <button
                          onClick={(e) => handleToggleStage(card, 'finalized', e)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            card.isFinalized
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                              : 'bg-slate-950/60 text-slate-400 border-white/5 hover:border-white/20'
                          }`}
                          title={canManageTasks ? 'Finalizar y mover al apartado de Finalizados' : 'Solo Jefes o Coordinadores pueden finalizar'}
                        >
                          {canManageTasks ? (
                            <Crown className={`w-3 h-3 ${card.isFinalized ? 'text-emerald-400' : 'text-amber-400'}`} />
                          ) : (
                            <Lock className="w-3 h-3 text-slate-500" />
                          )}
                          <span>Finalizar</span>
                        </button>

                        {/* 5. Descartar Material (Rojo Tenue) */}
                        <button
                          onClick={(e) => handleToggleStage(card, 'discarded', e)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border col-span-2 ${
                            card.isDiscarded
                              ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                              : 'bg-slate-950/60 text-slate-400 hover:text-red-300 border-white/5 hover:border-red-500/30'
                          }`}
                          title="Descartar este material (se moverá a Material Descartado)"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                          <span>Descartar Material</span>
                        </button>
                      </div>

                      {/* Timestamps breakdown if any stage is completed */}
                      {(card.isIngested || card.isEdited || card.isDocumented || card.isDiscarded || card.isFinalized) && (
                        <div className="p-2 rounded-xl bg-slate-950/80 border border-white/5 text-[10px] space-y-0.5 font-mono">
                          <div className="text-[9px] uppercase font-bold text-slate-500 font-sans mb-0.5">Registro de Marcas de Tiempo:</div>
                          {card.isIngested && (
                            <div className="flex items-center justify-between text-cyan-300">
                              <span>• Ingestado:</span>
                              <span>{card.ingestedAt ? new Date(card.ingestedAt).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Registrado'}</span>
                            </div>
                          )}
                          {card.isEdited && (
                            <div className="flex items-center justify-between text-blue-300">
                              <span>• Editado:</span>
                              <span>{card.editedAt ? new Date(card.editedAt).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Registrado'}</span>
                            </div>
                          )}
                          {card.isDocumented && (
                            <div className="flex items-center justify-between text-amber-300">
                              <span>• Por Archivar:</span>
                              <span>{card.documentedAt ? new Date(card.documentedAt).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Registrado'}</span>
                            </div>
                          )}
                          {card.isDiscarded && (
                            <div className="flex items-center justify-between text-red-300">
                              <span>• Descartado:</span>
                              <span>{card.discardedAt ? new Date(card.discardedAt).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Registrado'}</span>
                            </div>
                          )}
                          {card.isFinalized && (
                            <div className="flex items-center justify-between text-emerald-300">
                              <span>• Finalizado:</span>
                              <span>{card.finalizedAt ? new Date(card.finalizedAt).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Registrado'}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Assigned Workers List */}
                    {card.assignedWorkerIds && card.assignedWorkerIds.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-500 font-bold">Personal:</span>
                        {card.assignedWorkerIds.map(wId => {
                          const w = workers.find(work => work.id === wId);
                          if (!w) return null;
                          const hl = getWorkerHighlightInfo(w);
                          return (
                            <span key={wId} className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${hl.chipClass}`}>
                              {w.name}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Footer: Assignee & Reassign Board */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                      <button
                        onClick={(e) => handleToggleSelfAssignment(card, e)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          isSelfAssigned
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 border border-white/10 hover:text-white'
                        }`}
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>{isSelfAssigned ? 'Asignado/a' : '+ Asignarme'}</span>
                      </button>

                      {/* Reassign select (Ingesta -> Prensa / Programacion) */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">Mover a:</span>
                        <select
                          value={card.boardId}
                          onChange={(e) => handleQuickBoardChange(card, e.target.value, e)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-slate-950 border border-white/10 rounded-md text-[10px] text-purple-300 px-1.5 py-1 focus:outline-none focus:border-purple-500 cursor-pointer"
                        >
                          {productionBoards.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls for Producción (30 por página) */}
          {productionCards.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-white/10 text-xs">
              <span className="text-slate-400">
                Mostrando <strong className="text-white">{(currentPageProduccion - 1) * TASKS_PER_PAGE + 1}</strong> - <strong className="text-white">{Math.min(currentPageProduccion * TASKS_PER_PAGE, productionCards.length)}</strong> de <strong className="text-white">{productionCards.length}</strong> tareas
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPageProduccion <= 1}
                  onClick={() => setCurrentPageProduccion(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all border border-white/10 cursor-pointer"
                >
                  Anterior
                </button>
                <span className="px-3 py-1.5 font-bold font-mono bg-slate-950 text-cyan-300 rounded-lg border border-cyan-500/30">
                  {currentPageProduccion} / {totalPagesProduccion}
                </span>
                <button
                  type="button"
                  disabled={currentPageProduccion >= totalPagesProduccion}
                  onClick={() => setCurrentPageProduccion(prev => Math.min(totalPagesProduccion, prev + 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all border border-white/10 cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OTRAS SOLICITUDES & TAREAS DE GERENCIA */}
      {activeMainTab === 'solicitudes' && (
        <div className="space-y-4">
          <div className="glass-card p-4 rounded-xl border border-white/10 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Otras Solicitudes e Iniciativas
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Solicitudes especiales sin contador de tiempo. Una vez finalizadas por el Jefe, suman como Logros de la División.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar solicitudes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <CustomDatePicker
                value={dateFilter}
                onChange={setDateFilter}
                placeholder="Filtrar fecha..."
                accentColor="amber"
                clearable
              />

              {currentWorkerId && (
                <button
                  onClick={() => setOnlyMyTasks(!onlyMyTasks)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    onlyMyTasks
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Solo mis tareas</span>
                </button>
              )}

              <button
                onClick={() => handleOpenCreateTask('board_otras_solicitudes', true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Solicitud</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherRequestsCards.length === 0 ? (
              <div className="col-span-full text-center py-12 glass-card rounded-2xl border border-white/10 bg-slate-900/50 space-y-2">
                <Award className="w-8 h-8 text-amber-400/50 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No hay otras solicitudes activas</p>
                <p className="text-xs text-slate-500">Crea solicitudes generales o de gerencia usando el botón superior.</p>
              </div>
            ) : (
              paginatedOtherRequestsCards.map(card => {
                const isSelfAssigned = currentWorkerId ? card.assignedWorkerIds.includes(currentWorkerId) : false;
                const totalItems = card.checklist?.length || 0;
                const completedItems = card.checklist?.filter(i => i.completed).length || 0;
                const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
                const isAdminBoard = card.boardId === 'board_administracion';

                return (
                  <div
                    key={card.id}
                    className="glass-card p-4 rounded-2xl border border-white/10 bg-slate-900/90 hover:border-amber-500/40 transition-all space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5 text-amber-400" /> Otras Solicitudes
                        </span>
                        {card.linkedTaskIds && card.linkedTaskIds.length > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm flex items-center gap-1">
                            <Link2 className="w-2.5 h-2.5 text-cyan-400" /> {card.linkedTaskIds.length} vinculada{card.linkedTaskIds.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {card.isGerenciaOnly && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
                            Exclusiva Gerencia
                          </span>
                        )}
                      </div>

                      {totalItems > 0 && (
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md border ${
                          pct === 100 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        }`}>
                          {completedItems}/{totalItems} ({pct}%)
                        </span>
                      )}
                    </div>

                    <div className="cursor-pointer" onClick={() => handleOpenEditTask(card)}>
                      <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors flex items-center justify-between">
                        <span>{card.title}</span>
                        <Edit3 className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-300 opacity-0 group-hover:opacity-100 transition-all" />
                      </h4>
                      {card.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {card.description}
                        </p>
                      )}
                    </div>

                    {/* Desplegable de Tareas Vinculadas */}
                    {renderLinkedTasksAccordion(card)}

                    {/* CUSTOM CHECKLIST LIST (No Ingestada/Editada/Archivada buttons) */}
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1">
                          <CheckSquare className="w-3 h-3 text-amber-400" />
                          <span>Lista de Verificación:</span>
                        </div>
                        {totalItems > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {pct === 100 ? '✓ Verificación Completa' : `${completedItems} de ${totalItems} listos`}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {totalItems > 0 && (
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}

                      {/* Checklist Items */}
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                        {card.checklist && card.checklist.length > 0 ? (
                          card.checklist.map((item) => (
                            <div
                              key={item.id}
                              onClick={(e) => handleToggleChecklistItemOnCard(card, item.id, e)}
                              className={`flex items-start gap-2 p-2 rounded-xl text-xs cursor-pointer border transition-all ${
                                item.completed
                                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300/80 line-through'
                                  : 'bg-slate-950/80 border-white/10 text-slate-200 hover:border-amber-500/40 hover:bg-slate-900'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => {}} // Click on wrapper handles toggle
                                className="mt-0.5 rounded border-white/20 text-amber-500 focus:ring-amber-500 cursor-pointer shrink-0"
                              />
                              <span className="flex-1 leading-snug break-words">{item.text}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[11px] text-slate-500 italic py-1">
                            Sin lista de verificación. Haz clic en la tarea para añadir puntos de control.
                          </p>
                        )}
                      </div>

                      {/* Quick Add Checklist Item on Card */}
                      <form onSubmit={(e) => handleAddChecklistItemOnCard(card, e)} className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          placeholder="+ Añadir ítem a la lista..."
                          value={cardQuickCheckInput[card.id] || ''}
                          onChange={(e) => setCardQuickCheckInput({ ...cardQuickCheckInput, [card.id]: e.target.value })}
                          className="flex-1 bg-slate-950/90 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold rounded-lg transition-all cursor-pointer shrink-0"
                        >
                          Añadir
                        </button>
                      </form>
                    </div>

                    {/* Collaborators / Assigned Personal on Card */}
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-amber-400" />
                          <span>Colaboradores Asignados:</span>
                        </span>
                        {card.createdByName && (
                          <span className="text-[9px] text-slate-500 font-normal normal-case">
                            Por: {card.createdByName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1 flex-wrap min-h-[26px]">
                          {card.assignedWorkerIds && card.assignedWorkerIds.length > 0 ? (
                            card.assignedWorkerIds.map(wId => {
                              const w = workers.find(work => work.id === wId);
                              if (!w) return null;
                              const hl = getWorkerHighlightInfo(w);
                              return (
                                <span
                                  key={wId}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${hl.chipClass}`}
                                >
                                  <UserCheck className="w-2.5 h-2.5 opacity-80" />
                                  {w.name}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">
                              Sin colaboradores asignados
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleToggleSelfAssignment(card, e)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                            isSelfAssigned
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-300 border border-white/10 hover:text-white'
                          }`}
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>{isSelfAssigned ? 'Asignado/a' : '+ Unirme'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Stage / Finalize Button */}
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aprobación y Logro:</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleToggleStage(card, 'finalized', e)}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                            card.isFinalized
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-950/60 text-slate-300 border-white/10 hover:border-emerald-500/40'
                          }`}
                        >
                          <Crown className="w-4 h-4 text-emerald-400" />
                          <span>{card.isFinalized ? 'Finalizada (Logro)' : 'Aprobar & Finalizar Tarea'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls for Solicitudes (30 por página) */}
          {otherRequestsCards.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-white/10 text-xs">
              <span className="text-slate-400">
                Mostrando <strong className="text-white">{(currentPageSolicitudes - 1) * TASKS_PER_PAGE + 1}</strong> - <strong className="text-white">{Math.min(currentPageSolicitudes * TASKS_PER_PAGE, otherRequestsCards.length)}</strong> de <strong className="text-white">{otherRequestsCards.length}</strong> solicitudes
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPageSolicitudes <= 1}
                  onClick={() => setCurrentPageSolicitudes(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all border border-white/10 cursor-pointer"
                >
                  Anterior
                </button>
                <span className="px-3 py-1.5 font-bold font-mono bg-slate-950 text-amber-300 rounded-lg border border-amber-500/30">
                  {currentPageSolicitudes} / {totalPagesSolicitudes}
                </span>
                <button
                  type="button"
                  disabled={currentPageSolicitudes >= totalPagesSolicitudes}
                  onClick={() => setCurrentPageSolicitudes(prev => Math.min(totalPagesSolicitudes, prev + 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all border border-white/10 cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TAREAS FINALIZADAS (APARTADO OCULTO DE HISTÓRICO) */}
      {activeMainTab === 'finalizadas' && (
        <div className="space-y-4">
          <div className="glass-card p-4 rounded-xl border border-white/10 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Apartado Histórico de Tareas y Solicitudes Finalizadas
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Muestra todas las tareas y solicitudes aprobadas y concluidas por la coordinación y gerencia.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar finalizadas..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <CustomDatePicker
                value={dateFilter}
                onChange={setDateFilter}
                placeholder="Filtrar fecha..."
                accentColor="emerald"
                clearable
              />

              {/* Stage Filter (Ingestado, Editado, Por Archivar) with AND / ONLY logic */}
              {renderStageFilter()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {finalizedCards.length === 0 ? (
              <div className="col-span-full text-center py-12 glass-card rounded-2xl border border-white/10 bg-slate-900/50 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No hay tareas finalizadas aún</p>
                <p className="text-xs text-slate-500">Cuando un Jefe o Coordinador apruebe una tarea, aparecerá en esta lista.</p>
              </div>
            ) : (
              paginatedFinalizedCards.map(card => {
                const bObj = productionBoards.find(b => b.id === card.boardId);

                return (
                  <div
                    key={card.id}
                    className="glass-card p-4 rounded-2xl border border-emerald-500/30 bg-slate-900/90 space-y-3 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Finalizada
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {card.finalizedAt ? new Date(card.finalizedAt).toLocaleDateString('es-VE') : card.dueDate}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white line-clamp-2">
                        {card.title}
                      </h4>
                      {card.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {card.description}
                        </p>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1 text-[11px] text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tipo/Área:</span>
                        <span className="font-bold text-cyan-300">{bObj?.name || (card.isOtherRequest ? 'Otras Solicitudes' : 'VTV')}</span>
                      </div>
                      {!card.isOtherRequest && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Duración Original:</span>
                            <span className="font-mono text-cyan-400">{card.duration || '00:00:00'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Duración Editada:</span>
                            <span className="font-mono text-blue-400">{card.editedDuration || '00:00:00'}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Muestrario de Tareas Vinculadas / Sub-tareas si existen */}
                    {(() => {
                      const linkedSubCards = cards.filter(c => (card.linkedTaskIds || []).includes(c.id));
                      if (linkedSubCards.length === 0) return null;

                      return (
                        <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/25 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="font-bold text-cyan-300 flex items-center gap-1.5 uppercase text-[10px]">
                              <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Tareas Vinculadas ({linkedSubCards.length})</span>
                            </div>
                            <span className="text-[10px] font-mono text-cyan-400/80 font-bold">Sub-tareas</span>
                          </div>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {linkedSubCards.map((lCard, idx) => {
                              const subBoard = productionBoards.find(b => b.id === lCard.boardId);
                              return (
                                <div key={lCard.id} className="p-2 rounded-lg bg-slate-950/90 border border-white/5 space-y-1 text-xs">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-white text-[11px] truncate">
                                      <strong className="text-cyan-400 mr-1">#{idx + 1}</strong>
                                      {lCard.title}
                                    </span>
                                    <span className="text-[10px] font-mono text-cyan-300 shrink-0 bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/30">
                                      {lCard.editedDuration || lCard.duration || '00:00:00'}
                                    </span>
                                  </div>
                                  {lCard.description && (
                                    <p className="text-[10px] text-slate-400 line-clamp-1">
                                      {lCard.description}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                                    <span>Área: {subBoard?.name || 'VTV'}</span>
                                    <span className="text-emerald-400 font-bold">✓ Vinculada</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Unlock / Re-open action for Jefes */}
                    {canManageTasks && (
                      <button
                        onClick={(e) => handleToggleStage(card, 'finalized', e)}
                        className="w-full py-1.5 rounded-lg text-xs text-slate-400 hover:text-amber-300 bg-slate-950/40 hover:bg-slate-900 border border-white/5 transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Reabrir Tarea</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls for Finalizadas (30 por página) */}
          {finalizedCards.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-white/10 text-xs">
              <span className="text-slate-400">
                Mostrando <strong className="text-white">{(currentPageFinalizadas - 1) * TASKS_PER_PAGE + 1}</strong> - <strong className="text-white">{Math.min(currentPageFinalizadas * TASKS_PER_PAGE, finalizedCards.length)}</strong> de <strong className="text-white">{finalizedCards.length}</strong> tareas finalizadas
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPageFinalizadas <= 1}
                  onClick={() => setCurrentPageFinalizadas(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all border border-white/10 cursor-pointer"
                >
                  Anterior
                </button>
                <span className="px-3 py-1.5 font-bold font-mono bg-slate-950 text-emerald-300 rounded-lg border border-emerald-500/30">
                  {currentPageFinalizadas} / {totalPagesFinalizadas}
                </span>
                <button
                  type="button"
                  disabled={currentPageFinalizadas >= totalPagesFinalizadas}
                  onClick={() => setCurrentPageFinalizadas(prev => Math.min(totalPagesFinalizadas, prev + 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all border border-white/10 cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MATERIAL DESCARTADO */}
      {activeMainTab === 'descartados' && (
        <div className="space-y-4">
          <div className="glass-card p-4 rounded-xl border border-red-500/20 bg-slate-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Material Audiovisual Descartado</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Materiales que fueron marcados como descartados. Siguen sumando en las horas ingestadas totales pero no en archivados.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-red-500/10 text-red-300 border border-red-500/30">
                Total: {discardedCards.length} descartados
              </span>

              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar descartados..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                />
              </div>

              <CustomDatePicker
                value={dateFilter}
                onChange={setDateFilter}
                placeholder="Filtrar fecha..."
                accentColor="red"
                clearable
              />

              {/* Stage Filter (Ingestado, Editado, Por Archivar) with AND / ONLY logic */}
              {renderStageFilter()}
            </div>
          </div>

          {discardedCards.length === 0 ? (
            <div className="glass-card p-12 text-center rounded-2xl border border-white/5 bg-slate-900/40">
              <Trash2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-300">No hay material descartado</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Los materiales que sean marcados como descartados aparecerán en esta lista para su consulta o eventual restauración.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedDiscardedCards.map(card => {
                const bObj = productionBoards.find(b => b.id === card.boardId);
                return (
                  <div
                    key={card.id}
                    className="glass-card p-4 rounded-2xl border border-red-500/20 bg-slate-900/80 hover:border-red-500/40 transition-all space-y-3 relative group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                          Descartado
                        </span>
                        <h3 className="text-sm font-bold text-white mt-1.5 line-clamp-2">{card.title}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenEditTask(card)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                        title="Ver / Editar Tarea"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {card.description && (
                      <p className="text-xs text-slate-300 line-clamp-2 bg-slate-950/60 p-2 rounded-lg border border-white/5">
                        {card.description}
                      </p>
                    )}

                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1 text-[11px] text-slate-300 font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Área:</span>
                        <span className="font-bold text-cyan-300 font-sans">{bObj?.name || 'Producción'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Duración Ingestada:</span>
                        <span className="text-cyan-400 font-bold">{card.duration || '00:00:00'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Descartado el:</span>
                        <span className="text-red-300 font-bold">
                          {card.discardedAt ? new Date(card.discardedAt).toLocaleDateString('es-VE') : 'Fecha N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!canManageTasks) {
                            onAddNotificationToast('Acceso Restringido', 'Solo los Jefes de División o Gerencia pueden restaurar el material descartado.', 'info');
                            return;
                          }
                          onSaveCard({
                            ...card,
                            isDiscarded: false,
                            discardedAt: undefined
                          });
                          onAddNotificationToast('Material Restaurado', `El material "${card.title}" ha sido restaurado al flujo de producción.`, 'success');
                        }}
                        className="w-full py-1.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                        <span>Restaurar al Flujo</span>
                      </button>

                      {canManageTasks && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`¿Estás seguro de eliminar definitivamente el registro "${card.title}"?`)) {
                              onDeleteCard(card.id);
                              onAddNotificationToast('Registro Eliminado', 'Se eliminó el material descartado.', 'info');
                            }
                          }}
                          className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                          title="Eliminar definitivamente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls for Descartados (30 por página) */}
          {discardedCards.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-white/10 text-xs">
              <span className="text-slate-400">
                Mostrando <strong className="text-white">{(currentPageDescartados - 1) * TASKS_PER_PAGE + 1}</strong> - <strong className="text-white">{Math.min(currentPageDescartados * TASKS_PER_PAGE, discardedCards.length)}</strong> de <strong className="text-white">{discardedCards.length}</strong> materiales descartados
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPageDescartados <= 1}
                  onClick={() => setCurrentPageDescartados(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all border border-white/10 cursor-pointer"
                >
                  Anterior
                </button>
                <span className="px-3 py-1.5 font-bold font-mono bg-slate-950 text-rose-300 rounded-lg border border-rose-500/30">
                  {currentPageDescartados} / {totalPagesDescartados}
                </span>
                <button
                  type="button"
                  disabled={currentPageDescartados >= totalPagesDescartados}
                  onClick={() => setCurrentPageDescartados(prev => Math.min(totalPagesDescartados, prev + 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all border border-white/10 cursor-pointer"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REPORTE & TIEMPOS OPERATIVOS DE PROCESOS */}
      {activeMainTab === 'reportes' && (
        <div className="space-y-6">
          <div className="glass-card p-5 rounded-2xl border border-white/10 bg-slate-900/80 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  Reporte Operativo y Métricas de Tiempos
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conteo diario, mensual y anual de materiales ingestados, editados, archivados y finalizados con ahorro de tiempo por filtro de ingesta.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleCopyTextReport}
                  className="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 hover:text-white text-xs font-bold border border-purple-500/40 transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.2)]"
                  title="Copiar informe en formato texto para compartir o pegar en un mensaje"
                >
                  {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-purple-300" />}
                  <span>{copiedText ? '¡Copiado!' : 'Copiar Informe Texto'}</span>
                </button>

                <button
                  onClick={handlePrintReport}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-cyan-400" />
                  <span>Imprimir / PDF</span>
                </button>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Report Type */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Período del Reporte:</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="diario">Diario</option>
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>

              {/* Date Input */}
              {reportType === 'diario' && (
                <CustomDatePicker
                  label="Fecha Específica:"
                  value={reportDate}
                  onChange={setReportDate}
                  accentColor="purple"
                  className="w-full"
                />
              )}

              {reportType === 'mensual' && (
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Mes Seleccionado:</label>
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  />
                </div>
              )}

              {reportType === 'anual' && (
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Año Seleccionado:</label>
                  <input
                    type="number"
                    value={reportYear}
                    onChange={(e) => setReportYear(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Division Filter */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">División:</label>
                <select
                  value={reportDivisionFilter}
                  onChange={(e) => setReportDivisionFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="todos">Todas las Divisiones</option>
                  {divisions.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Worker Filter */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Colaborador:</label>
                <select
                  value={reportWorkerFilter}
                  onChange={(e) => setReportWorkerFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="todos">Todos los Colaboradores</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.cargo})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* METRICS SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
              {/* Horas de Ingesta */}
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-1">
                <span className="text-[10px] font-bold uppercase text-cyan-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Total Horas Ingestadas
                </span>
                <div className="text-2xl font-black text-white font-mono">{reportMetrics.totalIngestaHHMMSS}</div>
                <p className="text-[10px] text-slate-400">Suma total de horas de tareas marcadas como ingestadas en el período.</p>
              </div>

              {/* Tiempo Ahorrado por Filtro de Ingesta */}
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                <span className="text-[10px] font-bold uppercase text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Ahorro por Filtro de Ingesta
                </span>
                <div className="text-2xl font-black text-emerald-300 font-mono">{reportMetrics.tiempoAhorradoHHMMSS}</div>
                <p className="text-[10px] text-slate-400">Resta: Duración Original - Duración Editada.</p>
              </div>

              {/* Conteo de Procesos en Período */}
              <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-1">
                <span className="text-[10px] font-bold uppercase text-blue-400 flex items-center gap-1">
                  <Scissors className="w-3.5 h-3.5" />
                  Materiales Editados
                </span>
                <div className="text-2xl font-black text-white font-mono">{reportMetrics.editadosCount} items</div>
                <p className="text-[10px] text-slate-400">Materiales procesados en la etapa de edición.</p>
              </div>

              {/* Logros Otras Solicitudes */}
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-1">
                <span className="text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  Logros Otras Solicitudes
                </span>
                <div className="text-2xl font-black text-amber-300 font-mono">{reportMetrics.logrosOtrasSolicitudesCount} completados</div>
                <p className="text-[10px] text-slate-400">Solicitudes especiales finalizadas con éxito.</p>
              </div>

              {/* Material Archivado (Finalizados Consolidados) */}
              <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-1">
                <span className="text-[10px] font-bold uppercase text-purple-400 flex items-center gap-1">
                  <Archive className="w-3.5 h-3.5" />
                  Material Archivado
                </span>
                <div className="text-2xl font-black text-purple-300 font-mono">{reportMetrics.materialArchivadoCount} items</div>
                <p className="text-[10px] text-slate-400">Tareas finalizadas (tareas vinculadas cuentan como 1 solo item).</p>
              </div>
            </div>

            {/* APARTADO EXCLUSIVO DE SUPERUSUARIO: TAREAS COMPLETADAS POR PERSONAL AGRUPADO POR DIVISIÓN */}
            {isSuperUser && superuserWorkerMetrics && (
              <div className="pt-4 border-t border-purple-500/30">
                <div className="p-5 rounded-2xl bg-slate-950/90 border border-purple-500/40 shadow-[0_0_35px_rgba(168,85,247,0.15)] space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-purple-500/20">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                          Vista Exclusiva de Superusuario
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Control por Divisiones</span>
                      </div>
                      <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                        Métricas de Tareas Completadas Desglosadas por Área / División
                      </h3>
                      <p className="text-xs text-slate-400">
                        Visualización jerárquica del personal técnico y coordinadores agrupados por cada división operativa. Tareas vinculadas contabilizan 1 por familia.
                      </p>
                    </div>

                    {/* Search Filter for Superuser Section */}
                    <div className="relative w-full md:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={superUserSearch}
                        onChange={(e) => setSuperUserSearch(e.target.value)}
                        placeholder="Buscar división, técnico o jefe..."
                        className="w-full pl-9 pr-8 py-1.5 bg-slate-900 border border-purple-500/30 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                      />
                      {superUserSearch && (
                        <button
                          type="button"
                          onClick={() => setSuperUserSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Resumen Superior de Totales por Categoría */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-amber-400 uppercase block">Técnicos (Período)</span>
                        <span className="text-xl font-black text-amber-200 font-mono">{superuserWorkerMetrics.totalTechPeriod} familias</span>
                      </div>
                      <Users className="w-6 h-6 text-amber-400/50" />
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-950/10 border border-amber-500/20 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Técnicos (Histórico)</span>
                        <span className="text-xl font-black text-white font-mono">{superuserWorkerMetrics.totalTechAllTime} familias</span>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-slate-500/50" />
                    </div>

                    <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-purple-400 uppercase block">Coordinadores (Período)</span>
                        <span className="text-xl font-black text-purple-200 font-mono">{superuserWorkerMetrics.totalCoordPeriod} familias</span>
                      </div>
                      <Crown className="w-6 h-6 text-purple-400/50" />
                    </div>

                    <div className="p-3.5 rounded-xl bg-purple-950/10 border border-purple-500/20 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Coordinadores (Histórico)</span>
                        <span className="text-xl font-black text-white font-mono">{superuserWorkerMetrics.totalCoordAllTime} familias</span>
                      </div>
                      <Award className="w-6 h-6 text-slate-500/50" />
                    </div>
                  </div>

                  {/* BLOQUES DE PERSONAL AGRUPADOS POR CADA DIVISIÓN */}
                  <div className="space-y-6 pt-2">
                    {superuserWorkerMetrics.byDivision.length > 0 ? (
                      superuserWorkerMetrics.byDivision.map((divGroup) => (
                        <div key={`div_block_${divGroup.division.id}`} className="space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-purple-500/30">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-purple-500/20">
                            <div>
                              <h4 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-cyan-400" />
                                <span>{divGroup.division.name}</span>
                              </h4>
                              {divGroup.division.description && (
                                <p className="text-[11px] text-slate-400 mt-0.5">{divGroup.division.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                {divGroup.totalPeriodCount} familias en período
                              </span>
                              <span className="px-2.5 py-1 rounded-lg text-xs font-mono text-slate-400 bg-slate-950 border border-white/10">
                                {divGroup.totalAllTimeCount} histórico
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pt-1">
                            {/* COORDINADORES Y JEFES DE ESTA DIVISIÓN */}
                            <div className="space-y-2 bg-slate-950/80 p-3 rounded-xl border border-purple-500/20">
                              <div className="flex items-center justify-between pb-1">
                                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                                  Coordinadores y Jefes ({divGroup.coords.length})
                                </span>
                              </div>
                              {divGroup.coords.length > 0 ? (
                                <div className="overflow-x-auto rounded-lg border border-white/5">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-purple-950/40 text-purple-300 uppercase text-[9px] font-bold border-b border-purple-500/20">
                                      <tr>
                                        <th className="p-2">Coordinador</th>
                                        <th className="p-2 text-center">En Período</th>
                                        <th className="p-2 text-center">Histórico</th>
                                        <th className="p-2 text-center">En Proceso</th>
                                        <th className="p-2 text-right">Detalle</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-slate-300">
                                      {divGroup.coords.map((item) => (
                                        <tr key={`div_c_${item.worker.id}`} className="hover:bg-purple-950/20 transition-colors">
                                          <td className="p-2 font-bold text-white">
                                            <div className="text-xs flex items-center gap-1">
                                              <span>{item.worker.name}</span>
                                              <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                                            </div>
                                            <div className="text-[10px] text-purple-300 font-normal">{item.worker.cargo}</div>
                                          </td>
                                          <td className="p-2 text-center font-mono font-black text-emerald-400">
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                                              {item.periodCompletedCount}
                                            </span>
                                          </td>
                                          <td className="p-2 text-center font-mono text-slate-300">
                                            {item.totalCompletedCount}
                                          </td>
                                          <td className="p-2 text-center font-mono text-amber-400 text-[10px]">
                                            {item.inProgressCount > 0 ? `${item.inProgressCount} act.` : '-'}
                                          </td>
                                          <td className="p-2 text-right">
                                            <button
                                              type="button"
                                              onClick={() => setSelectedWorkerDetailId(item.worker.id)}
                                              className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                              title="Ver tareas del período de este coordinador"
                                            >
                                              <Eye className="w-3 h-3 text-purple-400" />
                                              <span>Ver</span>
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="p-3 text-center text-[11px] text-slate-500 italic">
                                  Sin coordinadores registrados en esta división.
                                </div>
                              )}
                            </div>

                            {/* PERSONAL TÉCNICO DE ESTA DIVISIÓN */}
                            <div className="space-y-2 bg-slate-950/80 p-3 rounded-xl border border-amber-500/20">
                              <div className="flex items-center justify-between pb-1">
                                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-amber-400" />
                                  Personal Técnico ({divGroup.techs.length})
                                </span>
                              </div>
                              {divGroup.techs.length > 0 ? (
                                <div className="overflow-x-auto rounded-lg border border-white/5">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-amber-950/40 text-amber-300 uppercase text-[9px] font-bold border-b border-amber-500/20">
                                      <tr>
                                        <th className="p-2">Técnico</th>
                                        <th className="p-2 text-center">En Período</th>
                                        <th className="p-2 text-center">Histórico</th>
                                        <th className="p-2 text-center">En Proceso</th>
                                        <th className="p-2 text-right">Detalle</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-slate-300">
                                      {divGroup.techs.map((item) => (
                                        <tr key={`div_t_${item.worker.id}`} className="hover:bg-amber-950/20 transition-colors">
                                          <td className="p-2 font-bold text-white">
                                            <div className="text-xs">{item.worker.name}</div>
                                            <div className="text-[10px] text-slate-400 font-normal">{item.worker.cargo}</div>
                                          </td>
                                          <td className="p-2 text-center font-mono font-black text-emerald-400">
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                                              {item.periodCompletedCount}
                                            </span>
                                          </td>
                                          <td className="p-2 text-center font-mono text-slate-300">
                                            {item.totalCompletedCount}
                                          </td>
                                          <td className="p-2 text-center font-mono text-amber-400 text-[10px]">
                                            {item.inProgressCount > 0 ? `${item.inProgressCount} act.` : '-'}
                                          </td>
                                          <td className="p-2 text-right">
                                            <button
                                              type="button"
                                              onClick={() => setSelectedWorkerDetailId(item.worker.id)}
                                              className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                              title="Ver tareas del período de este técnico"
                                            >
                                              <Eye className="w-3 h-3 text-purple-400" />
                                              <span>Ver</span>
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="p-3 text-center text-[11px] text-slate-500 italic">
                                  Sin técnicos registrados en esta división.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-900/40 rounded-xl border border-white/5">
                        No se encontraron divisiones ni personal con el filtro o búsqueda actual.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* MONTHLY CALENDAR GRID (When reportType === 'mensual') - Posicionado justo debajo de los resumenes de métricas */}
            {reportType === 'mensual' && (
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/80 p-4 rounded-2xl border border-white/10">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      <span>Calendario Mensual de Horas Ingestadas por Día</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Mes y Año: <strong className="text-cyan-300 font-mono">{reportMonth}</strong> • Total Días: {reportMetrics.monthlyCalendarDays.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 border border-emerald-400"></span> Con ingesta
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-white/10"></span> Sin ingesta
                    </span>
                  </div>
                </div>

                {/* Calendar Grid Header */}
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] uppercase text-slate-400 bg-slate-950 p-2 rounded-xl border border-white/10">
                  <div>Lun</div>
                  <div>Mar</div>
                  <div>Mié</div>
                  <div>Jue</div>
                  <div>Vie</div>
                  <div>Sáb</div>
                  <div>Dom</div>
                </div>

                {/* Calendar Grid Cells */}
                <div className="grid grid-cols-7 gap-1.5">
                  {/* Empty cells padding for first week alignment */}
                  {(() => {
                    const [mY, mM] = reportMonth.split('-').map(Number);
                    const firstDayObj = new Date(mY || new Date().getFullYear(), (mM || 1) - 1, 1);
                    const firstDayOfWeek = (firstDayObj.getDay() + 6) % 7;
                    const blanks = [];
                    for (let i = 0; i < firstDayOfWeek; i++) {
                      blanks.push(<div key={`blank_${i}`} className="p-2 min-h-[70px] rounded-xl bg-slate-950/30 border border-white/5 opacity-30"></div>);
                    }
                    return blanks;
                  })()}

                  {reportMetrics.monthlyCalendarDays.map(day => {
                    const hasData = day.ingestedSeconds > 0;
                    return (
                      <div
                        key={day.dayNum}
                        className={`p-2.5 min-h-[75px] rounded-xl border transition-all flex flex-col justify-between ${
                          hasData
                            ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.1)] hover:border-emerald-400'
                            : 'bg-slate-950/60 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-slate-400">{day.dayOfWeekShort}</span>
                          <span className={`text-xs font-black font-mono rounded-full w-5 h-5 flex items-center justify-center ${hasData ? 'bg-emerald-500/30 text-emerald-300' : 'text-white'}`}>
                            {day.dayNum}
                          </span>
                        </div>

                        <div className="mt-1 space-y-0.5">
                          <span className="text-[9px] text-slate-400 block font-medium">Horas Ingestadas:</span>
                          <span className={`text-xs font-bold font-mono block ${hasData ? 'text-emerald-300' : 'text-slate-500'}`}>
                            {day.ingestedHHMMSS}
                          </span>
                        </div>

                        {day.tasksCount > 0 && (
                          <div className="mt-1">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                              {day.tasksCount} item{day.tasksCount > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ADDITIONAL MONTHLY SECTIONS: DESGLOSE DE AHORRO Y MATERIAL ENTREGADO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Desglose de ahorro por filtro */}
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Desglose del Ahorro por Filtro</span>
                    </h4>
                    <div className="space-y-2">
                      {reportMetrics.savingsByFilter.map(sf => (
                        <div key={sf.boardId} className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-white/5 text-xs">
                          <span className="text-slate-300 font-medium">{sf.boardName}</span>
                          <div className="flex items-center gap-3 font-mono">
                            <span className="text-slate-500 text-[10px]">{sf.count} items</span>
                            <span className="text-emerald-300 font-bold">{sf.savedHHMMSS}</span>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs font-bold">
                        <span className="text-emerald-200">Total Ahorro Acumulado</span>
                        <span className="text-emerald-300 font-mono">{reportMetrics.tiempoAhorradoHHMMSS}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cantidad de material entregado */}
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-blue-400" />
                      <span>Cantidad de Material Entregado</span>
                    </h4>
                    <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300">Total Materiales Entregados:</span>
                        <span className="font-bold text-white font-mono text-sm">{reportMetrics.finalizadosCount} items</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300">Duración Total Editada Entregada:</span>
                        <span className="font-bold text-blue-300 font-mono text-sm">{reportMetrics.deliveredTotalEditedHHMMSS}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* LISTA 1: MATERIAL INGESTADO Y EDITADO */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-cyan-950/30 p-4 rounded-2xl border border-cyan-500/30">
                <div>
                  <h3 className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Lista 1: Material Ingestado y Editado ({reportMetrics.ingestadosYEditadosCount} tareas)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Tareas marcadas como Ingestadas (suman al total de horas ingestadas) y/o Editadas (su resta de original - editado suma al tiempo ahorrado). Se muestran por Tarea Raíz y se desglosan al hacer clic.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 w-fit">
                  {reportMetrics.ingestadosYEditadosCount} Tareas en Total
                </span>
              </div>

              {reportMetrics.ingestedAndEditedGroups.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-cyan-500/20 bg-slate-950/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-cyan-950/50 border-b border-cyan-500/20 text-cyan-300 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Material / Tarea Raíz</th>
                        <th className="p-3">Área / Tablero</th>
                        <th className="p-3">Personal Asignado</th>
                        <th className="p-3">Estado del Día</th>
                        <th className="p-3">Duración Orig.</th>
                        <th className="p-3">Duración Edit.</th>
                        <th className="p-3">Tiempo Ahorrado</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {reportMetrics.ingestedAndEditedGroups.map(group => {
                        const c = group.primaryCard;
                        const bObj = productionBoards.find(b => b.id === c.boardId);
                        const isExpanded = Boolean(expandedGroupIds[`ing1_${group.groupId}`]);

                        const origSec = group.totalDurationSeconds;
                        const editSec = group.totalEditedDurationSeconds;
                        const diffSec = Math.max(0, origSec - editSec);

                        const assignedNames = (c.assignedWorkerIds || [])
                          .map(wId => workers.find(w => w.id === wId)?.name)
                          .filter(Boolean);

                        return (
                          <React.Fragment key={`ing1_grp_${group.groupId}`}>
                            <tr
                              onClick={() => group.isLinkedGroup && toggleGroupExpanded(`ing1_${group.groupId}`)}
                              className={`transition-colors ${
                                group.isLinkedGroup
                                  ? 'hover:bg-cyan-950/40 cursor-pointer bg-cyan-950/20'
                                  : 'hover:bg-slate-900/40'
                              }`}
                            >
                              <td className="p-3 font-bold text-white max-w-[240px]">
                                <div className="flex items-center gap-2">
                                  {group.isLinkedGroup && (
                                    <span className="p-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </span>
                                  )}
                                  <span
                                    className="truncate hover:text-cyan-300 hover:underline cursor-pointer"
                                    title="Clic para ver/modificar esta tarea"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditTask(c);
                                    }}
                                  >
                                    {c.title}
                                  </span>
                                </div>
                                {group.isLinkedGroup && (
                                  <div className="text-[10px] text-cyan-300 font-medium mt-1 flex items-center gap-1">
                                    <Link2 className="w-3 h-3 text-cyan-400 shrink-0" />
                                    <span>
                                      {group.linkedCards.length} subtareas vinculadas ({1 + group.linkedCards.length} en total) • {isExpanded ? 'Clic para ocultar' : 'Clic para abrir desglose'}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-cyan-300 whitespace-nowrap">
                                {bObj?.name || 'VTV'}
                              </td>
                              <td className="p-3">
                                {assignedNames.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {assignedNames.map((n, i) => (
                                      <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-cyan-200 border border-white/5">
                                        {n}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-500 italic text-[10px]">Sin asignar</span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                                  {c.isIngested && <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Ingestado</span>}
                                  {c.isEdited && <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">Editado</span>}
                                </div>
                              </td>
                              <td className="p-3 font-mono text-cyan-300 font-bold whitespace-nowrap">
                                {group.totalDurationHHMMSS}
                              </td>
                              <td className="p-3 font-mono text-blue-300 font-bold whitespace-nowrap">
                                {group.totalEditedDurationHHMMSS}
                              </td>
                              <td className="p-3 font-mono text-emerald-300 font-bold whitespace-nowrap">
                                {diffSec > 0 ? formatSecondsToHHMMSS(diffSec) : '-'}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditTask(c);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                                  title="Ver / Modificar Tarea"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Editar</span>
                                </button>
                              </td>
                            </tr>

                            {/* Desglose de Subtareas Vinculadas de Lista 1 */}
                            {group.isLinkedGroup && isExpanded && (
                              group.linkedCards.map((subCard, subIdx) => {
                                const subBoard = productionBoards.find(b => b.id === subCard.boardId);
                                const subOrigSec = parseDurationToSeconds(subCard.duration);
                                const subEditSec = subCard.isEdited && subCard.editedDuration ? parseDurationToSeconds(subCard.editedDuration) : subOrigSec;
                                const subDiffSec = subCard.isEdited ? Math.max(0, subOrigSec - subEditSec) : 0;
                                const subEditedDurationStr = subCard.isEdited && subCard.editedDuration ? subCard.editedDuration : (subCard.duration || '00:00:00');

                                return (
                                  <tr key={`sub_ing1_${subCard.id}_${subIdx}`} className="bg-slate-900/90 text-slate-300 border-l-4 border-cyan-500">
                                    <td className="p-2.5 pl-8 text-xs font-medium text-slate-200">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-cyan-400 font-mono text-[10px] font-bold">↳ [{subIdx + 1}]</span>
                                        <span
                                          className="hover:text-cyan-300 hover:underline cursor-pointer"
                                          title="Clic para ver/modificar esta subtarea"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditTask(subCard);
                                          }}
                                        >
                                          {subCard.title}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-[11px] text-cyan-300">
                                      {subBoard?.name || 'VTV'}
                                    </td>
                                    <td className="p-2.5 text-[10px] text-slate-400 italic" colSpan={2}>
                                      Tarea vinculada individual
                                    </td>
                                    <td className="p-2.5 font-mono text-cyan-300 text-xs font-bold whitespace-nowrap">
                                      {subCard.duration || '00:00:00'}
                                    </td>
                                    <td className="p-2.5 font-mono text-blue-300 text-xs font-bold whitespace-nowrap">
                                      {subEditedDurationStr}
                                    </td>
                                    <td className="p-2.5 font-mono text-emerald-300 text-xs font-bold whitespace-nowrap">
                                      {subDiffSec > 0 ? formatSecondsToHHMMSS(subDiffSec) : '-'}
                                    </td>
                                    <td className="p-2.5 text-right whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditTask(subCard);
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                        title="Ver / Modificar Subtarea"
                                      >
                                        <Edit3 className="w-3 h-3 text-cyan-400" />
                                        <span>Editar</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-cyan-500/20 bg-slate-950/40 text-center text-xs text-slate-500 italic">
                  No hay material ingestado o editado en el día seleccionado.
                </div>
              )}
            </div>

            {/* LISTA 2: MATERIAL ARCHIVADO Y LOGROS DE OTRAS SOLICITUDES */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-950/30 p-4 rounded-2xl border border-amber-500/30">
                <div>
                  <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    <Archive className="w-4 h-4 text-amber-400" />
                    <span>Lista 2: Material Archivado y Logros ({reportMetrics.materialArchivadoYLogrosCount} items consolidados)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Material marcado como "Para Archivar" / Documentado (se cuenta 1 solo item por familia de tareas) y Otras Solicitudes marcadas como Logros ese día. Clic para ver desglose.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 w-fit">
                  {reportMetrics.materialArchivadoYLogrosCount} Familias / Items
                </span>
              </div>

              {reportMetrics.archivadosAndLogrosGroups.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-amber-500/20 bg-slate-950/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-amber-950/50 border-b border-amber-500/20 text-amber-300 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Material / Tarea Raíz</th>
                        <th className="p-3">Área / Tablero</th>
                        <th className="p-3">Personal Responsable</th>
                        <th className="p-3">Fecha y Hora Registro</th>
                        <th className="p-3">Duración</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {reportMetrics.archivadosAndLogrosGroups.map(group => {
                        const docCard = group.primaryCard;
                        const bObj = productionBoards.find(b => b.id === docCard.boardId);
                        const docInfo = getDocumentedInfo(docCard);
                        const isExpanded = Boolean(expandedGroupIds[`arch2_${group.groupId}`]);

                        return (
                          <React.Fragment key={`arch2_grp_${group.groupId}`}>
                            <tr
                              onClick={() => group.isLinkedGroup && toggleGroupExpanded(`arch2_${group.groupId}`)}
                              className={`transition-colors ${
                                group.isLinkedGroup
                                  ? 'hover:bg-amber-900/30 cursor-pointer bg-amber-950/20'
                                  : 'hover:bg-amber-950/10'
                              }`}
                            >
                              <td className="p-3 font-bold text-white max-w-[260px]">
                                <div className="flex items-center gap-2">
                                  {group.isLinkedGroup && (
                                    <span className="p-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </span>
                                  )}
                                  <span
                                    className="truncate hover:text-amber-300 hover:underline cursor-pointer"
                                    title="Clic para ver/modificar esta tarea"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditTask(docCard);
                                    }}
                                  >
                                    {docCard.title}
                                  </span>
                                </div>
                                {group.isLinkedGroup ? (
                                  <div className="text-[10px] text-amber-300 font-medium mt-1 flex items-center gap-1">
                                    <Link2 className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span>
                                      Familia de {1 + group.linkedCards.length} tareas (Cuenta como 1 item) • {isExpanded ? 'Clic para ocultar' : 'Clic para abrir desglose'}
                                    </span>
                                  </div>
                                ) : (
                                  docCard.isDepartmentAchievement && (
                                    <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                                      Logro Solicitud Especial
                                    </span>
                                  )
                                )}
                              </td>
                              <td className="p-3 text-cyan-300 whitespace-nowrap">
                                {bObj?.name || 'VTV'}
                              </td>
                              <td className="p-3 font-medium text-amber-200 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>{docInfo.workerName}</span>
                                </div>
                              </td>
                              <td className="p-3 font-mono text-cyan-300 text-[11px] whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                                  <span>{docInfo.formattedDateTime}</span>
                                </div>
                              </td>
                              <td className="p-3 font-mono font-bold whitespace-nowrap">
                                {group.isLinkedGroup ? (
                                  <span className="text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                                    {group.totalDurationHHMMSS}
                                  </span>
                                ) : (
                                  <span className="text-slate-200">{docCard.duration || '00:00:00'}</span>
                                )}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditTask(docCard);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                                  title="Ver / Modificar Tarea"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Editar</span>
                                </button>
                              </td>
                            </tr>

                            {/* Desglose de Subtareas Vinculadas de Lista 2 */}
                            {group.isLinkedGroup && isExpanded && (
                              group.linkedCards.map((subCard, subIdx) => {
                                const subBoard = productionBoards.find(b => b.id === subCard.boardId);
                                return (
                                  <tr key={`sub_arch2_${subCard.id}_${subIdx}`} className="bg-slate-900/90 text-slate-300 border-l-4 border-amber-500">
                                    <td className="p-2.5 pl-8 text-xs font-medium text-slate-200" colSpan={1}>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-amber-400 font-mono text-[10px] font-bold">↳ [{subIdx + 1}]</span>
                                        <span
                                          className="hover:text-amber-300 hover:underline cursor-pointer"
                                          title="Clic para ver/modificar esta subtarea"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditTask(subCard);
                                          }}
                                        >
                                          {subCard.title}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-[11px] text-cyan-300">
                                      {subBoard?.name || 'VTV'}
                                    </td>
                                    <td className="p-2.5 text-[10px] text-slate-400 italic" colSpan={2}>
                                      Tarea vinculada de la familia
                                    </td>
                                    <td className="p-2.5 font-mono text-cyan-300 text-xs font-bold whitespace-nowrap">
                                      {subCard.duration || '00:00:00'}
                                    </td>
                                    <td className="p-2.5 text-right whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditTask(subCard);
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                                        title="Ver / Modificar Subtarea"
                                      >
                                        <Edit3 className="w-3 h-3 text-amber-400" />
                                        <span>Editar</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-slate-950/40 text-center text-xs text-slate-500 italic">
                  No hay material archivado o logros en el día seleccionado.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT TASK MODAL */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8"
            >
              <div className="p-5 border-b border-white/10 bg-slate-950 flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Kanban className="w-4 h-4 text-cyan-400" />
                  <span>{editingCard ? 'Editar Registro de Tarea' : 'Crear Nuevo Registro'}</span>
                </h3>
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveTaskSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Title */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Título de la Tarea / Material *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Cobertura Noticias VTV / Edición Nota Especial..."
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Classification: General vs Otras Solicitudes / Administración */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Lista / Área *</label>
                    <select
                      value={taskBoardId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTaskBoardId(val);
                        if (val === 'board_otras_solicitudes' || val === 'board_administracion') {
                          setTaskIsOtherRequest(true);
                        } else {
                          setTaskIsOtherRequest(false);
                        }
                      }}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <optgroup label="Procesos Audiovisuales">
                        {productionBoards.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Administración y Otras Solicitudes">
                        <option value="board_administracion">Administración</option>
                        <option value="board_otras_solicitudes">Otras Solicitudes / Iniciativas</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Prioridad</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as any)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                </div>

                {/* Exclusiva de Gerencia Toggle (Solo visible para Gerente / Adjunta) */}
                {isGerenciaUser && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <input
                      type="checkbox"
                      id="isGerenciaOnly"
                      checked={taskIsGerenciaOnly}
                      onChange={(e) => setTaskIsGerenciaOnly(e.target.checked)}
                      className="rounded border-white/20 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="isGerenciaOnly" className="text-xs font-bold text-amber-300 cursor-pointer flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      Tarea Exclusiva de Gerencia (Oculta para usuarios generales)
                    </label>
                  </div>
                )}

                {/* Logro del Departamento Toggle (No administrativa ni gerencial) */}
                {taskBoardId !== 'board_administracion' && !taskIsGerenciaOnly && (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-white/10">
                    <div className="flex items-center gap-2.5">
                      <Award className="w-4 h-4 text-amber-400" />
                      <div>
                        <span className="text-xs font-bold text-white block">Logro del Departamento</span>
                        <span className="text-[10px] text-slate-400 block">Determina si esta solicitud cuenta como logro para los reportes gerenciales</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (taskIsDepartmentAchievement && !canManageTasks) {
                          onAddNotificationToast(
                            'Acceso Restringido',
                            'Solo los Jefes de División, Coordinadores o Gerencia pueden desmarcar un Logro del Departamento.',
                            'info'
                          );
                          return;
                        }
                        setTaskIsDepartmentAchievement(!taskIsDepartmentAchievement);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        taskIsDepartmentAchievement
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                          : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {taskIsDepartmentAchievement ? '🏆 Sí, es Logro' : 'No es logro'}
                    </button>
                  </div>
                )}

                {/* Duración Material Original & Editado con Ruleta / Candado */}
                {!taskIsOtherRequest && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <DurationPickerWheel
                      label="Tiempo Material Ingestado / Original"
                      value={taskDuration}
                      onChange={(val) => setTaskDuration(val)}
                      accentColor="cyan"
                    />

                    <DurationPickerWheel
                      label="Tiempo Material Editado"
                      value={taskEditedDuration}
                      onChange={(val) => setTaskEditedDuration(val)}
                      accentColor="blue"
                      syncFromValue={taskDuration}
                      syncLabel="Copiar de Ingestado"
                    />
                  </div>
                )}

                {/* WORKFLOW STAGE BOOLEANS & TIMESTAMPS IN MODAL */}
                {taskIsOtherRequest || taskBoardId === 'board_otras_solicitudes' || taskBoardId === 'board_administracion' ? (
                  /* CUSTOM CHECKLIST MANAGER (For Administración and Otras Solicitudes) */
                  <div className="space-y-3 p-3.5 rounded-xl bg-slate-950 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-amber-300 uppercase flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                        <span>Lista de Verificación Personalizada ({taskChecklist.filter(i => i.completed).length}/{taskChecklist.length})</span>
                      </div>
                      {taskChecklist.length > 0 && (
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          {Math.round((taskChecklist.filter(i => i.completed).length / taskChecklist.length) * 100)}% Completado
                        </span>
                      )}
                    </div>

                    {/* Input to add item */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Escribe un punto de control (ej. Elaborar reporte, coordinar transporte)..."
                        value={newChecklistItemText}
                        onChange={(e) => setNewChecklistItemText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddChecklistItemInModal();
                          }
                        }}
                        className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddChecklistItemInModal}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Añadir</span>
                      </button>
                    </div>

                    {/* Checklist items list */}
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                      {taskChecklist.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-2 text-center">
                          No hay elementos en la lista de verificación. Agrega tareas específicas de control.
                        </p>
                      ) : (
                        taskChecklist.map((item, index) => (
                          <div key={item.id || index} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/90 border border-white/5">
                            <label className="flex items-center gap-2.5 flex-1 cursor-pointer min-w-0">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => {
                                  if (item.completed && !canManageTasks) {
                                    onAddNotificationToast(
                                      'Acceso Restringido',
                                      'Solo los Jefes de División, Coordinadores o Gerencia pueden desmarcar ítems completados.',
                                      'info'
                                    );
                                    return;
                                  }
                                  setTaskChecklist(taskChecklist.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i));
                                }}
                                className="rounded border-white/20 text-amber-500 focus:ring-amber-500 cursor-pointer"
                              />
                              <span className={`text-xs ${item.completed ? 'line-through text-slate-500 font-normal' : 'text-slate-200 font-medium'} truncate`}>
                                {item.text}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setTaskChecklist(taskChecklist.filter(i => i.id !== item.id));
                              }}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors cursor-pointer"
                              title="Eliminar punto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  /* STANDARD AUDIOVISUAL STAGES */
                  <div className="space-y-3 p-3.5 rounded-xl bg-slate-950 border border-white/10">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Etapas del Flujo y Fechas de Registro</span>
                      </div>
                      {canManageTasks ? (
                        <span className="text-[10px] text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                          Edición de Fechas Habilitada (Coordinador)
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                          <Lock className="w-3 h-3 text-slate-500" /> Fechas fijas (Solo Coordinadores modifican)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Stage 1: Ingestado */}
                      <div className={`p-3 rounded-xl border space-y-2 transition-all ${taskIsIngested ? 'bg-cyan-950/30 border-cyan-500/40' : 'bg-slate-900/50 border-white/5 opacity-70'}`}>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-cyan-300">
                            <input
                              type="checkbox"
                              checked={taskIsIngested}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (!checked && !canManageTasks) {
                                  onAddNotificationToast(
                                    'Acceso Restringido',
                                    'Solo los Jefes de División, Coordinadores o Gerencia pueden desmarcar la etapa de Ingesta.',
                                    'info'
                                  );
                                  return;
                                }
                                setTaskIsIngested(checked);
                                if (checked && !taskIngestedAt) {
                                  setTaskIngestedAt(new Date().toISOString());
                                } else if (!checked) {
                                  setTaskIngestedAt(undefined);
                                }
                              }}
                              className="rounded border-white/20 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                            />
                            <Check className="w-3.5 h-3.5" />
                            <span>Ingestado</span>
                          </label>
                          {taskIsIngested && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded">Completado</span>}
                        </div>

                        {taskIsIngested && (
                          <div>
                            <label className="text-[10px] text-slate-400 font-medium block mb-1">Fecha y Hora de Ingesta:</label>
                            <input
                              type="datetime-local"
                              disabled={!canManageTasks}
                              value={formatForDatetimeLocal(taskIngestedAt)}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setTaskIngestedAt(parseDatetimeLocalToIso(e.target.value));
                                }
                              }}
                              className={`w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-500 ${!canManageTasks ? 'opacity-70 cursor-not-allowed bg-slate-900' : 'cursor-pointer'}`}
                            />
                          </div>
                        )}
                      </div>

                      {/* Stage 2: Editado */}
                      <div className={`p-3 rounded-xl border space-y-2 transition-all ${taskIsEdited ? 'bg-blue-950/30 border-blue-500/40' : 'bg-slate-900/50 border-white/5 opacity-70'}`}>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-blue-300">
                            <input
                              type="checkbox"
                              checked={taskIsEdited}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (!checked && !canManageTasks) {
                                  onAddNotificationToast(
                                    'Acceso Restringido',
                                    'Solo los Jefes de División, Coordinadores o Gerencia pueden desmarcar la etapa de Edición.',
                                    'info'
                                  );
                                  return;
                                }
                                setTaskIsEdited(checked);
                                if (checked && !taskEditedAt) {
                                  setTaskEditedAt(new Date().toISOString());
                                } else if (!checked) {
                                  setTaskEditedAt(undefined);
                                }
                              }}
                              className="rounded border-white/20 text-blue-500 focus:ring-blue-500 cursor-pointer"
                            />
                            <Scissors className="w-3.5 h-3.5" />
                            <span>Editado</span>
                          </label>
                          {taskIsEdited && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">Completado</span>}
                        </div>

                        {taskIsEdited && (
                          <div>
                            <label className="text-[10px] text-slate-400 font-medium block mb-1">Fecha y Hora de Edición:</label>
                            <input
                              type="datetime-local"
                              disabled={!canManageTasks}
                              value={formatForDatetimeLocal(taskEditedAt)}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setTaskEditedAt(parseDatetimeLocalToIso(e.target.value));
                                }
                              }}
                              className={`w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-blue-200 font-mono focus:outline-none focus:border-blue-500 ${!canManageTasks ? 'opacity-70 cursor-not-allowed bg-slate-900' : 'cursor-pointer'}`}
                            />
                          </div>
                        )}
                      </div>

                      {/* Stage 3: Por Archivar */}
                      <div className={`p-3 rounded-xl border space-y-2 transition-all ${taskIsDocumented ? 'bg-amber-950/30 border-amber-500/40' : 'bg-slate-900/50 border-white/5 opacity-70'}`}>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-amber-300">
                            <input
                              type="checkbox"
                              checked={taskIsDocumented}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (!checked && !canManageTasks) {
                                  onAddNotificationToast(
                                    'Acceso Restringido',
                                    'Solo los Jefes de División, Coordinadores o Gerencia pueden desmarcar la etapa de Por Archivar.',
                                    'info'
                                  );
                                  return;
                                }
                                setTaskIsDocumented(checked);
                                if (checked && !taskDocumentedAt) {
                                  setTaskDocumentedAt(new Date().toISOString());
                                } else if (!checked) {
                                  setTaskDocumentedAt(undefined);
                                }
                              }}
                              className="rounded border-white/20 text-amber-500 focus:ring-amber-500 cursor-pointer"
                            />
                            <Archive className="w-3.5 h-3.5" />
                            <span>Por Archivar</span>
                          </label>
                          {taskIsDocumented && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">Completado</span>}
                        </div>

                        {taskIsDocumented && (
                          <div>
                            <label className="text-[10px] text-slate-400 font-medium block mb-1">Fecha y Hora de Por Archivar:</label>
                            <input
                              type="datetime-local"
                              disabled={!canManageTasks}
                              value={formatForDatetimeLocal(taskDocumentedAt)}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setTaskDocumentedAt(parseDatetimeLocalToIso(e.target.value));
                                }
                              }}
                              className={`w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:outline-none focus:border-amber-500 ${!canManageTasks ? 'opacity-70 cursor-not-allowed bg-slate-900' : 'cursor-pointer'}`}
                            />
                          </div>
                        )}
                      </div>

                      {/* Estatus Especial: Descartar Material */}
                      <div className={`p-3 rounded-xl border space-y-2 transition-all ${taskIsDiscarded ? 'bg-red-950/40 border-red-500/50' : 'bg-slate-900/50 border-white/5 opacity-70'}`}>
                        <div className="flex items-center justify-between">
                          <label className={`flex items-center gap-2 font-bold text-xs text-red-300 ${canManageTasks ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                            <input
                              type="checkbox"
                              disabled={!canManageTasks}
                              checked={taskIsDiscarded}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (!canManageTasks) {
                                  onAddNotificationToast(
                                    'Acceso Restringido',
                                    'Solo los Jefes de División, Coordinadores o Gerencia pueden descartar o restaurar el material.',
                                    'info'
                                  );
                                  return;
                                }
                                setTaskIsDiscarded(checked);
                                if (checked && !taskDiscardedAt) {
                                  setTaskDiscardedAt(new Date().toISOString());
                                } else if (!checked) {
                                  setTaskDiscardedAt(undefined);
                                }
                              }}
                              className="rounded border-white/20 text-red-500 focus:ring-red-500 cursor-pointer"
                            />
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Descartar Material</span>
                          </label>
                          {taskIsDiscarded && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded">Descartado</span>}
                        </div>

                        {taskIsDiscarded && (
                          <div>
                            <label className="text-[10px] text-slate-400 font-medium block mb-1">Fecha y Hora de Descarte:</label>
                            <input
                              type="datetime-local"
                              disabled={!canManageTasks}
                              value={formatForDatetimeLocal(taskDiscardedAt)}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setTaskDiscardedAt(parseDatetimeLocalToIso(e.target.value));
                                }
                              }}
                              className={`w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-red-200 font-mono focus:outline-none focus:border-red-500 ${!canManageTasks ? 'opacity-70 cursor-not-allowed bg-slate-900' : 'cursor-pointer'}`}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                              * El material se moverá a la pestaña &quot;Material Descartado&quot;. Seguirá contando con sus horas ingestadas pero no en archivados.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Stage 4: Finalizado */}
                      <div className={`p-3 rounded-xl border space-y-2 transition-all ${taskIsFinalized ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-slate-900/50 border-white/5 opacity-70'}`}>
                        <div className="flex items-center justify-between">
                          <label className={`flex items-center gap-2 font-bold text-xs text-emerald-300 ${canManageTasks ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                            <input
                              type="checkbox"
                              disabled={!canManageTasks}
                              checked={taskIsFinalized}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setTaskIsFinalized(checked);
                                if (checked && !taskFinalizedAt) {
                                  setTaskFinalizedAt(new Date().toISOString());
                                } else if (!checked) {
                                  setTaskFinalizedAt(undefined);
                                }
                              }}
                              className="rounded border-white/20 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                            />
                            <Crown className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Finalizado</span>
                          </label>
                          {taskIsFinalized && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">Autorizado</span>}
                        </div>

                        {taskIsFinalized && (
                          <div>
                            <label className="text-[10px] text-slate-400 font-medium block mb-1">Fecha y Hora de Finalización:</label>
                            <input
                              type="datetime-local"
                              disabled={!canManageTasks}
                              value={formatForDatetimeLocal(taskFinalizedAt)}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setTaskFinalizedAt(parseDatetimeLocalToIso(e.target.value));
                                }
                              }}
                              className={`w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-emerald-200 font-mono focus:outline-none focus:border-emerald-500 ${!canManageTasks ? 'opacity-70 cursor-not-allowed bg-slate-900' : 'cursor-pointer'}`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAREAS VINCULADAS (LINKED TASKS - TAREA RAÍZ) */}
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-950 border border-white/10">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs font-bold text-cyan-300 uppercase flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Vinculación de Tareas (Esta será la Tarea Raíz)</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      * Las tareas seleccionadas quedarán vinculadas como sub-tareas debajo de esta.
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="relative w-full">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Buscar tarea para vincular por título o descripción..."
                        value={linkSearchQuery}
                        onChange={(e) => setLinkSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <select
                      value=""
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        if (selectedId && !taskLinkedTaskIds.includes(selectedId)) {
                          setTaskLinkedTaskIds([...taskLinkedTaskIds, selectedId]);
                          setLinkSearchQuery('');
                        }
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="">-- Seleccionar tarea para vincular debajo de esta --</option>
                      {cards
                        .filter(c => c.id !== editingCard?.id && !taskLinkedTaskIds.includes(c.id))
                        .filter(c => !linkSearchQuery || c.title.toLowerCase().includes(linkSearchQuery.toLowerCase()) || (c.description && c.description.toLowerCase().includes(linkSearchQuery.toLowerCase())))
                        .slice()
                        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.boardId === 'board_ingesta' ? 'Ingesta' : c.boardId === 'board_prensa' ? 'Prensa' : c.boardId === 'board_programacion' ? 'Programación' : 'Otras'})
                          </option>
                        ))}
                    </select>
                  </div>

                  {taskLinkedTaskIds.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {taskLinkedTaskIds.map(linkedId => {
                        const lCard = cards.find(c => c.id === linkedId);
                        return (
                          <span key={linkedId} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-2">
                            <Link2 className="w-3 h-3 text-cyan-400" />
                            <span>Sub-tarea: {lCard?.title || linkedId}</span>
                            <button
                              type="button"
                              onClick={() => setTaskLinkedTaskIds(taskLinkedTaskIds.filter(id => id !== linkedId))}
                              className="text-slate-400 hover:text-rose-400 font-bold ml-1 cursor-pointer"
                              title="Desvincular sub-tarea"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No hay sub-tareas vinculadas a esta tarea raíz.</p>
                  )}
                </div>

                {/* Personal Asignado */}
                <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-950 border border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Personal Asignado ({taskAssignedWorkerIds.length})</span>
                    </label>
                    {currentWorkerId && (
                      <button
                        type="button"
                        onClick={() => {
                          if (taskAssignedWorkerIds.includes(currentWorkerId)) {
                            setTaskAssignedWorkerIds(taskAssignedWorkerIds.filter(id => id !== currentWorkerId));
                          } else {
                            setTaskAssignedWorkerIds([...taskAssignedWorkerIds, currentWorkerId]);
                          }
                        }}
                        className="text-[10px] font-bold text-cyan-400 hover:underline cursor-pointer"
                      >
                        {taskAssignedWorkerIds.includes(currentWorkerId) ? '- Quitarme a mí' : '+ Asignarme a mí'}
                      </button>
                    )}
                  </div>

                  {/* Buscador de Colaboradores en Tareas */}
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Buscar colaborador por nombre, cargo o división..."
                      value={workerSearchTerm}
                      onChange={(e) => setWorkerSearchTerm(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-8 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    {workerSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setWorkerSearchTerm('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {filteredWorkersForAssignment.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2 text-center">
                        {workerSearchTerm ? 'No se encontraron colaboradores con esa búsqueda.' : 'No hay colaboradores registrados en el sistema.'}
                      </p>
                    ) : (
                      filteredWorkersForAssignment.map(w => {
                        const isAssigned = taskAssignedWorkerIds.includes(w.id);
                        const divName = divisions.find(d => d.id === w.divisionId)?.name || 'Sin división';
                        const hl = getWorkerHighlightInfo(w);

                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              if (isAssigned) {
                                const isSelf = currentWorkerId === w.id || currentSession?.userId === w.id;
                                const canUnassignOthers = canManageTasks || isDivisionHeadUser || isGerenciaUser;
                                if (!isSelf && !canUnassignOthers) {
                                  onAddNotificationToast(
                                    'Acción Restringida',
                                    'Solo puedes desasignarte a ti mismo de una tarea. Para desasignar a otros colaboradores se requiere ser Coordinador, Jefe de División o Gerencia.',
                                    'info'
                                  );
                                  return;
                                }
                                setTaskAssignedWorkerIds(taskAssignedWorkerIds.filter(id => id !== w.id));
                              } else {
                                setTaskAssignedWorkerIds([...taskAssignedWorkerIds, w.id]);
                              }
                            }}
                            className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer border ${
                              isAssigned
                                ? (hl.type !== 'regular' ? hl.assignedClass : 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40 font-bold')
                                : hl.listClass
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`w-2 h-2 rounded-full ${isAssigned ? (hl.type === 'gerente' ? 'bg-slate-950' : 'bg-slate-900') : hl.dotClass}`} />
                              <span className="font-bold">{w.name}</span>
                              <span className={`text-[10px] ${isAssigned && (hl.type === 'gerente' || hl.type === 'jefe_coordinador') ? 'text-slate-950 font-semibold' : 'text-slate-400'}`}>
                                ({w.cargo} - {divName})
                              </span>
                              {hl.label && (
                                <span className={hl.badgeClass}>
                                  {hl.label}
                                </span>
                              )}
                            </div>
                            {isAssigned && <Check className={`w-3.5 h-3.5 ${hl.type === 'gerente' || hl.type === 'jefe_coordinador' ? 'text-slate-950 font-black' : 'text-cyan-400'}`} />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Descripción / Pauta Detail</label>
                  <textarea
                    rows={3}
                    placeholder="Detalles sobre el contenido, fuente, evento o pauta audiovisual..."
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  {editingCard && (canManageTasks || isDivisionHeadUser || isGerenciaUser || editingCard.createdByWorkerId === currentWorkerId || (editingCard.assignedWorkerIds || []).includes(currentWorkerId || '')) ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Estás seguro de eliminar la tarea "${taskTitle}" de forma permanente?`)) {
                          onDeleteCard(editingCard.id);
                          setShowTaskModal(false);
                          onAddNotificationToast('Tarea Eliminada', 'Se eliminó la tarea permanentemente.', 'info');
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold hover:bg-rose-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Eliminar Tarea</span>
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTaskModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                    >
                      Guardar Tarea
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NOTIFICATION CENTER MODAL */}
      <AnimatePresence>
        {showNotificationCenter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Centro de Notificaciones</span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          {unreadCount} sin leer
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Notificaciones de tareas asignadas para <strong className="text-slate-200">{currentWorker?.name || currentSession?.name || 'tu usuario'}</strong>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowNotificationCenter(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action Toolbar & Tabs */}
              <div className="p-4 border-b border-white/10 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setNotificationTab('todas')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      notificationTab === 'todas'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Todas</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                      {userNotifications.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setNotificationTab('unread')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      notificationTab === 'unread'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Sin leer</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-mono font-black">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setNotificationTab('read')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      notificationTab === 'read'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Leídas</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                      {readCount}
                    </span>
                  </button>
                </div>

                {/* Bulk Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onMarkAllNotificationsRead) {
                          onMarkAllNotificationsRead(currentWorkerId);
                        } else {
                          userNotifications.forEach(n => onMarkNotificationRead(n.id));
                        }
                        onAddNotificationToast('Notificaciones Leídas', 'Se marcaron todas las notificaciones como leídas.', 'info');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Marcar todas como leídas"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Marcar leídas</span>
                    </button>
                  )}

                  {userNotifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('¿Estás seguro de borrar TODAS tus notificaciones de tareas? Esta acción no se puede deshacer.')) {
                          if (onClearAllNotifications) {
                            onClearAllNotifications(currentWorkerId);
                          } else {
                            userNotifications.forEach(n => {
                              if (onDeleteNotification) onDeleteNotification(n.id);
                            });
                          }
                          onAddNotificationToast('Notificaciones Borradas', 'Se han eliminado todas las notificaciones.', 'info');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Borrar todas las notificaciones"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Borrar todas</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Notification List */}
              <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto scrollbar-thin">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
                      <BellOff className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-300">
                      {notificationTab === 'unread' ? 'No tienes notificaciones sin leer' : notificationTab === 'read' ? 'No tienes notificaciones leídas' : 'No hay notificaciones registradas'}
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Cuando se te asigne una nueva tarea de producción o solicitud, recibirás un aviso automático aquí.
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((n, idx) => {
                    const taskObj = cards.find(c => c.id === n.taskId);
                    return (
                      <div
                        key={n.id ? `${n.id}_${idx}` : `notif_item_${idx}`}
                        className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          !n.read
                            ? 'bg-slate-900 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                            : 'bg-slate-950/60 border-white/5 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" title="Sin leer" />
                            )}
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                              {n.boardName || 'Tablero'}
                            </span>
                            {n.taskTitle && (
                              <span className="text-xs font-bold text-white truncate max-w-[280px]" title={n.taskTitle}>
                                {n.taskTitle}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-mono ml-auto sm:ml-0">
                              {n.createdAt ? new Date(n.createdAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">
                            {n.message}
                          </p>
                        </div>

                        {/* Actions per notification */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                          {taskObj && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!n.read) {
                                  onMarkNotificationRead(n.id);
                                }
                                setShowNotificationCenter(false);
                                handleOpenEditTask(taskObj);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Ver Tarea Asignada"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver Tarea</span>
                            </button>
                          )}

                          {!n.read && (
                            <button
                              type="button"
                              onClick={() => {
                                onMarkNotificationRead(n.id);
                                onAddNotificationToast('Notificación Leída', 'Marcada como leída.', 'info');
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors cursor-pointer"
                              title="Marcar como leída"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (onDeleteNotification) {
                                onDeleteNotification(n.id);
                              } else {
                                onMarkNotificationRead(n.id);
                              }
                              onAddNotificationToast('Notificación Eliminada', 'Se borró la notificación.', 'info');
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Eliminar esta notificación"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
                <span>Total: {userNotifications.length} notificaciones ({unreadCount} sin leer)</span>
                <button
                  type="button"
                  onClick={() => setShowNotificationCenter(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DETALLE TAREAS COMPLETADAS POR USUARIO (SUPERUSUARIO - SOLO PERIODO SOLICITADO) */}
      <AnimatePresence>
        {selectedWorkerDetailId && (() => {
          const w = workers.find(work => work.id === selectedWorkerDetailId);
          if (!w) return null;

          const isCoord = w.role === 'coordinator' || w.role === 'deputy' || w.role === 'superadmin' || w.cargo.toLowerCase().includes('coordinador') || w.cargo.toLowerCase().includes('jefe') || w.cargo.toLowerCase().includes('gerente');
          const divObj = divisions.find(d => d.id === w.divisionId);

          const matchesPeriod = (dateStr?: string) => {
            if (!dateStr) return false;
            const trimmed = dateStr.trim();
            if (!trimmed) return false;
            const ymdLocal = normalizeToYMD(trimmed);

            if (reportType === 'diario') return ymdLocal === reportDate;
            if (reportType === 'mensual') return ymdLocal.slice(0, 7) === reportMonth;
            if (reportType === 'anual') return ymdLocal.slice(0, 4) === reportYear;
            return true;
          };

          const periodLabel = reportType === 'diario'
            ? `Día ${reportDate}`
            : reportType === 'mensual'
            ? `Mes ${reportMonth}`
            : `Año ${reportYear}`;

          // Filtrar estrictamente por tareas procesadas por el usuario EN EL PERÍODO SOLICITADO
          const userPeriodCompletedCards = cards.filter(c => {
            if (c.isGerenciaOnly && !isGerenciaUser) return false;
            if (!isCardAssociatedWithWorker(c, w.id, w.name)) return false;
            if (c.isDiscarded) return false;

            const divName = (divObj ? divObj.name : '').toLowerCase();

            let isCompleted = false;
            let targetDate = c.createdAt;

            if (c.boardId === 'board_ingesta' || divName.includes('ingesta')) {
              isCompleted = Boolean(c.isIngested);
              targetDate = c.ingestedAt || c.createdAt;
            } else if (c.boardId === 'board_prensa' || c.boardId === 'board_programacion' || divName.includes('prensa') || divName.includes('programaci')) {
              isCompleted = Boolean(c.isDocumented || c.isFinalized || c.status === 'Finalizado');
              targetDate = c.documentedAt || c.finalizedAt || c.createdAt;
            } else {
              isCompleted = Boolean(c.isFinalized || c.status === 'Finalizado');
              targetDate = c.finalizedAt || c.documentedAt || c.ingestedAt || c.createdAt;
            }

            if (!isCompleted) return false;
            return matchesPeriod(targetDate);
          });

          const userPeriodCompletedGroups = buildCardTaskGroups(userPeriodCompletedCards, cards);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8 space-y-0"
              >
                <div className="p-5 border-b border-purple-500/30 bg-slate-950 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        {isCoord ? <Crown className="w-4 h-4 text-purple-400" /> : <Users className="w-4 h-4 text-amber-400" />}
                        <span>{w.name}</span>
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        {isCoord ? 'Coordinador' : 'Técnico'}
                      </span>
                      {divObj && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          {divObj.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {w.cargo} • Período: <strong className="text-purple-300 font-mono">{periodLabel}</strong> • Tareas del Período: <strong className="text-emerald-400 font-mono">{userPeriodCompletedGroups.length} familias</strong> ({userPeriodCompletedCards.length} ítems)
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedWorkerDetailId(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                  {userPeriodCompletedGroups.length > 0 ? (
                    userPeriodCompletedGroups.map((group) => {
                      const c = group.primaryCard;
                      const board = productionBoards.find(b => b.id === c.boardId);
                      return (
                        <div key={`detail_g_${group.groupId}`} className="p-3 rounded-xl bg-slate-950 border border-white/10 hover:border-purple-500/40 transition-all flex items-center justify-between gap-3 text-xs">
                          <div className="space-y-1 max-w-[70%]">
                            <div className="font-bold text-white flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="truncate">{c.title}</span>
                              {group.isLinkedGroup && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  Familia ({group.linkedCards.length + 1} tareas)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono flex-wrap">
                              <span className="text-cyan-300">{board?.name || 'VTV'}</span>
                              <span>•</span>
                              <span>Duración sumada: {group.totalDurationHHMMSS}</span>
                              {c.finalizedAt && (
                                <>
                                  <span>•</span>
                                  <span>Fin: {normalizeToYMD(c.finalizedAt)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedWorkerDetailId(null);
                              handleOpenEditTask(c);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold border border-white/10 transition-all shrink-0 cursor-pointer"
                          >
                            Ver Tarea
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-950/60 rounded-xl border border-white/5">
                      Este usuario no registra tareas completadas en el período seleccionado ({periodLabel}).
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-white/10 bg-slate-950 text-right">
                  <button
                    onClick={() => setSelectedWorkerDetailId(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* NEW BOARD MODAL */}
      <AnimatePresence>
        {showBoardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl my-8 p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white">Crear Nueva Lista / Tablero</h3>
                </div>
                <button
                  onClick={() => setShowBoardModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateBoardSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">Nombre de la Lista *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Archivo de Transmisiones Especiales"
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">Descripción (Opcional)</label>
                  <textarea
                    rows={2}
                    placeholder="Propósito o tipo de material a gestionar en esta lista..."
                    value={newBoardDesc}
                    onChange={(e) => setNewBoardDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">Color Distintivo</label>
                  <select
                    value={newBoardColor}
                    onChange={(e) => setNewBoardColor(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="cyan">Cian / Celeste</option>
                    <option value="blue">Azul</option>
                    <option value="indigo">Índigo</option>
                    <option value="purple">Púrpura</option>
                    <option value="amber">Ámbar</option>
                    <option value="emerald">Esmeralda / Verde</option>
                    <option value="rose">Rosa / Rojo</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowBoardModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                  >
                    Guardar Lista
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default React.memo(TaskManager);
