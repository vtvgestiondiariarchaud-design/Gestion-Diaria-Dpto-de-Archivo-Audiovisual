import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Umbrella, Award, Clock, ArrowRight, Search, 
  Plus, Trash2, CheckCircle2, AlertTriangle, HelpCircle, 
  CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Sparkles, User, Info, Check,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Division, Worker, ShiftAssignment } from '../types';

interface VacationControlProps {
  divisions: Division[];
  workers: Worker[];
  assignments: ShiftAssignment[];
  onUpdateWorkers: (updated: Worker[]) => void;
  userRole: string;
  userDivisionId?: string;
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

  const todayStr = new Date().toISOString().split('T')[0];

  const events: FreeDayEvent[] = earnedEvents.map(ev => {
    const earnedDate = new Date(ev.date + 'T12:00:00');
    // Expiration date is earnedDate + 8 days (same week + 1 day)
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
      // Free days accumulate indefinitely without automatic expiration/deletion
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

export default function VacationControl({
  divisions,
  workers,
  assignments,
  onUpdateWorkers,
  userRole,
  userDivisionId,
  onUpdateAssignments,
  onAddNotification
}: VacationControlProps) {
  const [activeSubTab, setActiveSubTab] = useState<'vacations' | 'freedays'>('vacations');
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for manual free days adjustment and date scheduling per worker
  const [tempAdjustment, setTempAdjustment] = useState<Record<string, number>>({});
  const [scheduleDate, setScheduleDate] = useState<Record<string, string>>({});
  
  // Year/Month state for the vacation calendar
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(6); // July (0-indexed is 6)

  // Selected worker ID for adding vacation
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');
  
  // Expanded worker details for free days
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);

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
        dayName: daysOfWeekStr[dayOfWeekNum],
        isWk: dayOfWeekNum === 0 || dayOfWeekNum === 6,
        isHol: isHoliday(dateStr)
      });
    }
    return dates;
  }, [currentYear, currentMonth, daysInMonth]);

  // Vacation assigning logic
  const handleAssignVacation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId || !vacStart || !vacEnd) return;

    if (vacStart > vacEnd) {
      alert('La fecha de inicio de vacaciones no puede ser posterior a la fecha de fin.');
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
    setExpandedWorkerId(null);
    if (onAddNotification) {
      onAddNotification(
        'Ajuste de Días Libres', 
        'Se ha actualizado el balance de días libres para el empleado de forma exitosa.', 
        'success'
      );
    }
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

  // List of workers filtered by search
  const filteredWorkers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return workers.filter(w => 
      w.name.toLowerCase().includes(q) || 
      (w.cargo && w.cargo.toLowerCase().includes(q)) ||
      divisions.find(d => d.id === w.divisionId)?.name.toLowerCase().includes(q)
    );
  }, [workers, divisions, searchTerm]);

  // List of active vacations this month for the mobile view
  const activeVacationsThisMonth = useMemo(() => {
    return filteredWorkers.filter(w => {
      if (!w.vacationStart || !w.vacationEnd) return false;
      const monthStartStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const lastDayOfM = new Date(currentYear, currentMonth + 1, 0).getDate();
      const monthEndStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayOfM).padStart(2, '0')}`;
      return w.vacationStart <= monthEndStr && w.vacationEnd >= monthStartStr;
    });
  }, [filteredWorkers, currentYear, currentMonth]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Intro Header */}
      <div className="p-6 glass rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Umbrella className="text-cyan-400" size={22} />
            Control de Vacaciones y Días Libres
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
            Gestiona de forma unificada los períodos vacacionales de los empleados y el balance de días libres acumulados por guardias realizadas en fines de semana o días feriados.
          </p>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex bg-slate-950/60 p-1 border border-white/5 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('vacations')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'vacations'
                ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CalendarDays size={13} />
            <span>Calendario Vacaciones</span>
          </button>
          <button
            onClick={() => setActiveSubTab('freedays')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'freedays'
                ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award size={13} />
            <span>Días Libres Acumulados</span>
          </button>
        </div>
      </div>

      {/* RENDER SUB-TAB 1: VACATIONS CALENDAR */}
      {activeSubTab === 'vacations' && (
        <div className="space-y-6">
          {/* Vacation Assigning Form (Superadmin & Coordinator only) */}
          {(userRole === 'superadmin' || userRole === 'deputy' || userRole === 'coordinator') && (
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

          {/* Search bar & calendar month switcher */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
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

          {/* Mobile-Only Vacation List */}
          <div className="block md:hidden space-y-3">
            <h4 className="text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">
              Empleados de Vacaciones este mes ({activeVacationsThisMonth.length})
            </h4>
            {activeVacationsThisMonth.length === 0 ? (
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl text-center text-xs text-slate-500 italic">
                No hay vacaciones registradas en {months[currentMonth]} {currentYear}.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {activeVacationsThisMonth.map(w => {
                  const divName = divisions.find(d => d.id === w.divisionId)?.name || 'Sin división';
                  const formatDate = (dStr: string) => {
                    const parts = dStr.split('-');
                    return `${parts[2]}/${parts[1]}`;
                  };
                  return (
                    <div key={w.id} className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-bold text-xs text-white">{w.name}</div>
                        <div className="text-[10px] text-slate-400">{w.cargo} • {divName}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-teal-400 font-medium">
                          <Umbrella size={12} className="shrink-0" />
                          <span>Del {formatDate(w.vacationStart!)} al {formatDate(w.vacationEnd!)}</span>
                        </div>
                      </div>
                      
                      {(userRole === 'superadmin' || userRole === 'deputy') && (
                        <button
                          onClick={() => handleRemoveVacation(w.id)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 rounded-lg transition-colors cursor-pointer"
                          title="Quitar Vacaciones"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Calendar Visual Timeline */}
          <div className="hidden md:block p-4 bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-400 px-1 uppercase tracking-wider mb-2">
              Línea de Tiempo de Vacaciones (Calendario de Franjas)
            </h4>
            
            <div className="overflow-x-auto w-full">
              <div className="min-w-[1000px] divide-y divide-white/5">
                {/* Header Row: Days of Month */}
                <div className="flex pb-2 font-mono text-[9px] text-slate-400 font-bold">
                  <div className="w-[180px] shrink-0 font-sans text-xs font-semibold text-slate-300">Empleado</div>
                  <div className="flex flex-1 justify-between">
                    {calendarDates.map(date => {
                      let colorClass = "text-slate-500";
                      let bgClass = "bg-transparent";
                      if (date.isHol) {
                        colorClass = "text-amber-400 font-extrabold";
                        bgClass = "bg-amber-500/10";
                      } else if (date.isWk) {
                        colorClass = "text-red-400";
                        bgClass = "bg-red-500/5";
                      }
                      
                      return (
                        <div 
                          key={date.dayNum} 
                          className={`w-7 shrink-0 text-center flex flex-col items-center justify-center py-1 rounded ${bgClass}`}
                          title={`${date.dayName} ${date.dayNum} ${months[currentMonth]} ${date.isHol ? '• Feriado de VTV' : ''}`}
                        >
                          <span>{date.dayName.slice(0, 1)}</span>
                          <span className={`text-[10px] ${colorClass}`}>{date.dayNum}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Body Rows: One row per filtered worker */}
                <div className="divide-y divide-white/5 pt-1">
                  {filteredWorkers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      No se encontraron empleados.
                    </div>
                  ) : (
                    filteredWorkers.map(w => {
                      const divName = divisions.find(d => d.id === w.divisionId)?.name || 'Sin división';
                      const hasVacation = w.vacationStart && w.vacationEnd;
                      
                      return (
                        <div key={w.id} className="flex items-center py-3">
                          {/* Worker Details Column */}
                          <div className="w-[180px] shrink-0 pr-3 truncate flex flex-col">
                            <span className="text-xs font-bold text-white truncate flex items-center gap-1.5" title={w.name}>
                              <User size={10} className="text-cyan-400 shrink-0" />
                              {w.name}
                            </span>
                            <span className="text-[9px] text-slate-400 truncate">{w.cargo} • {divName}</span>
                            
                            {hasVacation && (
                              <div className="flex items-center gap-1.5 mt-1 text-[8px] text-teal-400 font-mono">
                                <span>{w.vacationStart?.slice(5)}</span>
                                <ArrowRight size={8} />
                                <span>{w.vacationEnd?.slice(5)}</span>
                                {(userRole === 'superadmin' || userRole === 'deputy') && (
                                  <button
                                    onClick={() => handleRemoveVacation(w.id)}
                                    className="p-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded cursor-pointer ml-1"
                                    title="Quitar Vacaciones"
                                  >
                                    <Trash2 size={8} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Grid Timeline Bar Column */}
                          <div className="flex flex-1 justify-between items-center relative">
                            {calendarDates.map(date => {
                              // Check if date lies in worker's vacation period
                              const onVacation = w.vacationStart && w.vacationEnd && (
                                date.dateStr >= w.vacationStart && date.dateStr <= w.vacationEnd
                              );

                              return (
                                <div 
                                  key={date.dayNum} 
                                  className="w-7 shrink-0 h-6 flex items-center justify-center relative"
                                >
                                  {/* Grid Cell Background for holidays / weekends */}
                                  {date.isHol && <div className="absolute inset-0 bg-amber-500/5 pointer-events-none rounded" />}
                                  {date.isWk && <div className="absolute inset-0 bg-red-500/5 pointer-events-none rounded" />}

                                  {/* Colored Bar indicating active vacation */}
                                  {onVacation && (
                                    <div 
                                      className="absolute inset-y-1 left-0 right-0 bg-gradient-to-r from-teal-500/30 to-emerald-500/30 hover:from-teal-500/50 hover:to-emerald-500/50 border-y border-teal-400/40 cursor-help transition-all shadow-sm z-10"
                                      title={`${w.name} de vacaciones del ${w.vacationStart} al ${w.vacationEnd}`}
                                    />
                                  )}
                                  
                                  {/* Just a tiny dot to assist eye line if empty */}
                                  {!onVacation && <div className="w-1 h-1 bg-white/5 rounded-full" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            
            <div className="pt-2 px-1 flex flex-wrap gap-4 text-[10px] text-slate-400 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-2.5 bg-gradient-to-r from-teal-500/30 to-emerald-500/30 border-y border-teal-400/40 rounded" />
                <span>En Período de Vacaciones Activas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-2.5 bg-amber-500/10 rounded" />
                <span className="text-amber-400">Día Feriado Nacional / VTV</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-2.5 bg-red-500/5 rounded" />
                <span className="text-red-400">Sábado / Domingo</span>
              </div>
              <div className="text-slate-500 flex items-center gap-1">
                <Info size={11} className="text-slate-400" />
                <span>Cualquier empleado que esté de vacaciones NO se agregará automáticamente al crear un nuevo día operativo.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER SUB-TAB 2: ACCUMULATED FREE DAYS BALANCE */}
      {activeSubTab === 'freedays' && (
        <div className="space-y-6">
          {/* Rules and Explanation card */}
          <div className="p-5 bg-sky-950/20 border border-sky-500/30 rounded-2xl flex items-start gap-3.5 shadow-lg">
            <Award size={24} className="text-sky-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1.5">
              <h4 className="font-bold text-white text-sm">Reglamento de Días Libres Compensatorios de Guardia (VTV)</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Cada vez que un trabajador realice una guardia de <strong>fin de semana (sábado/domingo)</strong> o en un <strong>día feriado</strong>, acumula automáticamente <strong>1 Día Libre</strong> compensatorio.
              </p>
              <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-1">
                <li>Este día libre puede ser disfrutado dentro de la misma semana (lunes a domingo).</li>
                <li><strong>Expiración Automática:</strong> Si el día libre acumulado no es utilizado al transcurrir una semana más un día (8 días desde la fecha de su guardia de fin de semana o feriado), este expira y se elimina automáticamente de su balance de días disponibles.</li>
                <li>Si un empleado tiene programado un "Día Libre" o está de vacaciones, el sistema bloqueará su adición automática al crear un nuevo día operativo de lunes a viernes.</li>
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

          {/* Balance Table / Cards */}
          {/* Desktop Table - Hidden on mobile, visible on medium+ screens */}
          <div className="hidden md:block p-4 bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Empleado / Cargo</th>
                    <th className="py-3 px-4">Guardias Trabajadas (FDS/Feriado)</th>
                    <th className="py-3 px-4 text-emerald-400">Días Libres Usados</th>
                    <th className="py-3 px-4 text-red-400">Días Expirados</th>
                    <th className="py-3 px-4 text-cyan-400 font-bold">Balance Disponible</th>
                    <th className="py-3 px-4 text-right">Detalle de Guardia</th>
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
                                                        {ev.status === 'expired' && (
                                                          <span className="px-1.5 py-0.5 bg-slate-500/15 text-slate-400 border border-white/5 rounded font-bold text-[9px]" title={`Expiró el ${ev.expirationDateStr}`}>
                                                            Expirado
                                                          </span>
                                                        )}
                                                        {ev.status === 'active' && (
                                                          <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded font-extrabold text-[9px]" title={`Vence el ${ev.expirationDateStr}`}>
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

                                          {/* Disfrutados / Libres log */}
                                          <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
                                            <div className="text-[10px] font-bold text-white flex items-center gap-1.5 mb-1">
                                              <CheckCircle2 size={12} className="text-emerald-400" />
                                              Días Libres de Guardia Disfrutados (Libres)
                                            </div>
                                            {balance.libreDates.length === 0 ? (
                                              <div className="text-slate-500 text-[11px] italic py-4 text-center">
                                                No tiene días libres de guardia programados en el calendario.
                                              </div>
                                            ) : (
                                              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                                {balance.libreDates.map((lDate, idx) => {
                                                  const libreDateObj = new Date(lDate + 'T12:00:00');
                                                  const formattedDate = libreDateObj.toLocaleDateString('es-ES', { 
                                                    weekday: 'short', month: 'short', day: 'numeric' 
                                                  });
                                                  const matchingAsg = assignments.find(a => a.workerId === w.id && a.date === lDate && a.shiftType === 'libre');

                                                  return (
                                                    <div key={idx} className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-[11px] flex items-center justify-between">
                                                      <div>
                                                        <span className="font-bold text-slate-200 capitalize">{formattedDate}</span>
                                                        <span className="text-[9px] text-slate-400 block">{lDate}</span>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                        <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Disfrutado</span>
                                                        {canCoordinate && matchingAsg && (
                                                          <button
                                                            onClick={() => handleDeleteLibre(matchingAsg.id)}
                                                            className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                                                            title="Eliminar este día libre del calendario"
                                                          >
                                                            <Trash2 size={12} />
                                                          </button>
                                                        )}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Manual adjustments indicators if any */}
                                        {w.manualFreeDaysAdjustment !== undefined && w.manualFreeDaysAdjustment !== 0 && (
                                          <div className="p-2.5 bg-cyan-950/20 border border-cyan-500/20 rounded-xl flex items-center gap-2 text-[11px] text-cyan-300">
                                            <Sparkles size={13} className="shrink-0 animate-pulse" />
                                            <span>
                                              Este empleado tiene un <strong>ajuste manual de {w.manualFreeDaysAdjustment > 0 ? `+${w.manualFreeDaysAdjustment}` : w.manualFreeDaysAdjustment} días libres</strong> en su balance, aplicado por coordinación.
                                            </span>
                                          </div>
                                        )}

                                      </div>

                                      {/* Right Column - Coordination & Control Panel */}
                                      {canCoordinate && (
                                        <div className="lg:col-span-5 bg-white/[0.02] border border-white/5 rounded-2xl p-3.5 space-y-4">
                                          <div className="border-b border-white/5 pb-2">
                                            <h6 className="text-[11px] uppercase font-extrabold tracking-wider text-slate-200 flex items-center gap-1.5">
                                              <User size={13} className="text-cyan-400" />
                                              Acciones de Coordinación (Subordinado)
                                            </h6>
                                            <span className="text-[9px] text-slate-400">Autorización activa para la división de este empleado</span>
                                          </div>

                                          {/* Action 1: Modify free days balance manually */}
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-300 flex items-center justify-between">
                                              <span>Ajustar Balance de Días Libres</span>
                                              <span className="text-[9px] text-slate-500">Modifica el total disponible</span>
                                            </label>
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const currentVal = tempAdjustment[w.id] !== undefined ? tempAdjustment[w.id] : (w.manualFreeDaysAdjustment || 0);
                                                  setTempAdjustment({ ...tempAdjustment, [w.id]: currentVal - 1 });
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white rounded-lg font-bold border border-white/5 transition-all cursor-pointer"
                                              >
                                                -
                                              </button>
                                              
                                              <input
                                                type="number"
                                                value={tempAdjustment[w.id] !== undefined ? tempAdjustment[w.id] : (w.manualFreeDaysAdjustment || 0)}
                                                onChange={(e) => {
                                                  const val = parseInt(e.target.value) || 0;
                                                  setTempAdjustment({ ...tempAdjustment, [w.id]: val });
                                                }}
                                                className="w-16 h-8 text-center bg-slate-950 border border-white/10 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                                              />

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const currentVal = tempAdjustment[w.id] !== undefined ? tempAdjustment[w.id] : (w.manualFreeDaysAdjustment || 0);
                                                  setTempAdjustment({ ...tempAdjustment, [w.id]: currentVal + 1 });
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white rounded-lg font-bold border border-white/5 transition-all cursor-pointer"
                                              >
                                                +
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const val = tempAdjustment[w.id] !== undefined ? tempAdjustment[w.id] : (w.manualFreeDaysAdjustment || 0);
                                                  handleSaveAdjustment(w.id, val);
                                                }}
                                                className="ml-auto h-8 px-3.5 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white rounded-lg font-bold text-[10px] shadow-md hover:shadow-cyan-500/20 transition-all cursor-pointer inline-flex items-center gap-1"
                                              >
                                                <Check size={11} />
                                                <span>Guardar</span>
                                              </button>
                                            </div>
                                          </div>

                                          {/* Action 2: Schedule a free day for a specific date */}
                                          <div className="space-y-2 pt-2 border-t border-white/5">
                                            <label className="text-[10px] font-bold text-slate-300 flex items-center justify-between">
                                              <span>Programar Día Libre (Tomar Día)</span>
                                              <span className="text-[9px] text-slate-500">Asigna turno 'Libre'</span>
                                            </label>
                                            <div className="flex gap-2">
                                              <input
                                                type="date"
                                                value={scheduleDate[w.id] || ''}
                                                onChange={(e) => setScheduleDate({ ...scheduleDate, [w.id]: e.target.value })}
                                                className="flex-1 h-8 px-2 bg-slate-950 border border-white/10 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-cyan-500"
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
                                                className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[10px] transition-all cursor-pointer inline-flex items-center gap-1.5"
                                              >
                                                <Plus size={11} />
                                                <span>Programar</span>
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

          {/* Mobile Cards - Visible on mobile screens, hidden on desktop */}
          <div className="block md:hidden space-y-3">
            {filteredWorkers.length === 0 ? (
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl text-center text-xs text-slate-500 italic">
                No se encontraron empleados.
              </div>
            ) : (
              filteredWorkers.map(w => {
                const divName = divisions.find(d => d.id === w.divisionId)?.name || 'Sin división';
                const balance = computeWorkerFreeDays(w, assignments);
                const isExpanded = expandedWorkerId === w.id;
                const canCoordinate = userRole === 'superadmin' || userRole === 'deputy' || (userRole === 'coordinator' && userDivisionId === w.divisionId);

                return (
                  <div 
                    key={w.id} 
                    className={`bg-slate-900/60 border border-white/5 rounded-2xl transition-all overflow-hidden ${
                      isExpanded ? 'ring-1 ring-cyan-500/30 bg-slate-900/95 shadow-lg shadow-cyan-950/10' : ''
                    }`}
                  >
                    {/* Header Row - Click anywhere to toggle details */}
                    <div 
                      onClick={() => setExpandedWorkerId(isExpanded ? null : w.id)}
                      className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02] select-none"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="font-bold text-xs text-white truncate">{w.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{w.cargo} • {divName}</div>
                        
                        {/* Compact Stats Row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-slate-500 font-mono">
                          <span>Guardias: <strong className="text-slate-300 font-bold">{balance.earnedCount}</strong></span>
                          <span>Usados: <strong className="text-emerald-400 font-medium">{balance.usedCount}</strong></span>
                        </div>
                      </div>

                      {/* Balance Badge & Chevron */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 font-mono font-extrabold rounded-lg text-[10px] ${
                          balance.activeCount > 0 
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                            : 'bg-white/5 text-slate-400'
                        }`}>
                          {balance.activeCount} libre{balance.activeCount !== 1 && 's'}
                        </span>
                        <div className="text-slate-400 shrink-0">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Content inside Card */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-t border-white/5 bg-slate-950/40 p-3.5 space-y-4"
                        >
                          <div className="flex justify-between items-center text-[9px] text-slate-500">
                            <span className="flex items-center gap-1 uppercase font-bold tracking-wider">
                              <Clock size={11} className="text-cyan-400" /> Detalle de Guardia
                            </span>
                            <span className="font-mono text-[8px]">ID: {w.id}</span>
                          </div>

                          {/* Historical logs */}
                          <div className="space-y-3">
                            {/* Earned list */}
                            <div className="space-y-1.5">
                              <div className="text-[10px] font-bold text-white flex items-center gap-1.5">
                                <Award size={11} className="text-cyan-400" />
                                Días Acumulados
                              </div>
                              {balance.events.length === 0 ? (
                                <div className="text-slate-500 text-[10px] italic py-1 pl-1">
                                  No registra guardias en fines de semana o feriados.
                                </div>
                              ) : (
                                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                  {balance.events.map((ev, idx) => {
                                    const earnedDateObj = new Date(ev.earnedDate + 'T12:00:00');
                                    const formattedDate = earnedDateObj.toLocaleDateString('es-ES', { 
                                      weekday: 'short', month: 'short', day: 'numeric' 
                                    });

                                    return (
                                      <div key={idx} className="p-1.5 bg-slate-900/60 border border-white/5 rounded-lg flex items-center justify-between text-[10px]">
                                        <div>
                                          <span className="font-bold text-white block capitalize">{formattedDate}</span>
                                          <span className="text-[8px] text-slate-400">
                                            {ev.type === 'holiday' ? '⚠️ Feriado' : '⚡ Fin de Sem.'}
                                          </span>
                                        </div>
                                        
                                        <div className="text-right">
                                          {ev.status === 'used' && (
                                            <span className="px-1 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold text-[8px]">
                                              Disfrutado {ev.usedOnDate}
                                            </span>
                                          )}
                                          {ev.status === 'expired' && (
                                            <span className="px-1 py-0.5 bg-slate-500/15 text-slate-400 border border-white/5 rounded font-bold text-[8px]">
                                              Expirado
                                            </span>
                                          )}
                                          {ev.status === 'active' && (
                                            <span className="px-1 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded font-bold text-[8px]">
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

                            {/* Disfrutados list */}
                            <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                              <div className="text-[10px] font-bold text-white flex items-center gap-1.5">
                                <CheckCircle2 size={11} className="text-emerald-400" />
                                Días Disfrutados (Libres)
                              </div>
                              {balance.libreDates.length === 0 ? (
                                <div className="text-slate-500 text-[10px] italic py-1 pl-1">
                                  No tiene días libres de guardia programados.
                                </div>
                              ) : (
                                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                  {balance.libreDates.map((lDate, idx) => {
                                    const libreDateObj = new Date(lDate + 'T12:00:00');
                                    const formattedDate = libreDateObj.toLocaleDateString('es-ES', { 
                                      weekday: 'short', month: 'short', day: 'numeric' 
                                    });
                                    const matchingAsg = assignments.find(a => a.workerId === w.id && a.date === lDate && a.shiftType === 'libre');

                                    return (
                                      <div key={idx} className="p-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-[10px] flex items-center justify-between">
                                        <div>
                                          <span className="font-bold text-slate-200 capitalize">{formattedDate}</span>
                                          <span className="text-[8px] text-slate-400 block">{lDate}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">Disfrutado</span>
                                          {canCoordinate && matchingAsg && (
                                            <button
                                              onClick={() => handleDeleteLibre(matchingAsg.id)}
                                              className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                                              title="Eliminar"
                                            >
                                              <Trash2 size={11} />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Manual adjustments indicators */}
                            {w.manualFreeDaysAdjustment !== undefined && w.manualFreeDaysAdjustment !== 0 && (
                              <div className="p-2 bg-cyan-950/20 border border-cyan-500/20 rounded-xl flex items-center gap-1.5 text-[10px] text-cyan-300">
                                <Sparkles size={11} className="shrink-0 animate-pulse" />
                                <span>
                                  Ajuste manual de <strong>{w.manualFreeDaysAdjustment > 0 ? `+${w.manualFreeDaysAdjustment}` : w.manualFreeDaysAdjustment} días libres</strong>.
                                </span>
                              </div>
                            )}

                            {/* Coordinator Panel */}
                            {canCoordinate && (
                              <div className="mt-4 pt-3 border-t border-white/5 space-y-4">
                                <div className="border-b border-white/5 pb-1">
                                  <h6 className="text-[10px] uppercase font-extrabold tracking-wider text-slate-200 flex items-center gap-1">
                                    <User size={11} className="text-cyan-400" />
                                    Panel de Coordinación
                                  </h6>
                                </div>

                                {/* Action 1: Adjust balance */}
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-bold text-slate-300 flex items-center justify-between">
                                    <span>Ajustar Balance Manual</span>
                                    <span className="text-[8px] text-slate-500">Modifica total</span>
                                  </label>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentVal = tempAdjustment[w.id] !== undefined ? tempAdjustment[w.id] : (w.manualFreeDaysAdjustment || 0);
                                        setTempAdjustment({ ...tempAdjustment, [w.id]: currentVal - 1 });
                                      }}
                                      className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg font-bold border border-white/5 transition-all cursor-pointer text-xs"
                                    >
                                      -
                                    </button>
                                    
                                    <input
                                      type="number"
                                      value={tempAdjustment[w.id] !== undefined ? tempAdjustment[w.id] : (w.manualFreeDaysAdjustment || 0)}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setTempAdjustment({ ...tempAdjustment, [w.id]: val });
                                      }}
                                      className="w-12 h-7 text-center bg-slate-950 border border-white/10 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                                    />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentVal = tempAdjustment[w.id] !== undefined ? tempAdjustment[w.id] : (w.manualFreeDaysAdjustment || 0);
                                        setTempAdjustment({ ...tempAdjustment, [w.id]: currentVal + 1 });
                                      }}
                                      className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg font-bold border border-white/5 transition-all cursor-pointer text-xs"
                                    >
                                      +
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const val = tempAdjustment[w.id] !== undefined ? tempAdjustment[w.id] : (w.manualFreeDaysAdjustment || 0);
                                        handleSaveAdjustment(w.id, val);
                                      }}
                                      className="ml-auto h-7 px-2.5 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white rounded-lg font-bold text-[9px] transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <Check size={10} />
                                      <span>Guardar</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Action 2: Schedule a free day */}
                                <div className="space-y-1.5 pt-2 border-t border-white/5">
                                  <label className="text-[9px] font-bold text-slate-300 flex items-center justify-between">
                                    <span>Programar Día Libre</span>
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
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
