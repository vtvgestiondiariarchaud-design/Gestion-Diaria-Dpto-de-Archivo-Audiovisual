import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Kanban, Plus, Search, Filter, Calendar, CheckSquare, Users,
  Clock, AlertCircle, CheckCircle2, ChevronRight, X, Edit3, Trash2,
  Bell, Check, Tag, Sparkles, FolderPlus, ShieldAlert, ArrowRight,
  UserCheck, AlertTriangle, Layers, FileText, Printer, Copy, Database,
  Code2, Download, ExternalLink, BarChart3, Eye
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
  const secs = totalSeconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string; border: string; bg: string; badge: string; icon: any }[] = [
  {
    key: 'Pendiente',
    label: 'Pendiente',
    color: 'text-indigo-400',
    border: 'border-indigo-500/30',
    bg: 'bg-indigo-500/5',
    badge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    icon: Clock
  },
  {
    key: 'Ingestado',
    label: 'Ingestado',
    color: 'text-cyan-400',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/5',
    badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    icon: Sparkles
  },
  {
    key: 'Editado',
    label: 'Editado',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    badge: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    icon: Edit3
  },
  {
    key: 'Archivando',
    label: 'Archivando',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    icon: Clock
  },
  {
    key: 'Evaluacion Pendiente',
    label: 'Evaluación Pendiente',
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
    badge: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    icon: AlertCircle
  },
  {
    key: 'Finalizado',
    label: 'Finalizado',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    icon: CheckCircle2
  }
];

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

  // Permission check: Only jefe, adjunto, coordinador can delete boards, edit other people's tasks or assign others
  const canManageTasks = isGerenciaUser || isDivisionHeadUser;

  const currentWorkerId = currentSession?.userId;

  // Selected Board Filter ('todos' or board.id)
  const [selectedBoardId, setSelectedBoardId] = useState<string>('todos');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyMyTasks, setOnlyMyTasks] = useState<boolean>(false);

  // Modals state
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);
  const [showBoardModal, setShowBoardModal] = useState<boolean>(false);
  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<TaskCard | null>(null);

  // New Board Form State
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');
  const [newBoardColor, setNewBoardColor] = useState('cyan');

  // Task Modal Form State
  const [taskBoardId, setTaskBoardId] = useState<string>('');
  const [taskDivisionId, setTaskDivisionId] = useState<string>('');
  const [taskIsGerenciaOnly, setTaskIsGerenciaOnly] = useState<boolean>(false);
  const [taskDuration, setTaskDuration] = useState<string>('00:00:00');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('Pendiente');
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

  // Report Generator State
  const [reportType, setReportType] = useState<'diario' | 'mensual' | 'anual'>('diario');
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [reportYear, setReportYear] = useState<string>(() => new Date().getFullYear().toString());
  const [reportBoardFilter, setReportBoardFilter] = useState<string>('todos');
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('todos');
  const [reportDivisionFilter, setReportDivisionFilter] = useState<string>('todos');
  const [reportWorkerFilter, setReportWorkerFilter] = useState<string>('todos');
  const [reportCategoryFilter, setReportCategoryFilter] = useState<'todos' | 'logros' | 'activas'>('todos');

  // Unread notifications for current user
  const userNotifications = useMemo(() => {
    if (!currentWorkerId) return [];
    return notifications.filter(n => n.workerId === currentWorkerId);
  }, [notifications, currentWorkerId]);

  const unreadCount = useMemo(() => {
    return userNotifications.filter(n => !n.read).length;
  }, [userNotifications]);

  // Filtered Cards for main Kanban/List View
  const filteredCards = useMemo(() => {
    const userDivisionId = currentSession?.divisionId || currentWorker?.divisionId;

    return cards.filter(card => {
      // 1. Gerencia Exclusive Privacy: If task is Gerencia Exclusive, ONLY Gerencia (Gerente / Adjunta) can see it!
      if (card.isGerenciaOnly && !isGerenciaUser) {
        return false;
      }

      // 2. Division Task Isolation: Regular workers can ONLY see tasks belonging to their division or assigned to them
      if (!isDivisionHeadUser) {
        const isCardDivisionMatch = card.divisionId ? card.divisionId === userDivisionId : false;
        const isAssignedToUser = currentWorkerId ? card.assignedWorkerIds.includes(currentWorkerId) : false;
        const boardObj = boards.find(b => b.id === card.boardId);
        const isBoardDivisionMatch = boardObj?.divisionId ? boardObj.divisionId === userDivisionId : false;

        if (!isCardDivisionMatch && !isAssignedToUser && !isBoardDivisionMatch) {
          return false; // Hide cards from other divisions for regular employees
        }
      }

      // 3. Board filter
      if (selectedBoardId !== 'todos' && card.boardId !== selectedBoardId) return false;

      // 4. Status filter
      if (selectedStatusFilter !== 'todos' && card.status !== selectedStatusFilter) return false;

      // 5. Only my tasks filter
      if (onlyMyTasks && currentWorkerId && !card.assignedWorkerIds.includes(currentWorkerId)) return false;

      // 6. Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesTitle = card.title.toLowerCase().includes(query);
        const matchesDesc = card.description.toLowerCase().includes(query);
        const matchesAssignee = card.assignedWorkerIds.some(id => {
          const w = workers.find(work => work.id === id);
          return w && w.name.toLowerCase().includes(query);
        });
        if (!matchesTitle && !matchesDesc && !matchesAssignee) return false;
      }

      return true;
    });
  }, [cards, selectedBoardId, selectedStatusFilter, onlyMyTasks, currentWorkerId, searchQuery, workers, isGerenciaUser, isDivisionHeadUser, currentSession, currentWorker, boards]);

  // Report Filtered Cards with Division Achievements logic
  const reportTasks = useMemo(() => {
    const userDivisionId = currentSession?.divisionId || currentWorker?.divisionId;

    return cards.filter(card => {
      // 1. Gerencia Exclusive Privacy
      if (card.isGerenciaOnly && !isGerenciaUser) {
        return false;
      }

      // 2. Division Isolation for regular workers
      if (!isDivisionHeadUser) {
        const isCardDivisionMatch = card.divisionId ? card.divisionId === userDivisionId : false;
        const isAssignedToUser = currentWorkerId ? card.assignedWorkerIds.includes(currentWorkerId) : false;
        const boardObj = boards.find(b => b.id === card.boardId);
        const isBoardDivisionMatch = boardObj?.divisionId ? boardObj.divisionId === userDivisionId : false;

        if (!isCardDivisionMatch && !isAssignedToUser && !isBoardDivisionMatch) {
          return false;
        }
      }

      // 3. Board Filter
      if (reportBoardFilter !== 'todos' && card.boardId !== reportBoardFilter) return false;
      // 4. Status Filter
      if (reportStatusFilter !== 'todos' && card.status !== reportStatusFilter) return false;

      // 5. Division Filter
      if (reportDivisionFilter !== 'todos') {
        const matchesCardDivision = card.divisionId === reportDivisionFilter;
        const matchesWorkerDivision = card.assignedWorkerIds.some(id => {
          const w = workers.find(work => work.id === id);
          return w && w.divisionId === reportDivisionFilter;
        });
        const b = boards.find(board => board.id === card.boardId);
        const matchesBoardDivision = b && b.divisionId === reportDivisionFilter;
        if (!matchesCardDivision && !matchesWorkerDivision && !matchesBoardDivision) return false;
      }

      // 6. Worker/Person Filter
      if (reportWorkerFilter !== 'todos') {
        const isAssigned = card.assignedWorkerIds.includes(reportWorkerFilter);
        const isCreator = card.createdByWorkerId === reportWorkerFilter;
        if (!isAssigned && !isCreator) return false;
      }

      // 7. Category Filter
      if (reportCategoryFilter === 'logros') {
        const isLogro = card.status === 'Ingestado' || card.status === 'Editado' || card.status === 'Finalizado';
        if (!isLogro) return false;
      } else if (reportCategoryFilter === 'activas') {
        const isActive = card.status === 'Pendiente' || card.status === 'Archivando' || card.status === 'Evaluacion Pendiente';
        if (!isActive) return false;
      }

      // 8. Date comparison
      const taskDate = card.startDate || card.createdAt.split('T')[0];
      if (reportType === 'diario') {
        return taskDate === reportDate;
      } else if (reportType === 'mensual') {
        return taskDate.startsWith(reportMonth);
      } else if (reportType === 'anual') {
        return taskDate.startsWith(reportYear);
      }
      return true;
    });
  }, [cards, reportType, reportDate, reportMonth, reportYear, reportBoardFilter, reportStatusFilter, reportDivisionFilter, reportWorkerFilter, reportCategoryFilter, workers, boards, isGerenciaUser, isDivisionHeadUser, currentSession, currentWorker, currentWorkerId]);

  // Report Metrics & Cumulative Workflow Breakdown
  const reportMetrics = useMemo(() => {
    const total = reportTasks.length;
    const finalizadas = reportTasks.filter(t => t.status === 'Finalizado').length;
    
    // Tareas Activas (Pendiente, Archivando, Evaluación Pendiente)
    const tareasActivas = reportTasks.filter(t => t.status === 'Pendiente' || t.status === 'Archivando' || t.status === 'Evaluacion Pendiente').length;

    // 1. Material Ingestado: Todo material que alcanzó Ingestado o estados posteriores (Ingestado, Editado, Archivando, Evaluacion Pendiente, Finalizado)
    const ingestadosList = reportTasks.filter(t => ['Ingestado', 'Editado', 'Archivando', 'Evaluacion Pendiente', 'Finalizado'].includes(t.status));
    const cantidadIngestado = ingestadosList.length;
    const tiempoTotalIngestadoSec = ingestadosList.reduce((sum, t) => sum + parseDurationToSeconds(t.duration), 0);

    // 2. Material Editado: Todo material que alcanzó Editado o estados posteriores (Editado, Archivando, Evaluacion Pendiente, Finalizado)
    // Sigue siendo tiempo procesado en Ingesta, y además se suma a horas editadas
    const editadosList = reportTasks.filter(t => ['Editado', 'Archivando', 'Evaluacion Pendiente', 'Finalizado'].includes(t.status));
    const cantidadEditado = editadosList.length;
    const tiempoTotalEditadoSec = editadosList.reduce((sum, t) => sum + parseDurationToSeconds(t.duration), 0);

    // 3. Material Archivado (Finalizado): Una vez que llega al ciclo de Archivo y queda FINALIZADO
    const archivadosFinalizadosList = reportTasks.filter(t => t.status === 'Finalizado');
    const cantidadArchivado = archivadosFinalizadosList.length;
    const tiempoTotalArchivadoSec = archivadosFinalizadosList.reduce((sum, t) => sum + parseDurationToSeconds(t.duration), 0);

    // Desglose de Archivo por Prensa vs Programación
    let cantidadArchivadoPrensa = 0;
    let tiempoArchivadoPrensaSec = 0;
    let cantidadArchivadoProgramacion = 0;
    let tiempoArchivadoProgramacionSec = 0;
    let cantidadArchivadoGeneral = 0;
    let tiempoArchivadoGeneralSec = 0;

    archivadosFinalizadosList.forEach(t => {
      const durSec = parseDurationToSeconds(t.duration);
      const bObj = boards.find(b => b.id === t.boardId);
      const dObj = divisions.find(d => d.id === t.divisionId);
      const workerDivs = t.assignedWorkerIds.map(wId => {
        const w = workers.find(work => work.id === wId);
        return w?.divisionId ? divisions.find(d => d.id === w.divisionId)?.name || '' : '';
      }).join(' ');

      const combinedStr = `${bObj?.name || ''} ${dObj?.name || ''} ${workerDivs}`.toLowerCase();

      if (combinedStr.includes('prensa')) {
        cantidadArchivadoPrensa++;
        tiempoArchivadoPrensaSec += durSec;
      } else if (combinedStr.includes('programaci') || combinedStr.includes('programacion')) {
        cantidadArchivadoProgramacion++;
        tiempoArchivadoProgramacionSec += durSec;
      } else {
        cantidadArchivadoGeneral++;
        tiempoArchivadoGeneralSec += durSec;
      }
    });

    // Tiempo Total General Procesado (Material único que pasó por Ingesta / Edición / Archivo)
    const materialProcesadoList = reportTasks.filter(t => t.status !== 'Pendiente');
    const tiempoTotalGeneralSec = materialProcesadoList.reduce((sum, t) => sum + parseDurationToSeconds(t.duration), 0);

    const collaboratorSet = new Set<string>();
    reportTasks.forEach(t => t.assignedWorkerIds.forEach(id => collaboratorSet.add(id)));

    return {
      total,
      finalizadas,
      tareasActivas,
      cantidadIngestado,
      cantidadEditado,
      cantidadArchivado,
      tiempoTotalIngestado: formatSecondsToHHMMSS(tiempoTotalIngestadoSec),
      tiempoTotalEditado: formatSecondsToHHMMSS(tiempoTotalEditadoSec),
      tiempoTotalArchivado: formatSecondsToHHMMSS(tiempoTotalArchivadoSec),
      cantidadArchivadoPrensa,
      tiempoArchivadoPrensa: formatSecondsToHHMMSS(tiempoArchivadoPrensaSec),
      cantidadArchivadoProgramacion,
      tiempoArchivadoProgramacion: formatSecondsToHHMMSS(tiempoArchivadoProgramacionSec),
      cantidadArchivadoGeneral,
      tiempoArchivadoGeneral: formatSecondsToHHMMSS(tiempoArchivadoGeneralSec),
      tiempoTotalGeneral: formatSecondsToHHMMSS(tiempoTotalGeneralSec),
      totalCollaborators: collaboratorSet.size
    };
  }, [reportTasks, boards, divisions, workers]);

  const handlePrintReport = () => {
    window.print();
  };

  const handleCopyFormattedReportText = () => {
    const divisionName = reportDivisionFilter === 'todos'
      ? 'Todas las Divisiones'
      : (divisions.find(d => d.id === reportDivisionFilter)?.name || reportDivisionFilter);

    const workerName = reportWorkerFilter === 'todos'
      ? 'Todos los Colaboradores'
      : (workers.find(w => w.id === reportWorkerFilter)?.name || reportWorkerFilter);

    const boardName = reportBoardFilter === 'todos'
      ? 'Todos los Tableros'
      : (boards.find(b => b.id === reportBoardFilter)?.name || reportBoardFilter);

    let periodText = '';
    if (reportType === 'diario') periodText = `Fecha: ${reportDate}`;
    else if (reportType === 'mensual') periodText = `Mes: ${reportMonth}`;
    else periodText = `Año: ${reportYear}`;

    let text = `======================================================================\n`;
    text += `          REPORTE OPERATIVO DE TAREAS Y PROCESOS - CANAL VTV\n`;
    text += `======================================================================\n`;
    text += `Tipo de Reporte: ${reportType.toUpperCase()} | ${periodText}\n`;
    text += `Filtro Tablero/Área: ${boardName}\n`;
    text += `Filtro División: ${divisionName}\n`;
    text += `Filtro Colaborador: ${workerName}\n`;
    text += `Clasificación: ${reportCategoryFilter === 'logros' ? 'SOLO LOGROS POR DIVISIÓN' : reportCategoryFilter === 'activas' ? 'SOLO TAREAS ACTIVAS' : 'TODOS LOS REGISTROS'}\n`;
    text += `Filtro Estado: ${reportStatusFilter === 'todos' ? 'Todos los Estados' : reportStatusFilter}\n`;
    text += `Fecha de Emisión: ${new Date().toLocaleString('es-VE')}\n`;
    text += `----------------------------------------------------------------------\n`;
    text += `RESUMEN DE MÉTRICAS, MATERIALES Y TIEMPOS POR FLUJO ACUMULADO:\n`;
    text += ` - Total Tareas / Procesos Registrados: ${reportMetrics.total}\n`;
    text += ` - Material Ingestado: ${reportMetrics.cantidadIngestado} item(s) | Tiempo Total Ingestado: ${reportMetrics.tiempoTotalIngestado}\n`;
    text += `   (Material que fue ingestado y avanzó en el flujo)\n`;
    text += ` - Material Editado: ${reportMetrics.cantidadEditado} item(s) | Tiempo Total Editado: ${reportMetrics.tiempoTotalEditado}\n`;
    text += `   (Material procesado en edición tras ingesta)\n`;
    text += ` - Material Archivado (Finalizado): ${reportMetrics.cantidadArchivado} item(s) | Tiempo Total Archivado: ${reportMetrics.tiempoTotalArchivado}\n`;
    text += `   * Archivo Prensa: ${reportMetrics.cantidadArchivadoPrensa} item(s) (${reportMetrics.tiempoArchivadoPrensa})\n`;
    text += `   * Archivo Programación: ${reportMetrics.cantidadArchivadoProgramacion} item(s) (${reportMetrics.tiempoArchivadoProgramacion})\n`;
    text += `   * Archivo General/Otros: ${reportMetrics.cantidadArchivadoGeneral} item(s) (${reportMetrics.tiempoArchivadoGeneral})\n`;
    text += ` - Tiempo Total General Procesado: ${reportMetrics.tiempoTotalGeneral}\n`;
    text += ` - Tareas Activas en Proceso: ${reportMetrics.tareasActivas}\n`;
    text += ` - Colaboradores Involucrados: ${reportMetrics.totalCollaborators}\n`;
    text += `----------------------------------------------------------------------\n`;
    text += `DETALLE DE TAREAS, PROCESOS Y TRAZABILIDAD (${reportTasks.length}):\n\n`;

    if (reportTasks.length === 0) {
      text += `(No hay tareas o procesos registrados para los criterios seleccionados)\n`;
    } else {
      reportTasks.forEach((task, idx) => {
        const b = boards.find(board => board.id === task.boardId);
        const assignedNames = task.assignedWorkerIds
          .map(id => workers.find(w => w.id === id)?.name || id)
          .join(', ') || 'Sin asignar';

        const isLogro = task.status === 'Ingestado' || task.status === 'Editado' || task.status === 'Finalizado';
        const clasifTag = isLogro ? '[LOGRO DIVISIÓN]' : '[TAREA ACTIVA]';

        text += `${idx + 1}. ${clasifTag} [${task.status.toUpperCase()}] ${task.title}\n`;
        text += `   - ID Tarea: ${task.id.slice(-6).toUpperCase()}\n`;
        text += `   - Área/Tablero: ${b?.name || 'VTV'}\n`;
        text += `   - Fechas: Inicio ${task.startDate || 'S/D'} -> Entrega ${task.dueDate || 'S/D'}\n`;
        text += `   - Colaboradores Asignados: ${assignedNames}\n`;
        if (task.description) {
          text += `   - Descripción: ${task.description}\n`;
        }
        if (task.checklist && task.checklist.length > 0) {
          const doneCount = task.checklist.filter(c => c.completed).length;
          text += `   - Subtareas (${doneCount}/${task.checklist.length}):\n`;
          task.checklist.forEach(item => {
            text += `     [${item.completed ? 'X' : ' '}] ${item.text}\n`;
          });
        }
        if (task.history && task.history.length > 0) {
          text += `   - Historial de Trazabilidad de Estados:\n`;
          task.history.forEach(h => {
            const dateStr = new Date(h.timestamp).toLocaleString('es-VE');
            const fromStr = h.fromStatus ? `de "${h.fromStatus}" a ` : 'Estado inicial ';
            const userStr = h.changedByName ? ` por ${h.changedByName}` : '';
            text += `     * [${dateStr}] ${fromStr}"${h.toStatus}"${userStr}\n`;
          });
        }
        text += `\n`;
      });
    }
    text += `======================================================================\n`;

    navigator.clipboard.writeText(text);
    onAddNotificationToast(
      'Texto Diagramado Copiado',
      'El reporte con trazabilidad y logros por división se ha copiado al portapapeles.',
      'success'
    );
  };

  // Drag and Drop Handler for Cards with Audit Trail
  const handleCardDrop = (cardId: string, targetStatus: TaskStatus) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    if (card.status === targetStatus) return;

    // Permissions check: Jefes/Coordinadores OR Assigned Colaboradores
    const isAssigned = currentWorkerId ? card.assignedWorkerIds.includes(currentWorkerId) : false;

    if (!canManageTasks && !isAssigned) {
      onAddNotificationToast(
        'Acceso Restringido',
        'Solo los colaboradores asignados a esta tarea o los jefes de área pueden modificar su estado.',
        'info'
      );
      return;
    }

    const auditItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      fromStatus: card.status,
      toStatus: targetStatus,
      changedByWorkerId: currentSession?.userId,
      changedByName: currentSession?.name || 'Sistema',
      timestamp: new Date().toISOString()
    };

    const updatedCard: TaskCard = {
      ...card,
      status: targetStatus,
      history: [...(card.history || []), auditItem]
    };
    onSaveCard(updatedCard);
    onAddNotificationToast(
      'Estado Actualizado',
      `La tarea "${card.title}" fue movida a "${targetStatus}".`,
      'success'
    );
  };

  const handleQuickBoardChange = (card: TaskCard, targetBoardId: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const boardObj = boards.find(b => b.id === targetBoardId);
    const updatedCard: TaskCard = {
      ...card,
      boardId: targetBoardId
    };
    onSaveCard(updatedCard);
    onAddNotificationToast(
      'Tablero Actualizado',
      `La tarea "${card.title}" fue movida al tablero "${boardObj?.name || 'Nuevo Tablero'}".`,
      'info'
    );
  };

  // Open Create Task Modal
  const handleOpenCreateTask = (defaultStatus: TaskStatus = 'Pendiente') => {
    setEditingCard(null);
    setTaskBoardId(selectedBoardId !== 'todos' ? selectedBoardId : (boards[0]?.id || 'board_ingesta'));
    setTaskDivisionId(currentSession?.divisionId || currentWorker?.divisionId || '');
    setTaskIsGerenciaOnly(false);
    setTaskDuration('00:00:00');
    setTaskTitle('');
    setTaskDesc('');
    setTaskStatus(defaultStatus);
    setTaskPriority('media');
    
    const today = new Date().toISOString().split('T')[0];
    setTaskStartDate(today);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setTaskDueDate(nextWeek.toISOString().split('T')[0]);
    
    // Automatically pre-assign the current user
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
    setTaskIsGerenciaOnly(card.isGerenciaOnly || false);
    setTaskDuration(card.duration || '00:00:00');
    setTaskTitle(card.title);
    setTaskDesc(card.description);
    setTaskStatus(card.status);
    setTaskPriority(card.priority || 'media');
    setTaskStartDate(card.startDate || new Date().toISOString().split('T')[0]);
    setTaskDueDate(card.dueDate || new Date().toISOString().split('T')[0]);
    setTaskAssignedWorkerIds(card.assignedWorkerIds || []);
    setTaskChecklist(card.checklist || []);
    setShowTaskModal(true);

    // Auto mark notification as read when assigned worker reviews/opens the task assignment
    if (currentWorkerId && notifications && notifications.length > 0) {
      const pendingNotifs = notifications.filter(
        n => n.workerId === currentWorkerId && (n.taskId === card.id || n.taskTitle === card.title) && !n.read
      );
      pendingNotifs.forEach(notif => {
        onMarkNotificationRead(notif.id);
      });
    }
  };

  // Add checklist item in modal
  const handleAddChecklistItem = () => {
    if (!newChecklistItemText.trim()) return;
    setTaskChecklist(prev => [
      ...prev,
      {
        id: `check_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        text: newChecklistItemText.trim(),
        completed: false
      }
    ]);
    setNewChecklistItemText('');
  };

  const handleToggleChecklistItem = (id: string) => {
    setTaskChecklist(prev =>
      prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item)
    );
  };

  const handleRemoveChecklistItem = (id: string) => {
    setTaskChecklist(prev => prev.filter(item => item.id !== id));
  };

  // Toggle checklist item directly on a card from main view
  const handleQuickToggleCheck = (card: TaskCard, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedChecklist = card.checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    const updatedCard: TaskCard = {
      ...card,
      checklist: updatedChecklist
    };
    onSaveCard(updatedCard);
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

  // Save Task (Create or Edit)
  const handleSaveTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      onAddNotificationToast('Título Requerido', 'Por favor ingresa un título para la tarea.', 'info');
      return;
    }
    if (!taskBoardId) {
      onAddNotificationToast('Tablero Requerido', 'Selecciona un tablero para la tarea.', 'info');
      return;
    }

    const cardId = editingCard ? editingCard.id : `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    
    let updatedHistory = editingCard?.history || [];
    if (!editingCard) {
      // Creation audit log
      updatedHistory = [{
        id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        toStatus: taskStatus,
        changedByWorkerId: currentSession?.userId,
        changedByName: currentSession?.name || 'Sistema',
        timestamp: new Date().toISOString()
      }];
    } else if (editingCard.status !== taskStatus) {
      // Status update audit log
      updatedHistory = [...updatedHistory, {
        id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        fromStatus: editingCard.status,
        toStatus: taskStatus,
        changedByWorkerId: currentSession?.userId,
        changedByName: currentSession?.name || 'Sistema',
        timestamp: new Date().toISOString()
      }];
    }

    const cardData: TaskCard = {
      id: cardId,
      boardId: taskBoardId,
      divisionId: taskDivisionId || undefined,
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      status: taskStatus,
      priority: taskPriority,
      isGerenciaOnly: taskIsGerenciaOnly,
      duration: taskDuration.trim() || '00:00:00',
      startDate: taskStartDate,
      dueDate: taskDueDate,
      assignedWorkerIds: taskAssignedWorkerIds,
      checklist: taskChecklist,
      history: updatedHistory,
      createdAt: editingCard ? editingCard.createdAt : new Date().toISOString(),
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

  // Fast Status Change on Card
  const handleQuickStatusChange = (card: TaskCard, newStatus: TaskStatus, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    if (!canManageTasks && !card.assignedWorkerIds.includes(currentWorkerId || '')) {
      onAddNotificationToast('Acceso Restringido', 'Solo los asignados o coordinadores pueden cambiar el estado.', 'info');
      return;
    }

    const auditItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      fromStatus: card.status,
      toStatus: newStatus,
      changedByWorkerId: currentSession?.userId,
      changedByName: currentSession?.name || 'Sistema',
      timestamp: new Date().toISOString()
    };

    const updated: TaskCard = {
      ...card,
      status: newStatus,
      history: [...(card.history || []), auditItem]
    };
    onSaveCard(updated);
    onAddNotificationToast('Estado Actualizado', `La tarea "${card.title}" ahora está en: ${newStatus}`, 'info');
  };

  // Save New Board
  const handleCreateBoardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) {
      onAddNotificationToast('Nombre Requerido', 'Ingresa un nombre para el tablero.', 'info');
      return;
    }
    const newBoard: TaskBoard = {
      id: `board_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newBoardName.trim(),
      description: newBoardDesc.trim(),
      color: newBoardColor,
      createdAt: new Date().toISOString()
    };
    onAddBoard(newBoard);
    setSelectedBoardId(newBoard.id);
    setNewBoardName('');
    setNewBoardDesc('');
    setShowBoardModal(false);
    onAddNotificationToast('Tablero Creado', `Se creó el tablero "${newBoard.name}".`, 'success');
  };

  // Toggle assigned worker pill in Task Modal (Self or Manager permissions)
  const handleToggleWorkerAssignment = (workerId: string) => {
    // If not a manager and trying to assign someone else
    if (!canManageTasks && workerId !== currentWorkerId) {
      onAddNotificationToast(
        'Asignación Restringida',
        'Solo los Jefes y Coordinadores pueden asignar tareas a otros colaboradores. Tú puedes asignarte a ti mismo/a.',
        'info'
      );
      return;
    }

    if (taskAssignedWorkerIds.includes(workerId)) {
      setTaskAssignedWorkerIds(prev => prev.filter(id => id !== workerId));
    } else {
      setTaskAssignedWorkerIds(prev => [...prev, workerId]);
    }
  };

  // Filtered workers for assignment selector modal
  const filteredWorkersForAssignment = useMemo(() => {
    if (!workerSearchTerm.trim()) return workers;
    const term = workerSearchTerm.toLowerCase();
    return workers.filter(w => {
      const div = divisions.find(d => d.id === w.divisionId);
      return w.name.toLowerCase().includes(term) ||
             w.cargo.toLowerCase().includes(term) ||
             (div && div.name.toLowerCase().includes(term));
    });
  }, [workers, divisions, workerSearchTerm]);

  // SQL Script text to display and copy
  const sqlScriptText = `-- ==============================================================================
-- SCRIPT SQL DE IMPLEMENTACIÓN PARA BASE DE DATOS SUPABASE / POSTGRESQL
-- Módulo de Gestión de Tareas, Tableros y Reportes Operativos - Canal VTV
-- ==============================================================================

-- 1. Crear Tabla de Tableros (Task Boards)
CREATE TABLE IF NOT EXISTS task_boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  division_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Crear Tabla de Tarjetas y Tareas (Task Cards)
CREATE TABLE IF NOT EXISTS task_cards (
  id TEXT PRIMARY KEY,
  board_id TEXT REFERENCES task_boards(id) ON DELETE CASCADE,
  division_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Pendiente', -- Estados: Pendiente, Ingestado, Editado, Archivando, Evaluacion Pendiente, Finalizado
  start_date TEXT,
  due_date TEXT,
  assigned_worker_ids TEXT, -- JSON Array string con IDs de colaboradores
  checklist TEXT,           -- JSON Array string de subtareas
  priority TEXT DEFAULT 'media',
  created_by_worker_id TEXT,
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Crear Tabla de Historial y Trazabilidad de Estados (Audit Log)
CREATE TABLE IF NOT EXISTS task_history (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES task_cards(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_worker_id TEXT,
  changed_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Crear Tabla de Notificaciones de Tareas
CREATE TABLE IF NOT EXISTS task_notifications (
  id TEXT PRIMARY KEY,
  worker_id TEXT REFERENCES workers(id) ON DELETE CASCADE,
  task_id TEXT,
  task_title TEXT,
  board_name TEXT,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Inserción de Tableros por Defecto de VTV
INSERT INTO task_boards (id, name, description, color) VALUES
('board_ingesta', 'Ingesta', 'Recepción, digitalización y control de calidad de materiales audiovisuales entrantes.', 'cyan'),
('board_prensa', 'Prensa', 'Redacción, cobertura periodística y notas informativas de canal VTV.', 'blue'),
('board_programacion', 'Programación', 'Planificación, escaletas y emisión de la parrilla de programación.', 'indigo'),
('board_mantenimiento', 'Mantenimiento & Equipos Técnicos', 'Soporte técnico, mantenimiento preventivo y supervisión de infraestructura.', 'amber'),
('board_digitalizacion', 'Digitalización', 'Migración y resguardo de cintas históricas y acervo audiovisual.', 'purple'),
('board_administracion', 'Administración', 'Logística, gestión de personal, asignaciones y procesos administrativos.', 'emerald')
ON CONFLICT (id) DO NOTHING;

-- 5. Función Stored Procedure para Generar Reporte Diario, Mensual o Anual
CREATE OR REPLACE FUNCTION get_vtv_process_report(
  p_start_date TEXT,
  p_end_date TEXT,
  p_board_id TEXT DEFAULT 'todos',
  p_status TEXT DEFAULT 'todos'
)
RETURNS TABLE (
  task_id TEXT,
  title TEXT,
  board_name TEXT,
  status TEXT,
  start_date TEXT,
  due_date TEXT,
  assigned_worker_ids TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS task_id,
    c.title,
    b.name AS board_name,
    c.status,
    c.start_date,
    c.due_date,
    c.assigned_worker_ids,
    c.created_by_name AS created_by,
    c.created_at
  FROM task_cards c
  LEFT JOIN task_boards b ON c.board_id = b.id
  WHERE (c.start_date >= p_start_date AND c.start_date <= p_end_date)
    AND (p_board_id = 'todos' OR c.board_id = p_board_id)
    AND (p_status = 'todos' OR c.status = p_status)
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScriptText);
    onAddNotificationToast('SQL Copiado', 'El script SQL fue copiado al portapapeles.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Header */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-white/10 bg-slate-900/80 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                <Kanban className="w-3 h-3 text-cyan-400" />
                Módulo Principal de Tareas
              </span>
              <span className="text-xs text-slate-400 font-mono">VTV Operatividad</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              Gestión de Tareas y Proyectos
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Flujos de trabajo por áreas (Ingesta, Prensa, Programación, Mantenimiento, Digitalización, Administración) y generación de reportes periódicos.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Generate Report Button */}
            <button
              onClick={() => setShowReportModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.2)]"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Generar Reporte</span>
            </button>

            {/* SQL Script Button (Solo visible para Superadmin / Desarrollador) */}
            {currentSession?.role === 'superadmin' && (
              <button
                onClick={() => setShowSqlModal(true)}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                title="Script SQL para Supabase"
              >
                <Database className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Script SQL</span>
              </button>
            )}

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

            {/* Create Board Button (Admin/Coord only) */}
            {canManageTasks && (
              <button
                onClick={() => setShowBoardModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <FolderPlus className="w-4 h-4 text-purple-400" />
                <span>Nuevo Tablero</span>
              </button>
            )}

            {/* Create Task Button */}
            <button
              onClick={() => handleOpenCreateTask()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nueva Tarea</span>
            </button>
          </div>
        </div>
      </div>

      {/* Board Navigation Tabs & Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 glass-card p-4 rounded-2xl border border-white/10 bg-slate-900/60">
        {/* Boards Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
          <button
            onClick={() => setSelectedBoardId('todos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              selectedBoardId === 'todos'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white border border-cyan-500/40 shadow-sm'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Todos los Tableros</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 text-slate-300 font-mono">
              {cards.length}
            </span>
          </button>

          {boards.map(b => {
            const count = cards.filter(c => c.boardId === b.id).length;
            const isSelected = selectedBoardId === b.id;

            return (
              <div key={b.id} className="relative group flex items-center">
                <button
                  onClick={() => setSelectedBoardId(b.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-cyan-500/20 text-white border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                      : 'bg-slate-800/50 text-slate-300 border-white/5 hover:border-white/20'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>{b.name}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/60 text-slate-400 font-mono">
                    {count}
                  </span>
                </button>

                {/* Delete board button for admin */}
                {canManageTasks && boards.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`¿Eliminar el tablero "${b.name}"? Sus tareas asociadas también serán borradas.`)) {
                        onDeleteBoard(b.id);
                        if (selectedBoardId === b.id) setSelectedBoardId('todos');
                        onAddNotificationToast('Tablero Eliminado', `Se removió el tablero "${b.name}".`, 'info');
                      }
                    }}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                    title="Eliminar Tablero"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Search & Quick Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar tarea o colaborador..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Status Dropdown */}
          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="todos">Todos los Estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Ingestado">Ingestado</option>
            <option value="Editado">Editado</option>
            <option value="Archivando">Archivando</option>
            <option value="Evaluacion Pendiente">Evaluación Pendiente</option>
            <option value="Finalizado">Finalizado</option>
          </select>

          {/* Only My Tasks Toggle */}
          {currentWorkerId && (
            <button
              onClick={() => setOnlyMyTasks(!onlyMyTasks)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                onlyMyTasks
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Mis Tareas</span>
            </button>
          )}
        </div>
      </div>

      {/* KANBAN COLUMNS BOARD VIEW - 6 STATUS COLUMNS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {STATUS_COLUMNS.map(col => {
          const colCards = filteredCards.filter(c => c.status === col.key);
          const ColIcon = col.icon;

          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const cardId = e.dataTransfer.getData('text/plain');
                if (cardId) {
                  handleCardDrop(cardId, col.key);
                }
              }}
              className={`rounded-2xl border ${col.border} ${col.bg} p-3.5 flex flex-col min-h-[520px] transition-all`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <ColIcon className={`w-4 h-4 ${col.color}`} />
                  <h3 className="text-xs font-black uppercase text-white tracking-wider">
                    {col.label}
                  </h3>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${col.badge}`}>
                  {colCards.length}
                </span>
              </div>

              {/* Quick Add Button inside column */}
              <button
                onClick={() => handleOpenCreateTask(col.key)}
                className="w-full mb-3 py-2 rounded-xl border border-dashed border-white/10 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-slate-950/40 hover:bg-slate-900 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir {col.label}</span>
              </button>

              {/* Cards List */}
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {colCards.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs italic">
                    Sin tareas en este estado
                  </div>
                ) : (
                  colCards.map(card => {
                    const boardObj = boards.find(b => b.id === card.boardId);
                    const completedCheck = card.checklist.filter(c => c.completed).length;
                    const totalCheck = card.checklist.length;
                    const isSelfAssigned = currentWorkerId ? card.assignedWorkerIds.includes(currentWorkerId) : false;
                    const canDragCard = canManageTasks || isSelfAssigned;

                    return (
                      <motion.div
                        key={card.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        draggable={canDragCard}
                        onDragStart={(e) => {
                          if (!canDragCard) {
                            e.preventDefault();
                            return;
                          }
                          e.dataTransfer.setData('text/plain', card.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={() => handleOpenEditTask(card)}
                        className={`p-3.5 rounded-xl border border-white/10 bg-slate-900/90 hover:bg-slate-800/90 hover:border-cyan-500/40 transition-all shadow-md group space-y-2.5 relative ${
                          canDragCard ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                        }`}
                      >
                        {/* Board, Division, Gerencia Exclusiva & Priority Badges */}
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <div className="flex items-center gap-1 flex-wrap max-w-[80%]">
                            {card.isGerenciaOnly && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                                <ShieldAlert className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                Exclusiva Gerencia
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 truncate max-w-[120px]">
                              {boardObj?.name || 'VTV'}
                            </span>
                            {card.divisionId && (() => {
                              const divObj = divisions.find(d => d.id === card.divisionId);
                              return divObj ? (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-medium font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 truncate max-w-[100px]">
                                  {divObj.name}
                                </span>
                              ) : null;
                            })()}
                            {card.duration && card.duration !== '00:00:00' && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold font-mono bg-slate-950 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 shadow-sm">
                                <Clock className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                                {card.duration}
                              </span>
                            )}
                          </div>

                          {card.priority && (
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase font-mono shrink-0 ${
                              card.priority === 'urgente' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' :
                              card.priority === 'alta' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              card.priority === 'media' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {card.priority}
                            </span>
                          )}
                        </div>

                        {/* Card Title & Description */}
                        <div>
                          <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2">
                            {card.title}
                          </h4>
                          {card.description && (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 font-normal">
                              {card.description}
                            </p>
                          )}
                        </div>

                        {/* Checklist progress bar */}
                        {totalCheck > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                              <span className="flex items-center gap-1">
                                <CheckSquare className="w-3 h-3 text-emerald-400" />
                                Subtareas
                              </span>
                              <span>{completedCheck}/{totalCheck}</span>
                            </div>
                            <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-400 h-full transition-all duration-300"
                                style={{ width: `${(completedCheck / totalCheck) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Dates & Quick Self-Assignment Button */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-slate-400">
                          <div className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>{card.dueDate || card.startDate}</span>
                          </div>

                          <button
                            onClick={(e) => handleToggleSelfAssignment(card, e)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                              isSelfAssigned
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10'
                            }`}
                            title={isSelfAssigned ? 'Hacer clic para desasignarte' : 'Asignarme a esta tarea'}
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>{isSelfAssigned ? 'Asignado' : '+ Asignarme'}</span>
                          </button>
                        </div>

                        {/* Assigned Worker Avatars */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center -space-x-1.5 overflow-hidden">
                            {card.assignedWorkerIds.slice(0, 4).map(id => {
                              const worker = workers.find(w => w.id === id);
                              return (
                                <div
                                  key={id}
                                  className="w-5 h-5 rounded-full bg-purple-600 border border-slate-900 text-white font-bold text-[9px] flex items-center justify-center shrink-0"
                                  title={worker?.name || id}
                                >
                                  {(worker?.name || 'U')[0]}
                                </div>
                              );
                            })}
                            {card.assignedWorkerIds.length > 4 && (
                              <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-900 text-slate-400 text-[9px] flex items-center justify-center">
                                +{card.assignedWorkerIds.length - 4}
                              </span>
                            )}
                          </div>

                          {/* Quick Board & Status Selects */}
                          <div className="flex items-center gap-1">
                            <select
                              value={card.boardId}
                              onChange={(e) => handleQuickBoardChange(card, e.target.value, e)}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-slate-950 border border-white/10 rounded-md text-[10px] text-purple-300 px-1 py-0.5 focus:outline-none focus:border-purple-500 cursor-pointer max-w-[85px] truncate"
                              title="Cambiar Tablero"
                            >
                              {boards.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>

                            <select
                              value={card.status}
                              onChange={(e) => handleQuickStatusChange(card, e.target.value as TaskStatus, e)}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-slate-950 border border-white/10 rounded-md text-[10px] text-slate-300 px-1.5 py-0.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
                            >
                              <option value="Pendiente">Pendiente</option>
                              <option value="Ingestado">Ingestado</option>
                              <option value="Editado">Editado</option>
                              <option value="Archivando">Archivando</option>
                              <option value="Evaluacion Pendiente">Evaluación Pendiente</option>
                              <option value="Finalizado">Finalizado</option>
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* REPORT GENERATOR MODAL */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl my-8"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight">
                      Generador de Reporte Operativo de Procesos
                    </h2>
                    <p className="text-xs text-slate-400">
                      Documentación de procesos diarios, mensuales y anuales con fechas, estados y colaboradores participantes.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filters Bar */}
              <div className="p-5 bg-slate-950/60 border-b border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {/* Report Type Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Periodo *</label>
                  <select
                    value={reportType}
                    onChange={e => setReportType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="diario">Reporte Diario</option>
                    <option value="mensual">Reporte Mensual</option>
                    <option value="anual">Reporte Anual</option>
                  </select>
                </div>

                {/* Date / Month / Year Picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {reportType === 'diario' ? 'Fecha Específica' : reportType === 'mensual' ? 'Mes' : 'Año'}
                  </label>
                  {reportType === 'diario' && (
                    <input
                      type="date"
                      value={reportDate}
                      onChange={e => setReportDate(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  )}
                  {reportType === 'mensual' && (
                    <input
                      type="month"
                      value={reportMonth}
                      onChange={e => setReportMonth(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  )}
                  {reportType === 'anual' && (
                    <input
                      type="number"
                      min="2020"
                      max="2035"
                      value={reportYear}
                      onChange={e => setReportYear(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  )}
                </div>

                {/* Board Filter */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Área / Tablero</label>
                  <select
                    value={reportBoardFilter}
                    onChange={e => setReportBoardFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="todos">Todos los Tableros</option>
                    {boards.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Division Filter */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">División / Área</label>
                  <select
                    value={reportDivisionFilter}
                    onChange={e => setReportDivisionFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="todos">Todas las Divisiones</option>
                    {divisions.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Worker / Person Filter */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Colaborador / Persona</label>
                  <select
                    value={reportWorkerFilter}
                    onChange={e => setReportWorkerFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="todos">Todos los Colaboradores</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.cargo || 'Personal'})</option>
                    ))}
                  </select>
                </div>

                {/* Category Filter (Logros / Activas) */}
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1">Clasificación</label>
                  <select
                    value={reportCategoryFilter}
                    onChange={e => setReportCategoryFilter(e.target.value as any)}
                    className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="todos">Todos los Procesos</option>
                    <option value="logros">Solo Logros de División</option>
                    <option value="activas">Solo Tareas Activas</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Estado</label>
                  <select
                    value={reportStatusFilter}
                    onChange={e => setReportStatusFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="todos">Todos los Estados</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Ingestado">Ingestado</option>
                    <option value="Editado">Editado</option>
                    <option value="Archivando">Archivando</option>
                    <option value="Evaluacion Pendiente">Evaluación Pendiente</option>
                    <option value="Finalizado">Finalizado</option>
                  </select>
                </div>
              </div>

              {/* Report Actions Row */}
              <div className="px-5 py-3 bg-slate-950/80 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-emerald-400 font-bold">{reportTasks.length}</span>
                  <span>procesos filtrados para exportación</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyFormattedReportText}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-200 font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
                    title="Copiar informe diagramado en texto estructurado"
                  >
                    <Copy className="w-4 h-4 text-cyan-400" />
                    <span>Copiar Texto Diagramado</span>
                  </button>

                  <button
                    onClick={handlePrintReport}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir Reporte</span>
                  </button>
                </div>
              </div>

              {/* Printable Body Content */}
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {/* Summary Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10">
                    <p className="text-[10px] text-slate-400 uppercase font-mono font-bold">Total Procesos</p>
                    <p className="text-xl font-black text-white mt-0.5">{reportMetrics.total}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">Tiempo Total: <span className="text-white font-bold">{reportMetrics.tiempoTotalGeneral}</span></p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                    <p className="text-[10px] text-cyan-400 uppercase font-mono font-bold">Material Ingestado</p>
                    <p className="text-xl font-black text-cyan-300 mt-0.5">{reportMetrics.cantidadIngestado} <span className="text-xs font-normal text-cyan-400/80">archivos</span></p>
                    <p className="text-[10px] text-cyan-400/70 font-mono mt-1">Tiempo: <span className="font-bold text-cyan-200">{reportMetrics.tiempoTotalIngestado}</span></p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
                    <p className="text-[10px] text-blue-400 uppercase font-mono font-bold">Material Editado</p>
                    <p className="text-xl font-black text-blue-300 mt-0.5">{reportMetrics.cantidadEditado} <span className="text-xs font-normal text-blue-400/80">archivos</span></p>
                    <p className="text-[10px] text-blue-400/70 font-mono mt-1">Tiempo: <span className="font-bold text-blue-200">{reportMetrics.tiempoTotalEditado}</span></p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-[10px] text-emerald-400 uppercase font-mono font-bold">Material Archivado (Finalizado)</p>
                    <p className="text-xl font-black text-emerald-300 mt-0.5">{reportMetrics.cantidadArchivado} <span className="text-xs font-normal text-emerald-400/80">archivos</span></p>
                    <p className="text-[10px] text-emerald-400/70 font-mono mt-1">Tiempo Total: <span className="font-bold text-emerald-200">{reportMetrics.tiempoTotalArchivado}</span></p>
                    {(reportMetrics.cantidadArchivadoPrensa > 0 || reportMetrics.cantidadArchivadoProgramacion > 0) && (
                      <div className="mt-2 pt-1.5 border-t border-emerald-500/20 text-[9px] font-mono text-emerald-300 space-y-0.5">
                        <div className="flex justify-between"><span>Prensa:</span><span className="font-bold">{reportMetrics.cantidadArchivadoPrensa} ({reportMetrics.tiempoArchivadoPrensa})</span></div>
                        <div className="flex justify-between"><span>Programación:</span><span className="font-bold">{reportMetrics.cantidadArchivadoProgramacion} ({reportMetrics.tiempoArchivadoProgramacion})</span></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Report Table */}
                <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-950">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-white/10 text-slate-400 font-mono uppercase text-[10px]">
                        <th className="p-3">Código</th>
                        <th className="p-3">Tarea / Proceso</th>
                        <th className="p-3">Área / Tablero</th>
                        <th className="p-3">Estado</th>
                        <th className="p-3">Duración</th>
                        <th className="p-3">Fechas (Inicio / Entrega)</th>
                        <th className="p-3">Colaboradores Asignados</th>
                        <th className="p-3 text-right">Subtareas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {reportTasks.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                            No se encontraron procesos o tareas registradas en el período seleccionado.
                          </td>
                        </tr>
                      ) : (
                        reportTasks.map(task => {
                          const boardObj = boards.find(b => b.id === task.boardId);
                          const checklistDone = task.checklist.filter(c => c.completed).length;

                          return (
                            <tr key={task.id} className="hover:bg-slate-900/50">
                              <td className="p-3 font-mono text-[10px] text-slate-500">
                                {task.id.slice(-6).toUpperCase()}
                              </td>
                              <td className="p-3 font-bold text-white max-w-xs">
                                <div>{task.title}</div>
                                {task.description && (
                                  <div className="text-[10px] text-slate-400 font-normal line-clamp-1">{task.description}</div>
                                )}
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-[10px] font-bold text-cyan-300">
                                  {boardObj?.name || 'VTV'}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  task.status === 'Finalizado' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                  task.status === 'Evaluacion Pendiente' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                  task.status === 'Editado' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                  task.status === 'Archivando' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                  task.status === 'Pendiente' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                                  'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                }`}>
                                  {task.status}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-[11px] font-bold text-cyan-300 whitespace-nowrap">
                                {task.duration || '00:00:00'}
                              </td>
                              <td className="p-3 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                                {task.startDate || 'S/D'} a {task.dueDate || 'S/D'}
                              </td>
                              <td className="p-3">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {task.assignedWorkerIds.length === 0 ? (
                                    <span className="text-[10px] text-slate-500 italic">Sin asignar</span>
                                  ) : (
                                    task.assignedWorkerIds.map(id => {
                                      const w = workers.find(work => work.id === id);
                                      return (
                                        <span key={id} className="px-1.5 py-0.5 rounded bg-slate-900 text-[10px] text-slate-300 border border-white/10 font-medium">
                                          {w?.name || id}
                                        </span>
                                      );
                                    })
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-right font-mono text-[10px]">
                                {task.checklist.length > 0 ? (
                                  <span className="text-emerald-400 font-bold">{checklistDone}/{task.checklist.length}</span>
                                ) : (
                                  <span className="text-slate-600">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-950 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">
                  Generado el {new Date().toLocaleDateString('es-ES')} • Sistema Interno VTV
                </span>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SQL SCRIPT MODAL */}
      <AnimatePresence>
        {showSqlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">
                      Script SQL de Implementación Base de Datos
                    </h2>
                    <p className="text-xs text-slate-400">
                      Ejecuta este código en el editor SQL de Supabase / PostgreSQL para crear las tablas y procedimientos de reportes.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 bg-slate-950">
                <div className="relative">
                  <pre className="p-4 rounded-xl bg-slate-900 text-cyan-300 font-mono text-[11px] overflow-x-auto max-h-96 border border-white/10 leading-relaxed">
                    {sqlScriptText}
                  </pre>
                  <button
                    onClick={handleCopySql}
                    className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Copiar SQL</span>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-900 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
                >
                  Listo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NOTIFICATION CENTER MODAL */}
      <AnimatePresence>
        {showNotificationCenter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black text-white">Centro de Notificaciones</h3>
                </div>
                <button
                  onClick={() => setShowNotificationCenter(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 max-h-80 overflow-y-auto space-y-2">
                {userNotifications.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No tienes notificaciones pendientes.
                  </div>
                ) : (
                  userNotifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        onMarkNotificationRead(notif.id);
                        const card = cards.find(c => c.id === notif.taskId || c.title === notif.taskTitle);
                        if (card) {
                          handleOpenEditTask(card);
                          setShowNotificationCenter(false);
                        }
                      }}
                      className="p-3 rounded-xl border border-cyan-500/30 bg-slate-800/80 hover:bg-slate-800 text-xs transition-all flex items-start justify-between gap-3 cursor-pointer group shadow-md"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                          <p className="font-bold text-white group-hover:text-cyan-300 transition-colors">{notif.taskTitle}</p>
                        </div>
                        <p className="text-slate-300 text-[11px]">{notif.message}</p>
                        <p className="text-[9px] text-slate-500 font-mono">
                          {new Date(notif.createdAt).toLocaleString('es-VE')}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkNotificationRead(notif.id);
                          const card = cards.find(c => c.id === notif.taskId || c.title === notif.taskTitle);
                          if (card) {
                            handleOpenEditTask(card);
                            setShowNotificationCenter(false);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-bold rounded-lg border border-cyan-500/40 shrink-0 flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Revisar Tarea</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NEW BOARD MODAL */}
      <AnimatePresence>
        {showBoardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-black text-white">Crear Nuevo Tablero</h3>
                </div>
                <button onClick={() => setShowBoardModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateBoardSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nombre del Tablero *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Ingesta, Prensa, Programación..."
                    value={newBoardName}
                    onChange={e => setNewBoardName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Descripción</label>
                  <textarea
                    rows={2}
                    placeholder="Propósito operativo del tablero..."
                    value={newBoardDesc}
                    onChange={e => setNewBoardDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBoardModal(false)}
                    className="px-3.5 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs"
                  >
                    Guardar Tablero
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE / EDIT TASK MODAL */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 space-y-4 my-8"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Kanban className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-black text-white">
                    {editingCard ? 'Editar Tarea u Operación' : 'Crear Nueva Tarea'}
                  </h3>
                </div>
                <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTaskSubmit} className="space-y-4">
                {/* Title & Board Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-300 mb-1">Título de la Tarea *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Ingesta de señal internacional, Edición de nota..."
                      value={taskTitle}
                      onChange={e => setTaskTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Tablero *</label>
                    <select
                      value={taskBoardId}
                      onChange={e => setTaskBoardId(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      {boards.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Division Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">División Responsable / Asignada</label>
                  <select
                    value={taskDivisionId}
                    onChange={e => setTaskDivisionId(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Todas las Divisiones / Transversal</option>
                    {divisions.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Exclusive Gerencia Toggle (Etiqueta Única) */}
                {isGerenciaUser && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-300">Tarea Exclusiva de Gerencia (Etiqueta Única)</p>
                        <p className="text-[10px] text-slate-400">Marcar como confidencial: solo la Gerente y La Adjunta podrán ver esta tarea.</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={taskIsGerenciaOnly}
                      onChange={e => setTaskIsGerenciaOnly(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-amber-500/50 cursor-pointer shrink-0"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Descripción Detallada</label>
                  <textarea
                    rows={3}
                    placeholder="Instrucciones específicas, equipos o parámetros operativos..."
                    value={taskDesc}
                    onChange={e => setTaskDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Status, Priority & Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Estado</label>
                    <select
                      value={taskStatus}
                      onChange={e => setTaskStatus(e.target.value as TaskStatus)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Ingestado">Ingestado</option>
                      <option value="Editado">Editado</option>
                      <option value="Archivando">Archivando</option>
                      <option value="Evaluacion Pendiente">Evaluación Pendiente</option>
                      <option value="Finalizado">Finalizado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Prioridad</label>
                    <select
                      value={taskPriority}
                      onChange={e => setTaskPriority(e.target.value as any)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Fecha Inicio</label>
                    <input
                      type="date"
                      value={taskStartDate}
                      onChange={e => setTaskStartDate(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Fecha Entrega</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={e => setTaskDueDate(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Duración del Material Audiovisual */}
                <div className="p-3.5 rounded-xl border border-white/10 bg-slate-950/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      Duración del Material Audiovisual (HH:MM:SS)
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Tiempo de Ingesta / Edición / Archivo</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <input
                        type="text"
                        placeholder="00:00:00"
                        value={taskDuration}
                        onChange={e => setTaskDuration(e.target.value)}
                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400">Atajos:</span>
                      <button
                        type="button"
                        onClick={() => setTaskDuration('00:15:00')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 border border-white/10"
                      >
                        15 min
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskDuration('00:30:00')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 border border-white/10"
                      >
                        30 min
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskDuration('01:00:00')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 border border-white/10"
                      >
                        1 hr
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskDuration('02:00:00')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 border border-white/10"
                      >
                        2 hrs
                      </button>
                    </div>
                  </div>
                </div>

                {/* Checklist (Casillas de Verificación) */}
                <div className="p-3.5 rounded-xl border border-white/10 bg-slate-950/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                      Casillas de Verificación (Subtareas)
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {taskChecklist.filter(i => i.completed).length}/{taskChecklist.length} completadas
                    </span>
                  </div>

                  {/* Add checklist input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Agregar paso o item de verificación..."
                      value={newChecklistItemText}
                      onChange={e => setNewChecklistItemText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem(); } }}
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddChecklistItem}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-bold transition-colors border border-white/10 cursor-pointer"
                    >
                      Añadir
                    </button>
                  </div>

                  {/* Checklist items list */}
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {taskChecklist.map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/80 border border-white/5">
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleToggleChecklistItem(item.id)}
                            className="w-3.5 h-3.5 rounded bg-slate-950 border-white/20 text-cyan-500 focus:ring-0 cursor-pointer"
                          />
                          <span className={`text-xs ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {item.text}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveChecklistItem(item.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assigned Participants Selector */}
                <div className="p-3.5 rounded-xl border border-white/10 bg-slate-950/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-purple-400" />
                        Asignar Participantes ({taskAssignedWorkerIds.length} seleccionados)
                      </label>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {!canManageTasks
                          ? 'Cualquier colaborador puede asignarse a sí mismo. Solo Jefes/Coordinadores asignan a terceros.'
                          : 'Haz clic para seleccionar o desasignar colaboradores.'}
                      </p>
                    </div>

                    <input
                      type="text"
                      placeholder="Filtrar personal..."
                      value={workerSearchTerm}
                      onChange={e => setWorkerSearchTerm(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
                    {filteredWorkersForAssignment.map(w => {
                      const isAssigned = taskAssignedWorkerIds.includes(w.id);
                      const div = divisions.find(d => d.id === w.divisionId);
                      const isSelf = w.id === currentWorkerId;

                      return (
                        <div
                          key={w.id}
                          onClick={() => handleToggleWorkerAssignment(w.id)}
                          className={`p-2 rounded-xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                            isAssigned
                              ? 'bg-purple-500/20 border-purple-500/40 text-white font-bold'
                              : 'bg-slate-900/60 border-white/5 text-slate-400 hover:border-white/20'
                          } ${!canManageTasks && !isSelf ? 'opacity-70' : ''}`}
                        >
                          <div className="truncate pr-1">
                            <p className="truncate font-medium flex items-center gap-1">
                              {w.name}
                              {isSelf && <span className="text-[9px] text-cyan-400 font-mono">(Tú)</span>}
                            </p>
                            <p className="text-[9px] text-slate-500 font-mono truncate">{w.cargo} • {div?.name || 'VTV'}</p>
                          </div>
                          {isAssigned && <Check className="w-4 h-4 text-purple-400 stroke-[3] shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Audit Trail History (Trazabilidad de Estados) */}
                {editingCard && editingCard.history && editingCard.history.length > 0 && (
                  <div className="p-3.5 rounded-xl border border-white/10 bg-slate-950/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-400" />
                        Historial de Trazabilidad y Registros ({editingCard.history.length})
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">Registro de Estados</span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                      {editingCard.history.map((hist, idx) => (
                        <div key={hist.id || idx} className="p-2 rounded-lg bg-slate-900 border border-white/5 text-[11px] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                            <span className="text-slate-300 font-medium truncate">
                              {hist.fromStatus ? (
                                <>
                                  <span className="text-slate-400">{hist.fromStatus}</span> ➔ <span className="text-emerald-400 font-bold">{hist.toStatus}</span>
                                </>
                              ) : (
                                <>
                                  Registro inicial: <span className="text-cyan-300 font-bold">{hist.toStatus}</span>
                                </>
                              )}
                            </span>
                            {hist.changedByName && (
                              <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-white/5 shrink-0">
                                {hist.changedByName}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] font-mono text-slate-500 shrink-0">
                            {new Date(hist.timestamp).toLocaleString('es-VE')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  {editingCard && canManageTasks ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Estás seguro de eliminar la tarea "${taskTitle}"?`)) {
                          onDeleteCard(editingCard.id);
                          setShowTaskModal(false);
                          onAddNotificationToast('Tarea Eliminada', 'La tarea ha sido removida con éxito.', 'info');
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar Tarea</span>
                    </button>
                  ) : <div />}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTaskModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs transition-colors shadow-lg cursor-pointer"
                    >
                      {editingCard ? 'Guardar Cambios' : 'Crear Tarea'}
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
