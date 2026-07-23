import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Kanban, Plus, Search, Filter, Calendar, CheckSquare, Users,
  Clock, AlertCircle, CheckCircle2, ChevronRight, X, Edit3, Trash2,
  Bell, Check, Tag, Sparkles, FolderPlus, ShieldAlert, ArrowRight,
  UserCheck, AlertTriangle, Layers, FileText, Printer, Copy, Database,
  Code2, Download, ExternalLink, BarChart3, Eye, Lock, Crown, Scissors,
  FileCheck, Archive, Award
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

  // Active Main Navigation Tab ('produccion' | 'solicitudes' | 'finalizadas' | 'reportes')
  const [activeMainTab, setActiveMainTab] = useState<'produccion' | 'solicitudes' | 'finalizadas' | 'reportes'>('produccion');

  // Selected Board Filter within Producción ('todos' | 'board_ingesta' | 'board_prensa' | 'board_programacion')
  const [selectedBoardId, setSelectedBoardId] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
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

  // Report Generator Filters State
  const [reportType, setReportType] = useState<'diario' | 'mensual' | 'anual'>('diario');
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [reportYear, setReportYear] = useState<string>(() => new Date().getFullYear().toString());
  const [reportBoardFilter, setReportBoardFilter] = useState<string>('todos');
  const [reportDivisionFilter, setReportDivisionFilter] = useState<string>('todos');
  const [reportWorkerFilter, setReportWorkerFilter] = useState<string>('todos');
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Resolved list of production boards
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
    return merged.filter(b => b.id !== 'board_otras_solicitudes' && !b.name.toLowerCase().includes('otras solicitudes'));
  }, [boards]);

  // Unread notifications for current user
  const userNotifications = useMemo(() => {
    if (!currentWorkerId) return [];
    return notifications.filter(n => n.workerId === currentWorkerId);
  }, [notifications, currentWorkerId]);

  const unreadCount = useMemo(() => {
    return userNotifications.filter(n => !n.read).length;
  }, [userNotifications]);

  // Sorted cards by date descending (newest on top)
  const sortedCardsDescending = useMemo(() => {
    return [...cards].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.startDate || '1970-01-01').getTime();
      const timeB = new Date(b.createdAt || b.startDate || '1970-01-01').getTime();
      return timeB - timeA;
    });
  }, [cards]);

  // Filtered cards for active Production Tab (Ingesta, Prensa, Programación)
  const productionCards = useMemo(() => {
    const userDivisionId = currentSession?.divisionId || currentWorker?.divisionId;

    return sortedCardsDescending.filter(card => {
      // 1. Hide finalized tasks (they belong to Tareas Finalizadas tab)
      if (card.isFinalized) return false;

      // 2. Hide "Otras Solicitudes"
      if (card.isOtherRequest || card.boardId === 'board_otras_solicitudes') return false;

      // 3. Privacy: Gerencia Exclusive tasks only visible to Gerencia
      if (card.isGerenciaOnly && !isGerenciaUser) return false;

      // 4. Division isolation for regular workers
      if (!isDivisionHeadUser) {
        const isCardDivMatch = card.divisionId ? card.divisionId === userDivisionId : false;
        const isAssigned = currentWorkerId ? card.assignedWorkerIds.includes(currentWorkerId) : false;
        if (!isCardDivMatch && !isAssigned) return false;
      }

      // 5. Board filter
      if (selectedBoardId !== 'todos' && card.boardId !== selectedBoardId) return false;

      // 6. Only my tasks filter
      if (onlyMyTasks && currentWorkerId && !card.assignedWorkerIds.includes(currentWorkerId)) return false;

      // 7. Search query
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

      return true;
    });
  }, [sortedCardsDescending, selectedBoardId, onlyMyTasks, searchQuery, currentWorkerId, isGerenciaUser, isDivisionHeadUser, currentSession, currentWorker, workers]);

  // Filtered cards for "Otras Solicitudes" Tab
  const otherRequestsCards = useMemo(() => {
    const userDivisionId = currentSession?.divisionId || currentWorker?.divisionId;

    return sortedCardsDescending.filter(card => {
      // 1. Hide finalized tasks
      if (card.isFinalized) return false;

      // 2. Must be "Otras Solicitudes"
      if (!card.isOtherRequest && card.boardId !== 'board_otras_solicitudes') return false;

      // 3. Privacy: Gerencia Exclusive tasks remain hidden except for Gerente & Adjunta
      if (card.isGerenciaOnly && !isGerenciaUser) return false;

      // 4. Division isolation for regular workers
      if (!isDivisionHeadUser) {
        const isCardDivMatch = card.divisionId ? card.divisionId === userDivisionId : false;
        const isAssigned = currentWorkerId ? card.assignedWorkerIds.includes(currentWorkerId) : false;
        if (!isCardDivMatch && !isAssigned) return false;
      }

      // 5. Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesTitle = card.title.toLowerCase().includes(q);
        const matchesDesc = card.description.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      return true;
    });
  }, [sortedCardsDescending, searchQuery, isGerenciaUser, isDivisionHeadUser, currentSession, currentWorker]);

  // Filtered cards for "Tareas Finalizadas" Tab (Hidden section / Apartado)
  const finalizedCards = useMemo(() => {
    return sortedCardsDescending.filter(card => {
      // Must be finalized
      if (!card.isFinalized) return false;

      // Privacy check
      if (card.isGerenciaOnly && !isGerenciaUser) return false;

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return card.title.toLowerCase().includes(q) || card.description.toLowerCase().includes(q);
      }

      return true;
    });
  }, [sortedCardsDescending, searchQuery, isGerenciaUser]);

  // Metrics for Report Generator based on dates, stage timestamps & duration math
  const reportMetrics = useMemo(() => {
    const userDivisionId = currentSession?.divisionId || currentWorker?.divisionId;

    // Filter relevant cards by Division/Worker/Board filters
    const baseCards = cards.filter(card => {
      if (card.isGerenciaOnly && !isGerenciaUser) return false;

      if (!isDivisionHeadUser) {
        const isDivMatch = card.divisionId ? card.divisionId === userDivisionId : false;
        const isAssigned = currentWorkerId ? card.assignedWorkerIds.includes(currentWorkerId) : false;
        if (!isDivMatch && !isAssigned) return false;
      }

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
      if (reportType === 'diario') return dateStr.startsWith(reportDate);
      if (reportType === 'mensual') return dateStr.startsWith(reportMonth);
      if (reportType === 'anual') return dateStr.startsWith(reportYear);
      return true;
    };

    // 1. Ingestados en el período
    const ingestadosEnPeriodo = baseCards.filter(c => c.isIngested && matchesPeriod(c.ingestedAt || c.startDate || c.createdAt));
    
    // Horas de Ingesta: solo se suman si la tarea está archivada/documentada o finalizada y NO es otra solicitud
    const ingestadosArchivados = baseCards.filter(c => c.isIngested && (c.isDocumented || c.isFinalized) && !c.isOtherRequest && matchesPeriod(c.ingestedAt || c.startDate || c.createdAt));
    const totalIngestaSeconds = ingestadosArchivados.reduce((sum, c) => sum + parseDurationToSeconds(c.duration), 0);

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

    // 3. Documentados en el período
    const documentadosEnPeriodo = baseCards.filter(c => c.isDocumented && matchesPeriod(c.documentedAt || c.createdAt));

    // 4. Finalizados en el período
    const finalizadosEnPeriodo = baseCards.filter(c => c.isFinalized && matchesPeriod(c.finalizedAt || c.createdAt));

    // 5. Otras Solicitudes (Logros de la división)
    const logrosOtrasSolicitudes = baseCards.filter(c => c.isOtherRequest && c.isFinalized && matchesPeriod(c.finalizedAt || c.createdAt));

    return {
      totalBaseCards: baseCards.length,
      ingestadosCount: ingestadosEnPeriodo.length,
      totalIngestaHHMMSS: formatSecondsToHHMMSS(totalIngestaSeconds),
      editadosCount: editadosEnPeriodo.length,
      tiempoAhorradoHHMMSS: formatSecondsToHHMMSS(tiempoAhorradoSeconds),
      documentadosCount: documentadosEnPeriodo.length,
      finalizadosCount: finalizadosEnPeriodo.length,
      logrosOtrasSolicitudesCount: logrosOtrasSolicitudes.length,
      ingestadosEnPeriodo,
      editadosEnPeriodo,
      documentadosEnPeriodo,
      finalizadosEnPeriodo
    };
  }, [cards, reportType, reportDate, reportMonth, reportYear, reportBoardFilter, reportDivisionFilter, reportWorkerFilter, isGerenciaUser, isDivisionHeadUser, currentSession, currentWorker, workers]);

  // Stage Toggle Handler for Cards directly from view or modal
  const handleToggleStage = (card: TaskCard, stage: 'ingested' | 'edited' | 'documented' | 'finalized', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const nowIso = new Date().toISOString();
    const updatedCard: TaskCard = { ...card };

    if (stage === 'finalized') {
      if (!canManageTasks) {
        onAddNotificationToast(
          'Acceso Restringido',
          'Solo los Jefes de División o Coordinadores pueden autorizar y finalizar la tarea.',
          'info'
        );
        return;
      }
      const nextVal = !card.isFinalized;
      updatedCard.isFinalized = nextVal;
      if (nextVal) {
        updatedCard.finalizedAt = nowIso;
        updatedCard.status = 'Finalizado';
      }
    } else if (stage === 'ingested') {
      const nextVal = !card.isIngested;
      updatedCard.isIngested = nextVal;
      if (nextVal && !card.ingestedAt) {
        updatedCard.ingestedAt = nowIso;
        updatedCard.status = 'Ingested' as any;
      }
    } else if (stage === 'edited') {
      const nextVal = !card.isEdited;
      updatedCard.isEdited = nextVal;
      if (nextVal && !card.editedAt) {
        updatedCard.editedAt = nowIso;
        updatedCard.status = 'Editado' as any;
      }
    } else if (stage === 'documented') {
      const nextVal = !card.isDocumented;
      updatedCard.isDocumented = nextVal;
      if (nextVal && !card.documentedAt) {
        updatedCard.documentedAt = nowIso;
        updatedCard.status = 'Archivando' as any;
      }
    }

    onSaveCard(updatedCard);
    onAddNotificationToast(
      'Etapa Actualizada',
      `Se actualizó el estado de la etapa en "${card.title}".`,
      'success'
    );
  };

  // Open Create Task Modal
  const handleOpenCreateTask = (defaultBoardId?: string, isOtherReq: boolean = false) => {
    setEditingCard(null);
    setTaskBoardId(defaultBoardId || (isOtherReq ? 'board_otras_solicitudes' : 'board_ingesta'));
    setTaskDivisionId(currentSession?.divisionId || currentWorker?.divisionId || '');
    setTaskIsOtherRequest(isOtherReq || defaultBoardId === 'board_otras_solicitudes');
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
    setShowTaskModal(true);
  };

  // Open Edit Task Modal
  const handleOpenEditTask = (card: TaskCard) => {
    setEditingCard(card);
    setTaskBoardId(card.boardId);
    setTaskDivisionId(card.divisionId || '');
    setTaskIsOtherRequest(card.isOtherRequest || card.boardId === 'board_otras_solicitudes');
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

    setTaskIsIngested(Boolean(card.isIngested));
    setTaskIngestedAt(card.ingestedAt);
    setTaskIsEdited(Boolean(card.isEdited));
    setTaskEditedAt(card.editedAt);
    setTaskIsDocumented(Boolean(card.isDocumented));
    setTaskDocumentedAt(card.documentedAt);
    setTaskIsFinalized(Boolean(card.isFinalized));
    setTaskFinalizedAt(card.finalizedAt);

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

    const cardData: TaskCard = {
      id: cardId,
      boardId: taskBoardId,
      divisionId: taskDivisionId || undefined,
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      status: taskIsFinalized ? 'Finalizado' : taskIsDocumented ? 'Archivando' : taskIsEdited ? 'Editado' : taskIsIngested ? 'Ingestado' : 'Pendiente',
      priority: taskPriority,
      isOtherRequest: taskIsOtherRequest || taskBoardId === 'board_otras_solicitudes',
      isGerenciaOnly: taskIsGerenciaOnly,
      duration: taskDuration.trim() || '00:00:00',
      editedDuration: taskEditedDuration.trim() || '00:00:00',
      isIngested: taskIsIngested,
      ingestedAt: taskIsIngested ? (taskIngestedAt || nowIso) : undefined,
      isEdited: taskIsEdited,
      editedAt: taskIsEdited ? (taskEditedAt || nowIso) : undefined,
      isDocumented: taskIsDocumented,
      documentedAt: taskIsDocumented ? (taskDocumentedAt || nowIso) : undefined,
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

  // Print Report Handler
  const handlePrintReport = () => {
    window.print();
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
    reportText += `• Total Horas Ingesta (Archivadas): ${reportMetrics.totalIngestaHHMMSS}\n`;
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

        const stages = [];
        if (c.isIngested) stages.push('Ingestado');
        if (c.isEdited) stages.push('Editado');
        if (c.isDocumented) stages.push('Archivado');
        if (c.isFinalized) stages.push('Finalizado');

        reportText += `${idx + 1}. ${c.title}\n`;
        reportText += `   - Área/Lista: ${bObj?.name || 'VTV'}\n`;
        reportText += `   - Etapas: ${stages.length > 0 ? stages.join(', ') : 'Pendiente'}\n`;
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
            {cards.filter(c => !c.isFinalized && !c.isOtherRequest && c.boardId !== 'board_otras_solicitudes').length}
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
            {cards.filter(c => !c.isFinalized && (c.isOtherRequest || c.boardId === 'board_otras_solicitudes')).length}
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
          <span>Tareas Finalizadas (Oculto)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/10 text-emerald-300 font-mono font-bold">
            {cards.filter(c => c.isFinalized).length}
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
                <span>Todas las Listas (3)</span>
              </button>

              {productionBoards.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBoardId(b.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                    selectedBoardId === b.id
                      ? 'bg-cyan-500/20 text-white border-cyan-500/40'
                      : 'bg-slate-800/50 text-slate-300 border-white/5 hover:border-white/20'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>{b.name}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 text-slate-400 font-mono">
                    {productionCards.filter(c => c.boardId === b.id).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Search & My Tasks */}
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar en producción..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
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

                        {/* 3. Archivado/Documentado */}
                        <button
                          onClick={(e) => handleToggleStage(card, 'documented', e)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                            card.isDocumented
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                              : 'bg-slate-950/60 text-slate-400 border-white/5 hover:border-white/20'
                          }`}
                        >
                          <Archive className={`w-3 h-3 ${card.isDocumented ? 'text-amber-400' : 'opacity-30'}`} />
                          <span>Archivado</span>
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
                      </div>
                    </div>

                    {/* Footer: Assignee & Reassign Board */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                      <button
                        onClick={(e) => handleToggleSelfAssignment(card, e)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                          isSelfAssigned
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 border border-white/10'
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
          <div className="glass-card p-4 rounded-xl border border-white/10 bg-slate-900/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Otras Solicitudes e Iniciativas
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Solicitudes especiales sin contador de tiempo. Una vez finalizadas por el Jefe, suman como Logros de la División.
              </p>
            </div>

            <button
              onClick={() => handleOpenCreateTask('board_otras_solicitudes', true)}
              className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Solicitud</span>
            </button>
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

                return (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-4 rounded-2xl border border-white/10 bg-slate-900/90 hover:border-amber-500/40 transition-all space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      {card.isGerenciaOnly && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
                          Exclusiva Gerencia
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        Otras Solicitudes
                      </span>
                    </div>

                    <div className="cursor-pointer" onClick={() => handleOpenEditTask(card)}>
                      <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                        {card.title}
                      </h4>
                      {card.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {card.description}
                        </p>
                      )}
                    </div>

                    {/* Stage Buttons */}
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
          <div className="glass-card p-4 rounded-xl border border-white/10 bg-slate-900/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Apartado Histórico de Tareas y Solicitudes Finalizadas
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Muestra todas las tareas y solicitudes aprobadas y concluidas por la coordinación y gerencia.
              </p>
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
                      <th className="p-3">Etapas Cumplidas</th>
                      <th className="p-3">Duración Orig.</th>
                      <th className="p-3">Duración Edit.</th>
                      <th className="p-3">Tiempo Ahorrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {reportMetrics.ingestadosEnPeriodo.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                          No hay registros para la fecha o filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      reportMetrics.ingestadosEnPeriodo.map(c => {
                        const bObj = productionBoards.find(b => b.id === c.boardId);
                        const orig = parseDurationToSeconds(c.duration);
                        const edit = parseDurationToSeconds(c.editedDuration);
                        const diff = Math.max(0, orig - edit);

                        return (
                          <tr key={c.id} className="hover:bg-slate-900/40">
                            <td className="p-3 font-bold text-white">{c.title}</td>
                            <td className="p-3 text-cyan-300">{bObj?.name || 'VTV'}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                {c.isIngested && <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300">Ingestado</span>}
                                {c.isEdited && <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-300">Editado</span>}
                                {c.isDocumented && <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300">Archivado</span>}
                                {c.isFinalized && <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300">Finalizado</span>}
                              </div>
                            </td>
                            <td className="p-3 font-mono text-cyan-300">{c.duration || '00:00:00'}</td>
                            <td className="p-3 font-mono text-blue-300">{c.editedDuration || '00:00:00'}</td>
                            <td className="p-3 font-mono text-emerald-300 font-bold">{formatSecondsToHHMMSS(diff)}</td>
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

                {/* Classification: General vs Otras Solicitudes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Lista / Área *</label>
                    <select
                      value={taskBoardId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTaskBoardId(val);
                        if (val === 'board_otras_solicitudes') {
                          setTaskIsOtherRequest(true);
                        } else {
                          setTaskIsOtherRequest(false);
                        }
                      }}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      {productionBoards.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                      <option value="board_otras_solicitudes">Otras Solicitudes</option>
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

                {/* Exclusiva de Gerencia Toggle */}
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

                {/* WORKFLOW STAGE BOOLEANS IN MODAL */}
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-950 border border-white/10">
                  <div className="text-xs font-bold text-slate-300 uppercase">Etapas del Flujo de Trabajo:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${taskIsIngested ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-900 text-slate-400 border-white/5'}`}>
                      <input type="checkbox" checked={taskIsIngested} onChange={(e) => setTaskIsIngested(e.target.checked)} className="hidden" />
                      <Check className="w-3.5 h-3.5" />
                      <span>Ingestado</span>
                    </label>

                    <label className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${taskIsEdited ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-slate-900 text-slate-400 border-white/5'}`}>
                      <input type="checkbox" checked={taskIsEdited} onChange={(e) => setTaskIsEdited(e.target.checked)} className="hidden" />
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Editado</span>
                    </label>

                    <label className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${taskIsDocumented ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900 text-slate-400 border-white/5'}`}>
                      <input type="checkbox" checked={taskIsDocumented} onChange={(e) => setTaskIsDocumented(e.target.checked)} className="hidden" />
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archivado</span>
                    </label>

                    <label
                      onClick={() => {
                        if (!canManageTasks) {
                          onAddNotificationToast('Acceso Restringido', 'Solo Jefes o Coordinadores pueden finalizar.', 'info');
                        }
                      }}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${canManageTasks ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'} ${taskIsFinalized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-900 text-slate-400 border-white/5'}`}
                    >
                      <input
                        type="checkbox"
                        disabled={!canManageTasks}
                        checked={taskIsFinalized}
                        onChange={(e) => setTaskIsFinalized(e.target.checked)}
                        className="hidden"
                      />
                      <Crown className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Finalizado</span>
                    </label>
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
    </div>
  );
}
