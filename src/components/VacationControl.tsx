import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Umbrella, Award, Clock, ArrowRight, Search, 
  Plus, Trash2, CheckCircle2, AlertTriangle, HelpCircle, 
  CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Sparkles, User, Info, Check,
  ChevronDown, ChevronUp, Send, X, UserCheck, CheckCircle, XCircle, Hourglass, ShieldAlert,
  BarChart3, Layers, Minus, RotateCcw, Lock
} from 'lucide-react';
import { Division, Worker, ShiftAssignment, FreeDayRequest, UserRole } from '../types';
import { db } from '../supabaseClient';

interface VacationControlProps {
  divisions: Division[];
  workers: Worker[];
  assignments: ShiftAssignment[];
  onUpdateWorkers: (updated: Worker[]) => void;
  userRole: string;
  userDivisionId?: string;
  currentSession?: {
    userId: string;
    name: string;
    role: UserRole;
    divisionId?: string;
    email: string;
    cargo: string;
  } | null;
  freeDayRequests?: FreeDayRequest[];
  onUpdateFreeDayRequests?: (reqs: FreeDayRequest[]) => void;
  onUpdateAssignments?: (updated: ShiftAssignment[], divisionId?: string, date?: string) => void;
  onAddNotification?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

// Venezuelan national and VTV local holidays
export const VENEZUELAN_HOLIDAYS = [
  '01-01', // Año Nuevo
  '05-01', // Día del Trabajador
  '06-24', // Batalla de Carabobo
  '07-05', // Día de la Independencia
  '07-24', // Natalicio de Simón Bolívar
  '10-12', // Día de la Resistencia Indígena
  '12-24', // Nochebuena
  '12-25', // Navidad
  '12-31', // Fin de Año
];

export function isHoliday(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const mmDd = `${parts[1]}-${parts[2]}`;
  return VENEZUELAN_HOLIDAYS.includes(mmDd);
}

export function isWeekend(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr + 'T12:00:00');
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

interface FreeDayEvent {
  earnedDate: string;
  type: 'weekend' | 'holiday';
  status: 'active' | 'used' | 'expired';
  usedOnDate?: string;
  expirationDateStr: string;
}

// Compute the free days balance dynamically from actual calendar assignments
export function computeWorkerFreeDays(
  worker: Worker, 
  allAssignments: ShiftAssignment[]
): {
  earnedCount: number;
  usedCount: number;
  expiredCount: number;
  activeCount: number;
  events: FreeDayEvent[];
  libreDates: string[];
} {
  const workerAssignments = allAssignments.filter(asg => asg.workerId === worker.id);
  
  const earnedEvents: { date: string; type: 'weekend' | 'holiday' }[] = [];
  const libreDates: string[] = [];

  // Sort assignments chronologically
  const sortedAsgs = [...workerAssignments].sort((a, b) => a.date.localeCompare(b.date));

  sortedAsgs.forEach(asg => {
    if (asg.shiftType === 'libre') {
      libreDates.push(asg.date);
    } else {
      const isWk = isWeekend(asg.date);
      const isHol = isHoliday(asg.date);
      if (isWk || isHol) {
        earnedEvents.push({
          date: asg.date,
          type: isHol ? 'holiday' : 'weekend'
        });
      }
    }
  });

  const events: FreeDayEvent[] = earnedEvents.map(ev => {
    const earnedDate = new Date(ev.date + 'T12:00:00');
    // Expiration date is earnedDate + 8 days
    const expirationDate = new Date(earnedDate.getTime());
    expirationDate.setDate(expirationDate.getDate() + 8);
    const expirationStr = expirationDate.toISOString().split('T')[0];

    return {
      earnedDate: ev.date,
      type: ev.type,
      status: 'active' as const,
      usedOnDate: undefined,
      expirationDateStr: expirationStr
    };
  });

  // Track consumed libres
  const consumedLibres = new Set<string>();

  events.forEach(ev => {
    const earnedTime = new Date(ev.earnedDate + 'T12:00:00').getTime();

    // Find first matching 'libre' date on or after the earned date
    const matchingLibre = libreDates.find(lDate => {
      if (consumedLibres.has(lDate)) return false;
      const lTime = new Date(lDate + 'T12:00:00').getTime();
      return lTime >= earnedTime;
    });

    if (matchingLibre) {
      consumedLibres.add(matchingLibre);
      ev.status = 'used';
      ev.usedOnDate = matchingLibre;
    } else {
      ev.status = 'active';
    }
  });

  const manualAdj = worker.manualFreeDaysAdjustment || 0;
  const earnedCount = events.length + manualAdj;
  const usedCount = events.filter(e => e.status === 'used').length;
  const expiredCount = events.filter(e => e.status === 'expired').length;
  const activeCount = Math.max(0, events.filter(e => e.status === 'active').length + manualAdj);

  return {
    earnedCount,
    usedCount,
    expiredCount,
    activeCount,
    events,
    libreDates
  };
}

function VacationControl({
  divisions,
  workers,
  assignments,
  onUpdateWorkers,
  userRole,
  userDivisionId,
  currentSession,
  freeDayRequests = [],
  onUpdateFreeDayRequests,
  onUpdateAssignments,
  onAddNotification
}: VacationControlProps) {
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'vacations' | 'freedays'>('calendar');
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for manual free days adjustment and date scheduling per worker
  const [tempAdjustment, setTempAdjustment] = useState<Record<string, number>>({});
  const [scheduleDate, setScheduleDate] = useState<Record<string, string>>({});
  const [selectedCalendarDayModal, setSelectedCalendarDayModal] = useState<string | null>(null);
  
  // Year/Month state for the vacation calendar
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(6); // July (0-indexed is 6)

  // Selected worker ID for adding vacation
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');

  // Basic worker request form state
  const [workerRequestDate, setWorkerRequestDate] = useState('');
  const [workerRequestReason, setWorkerRequestReason] = useState('');
  
  // Expanded worker details for free days
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);

  // Role helpers
  const isCoordinatorOrAbove = userRole === 'superadmin' || userRole === 'deputy' || userRole === 'coordinator';
  const isGerenciaOrDeputy = userRole === 'superadmin' || userRole === 'deputy';
  const isCoordinator = userRole === 'coordinator';
  const isBasicWorker = userRole === 'worker';

  // Constants
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Get total days in the current selected month
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  // Calendar dates list
  const calendarDates = useMemo(() => {
    const dates = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
      
      const dateObj = new Date(currentYear, currentMonth, d);
      const dayOfWeekNum = dateObj.getDay();
      const daysOfWeekStr = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      
      dates.push({
        dayNum: d,
        dateStr,
        dayOfWeekStr: daysOfWeekStr[dayOfWeekNum],
        isWeekend: dayOfWeekNum === 0 || dayOfWeekNum === 6,
        isHoliday: isHoliday(dateStr)
      });
    }
    return dates;
  }, [currentYear, currentMonth, daysInMonth]);

  // Current basic worker logged in
  const currentWorkerObj = useMemo(() => {
    if (!currentSession?.userId) return workers.find(w => w.role === 'worker') || workers[0];
    return workers.find(w => w.id === currentSession.userId) || workers[0];
  }, [workers, currentSession]);

  // Workers list filtered by search and role
  const filteredWorkers = useMemo(() => {
    let list = workers;
    if (isBasicWorker && currentWorkerObj) {
      list = [currentWorkerObj];
    }
    const q = searchTerm.toLowerCase().trim();
    return list.filter(w => 
      w.name.toLowerCase().includes(q) || 
      (w.cargo && w.cargo.toLowerCase().includes(q)) ||
      divisions.find(d => d.id === w.divisionId)?.name.toLowerCase().includes(q)
    );
  }, [workers, divisions, searchTerm, isBasicWorker, currentWorkerObj]);

  // Pending free day requests for coordinators and jefes
  const pendingRequests = useMemo(() => {
    let reqs = freeDayRequests.filter(r => r.status === 'pending');
    if ((userRole === 'coordinator' || userRole === 'deputy') && userDivisionId) {
      reqs = reqs.filter(r => r.divisionId === userDivisionId);
    }
    return reqs;
  }, [freeDayRequests, userRole, userDivisionId]);

  // Active vacations this month for the mobile view
  const activeVacationsThisMonth = useMemo(() => {
    return filteredWorkers.filter(w => {
      if (!w.vacationStart || !w.vacationEnd) return false;
      const monthStartStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const lastDayOfM = new Date(currentYear, currentMonth + 1, 0).getDate();
      const monthEndStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayOfM).padStart(2, '0')}`;
      return w.vacationStart <= monthEndStr && w.vacationEnd >= monthStartStr;
    });
  }, [filteredWorkers, currentYear, currentMonth]);

  // Handlers for vacation assignment
  const handleAssignVacation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId || !vacStart || !vacEnd) return;

    if (vacStart > vacEnd) {
      if (onAddNotification) {
        onAddNotification('Error de fechas', 'La fecha de inicio no puede ser posterior a la fecha de fin.', 'error');
      }
      return;
    }

    const updatedWorkers = workers.map(w => {
      if (w.id === selectedWorkerId) {
        return {
          ...w,
          vacationStart: vacStart,
          vacationEnd: vacEnd
        };
      }
      return w;
    });

    onUpdateWorkers(updatedWorkers);
    setSelectedWorkerId('');
    setVacStart('');
    setVacEnd('');

    if (onAddNotification) {
      onAddNotification('Vacaciones Asignadas', 'Se registraron las fechas de vacaciones exitosamente.', 'success');
    }
  };

  const handleRemoveVacation = (workerId: string) => {
    const updatedWorkers = workers.map(w => {
      if (w.id === workerId) {
        return {
          ...w,
          vacationStart: undefined,
          vacationEnd: undefined
        };
      }
      return w;
    });
    onUpdateWorkers(updatedWorkers);
  };

  const handleSaveAdjustment = (workerId: string, value: number) => {
    // Check self-modification restriction for coordinators
    if (isCoordinator && currentSession?.userId === workerId) {
      if (onAddNotification) {
        onAddNotification(
          'Acción no permitida',
          'Los coordinadores no pueden modificar su propio saldo de días libres.',
          'error'
        );
      }
      return;
    }

    const updatedWorkers = workers.map(w => {
      if (w.id === workerId) {
        return {
          ...w,
          manualFreeDaysAdjustment: value
        };
      }
      return w;
    });
    onUpdateWorkers(updatedWorkers);
    if (onAddNotification) {
      onAddNotification(
        'Ajuste de Días Libres', 
        'Se ha actualizado el balance de días libres para el empleado de forma exitosa.', 
        'success'
      );
    }
  };

  const handleAddFreeDays = (worker: Worker, delta: number) => {
    if (isCoordinator && currentSession?.userId === worker.id) {
      if (onAddNotification) {
        onAddNotification(
          'Acción no permitida',
          'Los coordinadores no pueden modificar su propio saldo de días libres.',
          'error'
        );
      }
      return;
    }
    const currentManual = worker.manualFreeDaysAdjustment || 0;
    handleSaveAdjustment(worker.id, currentManual + delta);
  };

  const handleClearFreeDays = (worker: Worker) => {
    if (isCoordinator && currentSession?.userId === worker.id) {
      if (onAddNotification) {
        onAddNotification(
          'Acción no permitida',
          'Los coordinadores no pueden modificar su propio saldo de días libres.',
          'error'
        );
      }
      return;
    }
    const balance = computeWorkerFreeDays(worker, assignments);
    const baseActive = balance.events.filter(e => e.status === 'active').length;
    handleSaveAdjustment(worker.id, -baseActive);
  };

  const handleScheduleLibre = (workerId: string, dateStr: string) => {
    if (!dateStr) return;
    const workerObj = workers.find(w => w.id === workerId);
    if (!workerObj) return;

    // Check if they are on vacation on this date
    if (workerObj.vacationStart && workerObj.vacationEnd && 
        dateStr >= workerObj.vacationStart && dateStr <= workerObj.vacationEnd) {
      if (onAddNotification) {
        onAddNotification(
          'Error al programar', 
          'No se puede programar un día libre durante el período vacacional del empleado.', 
          'error'
        );
      }
      return;
    }

    const updated = [...assignments];
    const existingIndex = updated.findIndex(a => a.workerId === workerId && a.date === dateStr);
    
    const newAsg: ShiftAssignment = {
      id: `as_${workerId}_libre_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      workerId,
      divisionId: workerObj.divisionId,
      date: dateStr,
      shiftType: 'libre'
    };

    if (existingIndex > -1) {
      updated[existingIndex] = newAsg;
    } else {
      updated.push(newAsg);
    }

    if (onUpdateAssignments) {
      onUpdateAssignments(updated);
      setExpandedWorkerId(null);
      if (onAddNotification) {
        onAddNotification(
          'Día Libre Programado', 
          `Se ha programado un día libre para el ${dateStr} con éxito.`, 
          'success'
        );
      }
    }
  };

  const handleDeleteLibre = (assignmentId: string) => {
    if (onUpdateAssignments) {
      onUpdateAssignments(assignments.filter(a => a.id !== assignmentId));
      if (onAddNotification) {
        onAddNotification(
          'Día Libre Cancelado', 
          'Se ha cancelado la programación del día libre correctamente.', 
          'success'
        );
      }
    }
  };

  // Handlers for Basic Worker Request Creation
  const handleCreateWorkerFreeDayRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerRequestDate) return;
    if (!currentWorkerObj) return;

    // Calculate free days balance for this worker
    const balance = computeWorkerFreeDays(currentWorkerObj, assignments);
    if (balance.activeCount <= 0) {
      if (onAddNotification) {
        onAddNotification(
          'Sin Días Disponibles',
          'No cuentas con días libres disponibles acumulados en tu balance para realizar esta solicitud.',
          'error'
        );
      }
      return;
    }

    // Check if date falls in vacation
    if (currentWorkerObj.vacationStart && currentWorkerObj.vacationEnd &&
        workerRequestDate >= currentWorkerObj.vacationStart && workerRequestDate <= currentWorkerObj.vacationEnd) {
      if (onAddNotification) {
        onAddNotification(
          'Fecha en Vacaciones',
          'No puedes solicitar un día libre dentro de tu período vacacional asignado.',
          'error'
        );
      }
      return;
    }

    // Check if request already exists
    const existingReq = freeDayRequests.find(r => 
      r.workerId === currentWorkerObj.id && 
      r.requestedDate === workerRequestDate && 
      (r.status === 'pending' || r.status === 'approved')
    );

    if (existingReq) {
      if (onAddNotification) {
        onAddNotification(
          'Solicitud Existente',
          `Ya posees una solicitud (${existingReq.status === 'pending' ? 'pendiente' : 'aprobada'}) para la fecha ${workerRequestDate}.`,
          'info'
        );
      }
      return;
    }

    const newReq: FreeDayRequest = {
      id: `fdr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      workerId: currentWorkerObj.id,
      workerName: currentWorkerObj.name,
      divisionId: currentWorkerObj.divisionId,
      requestedDate: workerRequestDate,
      reason: workerRequestReason.trim() || undefined,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      await db.createFreeDayRequest(newReq);
    } catch (err) {
      console.error('Error in createFreeDayRequest:', err);
    }

    if (onUpdateFreeDayRequests) {
      onUpdateFreeDayRequests([newReq, ...freeDayRequests]);
    }

    setWorkerRequestDate('');
    setWorkerRequestReason('');

    if (onAddNotification) {
      onAddNotification(
        'Solicitud Enviada',
        `Se registró tu solicitud de día libre para el ${newReq.requestedDate}. Tu coordinador la evaluará.`,
        'success'
      );
    }
  };

  const handleCancelWorkerRequest = async (requestId: string) => {
    try {
      await db.deleteFreeDayRequest(requestId);
    } catch (err) {
      console.error('Error deleting request:', err);
    }

    if (onUpdateFreeDayRequests) {
      onUpdateFreeDayRequests(freeDayRequests.filter(r => r.id !== requestId));
    }

    if (onAddNotification) {
      onAddNotification('Solicitud Cancelada', 'Se ha eliminado tu solicitud pendiente.', 'info');
    }
  };

  // Handlers for Coordinator Request Approval / Rejection
  const handleApproveFreeDayRequest = async (req: FreeDayRequest) => {
    const reviewerId = currentSession?.userId || 'coord';
    const reviewerName = currentSession?.name || 'Coordinación';

    try {
      await db.updateFreeDayRequestStatus(req.id, 'approved', reviewerId, reviewerName);
    } catch (err) {
      console.error('Error approving request:', err);
    }

    const updatedReqs = freeDayRequests.map(r => r.id === req.id ? {
      ...r,
      status: 'approved' as const,
      reviewedByWorkerId: reviewerId,
      reviewedByName: reviewerName,
      reviewedAt: new Date().toISOString()
    } : r);

    if (onUpdateFreeDayRequests) {
      onUpdateFreeDayRequests(updatedReqs);
    }

    // Automatically schedule the 'libre' shift
    handleScheduleLibre(req.workerId, req.requestedDate);

    if (onAddNotification) {
      onAddNotification(
        'Solicitud Aprobada y Guardada',
        `Se ha confirmado y asignado el día libre a ${req.workerName} para la fecha ${req.requestedDate}.`,
        'success'
      );
    }
  };

  const handleRejectFreeDayRequest = async (req: FreeDayRequest) => {
    const reviewerId = currentSession?.userId || 'coord';
    const reviewerName = currentSession?.name || 'Coordinación';

    try {
      await db.updateFreeDayRequestStatus(req.id, 'rejected', reviewerId, reviewerName);
    } catch (err) {
      console.error('Error rejecting request:', err);
    }

    const updatedReqs = freeDayRequests.map(r => r.id === req.id ? {
      ...r,
      status: 'rejected' as const,
      reviewedByWorkerId: reviewerId,
      reviewedByName: reviewerName,
      reviewedAt: new Date().toISOString()
    } : r);

    if (onUpdateFreeDayRequests) {
      onUpdateFreeDayRequests(updatedReqs);
    }

    if (onAddNotification) {
      onAddNotification(
        'Solicitud Rechazada',
        `Se ha rechazado la solicitud de día libre de ${req.workerName} para el ${req.requestedDate}.`,
        'info'
      );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Intro Header */}
      <div className="p-6 glass rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/10 shadow-xl">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Umbrella className="text-cyan-400" size={22} />
            Control de Vacaciones y Días Libres
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
            {isBasicWorker ? (
              <span>Consulta tus vacaciones programadas, visualiza tu saldo de días libres acumulados por guardias de fin de semana o feriados y solicita tus fechas libres.</span>
            ) : (
              <span>Gestiona los períodos vacacionales de la plantilla, aprueba o confirma las solicitudes de días libres y monitorea las guardias y balances acumulados.</span>
            )}
          </p>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex bg-slate-950/60 p-1 border border-white/5 rounded-xl self-start md:self-auto gap-1">
          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'calendar'
                ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar size={13} />
            <span>Calendario General</span>
          </button>
          <button
            onClick={() => setActiveSubTab('vacations')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'vacations'
                ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Umbrella size={13} />
            <span>Vacaciones</span>
          </button>
          <button
            onClick={() => setActiveSubTab('freedays')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
              activeSubTab === 'freedays'
                ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award size={13} />
            <span>Días Libres</span>
            {isCoordinatorOrAbove && pendingRequests.length > 0 && (
              <span className="w-4 h-4 bg-amber-500 text-slate-950 rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* RENDER SUB-TAB 0: GENERAL CALENDAR (FIRST VIEW VISIBLE) */}
      {activeSubTab === 'calendar' && (
        <div className="space-y-6">
          {/* Controls & Legend Bar */}
          <div className="p-5 glass rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarDays className="text-cyan-400" size={20} />
                Calendario de Asistencia: Días Libres y Vacaciones
              </h4>
              <p className="text-xs text-slate-300">
                Visualiza de forma clara quién se encuentra de vacaciones o disfrutando de su día libre en cada fecha. Haz clic en cualquier día para ver el detalle.
              </p>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center gap-3 bg-slate-950/80 p-1.5 border border-white/10 rounded-xl self-start md:self-auto shadow-inner">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-black text-white min-w-[130px] text-center font-mono">
                {months[currentMonth]} {currentYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Quick Legend Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900/60 border border-white/5 rounded-xl text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-purple-500/30 border border-purple-500/50 flex items-center justify-center text-[9px]">
                  ☂️
                </span>
                <span className="text-slate-300 font-medium">De Vacaciones</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-emerald-500/30 border border-emerald-500/50 flex items-center justify-center text-[9px]">
                  🟢
                </span>
                <span className="text-slate-300 font-medium">Día Libre</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-amber-500/20 border border-amber-500/30"></span>
                <span className="text-slate-400">Fin de Semana</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              Total personal registrado: <strong className="text-white">{filteredWorkers.length}</strong>
            </div>
          </div>

          {/* Monthly Calendar Grid */}
          <div className="p-4 bg-slate-900/90 border border-white/10 rounded-2xl shadow-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
              {calendarDates.map((item) => {
                // Workers on vacation on this date
                const vacationWorkers = filteredWorkers.filter(w => 
                  w.vacationStart && w.vacationEnd && 
                  item.dateStr >= w.vacationStart && item.dateStr <= w.vacationEnd
                );

                // Workers on free day (libre) on this date
                const libreWorkerIds = assignments
                  .filter(a => a.date === item.dateStr && a.shiftType === 'libre')
                  .map(a => a.workerId);
                
                const libreWorkers = filteredWorkers.filter(w => libreWorkerIds.includes(w.id));

                const totalAbsent = vacationWorkers.length + libreWorkers.length;

                return (
                  <div
                    key={item.dateStr}
                    onClick={() => setSelectedCalendarDayModal(item.dateStr)}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[120px] cursor-pointer group hover:scale-[1.01] ${
                      item.isWeekend || item.isHoliday
                        ? 'bg-slate-900/90 border-amber-500/20 hover:border-amber-400/50'
                        : 'bg-slate-950/60 border-white/5 hover:border-white/20'
                    }`}
                  >
                    {/* Date Header */}
                    <div className="flex items-center justify-between w-full pb-1.5 border-b border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm font-black text-white">{item.dayNum}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{item.dayOfWeekStr}</span>
                      </div>
                      {totalAbsent > 0 && (
                        <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded text-[9px] font-black font-mono">
                          {totalAbsent} ausente{totalAbsent > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Content List */}
                    <div className="space-y-1 my-1.5 flex-1 max-h-[140px] overflow-y-auto pr-0.5">
                      {/* Vacations */}
                      {vacationWorkers.map(w => (
                        <div 
                          key={`vac_${w.id}`}
                          className="px-2 py-1 bg-purple-950/70 border border-purple-500/30 rounded-lg text-[10px] text-purple-200 font-medium flex items-center justify-between gap-1 truncate"
                          title={`${w.name} - Vacaciones`}
                        >
                          <span className="truncate flex items-center gap-1">
                            <Umbrella size={10} className="text-purple-400 shrink-0" />
                            <span className="truncate">{w.name}</span>
                          </span>
                          <span className="text-[8px] bg-purple-500/30 px-1 rounded text-purple-300 font-mono shrink-0">VAC</span>
                        </div>
                      ))}

                      {/* Free Days */}
                      {libreWorkers.map(w => (
                        <div 
                          key={`lib_${w.id}`}
                          className="px-2 py-1 bg-emerald-950/70 border border-emerald-500/30 rounded-lg text-[10px] text-emerald-200 font-medium flex items-center justify-between gap-1 truncate"
                          title={`${w.name} - Día Libre`}
                        >
                          <span className="truncate flex items-center gap-1">
                            <CheckCircle size={10} className="text-emerald-400 shrink-0" />
                            <span className="truncate">{w.name}</span>
                          </span>
                          <span className="text-[8px] bg-emerald-500/30 px-1 rounded text-emerald-300 font-mono shrink-0">LIBRE</span>
                        </div>
                      ))}

                      {totalAbsent === 0 && (
                        <div className="text-[9px] text-slate-600 italic py-2 text-center">
                          Todo el personal activo
                        </div>
                      )}
                    </div>

                    {/* Bottom Hint */}
                    <div className="text-[8px] text-slate-500 group-hover:text-cyan-400 transition-colors pt-1 border-t border-white/5 flex items-center justify-between">
                      <span>Ver detalles</span>
                      <span>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Day Details Modal */}
      {selectedCalendarDayModal && (() => {
        const dateStr = selectedCalendarDayModal;
        const dateObj = new Date(dateStr + 'T12:00:00');
        const formattedDate = dateObj.toLocaleDateString('es-ES', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });

        const vacWorkers = workers.filter(w => 
          w.vacationStart && w.vacationEnd && 
          dateStr >= w.vacationStart && dateStr <= w.vacationEnd
        );

        const libAsgs = assignments.filter(a => a.date === dateStr && a.shiftType === 'libre');
        const libWorkers = libAsgs.map(a => workers.find(w => w.id === a.workerId)).filter(Boolean) as Worker[];

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in relative">
              <button 
                onClick={() => setSelectedCalendarDayModal(null)}
                className="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white capitalize flex items-center gap-2">
                  <Calendar className="text-cyan-400" size={18} />
                  {formattedDate}
                </h3>
                <p className="text-xs text-slate-400">
                  Resumen de personal en vacaciones y días libres para esta fecha.
                </p>
              </div>

              {/* Vacaciones Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Umbrella size={14} />
                  Personal de Vacaciones ({vacWorkers.length})
                </h4>
                {vacWorkers.length === 0 ? (
                  <div className="text-slate-500 text-xs italic p-3 bg-slate-950/50 rounded-xl border border-white/5">
                    Ningún trabajador se encuentra de vacaciones en esta fecha.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {vacWorkers.map(w => {
                      const divName = divisions.find(d => d.id === w.divisionId)?.name || 'Sin división';
                      return (
                        <div key={w.id} className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-white">{w.name}</div>
                            <div className="text-[10px] text-purple-300">{w.cargo} • {divName}</div>
                          </div>
                          <span className="text-[9px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 font-mono">
                            {w.vacationStart} al {w.vacationEnd}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Días Libres Section */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle size={14} />
                  Personal con Día Libre ({libWorkers.length})
                </h4>
                {libWorkers.length === 0 ? (
                  <div className="text-slate-500 text-xs italic p-3 bg-slate-950/50 rounded-xl border border-white/5">
                    No hay trabajadores con día libre programado para esta fecha.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {libWorkers.map(w => {
                      const divName = divisions.find(d => d.id === w.divisionId)?.name || 'Sin división';
                      return (
                        <div key={w.id} className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-white">{w.name}</div>
                            <div className="text-[10px] text-emerald-300">{w.cargo} • {divName}</div>
                          </div>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                            LIBRE
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedCalendarDayModal(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* RENDER SUB-TAB 1: VACATIONS CALENDAR */}
      {activeSubTab === 'vacations' && (
        <div className="space-y-6">
          {/* Vacation Assigning Form (Superadmin & Coordinator only) */}
          {isCoordinatorOrAbove && (
            <div className="p-5 glass rounded-2xl border border-white/10 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus size={16} className="text-cyan-400" />
                Asignar Período Vacacional
              </h4>
              <form onSubmit={handleAssignVacation} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Trabajador</label>
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    required
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Selecciona un empleado...</option>
                    {workers.map(w => {
                      const divName = divisions.find(d => d.id === w.divisionId)?.name || 'Sin división';
                      return (
                        <option key={w.id} value={w.id}>{w.name} ({divName})</option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Inicio de Vacaciones</label>
                  <input
                    type="date"
                    value={vacStart}
                    onChange={(e) => setVacStart(e.target.value)}
                    required
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Fin de Vacaciones</label>
                  <input
                    type="date"
                    value={vacEnd}
                    onChange={(e) => setVacEnd(e.target.value)}
                    required
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 h-[36px] cursor-pointer"
                >
                  <Umbrella size={14} />
                  <span>Cargar Vacaciones</span>
                </button>
              </form>
            </div>
          )}

          {/* Basic User Vacation Notice Card */}
          {isBasicWorker && currentWorkerObj && (
            <div className="p-5 bg-gradient-to-r from-cyan-950/40 via-indigo-950/40 to-slate-900/60 border border-cyan-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                  <Umbrella size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Estado de tus Vacaciones Anuales</h4>
                  <p className="text-xs text-slate-300">
                    {currentWorkerObj.vacationStart && currentWorkerObj.vacationEnd ? (
                      <span>Tu período de descanso está asignado del <strong className="text-cyan-300">{currentWorkerObj.vacationStart}</strong> al <strong className="text-cyan-300">{currentWorkerObj.vacationEnd}</strong>.</span>
                    ) : (
                      <span>Aún no posees un período de vacaciones asignado para este ciclo laboral.</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search bar & calendar month switcher */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            {isCoordinatorOrAbove && (
              <div className="relative max-w-sm w-full">
                <input
                  type="text"
                  placeholder="Buscar por nombre, cargo o división..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all font-sans"
                />
                <Search size={14} className="absolute left-3 top-3 text-slate-500" />
              </div>
            )}

            {/* Calendar Switcher */}
            <div className="flex items-center gap-3 bg-slate-950/60 p-1 border border-white/5 rounded-xl self-start md:self-auto">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-white min-w-[120px] text-center">
                {months[currentMonth]} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Visual Vacation Gantt / Timeline Matrix */}
          <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Calendar size={14} className="text-cyan-400" />
                Matriz Visual de Vacaciones ({months[currentMonth]} {currentYear})
              </span>
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-cyan-500 rounded-sm"></span> Vacaciones Asignadas
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-amber-500/40 rounded-sm"></span> Fin de Semana
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[9px] text-slate-400 uppercase font-mono">
                    <th className="py-2 px-3 sticky left-0 bg-slate-900 z-10 min-w-[180px]">Trabajador</th>
                    {calendarDates.map((cd, idx) => (
                      <th 
                        key={idx} 
                        className={`py-1.5 px-1 text-center min-w-[28px] ${
                          cd.isWeekend ? 'bg-amber-500/10 text-amber-300' : ''
                        } ${cd.isHoliday ? 'bg-red-500/10 text-red-300 font-bold' : ''}`}
                      >
                        <div>{cd.dayOfWeekStr}</div>
                        <div className="font-bold">{cd.dayNum}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {filteredWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={calendarDates.length + 1} className="text-center py-6 text-slate-500 text-xs">
                        No hay personal registrado en este período.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkers.map(w => {
                      const divName = divisions.find(d => d.id === w.divisionId)?.name || 'Sin división';
                      const hasVacation = Boolean(w.vacationStart && w.vacationEnd);

                      return (
                        <tr key={w.id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 sticky left-0 bg-slate-900 z-10 border-r border-white/5">
                            <div className="font-bold text-white text-xs truncate max-w-[170px]">{w.name}</div>
                            <div className="text-[9px] text-slate-400 truncate max-w-[170px]">{w.cargo} • {divName}</div>
                            {isCoordinatorOrAbove && hasVacation && (
                              <button
                                onClick={() => handleRemoveVacation(w.id)}
                                className="text-[9px] text-red-400 hover:text-red-300 underline mt-0.5 inline-block cursor-pointer"
                              >
                                Quitar Vacaciones
                              </button>
                            )}
                          </td>

                          {calendarDates.map((cd, idx) => {
                            const isVacationDay = hasVacation && 
                              w.vacationStart! <= cd.dateStr && 
                              w.vacationEnd! >= cd.dateStr;

                            return (
                              <td 
                                key={idx} 
                                className={`p-0.5 text-center align-middle border-r border-white/5 ${
                                  cd.isWeekend ? 'bg-amber-500/5' : ''
                                }`}
                              >
                                {isVacationDay ? (
                                  <div className="w-full h-7 bg-gradient-to-r from-cyan-500 to-indigo-600 rounded-sm flex items-center justify-center text-white shadow-sm" title={`Vacaciones: ${w.vacationStart} a ${w.vacationEnd}`}>
                                    <Umbrella size={10} />
                                  </div>
                                ) : (
                                  <div className="w-full h-7"></div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RENDER SUB-TAB 2: FREE DAYS & APPROVALS */}
      {activeSubTab === 'freedays' && (
        <div className="space-y-6">
          {/* SECTION FOR BASIC WORKERS */}
          {isBasicWorker && currentWorkerObj && (() => {
            const balance = computeWorkerFreeDays(currentWorkerObj, assignments);
            const myRequests = freeDayRequests.filter(r => r.workerId === currentWorkerObj.id);

            return (
              <div className="space-y-6">
                {/* 1. Worker Overview & Balance Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center">
                      <Award size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Guardias de FDS / Feriados</div>
                      <div className="text-lg font-black text-white">{balance.earnedCount} días</div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Días Libres Disfrutados</div>
                      <div className="text-lg font-black text-emerald-400">{balance.usedCount} días</div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/30 text-cyan-200 border border-cyan-400/50 flex items-center justify-center">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Días Disponibles</div>
                      <div className="text-lg font-black text-cyan-300">{balance.activeCount} libres</div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                      <Clock size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Solicitudes Pendientes</div>
                      <div className="text-lg font-black text-amber-300">
                        {myRequests.filter(r => r.status === 'pending').length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Interactive Calendar & Request Form */}
                <div className="p-6 glass rounded-2xl border border-white/10 space-y-5 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Calendar size={18} className="text-cyan-400" />
                      Calendario Interactivo - Selecciona tu Día Libre
                    </h4>
                    <span className="text-xs px-2.5 py-1 bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold rounded-lg self-start sm:self-auto">
                      {balance.activeCount} {balance.activeCount === 1 ? 'día disponible' : 'días disponibles'}
                    </span>
                  </div>

                  {/* Interactive Month Grid */}
                  <div className="p-4 bg-slate-950/80 border border-white/10 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{months[currentMonth]} {currentYear}</span>
                        <span className="text-[10px] text-slate-400 font-normal">(Haz clic en un día para seleccionarlo)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg border border-white/5 transition-all cursor-pointer"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg border border-white/5 transition-all cursor-pointer"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {calendarDates.map((item) => {
                        const isSelected = workerRequestDate === item.dateStr;
                        const isVacation = currentWorkerObj.vacationStart && currentWorkerObj.vacationEnd &&
                          item.dateStr >= currentWorkerObj.vacationStart && item.dateStr <= currentWorkerObj.vacationEnd;
                        const isLibreApproved = assignments.some(a => a.workerId === currentWorkerObj.id && a.date === item.dateStr && a.shiftType === 'libre');
                        const pendingReq = myRequests.find(r => r.requestedDate === item.dateStr && r.status === 'pending');

                        return (
                          <button
                            key={item.dateStr}
                            type="button"
                            disabled={Boolean(isVacation || isLibreApproved || pendingReq)}
                            onClick={() => setWorkerRequestDate(item.dateStr)}
                            className={`p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between h-20 ${
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.25)] text-white scale-[1.02]'
                                : isVacation
                                ? 'bg-purple-950/30 border-purple-500/20 text-purple-300 opacity-60 cursor-not-allowed'
                                : isLibreApproved
                                ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-300 opacity-80 cursor-not-allowed'
                                : pendingReq
                                ? 'bg-amber-950/30 border-amber-500/20 text-amber-300 opacity-80 cursor-not-allowed'
                                : item.isWeekend || item.isHoliday
                                ? 'bg-slate-900/90 border-cyan-500/20 hover:border-cyan-400/50 text-slate-200 cursor-pointer'
                                : 'bg-slate-900/50 border-white/5 hover:border-white/20 text-slate-300 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-mono text-xs font-bold">{item.dayNum}</span>
                              <span className="text-[9px] uppercase font-semibold text-slate-400">{item.dayOfWeekStr}</span>
                            </div>

                            <div className="text-[8px] font-bold">
                              {isVacation && <span className="text-purple-400 block">Vacaciones</span>}
                              {isLibreApproved && <span className="text-emerald-400 block">Libre Aprobado</span>}
                              {pendingReq && <span className="text-amber-400 block">Solicitado</span>}
                              {!isVacation && !isLibreApproved && !pendingReq && isSelected && (
                                <span className="text-cyan-300 block">✓ Seleccionado</span>
                              )}
                              {!isVacation && !isLibreApproved && !pendingReq && !isSelected && (item.isWeekend || item.isHoliday) && (
                                <span className="text-slate-400 block">Guardia FDS</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {balance.activeCount <= 0 ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 text-amber-200 text-xs">
                      <AlertTriangle size={18} className="shrink-0 text-amber-400" />
                      <span>No posees días libres disponibles acumulados en tu balance. Debes haber laborado guardias en fin de semana o feriados para generar días compensatorios.</span>
                    </div>
                  ) : (
                    <form onSubmit={handleCreateWorkerFreeDayRequest} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Fecha Seleccionada</label>
                        <input
                          type="date"
                          value={workerRequestDate}
                          onChange={(e) => setWorkerRequestDate(e.target.value)}
                          required
                          className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Motivo / Observación (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Ej: Trámite personal, descanso compensatorio..."
                          value={workerRequestReason}
                          onChange={(e) => setWorkerRequestReason(e.target.value)}
                          className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!workerRequestDate}
                        className={`w-full text-white text-xs font-bold py-2 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 h-[36px] cursor-pointer ${
                          workerRequestDate
                            ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Send size={14} />
                        <span>Enviar Solicitud</span>
                      </button>
                    </form>
                  )}
                </div>

                {/* 3. My Submitted Requests List */}
                <div className="p-5 glass rounded-2xl border border-white/10 space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock size={16} className="text-cyan-400" />
                    Historial de Mis Solicitudes de Días Libres
                  </h4>

                  {myRequests.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs italic">
                      No has realizado ninguna solicitud de día libre aún.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myRequests.map(req => (
                        <div key={req.id} className="p-4 bg-slate-900/60 border border-white/5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-sm">{req.requestedDate}</span>
                              {req.reason && <span className="text-xs text-slate-400">— {req.reason}</span>}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Enviada el {new Date(req.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            {req.status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1">
                                  <Hourglass size={12} className="animate-spin" />
                                  Pendiente de Confirmación
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCancelWorkerRequest(req.id)}
                                  className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all cursor-pointer text-xs"
                                  title="Cancelar solicitud"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}

                            {req.status === 'approved' && (
                              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1">
                                <CheckCircle size={12} />
                                Aprobado por {req.reviewedByName || 'Coordinación'}
                              </span>
                            )}

                            {req.status === 'rejected' && (
                              <span className="px-2.5 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-xs font-bold flex items-center gap-1">
                                <XCircle size={12} />
                                Rechazado
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* SECTION FOR COORDINATORS & RANGOS SUPERIORES */}
          {isCoordinatorOrAbove && (
            <div className="space-y-6">
              {/* 1. Pending Approvals Box */}
              <div className="p-6 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldAlert size={18} className="text-amber-400" />
                    Solicitudes de Días Libres Pendientes de Confirmación
                  </h4>
                  <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black rounded-full">
                    {pendingRequests.length} por revisar
                  </span>
                </div>

                {pendingRequests.length === 0 ? (
                  <div className="text-slate-400 text-xs py-4 text-center italic">
                    No hay solicitudes pendientes de confirmación en este momento.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingRequests.map(req => {
                      const reqWorker = workers.find(w => w.id === req.workerId);
                      const divName = divisions.find(d => d.id === req.divisionId)?.name || 'Sin división';
                      const workerBalance = reqWorker ? computeWorkerFreeDays(reqWorker, assignments) : null;

                      return (
                        <div key={req.id} className="p-4 bg-slate-950/80 border border-white/10 rounded-xl space-y-3 relative">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-white text-sm">{req.workerName}</div>
                              <div className="text-[10px] text-slate-400">{reqWorker?.cargo || 'Empleado'} • {divName}</div>
                            </div>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md">
                              Fecha: {req.requestedDate}
                            </span>
                          </div>

                          {req.reason && (
                            <div className="text-xs text-slate-300 bg-white/5 p-2 rounded-lg border border-white/5">
                              <strong className="text-slate-400 text-[10px] uppercase block">Motivo:</strong>
                              {req.reason}
                            </div>
                          )}

                          {workerBalance && (
                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                              <span>Saldo disponible: <strong className="text-cyan-300">{workerBalance.activeCount} días</strong></span>
                              <span>•</span>
                              <span>Usados: <strong className="text-emerald-400">{workerBalance.usedCount}</strong></span>
                            </div>
                          )}

                          <div className="flex gap-2 pt-2 border-t border-white/5">
                            <button
                              type="button"
                              onClick={() => handleApproveFreeDayRequest(req)}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md"
                            >
                              <Check size={14} />
                              <span>Aprobar y Asignar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectFreeDayRequest(req)}
                              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border border-red-500/30"
                            >
                              <X size={14} />
                              <span>Rechazar</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Rules Regulations Box */}
              <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl flex items-start gap-3">
                <Info size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-sm">Reglamento de Días Libres Compensatorios de Guardia (VTV)</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Cada vez que un trabajador realice una guardia de <strong>fin de semana (sábado/domingo)</strong> o en un <strong>día feriado</strong>, acumula automáticamente <strong>1 Día Libre</strong> compensatorio.
                  </p>
                  <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-1">
                    <li>Al confirmar la solicitud de un trabajador, el sistema le asigna un turno de tipo "Libre" en la fecha programada.</li>
                    <li>Esta asignación descuenta automáticamente 1 día de su balance disponible y actualiza la gráfica de días libres.</li>
                  </ul>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative max-w-sm w-full">
                <input
                  type="text"
                  placeholder="Buscar por empleado o cargo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all font-sans"
                />
                <Search size={14} className="absolute left-3 top-3 text-slate-500" />
              </div>

              {/* 3. Full Workers Table for Management */}
              <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3 px-4">Empleado / Cargo</th>
                        <th className="py-3 px-4">Guardias Trabajadas (FDS/Feriado)</th>
                        <th className="py-3 px-4 text-emerald-400">Días Libres Usados</th>
                        <th className="py-3 px-4 text-red-400">Días Expirados</th>
                        <th className="py-3 px-4 text-cyan-400 font-bold">Balance Disponible</th>
                        <th className="py-3 px-4 text-right">Detalle & Gestión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {filteredWorkers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-500 text-xs">
                            No se encontraron empleados.
                          </td>
                        </tr>
                      ) : (
                        filteredWorkers.map(w => {
                          const divName = divisions.find(d => d.id === w.divisionId)?.name || 'Sin división';
                          const balance = computeWorkerFreeDays(w, assignments);
                          const isExpanded = expandedWorkerId === w.id;
                          const canCoordinate = userRole === 'superadmin' || userRole === 'deputy' || (userRole === 'coordinator' && userDivisionId === w.divisionId);

                          return (
                            <React.Fragment key={w.id}>
                              <tr 
                                onClick={() => setExpandedWorkerId(isExpanded ? null : w.id)}
                                className={`hover:bg-white/[0.04] transition-colors cursor-pointer select-none ${isExpanded ? 'bg-white/[0.03]' : ''}`}
                              >
                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-white">{w.name}</div>
                                  <div className="text-[10px] text-slate-400">{w.cargo} • {divName}</div>
                                </td>
                                <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                                  {balance.earnedCount} {balance.earnedCount === 1 ? 'día' : 'días'}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-emerald-400">
                                  {balance.usedCount}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-slate-500">
                                  {balance.expiredCount}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className={`px-2 py-0.5 font-mono font-extrabold rounded-lg text-xs ${
                                    balance.activeCount > 0 
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                                      : 'bg-white/5 text-slate-400'
                                  }`}>
                                    {balance.activeCount} {balance.activeCount === 1 ? 'disponible' : 'disponibles'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedWorkerId(isExpanded ? null : w.id);
                                    }}
                                    className="px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg font-bold text-[10px] transition-all cursor-pointer inline-flex items-center gap-1"
                                  >
                                    {isExpanded ? 'Ocultar' : 'Ver Detalles'}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded detail section */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={6} className="bg-slate-950/40 p-4 border-l-2 border-cyan-500">
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-3"
                                      >
                                        <div className="flex justify-between items-center">
                                          <h5 className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                                            <Clock size={12} className="text-cyan-400" />
                                            Registro Histórico de Guardias de Fin de Semana, Feriados y Días Libres
                                          </h5>
                                          <span className="text-[9px] text-slate-500 font-mono">ID Empleado: {w.id}</span>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                          {/* Left Columns - logs & info */}
                                          <div className={`${canCoordinate ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3`}>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                              {/* Earned free days log */}
                                              <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
                                                <div className="text-[10px] font-bold text-white flex items-center gap-1.5 mb-1">
                                                  <Award size={12} className="text-cyan-400" />
                                                  Días Libres Acumulados por Guardia
                                                </div>
                                                {balance.events.length === 0 ? (
                                                  <div className="text-slate-500 text-[11px] italic py-4 text-center">
                                                    No se registran guardias en fines de semana o feriados.
                                                  </div>
                                                ) : (
                                                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                                    {balance.events.map((ev, idx) => {
                                                      const earnedDateObj = new Date(ev.earnedDate + 'T12:00:00');
                                                      const formattedDate = earnedDateObj.toLocaleDateString('es-ES', { 
                                                        weekday: 'short', month: 'short', day: 'numeric' 
                                                      });

                                                      return (
                                                        <div key={idx} className="p-2 bg-slate-900/60 border border-white/5 rounded-lg flex items-center justify-between text-[11px]">
                                                          <div>
                                                            <span className="font-bold text-white block capitalize">{formattedDate}</span>
                                                            <span className="text-[9px] text-slate-400">
                                                              {ev.type === 'holiday' ? '⚠️ Feriado' : '⚡ Fin de Semana'}
                                                            </span>
                                                          </div>
                                                          
                                                          <div className="text-right">
                                                            {ev.status === 'used' && (
                                                              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold text-[9px]">
                                                                Disfrutado {ev.usedOnDate}
                                                              </span>
                                                            )}

                                                            {ev.status === 'active' && (
                                                              <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded font-bold text-[9px]">
                                                                Disponible
                                                              </span>
                                                            )}
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>

                                              {/* Scheduled free days log */}
                                              <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
                                                <div className="text-[10px] font-bold text-white flex items-center gap-1.5 mb-1">
                                                  <CalendarDays size={12} className="text-emerald-400" />
                                                  Días Libres Programados / Tomados
                                                </div>
                                                {balance.libreDates.length === 0 ? (
                                                  <div className="text-slate-500 text-[11px] italic py-4 text-center">
                                                    No hay días libres asignados en el calendario.
                                                  </div>
                                                ) : (
                                                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                                    {balance.libreDates.map((dStr, idx) => {
                                                      const asgObj = assignments.find(a => a.workerId === w.id && a.date === dStr && a.shiftType === 'libre');
                                                      const dObj = new Date(dStr + 'T12:00:00');
                                                      const formatted = dObj.toLocaleDateString('es-ES', { 
                                                        weekday: 'short', month: 'short', day: 'numeric' 
                                                      });

                                                      return (
                                                        <div key={idx} className="p-2 bg-slate-900/60 border border-white/5 rounded-lg flex items-center justify-between text-[11px]">
                                                          <div>
                                                            <span className="font-bold text-white block capitalize">{formatted}</span>
                                                            <span className="text-[9px] text-slate-500 font-mono">{dStr}</span>
                                                          </div>
                                                          {canCoordinate && asgObj && (
                                                            <button
                                                              type="button"
                                                              onClick={() => handleDeleteLibre(asgObj.id)}
                                                              className="text-red-400 hover:text-red-300 p-1 hover:bg-white/5 rounded transition-all cursor-pointer"
                                                              title="Eliminar día libre"
                                                            >
                                                              <Trash2 size={12} />
                                                            </button>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Right Column - Coordinator manual adjustment & schedule */}
                                          {canCoordinate && (
                                            <div className="lg:col-span-5 p-3.5 bg-slate-900/90 border border-white/10 rounded-xl space-y-3">
                                              <h6 className="text-[10px] uppercase font-bold text-cyan-300 flex items-center gap-1">
                                                <Sparkles size={12} />
                                                Acciones Directas de Coordinación
                                              </h6>

                                              {/* Action 1: Manual adjustment with +1, -1, +6, Limpiar and Coordinator Self-Protection */}
                                              {isCoordinator && w.id === currentSession?.userId ? (
                                                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] text-amber-300 font-medium flex items-center gap-1.5">
                                                  <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                                                  <span>Los coordinadores no pueden modificar su propio saldo de días libres. Solicítalo a Gerencia/Adjunta.</span>
                                                </div>
                                              ) : (
                                                <div className="space-y-1.5">
                                                  <label className="text-[9px] font-bold text-slate-300 flex items-center justify-between">
                                                    <span>Gestión de Balance de Días Libres</span>
                                                    <span className="text-[8px] text-slate-500">Ajuste actual: {w.manualFreeDaysAdjustment || 0}</span>
                                                  </label>
                                                  <div className="flex flex-wrap items-center gap-1.5">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleAddFreeDays(w, -1)}
                                                      className="px-2 h-7 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-lg font-bold border border-red-500/20 transition-all cursor-pointer text-[10px] flex items-center gap-0.5"
                                                      title="Restar 1 día libre"
                                                    >
                                                      <Minus size={10} /> 1
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleAddFreeDays(w, 1)}
                                                      className="px-2 h-7 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg font-bold border border-emerald-500/20 transition-all cursor-pointer text-[10px] flex items-center gap-0.5"
                                                      title="Agregar 1 día libre"
                                                    >
                                                      <Plus size={10} /> 1
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleAddFreeDays(w, 6)}
                                                      className="px-2.5 h-7 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-lg font-bold border border-cyan-500/20 transition-all cursor-pointer text-[10px] flex items-center gap-0.5"
                                                      title="Agregar 6 días libres (+6)"
                                                    >
                                                      <Plus size={10} /> 6
                                                    </button>

                                                    <button
                                                      type="button"
                                                      onClick={() => handleClearFreeDays(w)}
                                                      className="ml-auto h-7 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-lg font-bold text-[9px] transition-all cursor-pointer border border-amber-500/20 flex items-center gap-1"
                                                      title="Limpiar la cantidad de días libres disponibles acumulados"
                                                    >
                                                      <RotateCcw size={10} />
                                                      <span>Limpiar</span>
                                                    </button>
                                                  </div>
                                                </div>
                                              )}

                                              {/* Action 2: Schedule a free day */}
                                              <div className="space-y-1.5 pt-2 border-t border-white/5">
                                                <label className="text-[9px] font-bold text-slate-300 flex items-center justify-between">
                                                  <span>Programar Día Libre Directo</span>
                                                  <span className="text-[8px] text-slate-500">Asigna turno 'Libre'</span>
                                                </label>
                                                <div className="flex gap-1.5">
                                                  <input
                                                    type="date"
                                                    value={scheduleDate[w.id] || ''}
                                                    onChange={(e) => setScheduleDate({ ...scheduleDate, [w.id]: e.target.value })}
                                                    className="flex-1 h-7 px-1.5 bg-slate-950 border border-white/10 rounded-lg text-[10px] font-medium text-slate-300 focus:outline-none focus:border-cyan-500"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const dateStr = scheduleDate[w.id];
                                                      if (!dateStr) {
                                                        if (onAddNotification) {
                                                          onAddNotification('Selecciona una fecha', 'Por favor selecciona la fecha que el empleado tomará libre.', 'info');
                                                        }
                                                        return;
                                                      }
                                                      handleScheduleLibre(w.id, dateStr);
                                                      setScheduleDate({ ...scheduleDate, [w.id]: '' });
                                                    }}
                                                    className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[9px] transition-all cursor-pointer flex items-center gap-1"
                                                  >
                                                    <Plus size={10} />
                                                    <span>Asignar</span>
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </motion.div>
                                    </td>
                                  </tr>
                                )}
                              </AnimatePresence>
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(VacationControl);
