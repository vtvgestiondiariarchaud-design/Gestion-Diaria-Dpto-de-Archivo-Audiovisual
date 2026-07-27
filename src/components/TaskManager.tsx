import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Kanban, Plus, Search, Filter, Calendar, CheckSquare, Users,
  Clock, AlertCircle, CheckCircle2, ChevronRight, X, Edit3, Trash2,
  Bell, Check, Tag, Sparkles, FolderPlus, ShieldAlert, ArrowRight,
  UserCheck, AlertTriangle, Layers, FileText, Printer, Copy, Database,
  Code2, Download, ExternalLink, BarChart3, Eye, Lock, Crown, Scissors,
  FileCheck, Archive, Award, CheckCheck, BellOff
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
}

// Helpers para cálculo y formateo de duración de material audiovisual
const parseDurationToSeconds = (durStr?: string): number => {
  if (!durStr) return 0;
  const clean = durStr.trim();
  const parts = clean.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  } else if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
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

// Helper to format ISO or Date string for <input type="datetime-local" />
const formatForDatetimeLocal = (isoStr?: string) => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
};

export default function TaskManager({
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
  onAddNotificationToast
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
  const [taskStartDate, setTaskStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [taskDueDate, setTaskDueDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  });
  const [taskAssignedWorkerIds, setTaskAssignedWorkerIds] = useState<string[]>([]);
  const [taskChecklist, setTaskChecklist] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [newChecklistItemText, setNewChecklistItemText] = useState('');
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');

  // Form Stage Booleans
  const [taskIsIngested, setTaskIsIngested] = useState(false);
  const [taskIngestedAt, setTaskIngestedAt] = useState<string | undefined>(undefined);
  const [taskIsEdited, setTaskIsEdited] = useState(false);
  const [taskEditedAt, setTaskEditedAt] = useState<string | undefined>(undefined);
  const [taskIsDocumented, setTaskIsDocumented] = useState(false);
  const [taskDocumentedAt, setTaskDocumentedAt] = useState<string | undefined>(undefined);
  const [taskIsFinalized, setTaskIsFinalized] = useState(false);
  const [taskFinalizedAt, setTaskFinalizedAt] = useState<string | undefined>(undefined);
  const [taskIsDepartmentAchievement, setTaskIsDepartmentAchievement] = useState<boolean>(false);
  const [taskIsDiscarded, setTaskIsDiscarded] = useState<boolean>(false);
  const [taskDiscardedAt, setTaskDiscardedAt] = useState<string | undefined>(undefined);

  // Report Generator Filters State
  const [reportType, setReportType] = useState<'diario' | 'mensual' | 'anual'>('diario');
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [reportYear, setReportYear] = useState<string>(() => new Date().getFullYear().toString());
  const [reportBoardFilter, setReportBoardFilter] = useState<string>('todos');
  const [reportDivisionFilter, setReportDivisionFilter] = useState<string>('todos');
  const [reportWorkerFilter, setReportWorkerFilter] = useState<string>('todos');
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Quick checklist input state for individual cards in "Otras Solicitudes"
  const [cardQuickCheckInput, setCardQuickCheckInput] = useState<{ [cardId: string]: string }>({});

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

  // Sorted cards by date descending (newest on top)
  const sortedCardsDescending = useMemo(() => {
    return [...cards].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.startDate || '1970-01-01').getTime();
      const timeB = new Date(b.createdAt || b.startDate || '1970-01-01').getTime();
      return timeB - timeA;
    });
  }, [cards]);

  // Helper to match card dates against dateFilter (YYYY-MM-DD)
  const cardMatchesDateFilter = (card: TaskCard, filterDate: string) => {
    if (!filterDate) return true;
    const dates = [
      card.createdAt,
      card.startDate,
      card.dueDate,
      card.ingestedAt,
      card.editedAt,
      card.documentedAt,
      card.finalizedAt
    ].filter(Boolean) as string[];

    return dates.some(d => {
      if (d.startsWith(filterDate)) return true;
      try {
        const dt = new Date(d);
        if (!isNaN(dt.getTime())) {
          const pad = (n: number) => n < 10 ? '0' + n : n;
          const ymd = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
          return ymd === filterDate;
        }
      } catch {}
      return false;
    });
  };

  // Filtered cards for active Production Tab (Ingesta, Prensa, Programación)
  const productionCards = useMemo(() => {
    return sortedCardsDescending.filter(card => {
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
      if (onlyMyTasks && currentWorkerId && !card.assignedWorkerIds.includes(currentWorkerId)) return false;

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

      return true;
    });
  }, [sortedCardsDescending, selectedBoardId, onlyMyTasks, searchQuery, dateFilter, currentWorkerId, isGerenciaUser, workers]);

  // Filtered cards for "Otras Solicitudes" Tab (Includes Administración and general requests)
  const otherRequestsCards = useMemo(() => {
    return sortedCardsDescending.filter(card => {
      // 0. Hide discarded tasks
      if (card.isDiscarded) return false;

      // 1. Hide finalized tasks
      if (card.isFinalized) return false;

      // 2. Must be "Otras Solicitudes" OR "Administración"
      if (!card.isOtherRequest && card.boardId !== 'board_otras_solicitudes' && card.boardId !== 'board_administracion') return false;

      // 3. Privacy: Gerencia Exclusive tasks remain hidden except for Gerente & Adjunta
      if (card.isGerenciaOnly && !isGerenciaUser) return false;

      // 4. Only my tasks filter
      if (onlyMyTasks && currentWorkerId && !card.assignedWorkerIds.includes(currentWorkerId)) return false;

      // 5. Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesTitle = card.title.toLowerCase().includes(q);
        const matchesDesc = card.description.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // 6. Date filter
      if (dateFilter && !cardMatchesDateFilter(card, dateFilter)) return false;

      return true;
    });
  }, [sortedCardsDescending, onlyMyTasks, searchQuery, dateFilter, currentWorkerId, isGerenciaUser]);

  // Filtered cards for "Tareas Finalizadas" Tab (Hidden section / Apartado)
  const finalizedCards = useMemo(() => {
    return sortedCardsDescending.filter(card => {
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

      return true;
    });
  }, [sortedCardsDescending, searchQuery, dateFilter, isGerenciaUser]);

  // Filtered cards for "Material Descartado" Tab
  const discardedCards = useMemo(() => {
    return sortedCardsDescending.filter(card => {
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

      return true;
    });
  }, [sortedCardsDescending, searchQuery, dateFilter, isGerenciaUser]);

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
        const isAssigned = card.assignedWorkerIds.includes(reportWorkerFilter);
        const isCreator = card.createdByWorkerId === reportWorkerFilter;
        if (!isAssigned && !isCreator) return false;
      }

      return true;
    });

    const matchesPeriod = (dateStr?: string) => {
      if (!dateStr) return false;
      let ymd = dateStr.slice(0, 10);
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const pad = (n: number) => n < 10 ? '0' + n : n;
          ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
      } catch {}

      if (reportType === 'diario') return ymd === reportDate;
      if (reportType === 'mensual') return ymd.slice(0, 7) === reportMonth;
      if (reportType === 'anual') return ymd.slice(0, 4) === reportYear;
      return true;
    };

    // 1. Ingestados en el período
    const ingestadosEnPeriodo = baseCards.filter(c => c.isIngested && matchesPeriod(c.ingestedAt || c.startDate || c.createdAt));
    
    // Horas de Ingesta: se suman inmediatamente tan pronto como se marca la tarea como ingestado (si no es otra solicitud)
    const ingestadosValidos = baseCards.filter(c => c.isIngested && !c.isOtherRequest && matchesPeriod(c.ingestedAt || c.startDate || c.createdAt));
    const totalIngestaSeconds = ingestadosValidos.reduce((sum, c) => sum + parseDurationToSeconds(c.duration), 0);

    // 2. Editados en el período
    const editadosEnPeriodo = baseCards.filter(c => c.isEdited && matchesPeriod(c.editedAt || c.createdAt));
    // Tiempo Ahorrado por Filtro de Ingesta: resta de (tiempo material original - tiempo material editado)
    const tiempoAhorradoSeconds = editadosEnPeriodo.reduce((sum, c) => {
      if (c.isOtherRequest) return sum;
      const origSec = parseDurationToSeconds(c.duration);
      const editSec = parseDurationToSeconds(c.editedDuration);
      const diff = Math.max(0, origSec - editSec);
      return sum + diff;
    }, 0);

    // 3. Documentados ("Por Archivar") en el período (excluye material descartado)
    const documentadosEnPeriodo = baseCards.filter(c => c.isDocumented && !c.isDiscarded && matchesPeriod(c.documentedAt || c.createdAt));

    // Materiales Descartados en el período
    const descartadosEnPeriodo = baseCards.filter(c => c.isDiscarded && matchesPeriod(c.discardedAt || c.createdAt));

    // 4. Finalizados en el período
    const finalizadosEnPeriodo = baseCards.filter(c => c.isFinalized && matchesPeriod(c.finalizedAt || c.createdAt));

    // 5. Logros de solicitudes (no administrativas ni gerenciales)
    const departmentAchievements = baseCards.filter(c => {
      // Excluir tareas administrativas y gerenciales
      if (c.boardId === 'board_administracion') return false;
      if (c.isGerenciaOnly) return false;

      // Debe pertenecer al período seleccionado
      if (!matchesPeriod(c.finalizedAt || c.createdAt || c.startDate)) return false;

      // Debe contar como logro (booleano explícito o solicitud especial finalizada)
      return Boolean(c.isDepartmentAchievement || (c.isOtherRequest && c.isFinalized));
    });

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

      // Buscar tareas ingestadas en esta fecha
      const dayTasks = baseCards.filter(c => {
        if (!c.isIngested || c.isOtherRequest) return false;
        const ingDate = c.ingestedAt || c.startDate || c.createdAt;
        if (!ingDate) return false;
        return ingDate.startsWith(dateStr);
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

    return {
      totalBaseCards: baseCards.length,
      ingestadosCount: ingestadosEnPeriodo.length,
      totalIngestaHHMMSS: formatSecondsToHHMMSS(totalIngestaSeconds),
      editadosCount: editadosEnPeriodo.length,
      tiempoAhorradoHHMMSS: formatSecondsToHHMMSS(tiempoAhorradoSeconds),
      documentadosCount: documentadosEnPeriodo.length,
      descartadosCount: descartadosEnPeriodo.length,
      finalizadosCount: finalizadosEnPeriodo.length,
      logrosOtrasSolicitudesCount: departmentAchievements.length,
      ingestadosEnPeriodo,
      editadosEnPeriodo,
      documentadosEnPeriodo,
      descartadosEnPeriodo,
      finalizadosEnPeriodo,
      departmentAchievements,
      monthlyCalendarDays,
      savingsByFilter,
      deliveredCount: finalizadosEnPeriodo.length,
      deliveredTotalEditedHHMMSS: formatSecondsToHHMMSS(deliveredTotalEditedSeconds)
    };
  }, [cards, reportType, reportDate, reportMonth, reportYear, reportBoardFilter, reportDivisionFilter, reportWorkerFilter, isGerenciaUser, isDivisionHeadUser, currentSession, currentWorker, workers, productionBoards]);

  // Stage Toggle Handler for Cards directly from view or modal
  const handleToggleStage = (card: TaskCard, stage: 'ingested' | 'edited' | 'documented' | 'finalized' | 'discarded', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const nowIso = new Date().toISOString();
    const updatedCard: TaskCard = { ...card };

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
      if (nextVal) {
        updatedCard.status = 'Archivando' as any;
      }
    } else if (stage === 'discarded') {
      const nextVal = !card.isDiscarded;
      if (!nextVal && !canManageTasks) {
        onAddNotificationToast(
          'Acceso Restringido',
          'Solo los Jefes de División, Coordinadores o Gerencia pueden restaurar o desmarcar el material descartado.',
          'info'
        );
        return;
      }
      updatedCard.isDiscarded = nextVal;
      updatedCard.discardedAt = nextVal ? (card.discardedAt || nowIso) : undefined;
    }

    onSaveCard(updatedCard);
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

  // Open Create Task Modal
  const handleOpenCreateTask = (defaultBoardId?: string, isOtherReq: boolean = false) => {
    setEditingCard(null);
    const initialIsOtherReq = isOtherReq || defaultBoardId === 'board_otras_solicitudes' || defaultBoardId === 'board_administracion';
    setTaskBoardId(defaultBoardId || (initialIsOtherReq ? 'board_otras_solicitudes' : 'board_ingesta'));
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
    setTaskIsDepartmentAchievement(false);
    setTaskIsDiscarded(false);
    setTaskDiscardedAt(undefined);

    const today = new Date().toISOString().split('T')[0];
    setTaskStartDate(today);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setTaskDueDate(nextWeek.toISOString().split('T')[0]);
    
    if (currentWorkerId) {
      setTaskAssignedWorkerIds([currentWorkerId]);
    } else {
      setTaskAssignedWorkerIds([]);
    }

    setTaskChecklist([]);
    setNewChecklistItemText('');
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
    setTaskStartDate(card.startDate || new Date().toISOString().split('T')[0]);
    setTaskDueDate(card.dueDate || new Date().toISOString().split('T')[0]);
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
    setTaskIsDepartmentAchievement(Boolean(card.isDepartmentAchievement));
    setTaskIsDiscarded(Boolean(card.isDiscarded));
    setTaskDiscardedAt(card.discardedAt);

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
      isEdited: isOther ? false : taskIsEdited,
      editedAt: isOther ? undefined : (taskIsEdited ? (taskEditedAt || nowIso) : undefined),
      isDocumented: isOther ? false : taskIsDocumented,
      documentedAt: isOther ? undefined : (taskIsDocumented ? (taskDocumentedAt || nowIso) : undefined),
      isDiscarded: taskIsDiscarded,
      discardedAt: taskIsDiscarded ? (taskDiscardedAt || nowIso) : undefined,
      isFinalized: taskIsFinalized,
      finalizedAt: taskIsFinalized ? (taskFinalizedAt || nowIso) : undefined,
      startDate: taskStartDate,
      dueDate: taskDueDate,
      assignedWorkerIds: taskAssignedWorkerIds,
      checklist: taskChecklist,
      createdAt: editingCard ? editingCard.createdAt : nowIso,
      createdByWorkerId: editingCard ? editingCard.createdByWorkerId : currentSession?.userId,
      createdByName: editingCard ? editingCard.createdByName : currentSession?.name
    };

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

    onSaveCard(cardData);
    setShowTaskModal(false);
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
    onAddNotificationToast(
      'Reasignado a Archivo',
      `La tarea "${card.title}" fue asignada a "${bObj?.name || targetBoardId}".`,
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
      // Day of week index where 0=Monday, 6=Sunday
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
    reportText += `• Materiales Ingestados: ${reportMetrics.ingestadosCount} items\n`;
    reportText += `• Materiales Archivados: ${reportMetrics.documentadosCount} items\n`;
    reportText += `• Tareas Finalizadas: ${reportMetrics.finalizadosCount} items\n`;
    reportText += `• Logros Otras Solicitudes: ${reportMetrics.logrosOtrasSolicitudesCount} completados\n\n`;

    reportText += `--- DETALLE DE MATERIALES Y TAREAS (${reportMetrics.ingestadosEnPeriodo.length}) ---\n`;
    if (reportMetrics.ingestadosEnPeriodo.length === 0) {
      reportText += `(Sin registros para la fecha o filtros seleccionados)\n`;
    } else {
      reportMetrics.ingestadosEnPeriodo.forEach((c, idx) => {
        const bObj = productionBoards.find(b => b.id === c.boardId);
        const orig = parseDurationToSeconds(c.duration);
        const edit = parseDurationToSeconds(c.editedDuration);
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
        if (c.isDocumented) stageTimes.push(`Archivado (${fmtDate(c.documentedAt)})`);
        if (c.isFinalized) stageTimes.push(`Finalizado (${fmtDate(c.finalizedAt)})`);

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
      });
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
            {cards.filter(c => !c.isDiscarded && !c.isFinalized && !c.isOtherRequest && c.boardId !== 'board_otras_solicitudes' && c.boardId !== 'board_administracion').length}
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
            {cards.filter(c => !c.isDiscarded && !c.isFinalized && (c.isOtherRequest || c.boardId === 'board_otras_solicitudes' || c.boardId === 'board_administracion')).length}
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
            {cards.filter(c => !c.isDiscarded && c.isFinalized).length}
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
            {cards.filter(c => c.isDiscarded).length}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-card p-3.5 rounded-xl border border-white/10 bg-slate-900/60">
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
                      {productionCards.filter(c => c.boardId === b.id).length}
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

            {/* Search, Date Filter & My Tasks */}
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
              <div className="relative flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-cyan-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  title="Filtrar tareas por fecha"
                  className="bg-slate-950 border border-white/10 rounded-lg pl-8 pr-2 py-1.5 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500 cursor-pointer font-mono"
                />
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter('')}
                    className="px-1.5 py-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded border border-rose-500/30 cursor-pointer"
                    title="Limpiar filtro de fecha"
                  >
                    ✕
                  </button>
                )}
              </div>

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
              productionCards.map(card => {
                const bObj = productionBoards.find(b => b.id === card.boardId);
                const isSelfAssigned = currentWorkerId ? card.assignedWorkerIds.includes(currentWorkerId) : false;

                // Duration difference
                const origSec = parseDurationToSeconds(card.duration);
                const editSec = parseDurationToSeconds(card.editedDuration);
                const savedSec = Math.max(0, origSec - editSec);

                return (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-4 rounded-2xl border border-white/10 bg-slate-900/90 hover:border-cyan-500/40 transition-all space-y-3 relative group"
                  >
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {bObj?.name || 'Ingesta'}
                        </span>
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

                      {card.priority && (
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase font-mono ${
                          card.priority === 'urgente' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' :
                          card.priority === 'alta' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {card.priority}
                        </span>
                      )}
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
                          return (
                            <span key={wId} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 border border-cyan-500/20">
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
                  </motion.div>
                );
              })
            )}
          </div>
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

              <div className="relative flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  title="Filtrar por fecha"
                  className="bg-slate-950 border border-white/10 rounded-lg pl-8 pr-2 py-1.5 text-xs text-amber-200 focus:outline-none focus:border-amber-500 cursor-pointer font-mono"
                />
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter('')}
                    className="px-1.5 py-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded border border-rose-500/30 cursor-pointer"
                    title="Limpiar filtro de fecha"
                  >
                    ✕
                  </button>
                )}
              </div>

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
              otherRequestsCards.map(card => {
                const isSelfAssigned = currentWorkerId ? card.assignedWorkerIds.includes(currentWorkerId) : false;
                const totalItems = card.checklist?.length || 0;
                const completedItems = card.checklist?.filter(i => i.completed).length || 0;
                const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
                const isAdminBoard = card.boardId === 'board_administracion';

                return (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-4 rounded-2xl border border-white/10 bg-slate-900/90 hover:border-amber-500/40 transition-all space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-1.5">
                        {isAdminBoard ? (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Administración
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            Otras Solicitudes
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
                  </motion.div>
                );
              })
            )}
          </div>
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

              <div className="relative flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  title="Filtrar por fecha"
                  className="bg-slate-950 border border-white/10 rounded-lg pl-8 pr-2 py-1.5 text-xs text-emerald-200 focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
                />
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter('')}
                    className="px-1.5 py-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded border border-rose-500/30 cursor-pointer"
                    title="Limpiar filtro de fecha"
                  >
                    ✕
                  </button>
                )}
              </div>
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
              finalizedCards.map(card => {
                const bObj = productionBoards.find(b => b.id === card.boardId);

                return (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
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
                  </motion.div>
                );
              })
            )}
          </div>
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
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-red-500/10 text-red-300 border border-red-500/30">
                Total: {discardedCards.length} descartados
              </span>
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
              {discardedCards.map(card => {
                const bObj = productionBoards.find(b => b.id === card.boardId);
                return (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
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
                  </motion.div>
                );
              })}
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
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Fecha Específica:</label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  />
                </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* Horas de Ingesta */}
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-1">
                <span className="text-[10px] font-bold uppercase text-cyan-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Total Horas Ingesta (Archivadas)
                </span>
                <div className="text-2xl font-black text-white font-mono">{reportMetrics.totalIngestaHHMMSS}</div>
                <p className="text-[10px] text-slate-400">Sumado sólo si fue ingestado y archivado/finalizado.</p>
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
            </div>

            {/* MONTHLY CALENDAR GRID (When reportType === 'mensual') */}
            {reportType === 'mensual' && (
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/80 p-4 rounded-2xl border border-white/10">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      <span>Calendario Mensual de Ingesta</span>
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

                    {/* Section Logros de Solicitudes (no administrativas ni gerenciales) */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-400" />
                          Logros de Solicitudes ({reportMetrics.departmentAchievements.length})
                        </span>
                        <span className="text-[10px] text-slate-400">No admin / gerenciales</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Solicitudes especiales que cuentan como logro del departamento para la gerencia.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DAILY / MONTHLY BREAKDOWN TABLE */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-cyan-400" />
                Detalle de Materiales y Tareas Registradas
              </h3>

              <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 border-b border-white/10 text-slate-400 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-3">Título / Tarea</th>
                      <th className="p-3">Área / Tablero</th>
                      <th className="p-3">Personal Asignado</th>
                      <th className="p-3">Etapas y Tiempos</th>
                      <th className="p-3">Duración Orig.</th>
                      <th className="p-3">Duración Edit.</th>
                      <th className="p-3">Tiempo Ahorrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {reportMetrics.ingestadosEnPeriodo.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                          No hay registros para la fecha o filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      reportMetrics.ingestadosEnPeriodo.map(c => {
                        const bObj = productionBoards.find(b => b.id === c.boardId);
                        const orig = parseDurationToSeconds(c.duration);
                        const edit = parseDurationToSeconds(c.editedDuration);
                        const diff = Math.max(0, orig - edit);

                        const assignedNames = (c.assignedWorkerIds || [])
                          .map(wId => workers.find(w => w.id === wId)?.name)
                          .filter(Boolean);

                        const fmtTime = (isoStr?: string) => isoStr ? new Date(isoStr).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '';

                        return (
                          <tr key={c.id} className="hover:bg-slate-900/40">
                            <td className="p-3 font-bold text-white max-w-[200px] truncate" title={c.title}>{c.title}</td>
                            <td className="p-3 text-cyan-300 whitespace-nowrap">{bObj?.name || 'VTV'}</td>
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
                              <div className="flex flex-col gap-0.5 text-[10px] font-mono">
                                {c.isIngested && <span className="text-cyan-300">Ingestado: {fmtTime(c.ingestedAt)}</span>}
                                {c.isEdited && <span className="text-blue-300">Editado: {fmtTime(c.editedAt)}</span>}
                                {c.isDocumented && <span className="text-amber-300">Archivado: {fmtTime(c.documentedAt)}</span>}
                                {c.isFinalized && <span className="text-emerald-300">Finalizado: {fmtTime(c.finalizedAt)}</span>}
                              </div>
                            </td>
                            <td className="p-3 font-mono text-cyan-300 whitespace-nowrap">{c.duration || '00:00:00'}</td>
                            <td className="p-3 font-mono text-blue-300 whitespace-nowrap">{c.editedDuration || '00:00:00'}</td>
                            <td className="p-3 font-mono text-emerald-300 font-bold whitespace-nowrap">{formatSecondsToHHMMSS(diff)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
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

                {/* Duración Material Original & Editado (Omit si es Otras Solicitudes) */}
                {!taskIsOtherRequest && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-white/10">
                    <div>
                      <label className="text-xs font-bold text-cyan-300 block mb-1">Tiempo Material Original (HH:MM:SS)</label>
                      <input
                        type="text"
                        placeholder="01:30:00"
                        value={taskDuration}
                        onChange={(e) => setTaskDuration(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-blue-300 block mb-1">Tiempo Material Editado (HH:MM:SS)</label>
                      <input
                        type="text"
                        placeholder="01:00:00"
                        value={taskEditedDuration}
                        onChange={(e) => setTaskEditedDuration(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
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
                                  setTaskIngestedAt(new Date(e.target.value).toISOString());
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
                                  setTaskEditedAt(new Date(e.target.value).toISOString());
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
                                  setTaskDocumentedAt(new Date(e.target.value).toISOString());
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
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-red-300">
                            <input
                              type="checkbox"
                              checked={taskIsDiscarded}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (!checked && !canManageTasks) {
                                  onAddNotificationToast(
                                    'Acceso Restringido',
                                    'Solo los Jefes de División, Coordinadores o Gerencia pueden restaurar el material descartado.',
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
                                  setTaskDiscardedAt(new Date(e.target.value).toISOString());
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
                                  setTaskFinalizedAt(new Date(e.target.value).toISOString());
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

                {/* Personal Asignado */}
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-950 border border-white/10">
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

                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {workers.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No hay colaboradores registrados en el sistema.</p>
                    ) : (
                      workers.map(w => {
                        const isAssigned = taskAssignedWorkerIds.includes(w.id);
                        const divName = divisions.find(d => d.id === w.divisionId)?.name || 'Sin división';
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              if (isAssigned) {
                                setTaskAssignedWorkerIds(taskAssignedWorkerIds.filter(id => id !== w.id));
                              } else {
                                setTaskAssignedWorkerIds([...taskAssignedWorkerIds, w.id]);
                              }
                            }}
                            className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer border ${
                              isAssigned
                                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40 font-bold'
                                : 'bg-slate-900 text-slate-400 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${isAssigned ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                              <span>{w.name}</span>
                              <span className="text-[10px] text-slate-500">({w.cargo} - {divName})</span>
                            </div>
                            {isAssigned && <Check className="w-3.5 h-3.5 text-cyan-400" />}
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
                  {editingCard && canManageTasks ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Eliminar la tarea "${taskTitle}"?`)) {
                          onDeleteCard(editingCard.id);
                          setShowTaskModal(false);
                          onAddNotificationToast('Tarea Eliminada', 'Se eliminó el registro con éxito.', 'info');
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold hover:bg-rose-500/30 transition-all cursor-pointer"
                    >
                      Eliminar Tarea
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
                  filteredNotifications.map((n) => {
                    const taskObj = cards.find(c => c.id === n.taskId);
                    return (
                      <div
                        key={n.id}
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
    </div>
  );
}
