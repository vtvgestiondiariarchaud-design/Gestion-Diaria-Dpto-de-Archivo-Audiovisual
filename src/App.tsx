import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, Layers, Utensils, FileText, Calendar, 
  Database, Shield, AlertTriangle, Sparkles, 
  Bell, CheckCircle2, Info, ChevronDown, UserCircle, LogOut, Loader2, KeyRound, UserPlus, Edit2, Check, X, ChevronLeft, ChevronRight, Plus,
  Umbrella, Kanban, CheckSquare
} from 'lucide-react';

import { Division, Worker, ShiftAssignment, ShiftChangeRequest, UserRole, TaskBoard, TaskCard, TaskNotification } from './types';
import { db, DEFAULT_DIVISIONS, isSupabaseConfigured, supabaseConnectionStatus, lastSupabaseError, supabase } from './supabaseClient';

import TaskManager from './components/TaskManager';
import TrelloBoard from './components/TrelloBoard';
import ComedorLogistics from './components/ComedorLogistics';
import ReportGenerator from './components/ReportGenerator';
import DatabaseSchema from './components/DatabaseSchema';
import AdminPanel from './components/AdminPanel';
import ShiftChanges from './components/ShiftChanges';
import VacationControl from './components/VacationControl';

interface NotificationToast {
  id: string;
  title: string;
  desc: string;
  type: 'success' | 'info';
}

export default function App() {
  const getTodayDateStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Operational Days list with default initial values and local storage persistence
  const [operationalDates, setOperationalDates] = useState<string[]>(() => {
    const saved = localStorage.getItem('vtv_operational_dates');
    return saved ? JSON.parse(saved) : ['2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'];
  });
  const [selectedDateStr, setSelectedDateStr] = useState<string>(getTodayDateStr);

  const handleAddOperationalDate = async (newDateStr: string) => {
    if (!newDateStr) return;
    const matched = newDateStr.match(/^\d{4}-\d{2}-\d{2}$/);
    if (!matched) {
      addNotification('Formato Inválido', 'Por favor usa el formato AAAA-MM-DD.', 'info');
      return;
    }
    if (operationalDates.includes(newDateStr)) {
      addNotification('Día Existente', `El día ${newDateStr} ya está registrado.`, 'info');
      setSelectedDateStr(newDateStr);
      return;
    }
    const updated = [...operationalDates, newDateStr].sort();
    setOperationalDates(updated);
    localStorage.setItem('vtv_operational_dates', JSON.stringify(updated));
    setSelectedDateStr(newDateStr);

    // Determinar si es de lunes a viernes (1 a 5)
    const [year, month, day] = newDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isWeekday) {
      const newAssignments: ShiftAssignment[] = [];
      workers.forEach(w => {
        // Exclude worker from auto-scheduling if they are on vacation on this date
        const isOnVacation = w.vacationStart && w.vacationEnd &&
                             newDateStr >= w.vacationStart && newDateStr <= w.vacationEnd;
        if (isOnVacation) return;

        // Exclude worker if they have a programmed 'libre' (free day) shift on this date
        const hasFreeDay = assignments.some(a => a.workerId === w.id && a.date === newDateStr && a.shiftType === 'libre');
        if (hasFreeDay) return;

        if (w.fixedShift && w.fixedShift !== 'pool') {
          newAssignments.push({
            id: `as_${w.id}_${w.fixedShift}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            workerId: w.id,
            divisionId: w.divisionId,
            date: newDateStr,
            shiftType: w.fixedShift
          });
        }
      });

      if (newAssignments.length > 0) {
        setAssignments(prev => [...prev, ...newAssignments]);
        try {
          for (const asg of newAssignments) {
            await db.upsertAssignment(asg);
          }
          addNotification(
            'Día Habilitado y Conformado',
            `Se habilitó el día ${newDateStr} y se preestablecieron automáticamente ${newAssignments.length} turnos fijos de lunes a viernes.`,
            'success'
          );
        } catch (err) {
          console.error("Error al guardar las asignaciones automáticas:", err);
          addNotification('Día Habilitado', `Se habilitó el día ${newDateStr}, pero hubo un detalle al persistir los turnos preestablecidos.`, 'info');
        }
      } else {
        addNotification('Día Habilitado', `Se habilitó el día ${newDateStr} (L-V), sin turnos fijos cargados.`, 'success');
      }
    } else {
      addNotification(
        'Día Habilitado',
        `Se habilitó el día ${newDateStr}. Al ser fin de semana, el tablero se creará vacío para conformación manual.`,
        'success'
      );
    }
  };

  useEffect(() => {
    const todayStr = getTodayDateStr();
    if (!operationalDates.includes(todayStr)) {
      handleAddOperationalDate(todayStr);
    } else {
      setSelectedDateStr(todayStr);
    }
  }, []);

  const getPrevDateStr = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getNextDateStr = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getRelativeDateDetails = (dateStr: string) => {
    const todayStr = getTodayDateStr();
    
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const todayDate = new Date(ty, tm - 1, td);
    
    const diffTime = targetDate.getTime() - todayDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    let label = '';
    if (diffDays === 0) {
      label = 'Hoy';
    } else if (diffDays === -1) {
      label = 'Ayer';
    } else if (diffDays < -1) {
      label = `Hace ${Math.abs(diffDays)} días`;
    } else if (diffDays === 1) {
      label = 'Mañana';
    } else {
      label = `En ${diffDays} días`;
    }
    
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const dayName = dayNames[targetDate.getDay()];
    const formattedDateDisplay = `${d} de ${months[m - 1]} de ${y}`;
    
    return {
      label,
      dayName,
      formattedDateDisplay
    };
  };

  const formattedSelectedDate = useMemo(() => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return `${days[date.getDay()]}, ${String(day).padStart(2, '0')} de ${months[date.getMonth()]} ${year}`;
  }, [selectedDateStr]);

  // Core Sync States
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  // Memoized workers sorted by division name, then alphabetically by worker name
  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const divA = divisions.find(d => d.id === a.divisionId);
      const divB = divisions.find(d => d.id === b.divisionId);
      const nameA = divA ? divA.name : 'Sin división';
      const nameB = divB ? divB.name : 'Sin división';
      
      const divCompare = nameA.localeCompare(nameB);
      if (divCompare !== 0) return divCompare;
      return a.name.localeCompare(b.name);
    });
  }, [workers, divisions]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [requests, setRequests] = useState<ShiftChangeRequest[]>([]);

  // Task System States
  const [taskBoards, setTaskBoards] = useState<TaskBoard[]>([]);
  const [taskCards, setTaskCards] = useState<TaskCard[]>([]);
  const [taskNotifications, setTaskNotifications] = useState<TaskNotification[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'not_configured'>(
    isSupabaseConfigured ? 'connected' : 'not_configured'
  );
  const [dbError, setDbError] = useState<string | null>(null);

  // Authentication & Session
  const [currentSession, setCurrentSession] = useState<{
    userId: string;
    name: string;
    role: UserRole;
    divisionId?: string;
    email: string;
    cargo: string;
  } | null>(() => {
    const saved = localStorage.getItem('vtv_real_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Active Navigation Tab ('tareas' as primary default)
  const [activeTab, setActiveTab] = useState<'tareas' | 'tablero' | 'comedor' | 'reportes' | 'solicitudes' | 'admin' | 'vacaciones'>('tareas');
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);

  // Currently Selected Division in Trello Board view
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('todos');

  // Auth form states
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCargo, setRegCargo] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regDivisionId, setRegDivisionId] = useState('div_archivo_prensa');
  const [regRole, setRegRole] = useState<UserRole>('worker');

  // Username change editing state
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newCedula, setNewCedula] = useState('');

  // Forced password change state
  const [forceNewPassword, setForceNewPassword] = useState('');
  const [forceConfirmPassword, setForceConfirmPassword] = useState('');

  // Individual food preference states derived dynamically from workers' profiles
  const mealsPreferences = useMemo(() => {
    const prefs: Record<string, { desayuno: boolean; almuerzo: boolean; cena: boolean }> = {};
    
    // 1. Load preferences stored on each worker in the DB
    workers.forEach(w => {
      if (w.mealsPreference) {
        prefs[w.id] = w.mealsPreference;
      }
    });

    // 2. Overlay / merge local storage as fallback for instant reactivity
    try {
      const saved = localStorage.getItem('vtv_meals_preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(id => {
          if (!prefs[id]) {
            prefs[id] = parsed[id];
          }
        });
      }
    } catch (e) {
      console.error('Error parsing local meals preferences:', e);
    }

    return prefs;
  }, [workers]);

  const handleUpdateMealsPreference = async (workerId: string, prefs: { desayuno: boolean; almuerzo: boolean; cena: boolean }) => {
    // Save to local storage for local persistence & fast feedback
    try {
      const saved = localStorage.getItem('vtv_meals_preferences');
      const parsed = saved ? JSON.parse(saved) : {};
      parsed[workerId] = prefs;
      localStorage.setItem('vtv_meals_preferences', JSON.stringify(parsed));
    } catch (e) {
      console.error(e);
    }

    // Instantly update workers state so the UI updates without a network round-trip delay
    const updatedWorkers = workers.map(w => {
      if (w.id === workerId) {
        return { ...w, mealsPreference: prefs };
      }
      return w;
    });
    setWorkers(updatedWorkers);

    // Save to the database (Supabase or localDB fallback)
    const targetWorker = updatedWorkers.find(w => w.id === workerId);
    if (targetWorker) {
      try {
        await db.updateWorker(targetWorker);
      } catch (err) {
        console.error('Error persisting meal preference updates to database:', err);
      }
    }
  };

  // Toast Notification State
  const [notifications, setNotifications] = useState<NotificationToast[]>([]);

  // Push notifications helper
  const addNotification = (title: string, desc: string, type: 'success' | 'info' = 'info') => {
    const newNotif: NotificationToast = {
      id: `notif_${Date.now()}`,
      title,
      desc,
      type
    };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
    }, 4500);
  };

  // Sync data function
  const syncData = async () => {
    setLoading(true);
    try {
      // Intentar obtener configuración en caliente del backend (Render, etc.) para evitar re-compilaciones
      try {
        const configRes = await fetch('/api/config');
        if (configRes.ok) {
          const configData = await configRes.json();
          if (configData.supabaseUrl && configData.supabaseAnonKey) {
            const { initSupabaseClient } = await import('./supabaseClient');
            initSupabaseClient(configData.supabaseUrl, configData.supabaseAnonKey);
          }
        }
      } catch (err) {
        console.warn('Configuración dinámica no disponible, usando variables de entorno estáticas:', err);
      }

      const fetchedDivisions = await db.fetchDivisions();
      const fetchedWorkers = await db.fetchWorkers();
      const fetchedAssignments = await db.fetchAssignments();
      const fetchedRequests = await db.fetchRequests();

      // Fetch Tasks System Data
      const fetchedTaskBoards = await db.fetchTaskBoards();
      const fetchedTaskCards = await db.fetchTaskCards();
      const fetchedTaskNotifs = await db.fetchTaskNotifications();

      // Ensure default initial task boards exist if empty
      let finalBoards = fetchedTaskBoards;
      if (finalBoards.length === 0) {
        finalBoards = [
          {
            id: 'board_ingesta',
            name: 'Ingesta',
            description: 'Recepción, digitalización y control de calidad de materiales audiovisuales entrantes.',
            color: 'cyan',
            createdAt: new Date().toISOString()
          },
          {
            id: 'board_prensa',
            name: 'Prensa',
            description: 'Redacción, cobertura periodística y notas informativas de canal VTV.',
            color: 'blue',
            createdAt: new Date().toISOString()
          },
          {
            id: 'board_programacion',
            name: 'Programación',
            description: 'Planificación, escaletas y emisión de la parrilla de programación.',
            color: 'indigo',
            createdAt: new Date().toISOString()
          },
          {
            id: 'board_mantenimiento',
            name: 'Mantenimiento & Equipos Técnicos',
            description: 'Soporte técnico, mantenimiento preventivo y supervisión de infraestructura.',
            color: 'amber',
            createdAt: new Date().toISOString()
          },
          {
            id: 'board_digitalizacion',
            name: 'Digitalización',
            description: 'Migración y resguardo de cintas históricas y acervo audiovisual.',
            color: 'purple',
            createdAt: new Date().toISOString()
          },
          {
            id: 'board_administracion',
            name: 'Administración',
            description: 'Logística, gestión de personal, asignaciones y procesos administrativos.',
            color: 'emerald',
            createdAt: new Date().toISOString()
          }
        ];
        localStorage.setItem('vtv_task_boards', JSON.stringify(finalBoards));
        for (const b of finalBoards) {
          db.createTaskBoard(b);
        }
      }

      // Ensure default initial task cards exist if empty
      let finalCards = fetchedTaskCards;
      if (finalCards.length === 0) {
        const today = getTodayDateStr();
        const nextWeek = getNextDateStr(today);
        finalCards = [
          {
            id: 'task_default_1',
            boardId: 'board_ingesta',
            title: 'Ingesta de Señal Internacional en Vivo',
            description: 'Sincronización y captura en servidor de almacenamiento central para notas de prensa.',
            status: 'Ingestado',
            priority: 'alta',
            startDate: today,
            dueDate: nextWeek,
            assignedWorkerIds: [],
            checklist: [
              { id: 'c1', text: 'Verificación de audio e imagen', completed: true },
              { id: 'c2', text: 'Etiquetado con palabras clave', completed: true }
            ],
            createdAt: new Date().toISOString(),
            createdByName: 'Jefatura de Operaciones'
          },
          {
            id: 'task_default_2',
            boardId: 'board_prensa',
            title: 'Edición de Avance Informativo del Mediodía',
            description: 'Ensamblaje y titulación de reportajes especiales para emisión en vivo.',
            status: 'Editado',
            priority: 'urgente',
            startDate: today,
            dueDate: nextWeek,
            assignedWorkerIds: [],
            checklist: [
              { id: 'm1', text: 'Revisión de generador de caracteres', completed: true },
              { id: 'm2', text: 'Exportación a máster de emisión', completed: false }
            ],
            createdAt: new Date().toISOString(),
            createdByName: 'Coordinación de Prensa'
          },
          {
            id: 'task_default_3',
            boardId: 'board_digitalizacion',
            title: 'Archivado y Catalogación de Cinta Histórica',
            description: 'Indexación en base de datos documental para preservación permanente.',
            status: 'Archivando',
            priority: 'media',
            startDate: today,
            dueDate: nextWeek,
            assignedWorkerIds: [],
            checklist: [
              { id: 'e1', text: 'Limpieza de cabezales y formato', completed: true },
              { id: 'e2', text: 'Verificación de metadatos', completed: false }
            ],
            createdAt: new Date().toISOString(),
            createdByName: 'Archivo Audiovisual'
          }
        ];
        localStorage.setItem('vtv_task_cards', JSON.stringify(finalCards));
        for (const c of finalCards) {
          db.upsertTaskCard(c);
        }
      }

      setTaskBoards(finalBoards);
      setTaskCards(finalCards);
      setTaskNotifications(fetchedTaskNotifs);

      // Robust local storage fallback for worker preestablished fixed shifts, vacations, and free days adjustment
      let mergedWorkers = fetchedWorkers;
      try {
        const localFixedShiftsRaw = localStorage.getItem('vtv_worker_fixed_shifts');
        const localFixedShifts = localFixedShiftsRaw ? JSON.parse(localFixedShiftsRaw) : {};

        const localVacStartRaw = localStorage.getItem('vtv_worker_vacation_start');
        const localVacStart = localVacStartRaw ? JSON.parse(localVacStartRaw) : {};

        const localVacEndRaw = localStorage.getItem('vtv_worker_vacation_end');
        const localVacEnd = localVacEndRaw ? JSON.parse(localVacEndRaw) : {};

        const localManualFreeDaysRaw = localStorage.getItem('vtv_worker_manual_free_days');
        const localManualFreeDays = localManualFreeDaysRaw ? JSON.parse(localManualFreeDaysRaw) : {};
        
        // Feed DB values to local storage fallback if they are present
        fetchedWorkers.forEach(w => {
          if (w.fixedShift && w.fixedShift !== 'pool') {
            localFixedShifts[w.id] = w.fixedShift;
          }
          if (w.vacationStart) {
            localVacStart[w.id] = w.vacationStart;
          }
          if (w.vacationEnd) {
            localVacEnd[w.id] = w.vacationEnd;
          }
          if (w.manualFreeDaysAdjustment !== undefined) {
            localManualFreeDays[w.id] = w.manualFreeDaysAdjustment;
          }
        });
        localStorage.setItem('vtv_worker_fixed_shifts', JSON.stringify(localFixedShifts));
        localStorage.setItem('vtv_worker_vacation_start', JSON.stringify(localVacStart));
        localStorage.setItem('vtv_worker_vacation_end', JSON.stringify(localVacEnd));
        localStorage.setItem('vtv_worker_manual_free_days', JSON.stringify(localManualFreeDays));

        mergedWorkers = fetchedWorkers.map(w => ({
          ...w,
          fixedShift: localFixedShifts[w.id] || w.fixedShift || 'pool',
          vacationStart: localVacStart[w.id] || w.vacationStart,
          vacationEnd: localVacEnd[w.id] || w.vacationEnd,
          manualFreeDaysAdjustment: localManualFreeDays[w.id] !== undefined ? localManualFreeDays[w.id] : (w.manualFreeDaysAdjustment || 0)
        }));
      } catch (err) {
        console.warn('Error applying localStorage fallback for workers:', err);
      }

      setDivisions(fetchedDivisions.length > 0 ? fetchedDivisions : DEFAULT_DIVISIONS);
      setWorkers(mergedWorkers);
      setAssignments(fetchedAssignments);
      setRequests(fetchedRequests);

      setDbStatus(supabaseConnectionStatus);
      setDbError(lastSupabaseError);
    } catch (e: any) {
      console.error('Error synchronizing database data:', e);
      addNotification('Error de Conexión', 'No se pudo sincronizar con la base de datos.', 'info');
      setDbStatus('error');
      setDbError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Silent data refresh for real-time background sync across workers
  const syncDataSilent = async () => {
    try {
      const fetchedTaskBoards = await db.fetchTaskBoards();
      const fetchedTaskCards = await db.fetchTaskCards();
      const fetchedTaskNotifs = await db.fetchTaskNotifications();
      const fetchedWorkers = await db.fetchWorkers();
      const fetchedAssignments = await db.fetchAssignments();
      const fetchedRequests = await db.fetchRequests();

      if (fetchedTaskBoards.length > 0) setTaskBoards(fetchedTaskBoards);
      setTaskCards(fetchedTaskCards);
      if (fetchedTaskNotifs.length > 0) setTaskNotifications(fetchedTaskNotifs);
      if (fetchedWorkers.length > 0) setWorkers(fetchedWorkers);
      if (fetchedAssignments.length > 0) setAssignments(fetchedAssignments);
      if (fetchedRequests.length > 0) setRequests(fetchedRequests);

      setDbStatus(supabaseConnectionStatus);
      setDbError(lastSupabaseError);
    } catch (e) {
      console.warn('Silent sync warning:', e);
    }
  };

  // Load data on mount and setup real-time background synchronization
  useEffect(() => {
    syncData();

    // Auto-polling interval (every 5 seconds) so all workers see task updates live
    const pollInterval = setInterval(() => {
      syncDataSilent();
    }, 5000);

    // Supabase Realtime channel subscription
    let channel: any = null;
    if (supabase) {
      try {
        channel = supabase.channel('vtv_realtime_channel')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'task_cards' }, () => {
            syncDataSilent();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'task_boards' }, () => {
            syncDataSilent();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_assignments' }, () => {
            syncDataSilent();
          })
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription error:', err);
      }
    }

    return () => {
      clearInterval(pollInterval);
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Task System Handlers
  const handleAddBoard = async (board: TaskBoard) => {
    const updated = [...taskBoards, board];
    setTaskBoards(updated);
    localStorage.setItem('vtv_task_boards', JSON.stringify(updated));
    try {
      await db.createTaskBoard(board);
      addNotification('Tablero Creado', `El tablero "${board.name}" se sincronizó con Supabase.`, 'success');
      setDbStatus(supabaseConnectionStatus);
      setDbError(lastSupabaseError);
    } catch (err: any) {
      console.error('Error creating board in Supabase:', err);
      addNotification('Error en Supabase', err.message || 'No se pudo guardar el tablero en Supabase.', 'info');
      setDbStatus('error');
      setDbError(err.message || 'Error guardando tablero en Supabase');
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    const updatedBoards = taskBoards.filter(b => b.id !== boardId);
    const updatedCards = taskCards.filter(c => c.boardId !== boardId);
    setTaskBoards(updatedBoards);
    setTaskCards(updatedCards);
    localStorage.setItem('vtv_task_boards', JSON.stringify(updatedBoards));
    localStorage.setItem('vtv_task_cards', JSON.stringify(updatedCards));
    try {
      await db.deleteTaskBoard(boardId);
      addNotification('Tablero Eliminado', 'Se eliminó el tablero correctamente.', 'success');
    } catch (err: any) {
      console.error('Error deleting board:', err);
      addNotification('Error en Supabase', err.message || 'Error al eliminar el tablero.', 'info');
    }
  };

  const handleSaveCard = async (card: TaskCard) => {
    const existingCard = taskCards.find(c => c.id === card.id);
    const oldAssignees = existingCard ? existingCard.assignedWorkerIds : [];
    const newlyAssigned = card.assignedWorkerIds.filter(id => !oldAssignees.includes(id));

    const existingIndex = taskCards.findIndex(c => c.id === card.id);
    let updatedCards: TaskCard[] = [];
    if (existingIndex >= 0) {
      updatedCards = taskCards.map(c => c.id === card.id ? card : c);
    } else {
      updatedCards = [card, ...taskCards];
    }

    setTaskCards(updatedCards);
    localStorage.setItem('vtv_task_cards', JSON.stringify(updatedCards));

    try {
      await db.upsertTaskCard(card);
      addNotification('Tarea Guardada', `La tarea "${card.title}" se guardó en la base de datos Supabase.`, 'success');
      setDbStatus(supabaseConnectionStatus);
      setDbError(lastSupabaseError);
    } catch (err: any) {
      console.error('Error upserting card in Supabase:', err);
      addNotification('Error de Base de Datos', err.message || 'No se pudo guardar la tarea en Supabase.', 'info');
      setDbStatus('error');
      setDbError(err.message || 'Error guardando tarea en Supabase');
    }

    // Notifications for newly assigned workers
    if (newlyAssigned.length > 0) {
      const boardObj = taskBoards.find(b => b.id === card.boardId);
      const boardName = boardObj ? boardObj.name : 'Tablero de Tareas';

      for (const workerId of newlyAssigned) {
        const notif: TaskNotification = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          workerId,
          taskId: card.id,
          taskTitle: card.title,
          boardName,
          message: `Se te ha asignado la tarea "${card.title}" en el tablero "${boardName}".`,
          createdAt: new Date().toISOString(),
          read: false
        };
        setTaskNotifications(prev => [notif, ...prev]);
        try {
          await db.createTaskNotification(notif);
        } catch (e) {
          console.warn('Error saving notif:', e);
        }
      }
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    const updatedCards = taskCards.filter(c => c.id !== cardId);
    setTaskCards(updatedCards);
    localStorage.setItem('vtv_task_cards', JSON.stringify(updatedCards));
    try {
      await db.deleteTaskCard(cardId);
      addNotification('Tarea Eliminada', 'La tarea se eliminó de Supabase.', 'success');
    } catch (err: any) {
      console.error('Error deleting card:', err);
      addNotification('Error en Supabase', err.message || 'No se pudo eliminar la tarea.', 'info');
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    const updated = taskNotifications.map(n => n.id === id ? { ...n, read: true } : n);
    setTaskNotifications(updated);
    localStorage.setItem('vtv_task_notifications', JSON.stringify(updated));
    await db.markTaskNotificationRead(id);
  };

  // Update selected division ID when session changes
  useEffect(() => {
    if (currentSession && currentSession.role === 'coordinator' && currentSession.divisionId) {
      setSelectedDivisionId(currentSession.divisionId);
    }
  }, [currentSession]);

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailStr = loginEmail.trim().toLowerCase();
    if (!emailStr) return;

    setLoading(true);
    try {
      // Fetch latest workers list
      const latestWorkers = await db.fetchWorkers();
      let workerFound = latestWorkers.find(w => w.email.toLowerCase() === emailStr);

      const isSuperEmail = emailStr === 'vtvgestiondiariarchaud@gmail.com';

      // Verify passwords
      if (isSuperEmail) {
        if (loginPassword !== 'Moonshade.1') {
          addNotification('Contraseña Incorrecta', 'La contraseña para el superusuario es inválida.', 'info');
          setLoading(false);
          return;
        }
      } else if (workerFound) {
        if (workerFound.password && workerFound.password !== loginPassword) {
          addNotification('Contraseña Incorrecta', 'La contraseña ingresada es incorrecta.', 'info');
          setLoading(false);
          return;
        }
      }

      // Auto-register SuperAdmin if they don't exist yet
      if (!workerFound && isSuperEmail) {
        const superAdmin: Worker = {
          id: 'sa_vtv_1',
          name: 'Fredd Rojas - Gerente',
          email: emailStr,
          cargo: 'Gerente del Dpto de Archivo Audiovisual',
          divisionId: 'div_archivo_prensa',
          role: 'superadmin',
          password: 'Moonshade.1'
        };
        await db.registerWorker(superAdmin);
        workerFound = superAdmin;
        await syncData();
      } else if (workerFound && isSuperEmail && (workerFound.name !== 'Fredd Rojas - Gerente' || workerFound.cargo !== 'Gerente del Dpto de Archivo Audiovisual')) {
        // Automatically enforce correct details on login
        workerFound.name = 'Fredd Rojas - Gerente';
        workerFound.cargo = 'Gerente del Dpto de Archivo Audiovisual';
        workerFound.divisionId = 'div_archivo_prensa';
        workerFound.password = 'Moonshade.1';
        await db.registerWorker(workerFound);
        await syncData();
      }

      if (workerFound) {
        const session = {
          userId: workerFound.id,
          name: workerFound.name,
          role: workerFound.role,
          divisionId: workerFound.divisionId,
          email: workerFound.email,
          cargo: workerFound.cargo
        };
        setCurrentSession(session);
        localStorage.setItem('vtv_real_session', JSON.stringify(session));
        addNotification('Sesión Iniciada', `Bienvenido(a) de vuelta, ${workerFound.name}.`, 'success');
        
        // Reset login password
        setLoginPassword('');
      } else {
        addNotification('Acceso Denegado', 'El correo no está registrado como personal de VTV. Regístrate primero.', 'info');
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Fallo al iniciar sesión.', 'info');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameStr = regName.trim();
    const emailStr = regEmail.trim().toLowerCase();
    const cargoStr = regCargo.trim();
    const cedulaStr = regCedula.trim();
    const passStr = regPassword;

    if (!nameStr || !emailStr || !cargoStr || !cedulaStr || !passStr) {
      addNotification('Campos vacíos', 'Por favor, llena todos los campos, incluyendo la contraseña y Cédula.', 'info');
      return;
    }

    setLoading(true);
    try {
      const isSuperEmail = emailStr === 'vtvgestiondiariarchaud@gmail.com';
      const selectedRole: UserRole = isSuperEmail ? 'superadmin' : regRole;

      const newWorker: Worker = {
        id: isSuperEmail ? 'sa_vtv_1' : `work_${Date.now()}`,
        name: isSuperEmail ? 'Fredd Rojas - Gerente' : nameStr,
        email: emailStr,
        cargo: isSuperEmail ? 'Gerente del Dpto de Archivo Audiovisual' : cargoStr,
        divisionId: isSuperEmail ? 'div_archivo_prensa' : regDivisionId,
        role: selectedRole,
        cedula: isSuperEmail ? 'V-12345678' : cedulaStr,
        password: isSuperEmail ? 'Moonshade.1' : passStr
      };

      await db.registerWorker(newWorker);
      addNotification('Registro Exitoso', `Cuenta creada como ${selectedRole === 'superadmin' ? 'Gerente del Dpto de Archivo Audiovisual' : cargoStr}.`, 'success');

      // If registered worker is coordinator, update division coordinator record automatically
      if (selectedRole === 'coordinator') {
        await db.updateDivisionCoordinator(regDivisionId, newWorker.id, nameStr);
      }

      await syncData();

      // Log in
      const session = {
        userId: newWorker.id,
        name: newWorker.name,
        role: newWorker.role,
        divisionId: newWorker.divisionId,
        email: newWorker.email,
        cargo: newWorker.cargo
      };
      setCurrentSession(session);
      localStorage.setItem('vtv_real_session', JSON.stringify(session));

      // Reset fields
      setRegName('');
      setRegEmail('');
      setRegCargo('');
      setRegCedula('');
      setRegPassword('');
    } catch (err) {
      console.error(err);
      addNotification('Error', 'No se pudo realizar el registro.', 'info');
    } finally {
      setLoading(false);
    }
  };

  const handleForceChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;

    const newPass = forceNewPassword.trim();
    const confPass = forceConfirmPassword.trim();

    if (newPass.length < 8) {
      addNotification('Contraseña muy corta', 'La nueva contraseña debe tener al menos 8 caracteres.', 'info');
      return;
    }

    if (newPass === '12345678') {
      addNotification('Contraseña no permitida', 'No puedes usar la contraseña provisional "12345678" como tu contraseña definitiva.', 'info');
      return;
    }

    if (newPass !== confPass) {
      addNotification('Contraseñas no coinciden', 'La nueva contraseña y su confirmación no coinciden.', 'info');
      return;
    }

    setLoading(true);
    try {
      const latestWorkers = await db.fetchWorkers();
      const currentWorker = latestWorkers.find(w => w.id === currentSession.userId);
      if (currentWorker) {
        currentWorker.password = newPass;
        currentWorker.mustChangePassword = false;
        await db.updateWorker(currentWorker);
        
        addNotification('Contraseña Actualizada', 'Tu contraseña ha sido actualizada correctamente. Ya puedes acceder al sistema.', 'success');
        setForceNewPassword('');
        setForceConfirmPassword('');
        await syncData();
      } else {
        addNotification('Error', 'No se encontró tu registro de usuario.', 'info');
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Fallo al actualizar la contraseña.', 'info');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    const cleanName = newUsername.trim();
    const cleanCedula = newCedula.trim();
    if (!cleanName) {
      addNotification('Nombre vacío', 'Por favor ingresa un nombre válido.', 'info');
      return;
    }

    setLoading(true);
    try {
      const latestWorkers = await db.fetchWorkers();
      const currentWorker = latestWorkers.find(w => w.id === currentSession.userId);
      if (currentWorker) {
        currentWorker.name = cleanName;
        currentWorker.cedula = cleanCedula;
        
        // Also update coordinatorName if they are coordinator of some division
        const updatedDivisions = divisions.map(d => {
          if (d.coordinatorId === currentWorker.id) {
            return { ...d, coordinatorName: cleanName };
          }
          return d;
        });

        await db.updateWorker(currentWorker);
        
        for (const d of updatedDivisions) {
          if (d.coordinatorId === currentWorker.id) {
            await db.updateDivision(d);
          }
        }

        // Update active session
        const updatedSession = { ...currentSession, name: cleanName };
        setCurrentSession(updatedSession);
        localStorage.setItem('vtv_real_session', JSON.stringify(updatedSession));
        
        addNotification('Perfil Actualizado', 'Tu nombre y cédula han sido modificados con éxito.', 'success');
        setIsEditingUsername(false);
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'No se pudo actualizar el perfil.', 'info');
    } finally {
      setLoading(false);
      await syncData();
    }
  };

  const handleLogout = () => {
    setCurrentSession(null);
    localStorage.removeItem('vtv_real_session');
    addNotification('Sesión Finalizada', 'Has cerrado tu sesión de forma segura.', 'info');
  };

  // Sync wrappers to pass to child components
  const handleUpdateAssignments = async (updated: ShiftAssignment[], divisionId?: string, date?: string) => {
    setAssignments(updated);
    try {
      if (divisionId && date) {
        // Clear existing assignments for this division and date to avoid duplicates / stale items
        await db.deleteAssignmentsForDivisionAndDate(divisionId, date);
        
        // ONLY upsert the assignments that are actually for this division and date
        // to avoid mass network traffic and slow performance/failures
        const toUpsert = updated.filter(a => a.divisionId === divisionId && a.date === date);
        for (const asg of toUpsert) {
          await db.upsertAssignment(asg);
        }
      } else {
        // Fallback (unlikely)
        for (const asg of updated) {
          await db.upsertAssignment(asg);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateRequests = async (updated: ShiftChangeRequest[]) => {
    setRequests(updated);
    try {
      for (const req of updated) {
        const exists = requests.find(r => r.id === req.id);
        if (!exists) {
          await db.createRequest(req);
        } else if (exists.status !== req.status) {
          await db.updateRequestStatus(req.id, req.status);
        }
      }
    } catch (e) {
      console.error(e);
    }
    await syncData();
  };

  const handleUpdateWorkers = async (updated: Worker[]) => {
    setWorkers(updated);

    // Save preestablished fixed shifts, vacations, and manual adjustments to local storage fallback
    try {
      const localFixedShiftsRaw = localStorage.getItem('vtv_worker_fixed_shifts');
      const localFixedShifts = localFixedShiftsRaw ? JSON.parse(localFixedShiftsRaw) : {};

      const localVacStartRaw = localStorage.getItem('vtv_worker_vacation_start');
      const localVacStart = localVacStartRaw ? JSON.parse(localVacStartRaw) : {};

      const localVacEndRaw = localStorage.getItem('vtv_worker_vacation_end');
      const localVacEnd = localVacEndRaw ? JSON.parse(localVacEndRaw) : {};

      const localManualFreeDaysRaw = localStorage.getItem('vtv_worker_manual_free_days');
      const localManualFreeDays = localManualFreeDaysRaw ? JSON.parse(localManualFreeDaysRaw) : {};

      updated.forEach(w => {
        if (w.fixedShift) {
          localFixedShifts[w.id] = w.fixedShift;
        }
        if (w.vacationStart) {
          localVacStart[w.id] = w.vacationStart;
        } else {
          delete localVacStart[w.id];
        }
        if (w.vacationEnd) {
          localVacEnd[w.id] = w.vacationEnd;
        } else {
          delete localVacEnd[w.id];
        }
        if (w.manualFreeDaysAdjustment !== undefined) {
          localManualFreeDays[w.id] = w.manualFreeDaysAdjustment;
        }
      });
      localStorage.setItem('vtv_worker_fixed_shifts', JSON.stringify(localFixedShifts));
      localStorage.setItem('vtv_worker_vacation_start', JSON.stringify(localVacStart));
      localStorage.setItem('vtv_worker_vacation_end', JSON.stringify(localVacEnd));
      localStorage.setItem('vtv_worker_manual_free_days', JSON.stringify(localManualFreeDays));
    } catch (err) {
      console.warn('Error saving worker fixed shifts, vacations, and free days to local storage fallback:', err);
    }

    try {
      for (const w of updated) {
        const old = workers.find(o => o.id === w.id);
        if (old) {
          if (
            old.role !== w.role || 
            old.divisionId !== w.divisionId || 
            old.name !== w.name ||
            old.password !== w.password ||
            old.mustChangePassword !== w.mustChangePassword ||
            old.fixedShift !== w.fixedShift ||
            old.cargo !== w.cargo ||
            old.cedula !== w.cedula ||
            old.vacationStart !== w.vacationStart ||
            old.vacationEnd !== w.vacationEnd ||
            old.manualFreeDaysAdjustment !== w.manualFreeDaysAdjustment
          ) {
            await db.updateWorker(w);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    await syncData();
  };

  const handleUpdateDivisions = async (updated: Division[]) => {
    setDivisions(updated);
    try {
      for (const d of updated) {
        const exists = divisions.find(div => div.id === d.id);
        if (!exists) {
          await db.createDivision(d);
        } else if (exists.coordinatorId !== d.coordinatorId || exists.name !== d.name || exists.description !== d.description) {
          await db.updateDivision(d);
        }
      }
      for (const d of divisions) {
        const exists = updated.find(div => div.id === d.id);
        if (!exists) {
          await db.deleteDivision(d.id);
        }
      }
    } catch (e: any) {
      console.error(e);
      addNotification(
        'Error de Base de Datos',
        e?.message || 'No se pudo actualizar la estructura de divisiones en Supabase.',
        'info'
      );
    }
    await syncData();
  };

  const currentUserObj = currentSession ? workers.find(w => w.id === currentSession.userId) : null;
  const isPasswordChangeRequired = currentUserObj?.mustChangePassword === true;

  return (
    <div className="min-h-screen text-slate-100 font-sans relative overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-300">
      
      {/* Frosted Glass Liquid background */}
      <div className="liquid-bg" />

      {/* NO SESSION LOGGED IN - RENDER AUTHENTICATION PLATFORM */}
      {!currentSession ? (
        <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md p-6 glass border-white/15 rounded-3xl shadow-2xl relative overflow-hidden space-y-6"
          >
            {/* Header VTV */}
            <div className="text-center space-y-3">
              <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-600 items-center justify-center shadow-lg shadow-cyan-500/20">
                <Tv className="text-white animate-pulse" size={28} strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-white tracking-tight">VTV GUARDIA</h1>
                <p className="text-xs text-slate-400">Sistema Automatizado de Control de Guardia y Raciones de Comedor</p>
              </div>
            </div>

            {/* Cloud Status */}
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-slate-900/60 rounded-xl border border-white/5 font-mono text-[10px] uppercase font-bold text-center w-full">
                <span className={`w-2 h-2 rounded-full ${
                  dbStatus === 'connected' ? 'bg-cyan-400 animate-pulse' :
                  dbStatus === 'error' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'
                }`} />
                {dbStatus === 'connected' ? (
                  <span className="text-cyan-400">Canal Seguro Supabase Cloud Activo</span>
                ) : dbStatus === 'error' ? (
                  <span className="text-amber-400">Error de Conexión (Supabase con Error o Tablas faltantes)</span>
                ) : (
                  <span className="text-slate-400">Supabase Desconectado / Sin Configurar</span>
                )}
              </div>
              
              {dbStatus === 'error' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-[11px] text-slate-300 w-full text-center leading-normal">
                  <span className="text-amber-400 font-bold block mb-1">⚠️ Error en la Base de Datos Supabase</span>
                  Ocurrió un error de sincronización. Contacta al Administrador/Gerente para verificar la conexión.
                </div>
              )}
            </div>

            {/* Tabs Selector */}
            <div className="flex gap-2 p-1 bg-slate-950/80 border border-white/5 rounded-xl">
              <button
                onClick={() => setAuthTab('login')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  authTab === 'login' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound size={13} />
                <span>Iniciar Sesión</span>
              </button>
              <button
                onClick={() => setAuthTab('register')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  authTab === 'register' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus size={13} />
                <span>Registrar Personal</span>
              </button>
            </div>

            {/* Form */}
            {authTab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Correo Electrónico:</label>
                  <input
                    type="email"
                    required
                    placeholder="ej: nombre.apellido@vtv.gob.ve"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-500 leading-normal">
                    * Si eres el Gerente del Dpto de Archivo Audiovisual, ingresa tu correo <strong>vtvgestiondiariarchaud@gmail.com</strong> para auto-inicializar la cuenta como SuperAdmin.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Contraseña:</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : 'Entrar al Sistema'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Nombre Completo:</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Carlos Mendoza"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Correo Electrónico:</label>
                  <input
                    type="email"
                    required
                    placeholder="ej: carlos.m@vtv.gob.ve"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Cargo / Puesto de Trabajo:</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Editor de Guardia Principal"
                    value={regCargo}
                    onChange={(e) => setRegCargo(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Cédula de Identidad:</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: V-12345678"
                    value={regCedula}
                    onChange={(e) => setRegCedula(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Contraseña:</label>
                  <input
                    type="password"
                    required
                    placeholder="Crea una contraseña segura"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400">División:</label>
                    <div className="relative">
                      <select
                        value={regDivisionId}
                        onChange={(e) => setRegDivisionId(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all appearance-none cursor-pointer"
                      >
                        {divisions.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Tipo de Acceso:</label>
                    <div className="relative">
                      <select
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value as any)}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="worker">Trabajador</option>
                        <option value="coordinator">Coordinador / Jefe</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : 'Registrarse e Ingresar'}
                </button>
              </form>
            )}

            {/* Instruction footnote */}
            <div className="pt-2 border-t border-white/5 text-[10px] text-slate-400 text-center leading-relaxed">
              Venezolana de Televisión • Canal de Integridad de Guardias
            </div>
          </motion.div>
        </div>
      ) : isPasswordChangeRequired ? (
        /* FORCE PASSWORD CHANGE FORM */
        <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-6 glass border-white/15 rounded-3xl shadow-2xl relative overflow-hidden space-y-6"
          >
            <div className="text-center space-y-3">
              <div className="inline-flex w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 items-center justify-center shadow-lg">
                <KeyRound className="text-amber-400" size={24} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white tracking-tight">Cambio de Contraseña Requerido</h2>
                <p className="text-xs text-slate-400">Tu contraseña ha sido restablecida por un administrador. Debes cambiarla para poder continuar.</p>
              </div>
            </div>

            <form onSubmit={handleForceChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Nueva Contraseña:</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  value={forceNewPassword}
                  onChange={(e) => setForceNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400">Confirmar Nueva Contraseña:</label>
                <input
                  type="password"
                  required
                  placeholder="Repite la contraseña"
                  value={forceConfirmPassword}
                  onChange={(e) => setForceConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all placeholder:text-slate-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Actualizar Contraseña'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentSession(null);
                  localStorage.removeItem('vtv_real_session');
                }}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-medium transition-all cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </form>
          </motion.div>
        </div>
      ) : (
        /* CORE APPLICATION LAYOUT */
        <div className="relative z-10">
          
          {/* Header & Logo */}
          <header className="border-b border-white/5 bg-slate-950/40 glass sticky top-0 z-40 px-4 py-3">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Logo & Title */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                  <Tv className="text-white" size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold tracking-wider text-white text-base">VTV</span>
                    <span className="h-4 w-px bg-white/20" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400 font-mono">Control de Guardia</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Venezolana de Televisión • Gerencia de Archivo Audiovisual</p>
                </div>
              </div>

              {/* User Session Profile & Logout */}
              <div className="flex items-center gap-3.5 bg-slate-900/60 p-2 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 px-1">
                  <UserCircle size={16} className="text-cyan-400 shrink-0" />
                  {isEditingUsername ? (
                    <form onSubmit={handleChangeUsername} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="bg-slate-950 border border-cyan-500/30 rounded px-2 py-0.5 text-[11px] text-white focus:outline-none w-28 font-sans font-medium"
                        placeholder="Nuevo nombre..."
                        title="Nombre"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={newCedula}
                        onChange={(e) => setNewCedula(e.target.value)}
                        className="bg-slate-950 border border-cyan-500/30 rounded px-2 py-0.5 text-[11px] text-white focus:outline-none w-20 font-mono text-[10px]"
                        placeholder="Cédula..."
                        title="Cédula"
                      />
                      <button
                        type="submit"
                        className="p-1 bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/30 rounded cursor-pointer transition-all shrink-0"
                        title="Guardar cambios"
                      >
                        <Check size={10} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingUsername(false)}
                        className="p-1 bg-white/5 hover:bg-white/10 text-slate-400 rounded cursor-pointer transition-all shrink-0"
                        title="Cancelar"
                      >
                        <X size={10} strokeWidth={2.5} />
                      </button>
                    </form>
                  ) : (
                    <div className="text-left">
                      <div className="text-[11px] font-bold text-white leading-tight flex items-center gap-1.5">
                        <span
                          className="cursor-pointer hover:text-cyan-300 transition-all"
                          onClick={() => {
                            const wFound = workers.find(w => w.id === currentSession.userId);
                            setNewUsername(currentSession.name);
                            setNewCedula(wFound?.cedula || '');
                            setIsEditingUsername(true);
                          }}
                          title="Click para editar perfil"
                        >
                          {currentSession.name}
                        </span>
                        <button
                          onClick={() => {
                            const wFound = workers.find(w => w.id === currentSession.userId);
                            setNewUsername(currentSession.name);
                            setNewCedula(wFound?.cedula || '');
                            setIsEditingUsername(true);
                          }}
                          className="p-0.5 text-slate-400 hover:text-cyan-300 rounded hover:bg-white/5 transition-all cursor-pointer shrink-0"
                          title="Cambiar nombre y cédula de usuario"
                        >
                          <Edit2 size={9} />
                        </button>
                      </div>
                      <div className="text-[9px] text-slate-400 uppercase font-mono mt-0.5">
                        {currentSession.role === 'superadmin' ? 'Gerente (SuperAdmin)' : currentSession.cargo}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-xl transition-all cursor-pointer"
                  title="Cerrar Sesión"
                >
                  <LogOut size={14} />
                </button>
              </div>

            </div>
          </header>

          {/* Main Container */}
          <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

            {/* Global Welcome Banner & Division Filter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Welcome Info */}
              <div className="md:col-span-2 p-5 glass flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider font-mono">Panel de Control Activo</span>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Hola, {currentSession.name.split(' ')[0]}
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {currentSession.role === 'superadmin' && 'Tienes acceso completo para orquestar la logística de guardia diaria y administrar divisiones.'}
                    {currentSession.role === 'coordinator' && `Coordinas los turnos de la división: ${divisions.find(d => d.id === currentSession.divisionId)?.name || 'Tu división'}.`}
                    {currentSession.role === 'worker' && 'Visualiza tus asignaciones de comedor y solicita intercambios de guardia.'}
                  </p>
                </div>
                
                <div className="hidden sm:block text-right">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase">Fecha de Operación</span>
                  <span className="text-sm font-extrabold text-cyan-400 font-sans mt-1 block">{formattedSelectedDate}</span>
                </div>
              </div>

              {/* Quick Division Selector */}
              <div className="p-4 glass flex flex-col justify-center gap-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                  Filtrar Tablero por División:
                </label>
                
                {currentSession.role === 'coordinator' && currentSession.divisionId ? (
                  <div className="p-2.5 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-xs text-cyan-300 font-semibold truncate font-mono">
                    {divisions.find(d => d.id === selectedDivisionId)?.name} (Mi División)
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedDivisionId}
                      onChange={(e) => setSelectedDivisionId(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="todos">Todas las Divisiones</option>
                      {divisions.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>

            </div>

            {/* Unified Date Navigation Panel */}
            {['tablero', 'comedor', 'reportes'].includes(activeTab) && (() => {
              const { label, dayName, formattedDateDisplay } = getRelativeDateDetails(selectedDateStr);
              const nextStr = getNextDateStr(selectedDateStr);
              const nextDayExists = operationalDates.includes(nextStr);

              const handlePrevDay = () => {
                const prevStr = getPrevDateStr(selectedDateStr);
                if (!operationalDates.includes(prevStr)) {
                  handleAddOperationalDate(prevStr);
                } else {
                  setSelectedDateStr(prevStr);
                }
              };

              const handleNextDay = () => {
                setSelectedDateStr(nextStr);
              };

              const handleCreateNextDay = () => {
                handleAddOperationalDate(nextStr);
              };

              return (
                <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 rounded-2xl border border-white/10 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Left side: Relative date and calendar date */}
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/25">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block font-mono">
                        {label}
                      </span>
                      <h3 className="text-base font-bold text-white flex items-center gap-1.5 leading-none mt-0.5">
                        <span>{dayName}</span>
                        <span className="text-slate-400 text-xs font-normal">({formattedDateDisplay})</span>
                      </h3>
                    </div>
                  </div>

                  {/* Center / Right side: navigation arrows & + */}
                  <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-3 bg-white/5 p-1 rounded-xl border border-white/10">
                    {/* Left button: always previous day */}
                    <button
                      onClick={handlePrevDay}
                      className="p-2.5 sm:p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                      title="Día Anterior"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    <span className="text-xs font-bold text-slate-200 select-none px-2 font-mono">
                      {selectedDateStr}
                    </span>

                    {/* Right button: right arrow or + */}
                    {nextDayExists ? (
                      <button
                        onClick={handleNextDay}
                        className="p-2.5 sm:p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                        title="Día Siguiente"
                      >
                        <ChevronRight size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={handleCreateNextDay}
                        className="px-4 py-2 sm:px-3 sm:py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
                        title="Habilitar Día Siguiente"
                      >
                        <Plus size={14} />
                        <span>Habilitar Siguiente</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Navigation Tabs - Glassmorphic Toolbar */}
            <div className="flex overflow-x-auto gap-2 p-1.5 glass rounded-2xl">
              <button
                onClick={() => setActiveTab('tareas')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'tareas' 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.3)]' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Kanban size={14} className={activeTab === 'tareas' ? 'text-cyan-400' : 'text-slate-400'} />
                <span>Gestión de Tareas</span>
                {taskNotifications.filter(n => !n.read && n.workerId === currentSession?.userId).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('tablero')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'tablero' 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Layers size={14} className={activeTab === 'tablero' ? 'text-cyan-400' : 'text-slate-400'} />
                <span>Tableros Diarios</span>
              </button>

              <button
                onClick={() => setActiveTab('comedor')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'comedor' 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Utensils size={14} className={activeTab === 'comedor' ? 'text-violet-400' : 'text-slate-400'} />
                <span>Logística Comedor</span>
              </button>

              <button
                onClick={() => setActiveTab('reportes')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'reportes' 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <FileText size={14} className={activeTab === 'reportes' ? 'text-cyan-400' : 'text-slate-400'} />
                <span>Generador Reportes</span>
              </button>

              <button
                onClick={() => setActiveTab('solicitudes')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'solicitudes' 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Calendar size={14} className={activeTab === 'solicitudes' ? 'text-indigo-400' : 'text-slate-400'} />
                <span>Permisos e Intercambios</span>
                {requests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('vacaciones')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'vacaciones' 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Umbrella size={14} className={activeTab === 'vacaciones' ? 'text-cyan-400' : 'text-slate-400'} />
                <span>Vacaciones y Días Libres</span>
              </button>

              {/* SuperAdmin Exclusivity Tab */}
              {currentSession.role === 'superadmin' && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'admin' 
                      ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Shield size={14} className={activeTab === 'admin' ? 'text-sky-400' : 'text-slate-400'} />
                  <span>Consola Gerencial</span>
                </button>
              )}
            </div>

            {/* RLS policy violation / schema error warning banner */}
            {dbStatus === 'error' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-300 leading-relaxed mb-4"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="text-amber-400 font-bold block mb-0.5">⚠️ Sincronización en la Nube Pausada por Políticas RLS en Supabase</span>
                    La conexión con la URL de tu Supabase es correcta, pero el servidor rechazó guardar la información debido a políticas de seguridad activas en tus tablas (Row-Level Security).
                    <span className="text-white font-medium block mt-1">La aplicación ha cambiado al Almacenamiento Local de forma automática para que puedas interactuar y registrar todo al 100% sin perder datos.</span>
                  </div>
                </div>
                {currentSession?.role === 'superadmin' && (
                  <button
                    onClick={() => setShowBlueprintModal(true)}
                    className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl font-bold transition-all whitespace-nowrap shrink-0 self-stretch md:self-auto text-center cursor-pointer"
                  >
                    Ver Solución SQL 🛠️
                  </button>
                )}
              </motion.div>
            )}

            {/* Core Tab Render Switcher */}
            <div className="min-h-[500px]">
              {loading ? (
                <div className="min-h-[400px] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={36} className="text-cyan-400 animate-spin" />
                    <p className="text-xs text-slate-400">Sincronizando base de datos...</p>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'tareas' && (
                      <TaskManager
                        boards={taskBoards}
                        cards={taskCards}
                        notifications={taskNotifications}
                        workers={sortedWorkers}
                        divisions={divisions}
                        currentSession={currentSession}
                        onAddBoard={handleAddBoard}
                        onDeleteBoard={handleDeleteBoard}
                        onSaveCard={handleSaveCard}
                        onDeleteCard={handleDeleteCard}
                        onMarkNotificationRead={handleMarkNotificationRead}
                        onAddNotificationToast={addNotification}
                      />
                    )}

                    {activeTab === 'tablero' && (
                      <TrelloBoard
                        currentDivisionId={selectedDivisionId}
                        divisions={divisions}
                        workers={sortedWorkers}
                        assignments={assignments}
                        onUpdateAssignments={handleUpdateAssignments}
                        userRole={currentSession.role}
                        userDivisionId={currentSession.divisionId}
                        onAddNotification={addNotification}
                        selectedDateStr={selectedDateStr}
                        setSelectedDateStr={setSelectedDateStr}
                        operationalDates={operationalDates}
                        onAddOperationalDate={handleAddOperationalDate}
                      />
                    )}

                    {activeTab === 'comedor' && (
                      <ComedorLogistics
                        divisions={divisions}
                        workers={sortedWorkers}
                        assignments={assignments}
                        selectedDateStr={selectedDateStr}
                        setSelectedDateStr={setSelectedDateStr}
                        operationalDates={operationalDates}
                        onAddOperationalDate={handleAddOperationalDate}
                        mealsPreferences={mealsPreferences}
                        onUpdateMealsPreference={handleUpdateMealsPreference}
                      />
                    )}

                    {activeTab === 'reportes' && (
                      <ReportGenerator
                        divisions={divisions}
                        workers={sortedWorkers}
                        assignments={assignments}
                        onAddNotification={addNotification}
                        selectedDateStr={selectedDateStr}
                        setSelectedDateStr={setSelectedDateStr}
                        operationalDates={operationalDates}
                        onAddOperationalDate={handleAddOperationalDate}
                      />
                    )}

                    {activeTab === 'solicitudes' && (
                      <ShiftChanges
                        workers={sortedWorkers}
                        divisions={divisions}
                        assignments={assignments}
                        requests={requests}
                        userRole={currentSession.role}
                        userDivisionId={currentSession.divisionId}
                        currentUserId={currentSession.userId}
                        onUpdateRequests={handleUpdateRequests}
                        onUpdateAssignments={handleUpdateAssignments}
                        onAddNotification={addNotification}
                      />
                    )}

                    {activeTab === 'vacaciones' && (
                      <VacationControl
                        divisions={divisions}
                        workers={sortedWorkers}
                        assignments={assignments}
                        onUpdateWorkers={handleUpdateWorkers}
                        userRole={currentSession.role}
                        userDivisionId={currentSession.divisionId}
                        onUpdateAssignments={handleUpdateAssignments}
                        onAddNotification={addNotification}
                      />
                    )}

                    {activeTab === 'admin' && currentSession.role === 'superadmin' && (
                      <AdminPanel
                        divisions={divisions}
                        workers={sortedWorkers}
                        onUpdateDivisions={handleUpdateDivisions}
                        onUpdateWorkers={handleUpdateWorkers}
                        onAddNotification={addNotification}
                        onOpenBlueprint={() => setShowBlueprintModal(true)}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

          </main>

        </div>
      )}

      {/* Blueprint Modal Overlay */}
      <AnimatePresence>
        {showBlueprintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBlueprintModal(false)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(34,211,238,0.15)] space-y-6"
            >
              <DatabaseSchema onClose={() => setShowBlueprintModal(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Liquid-Style Notifications Center */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="p-4 bg-slate-950/95 border border-cyan-500/20 shadow-xl rounded-2xl flex items-start gap-3 pointer-events-auto backdrop-blur-lg"
            >
              {notif.type === 'success' ? (
                <CheckCircle2 size={18} className="text-cyan-400 shrink-0 mt-0.5" />
              ) : (
                <Info size={18} className="text-violet-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <h5 className="font-bold text-xs text-white leading-tight">{notif.title}</h5>
                <p className="text-[11px] text-slate-300 leading-normal">{notif.desc}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
