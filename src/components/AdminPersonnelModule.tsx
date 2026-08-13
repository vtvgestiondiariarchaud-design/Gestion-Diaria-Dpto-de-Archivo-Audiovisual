import React, { useState, useMemo } from 'react';
import { Personnel, GuardShiftRecord, ShiftType, DivisionType, UserProfile } from '../types';
import { canUserManagePersonnel, canUserAssignVacations } from '../utils/permissions';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  ShieldAlert, 
  Sun, 
  Briefcase,
  X,
  Gift,
  Award,
  Crown,
  Share2,
  Copy,
  Send,
  Palmtree,
  Trash2,
  CalendarPlus,
  Sparkles,
  KeyRound,
  Lock,
  Search
} from 'lucide-react';

interface AdminPersonnelModuleProps {
  personnel: Personnel[];
  guardShifts: GuardShiftRecord[];
  currentUser: UserProfile;
  onAddGuardShift: (shift: Omit<GuardShiftRecord, 'id' | 'createdAt'>) => void;
  onAddBatchGuardShifts?: (shifts: Omit<GuardShiftRecord, 'id' | 'createdAt'>[], replaceTargetDate?: string) => void;
  onDeleteGuardShift?: (shiftId: string) => void;
  onClearAllGuardShifts?: () => void;
  onAddPersonnel: (person: Omit<Personnel, 'id' | 'guardDaysWorked' | 'daysOffGenerated' | 'daysOffTaken' | 'balanceDays'>) => void;
  onDeletePersonnel?: (personnelId: string) => void;
  onQuickAdjustDays: (personnelId: string, type: 'guard' | 'dayOff') => void;
  onOpenPinModal?: () => void;
  userHasPin?: boolean;
}

export const AdminPersonnelModule: React.FC<AdminPersonnelModuleProps> = ({
  personnel,
  guardShifts,
  currentUser,
  onAddGuardShift,
  onAddBatchGuardShifts,
  onDeleteGuardShift,
  onClearAllGuardShifts,
  onAddPersonnel,
  onDeletePersonnel,
  onQuickAdjustDays,
  onOpenPinModal,
  userHasPin,
}) => {
  // Access checks:
  // Jefes, Coordinadores, Gerente, Adjunta, Asistente Admin -> Guardias y Días Libres
  // Asistente Admin, Gerente, Adjunta -> Vacaciones
  const hasAccess = canUserManagePersonnel(currentUser);
  const canAssignVacations = canUserAssignVacations(currentUser);

  // Calendar state (Year & Month)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1)); // August 2026 default
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Selected Day Detail & Assignment Modal State
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  
  // Assignment Mode inside Modal: 'guardia' | 'vacaciones' | 'diaLibre'
  const [assignmentMode, setAssignmentMode] = useState<'guardia' | 'vacaciones' | 'diaLibre'>('guardia');

  // Guardia Mode States (Multiple workers + Encargado)
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [leadWorkerId, setLeadWorkerId] = useState<string>('');
  const [guardNotes, setGuardNotes] = useState('');

  // Vacaciones Mode States (Date Range)
  const [vacationPersonId, setVacationPersonId] = useState<string>(personnel[0]?.id || '');
  const [vacationStartDate, setVacationStartDate] = useState<string>('');
  const [vacationEndDate, setVacationEndDate] = useState<string>('');
  const [vacationNotes, setVacationNotes] = useState('');

  // Día Libre Mode State
  const [dayOffPersonId, setDayOffPersonId] = useState<string>(personnel[0]?.id || '');
  const [dayOffNotes, setDayOffNotes] = useState('');

  // Duplication Modal State
  const [duplicateFromDate, setDuplicateFromDate] = useState<string | null>(null);
  const [duplicateTargetDate, setDuplicateTargetDate] = useState<string>('');

  // Add Personnel Modal State
  const [isAddingPersonnel, setIsAddingPersonnel] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRole, setNewPersonRole] = useState<Personnel['role']>('Coordinador');
  const [newPersonDivision, setNewPersonDivision] = useState<DivisionType>('Prensa');
  const [newPersonPin, setNewPersonPin] = useState('');

  // Feedback Toast
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Panel Search & Division Filter
  const [panelSearchQuery, setPanelSearchQuery] = useState('');
  const [panelDivisionFilter, setPanelDivisionFilter] = useState<string>('all');

  // Assignment Modal Personnel Search
  const [assignSearchQuery, setAssignSearchQuery] = useState('');

  // Filtered personnel for Panel de Saldos
  const filteredPanelPersonnel = useMemo(() => {
    return personnel.filter((p) => {
      const matchesDivision =
        panelDivisionFilter === 'all' || p.division === panelDivisionFilter;
      const matchesSearch =
        !panelSearchQuery.trim() ||
        p.name.toLowerCase().includes(panelSearchQuery.toLowerCase().trim()) ||
        p.role.toLowerCase().includes(panelSearchQuery.toLowerCase().trim()) ||
        p.division.toLowerCase().includes(panelSearchQuery.toLowerCase().trim());
      return matchesDivision && matchesSearch;
    });
  }, [personnel, panelSearchQuery, panelDivisionFilter]);

  // Filtered personnel for Assignment Modal
  const filteredPersonnelForAssign = useMemo(() => {
    if (!assignSearchQuery.trim()) return personnel;
    const q = assignSearchQuery.toLowerCase().trim();
    return personnel.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.division.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q)
    );
  }, [personnel, assignSearchQuery]);

  // Grouped personnel by division for Assignment Modal
  const groupedPersonnelForAssign = useMemo<Record<string, Personnel[]>>(() => {
    const knownDivisions: DivisionType[] = ['Prensa', 'Programación', 'Ingesta', 'Gerencia'];
    const groups: Record<string, Personnel[]> = {};

    knownDivisions.forEach((div) => {
      groups[div] = [];
    });

    filteredPersonnelForAssign.forEach((p) => {
      const divKey = p.division || 'Gerencia';
      if (!groups[divKey]) groups[divKey] = [];
      groups[divKey].push(p);
    });

    return groups;
  }, [filteredPersonnelForAssign]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Calendar Days Calculation (Monday = 0 ... Sunday = 6)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rawFirstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday
  const firstDayIndex = (rawFirstDayIndex + 6) % 7; // 0 = Monday ... 6 = Sunday

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Helper to find shifts active on a given date (including vacation ranges)
  const getShiftsForDate = (dateStr: string) => {
    return guardShifts.filter((s) => {
      const sDate = s.date ? s.date.substring(0, 10) : '';
      const sEndDate = s.endDate ? s.endDate.substring(0, 10) : '';
      if (s.shiftType === 'Vacaciones' && sEndDate) {
        return dateStr >= sDate && dateStr <= sEndDate;
      }
      return sDate === dateStr;
    });
  };

  const handleOpenAssignModal = (dayNum: number) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${year}-${pad(month + 1)}-${pad(dayNum)}`;
    setSelectedCalendarDate(dateStr);
    setAssignSearchQuery('');

    if (!canAssignVacations && assignmentMode === 'vacaciones') {
      setAssignmentMode('guardia');
    }
    
    // Default vacation start/end dates
    setVacationStartDate(dateStr);
    const endDateObj = new Date(year, month, dayNum + 7);
    const endStr = `${endDateObj.getFullYear()}-${pad(endDateObj.getMonth() + 1)}-${pad(endDateObj.getDate())}`;
    setVacationEndDate(endStr);

    // Pre-select current workers on this date if any
    const existingShifts = getShiftsForDate(dateStr);
    const existingGuardWorkers = existingShifts
      .filter((s) => s.shiftType === 'Guardia (Fin de semana/Feriado)')
      .map((s) => s.personnelId);
    
    if (existingGuardWorkers.length > 0) {
      setSelectedWorkerIds(existingGuardWorkers);
      const lead = existingShifts.find((s) => s.isLead);
      setLeadWorkerId(lead ? lead.personnelId : existingGuardWorkers[0]);
    } else {
      setSelectedWorkerIds([]);
      setLeadWorkerId('');
    }
  };

  // Toggle worker selection for guard
  const handleToggleWorker = (personId: string) => {
    if (selectedWorkerIds.includes(personId)) {
      const next = selectedWorkerIds.filter((id) => id !== personId);
      setSelectedWorkerIds(next);
      if (leadWorkerId === personId) {
        setLeadWorkerId(next[0] || '');
      }
    } else {
      const next = [...selectedWorkerIds, personId];
      setSelectedWorkerIds(next);
      if (!leadWorkerId) {
        setLeadWorkerId(personId);
      }
    }
  };

  // Save Assignment Logic
  const handleSaveAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCalendarDate) return;

    if (assignmentMode === 'guardia') {
      const newShifts = selectedWorkerIds.map((pid) => {
        const p = personnel.find((per) => per.id === pid);
        return {
          personnelId: pid,
          personnelName: p?.name || 'Personal',
          division: p?.division || 'Prensa',
          date: selectedCalendarDate,
          shiftType: 'Guardia (Fin de semana/Feriado)' as ShiftType,
          isLead: pid === leadWorkerId,
          assignedBy: `${currentUser.name} (${currentUser.role})`,
          notes: guardNotes.trim(),
        };
      });

      if (onAddBatchGuardShifts) {
        onAddBatchGuardShifts(newShifts, selectedCalendarDate);
      } else {
        newShifts.forEach((s) => onAddGuardShift(s));
      }

    } else if (assignmentMode === 'vacaciones') {
      if (!canAssignVacations) return;
      if (!vacationPersonId || !vacationStartDate || !vacationEndDate) return;
      const p = personnel.find((per) => per.id === vacationPersonId);
      if (!p) return;

      const vacationShift = {
        personnelId: p.id,
        personnelName: p.name,
        division: p.division,
        date: vacationStartDate,
        endDate: vacationEndDate,
        shiftType: 'Vacaciones' as ShiftType,
        assignedBy: `${currentUser.name} (${currentUser.role})`,
        notes: vacationNotes.trim() || `Vacaciones Rango ${vacationStartDate} a ${vacationEndDate}`,
      };

      if (onAddBatchGuardShifts) {
        onAddBatchGuardShifts([vacationShift]);
      } else {
        onAddGuardShift(vacationShift);
      }

    } else if (assignmentMode === 'diaLibre') {
      if (!dayOffPersonId) return;
      const p = personnel.find((per) => per.id === dayOffPersonId);
      if (!p) return;

      const dayOffShift = {
        personnelId: p.id,
        personnelName: p.name,
        division: p.division,
        date: selectedCalendarDate,
        shiftType: 'Día Libre' as ShiftType,
        assignedBy: `${currentUser.name} (${currentUser.role})`,
        notes: dayOffNotes.trim(),
      };

      onAddGuardShift(dayOffShift);
    }

    setSelectedCalendarDate(null);
    setGuardNotes('');
    setVacationNotes('');
    setDayOffNotes('');
  };

  // Generate WhatsApp Report String
  const generateWhatsAppReport = (dateStr: string) => {
    const shiftsOnDate = getShiftsForDate(dateStr);
    const guardShiftsOnDate = shiftsOnDate.filter((s) => s.shiftType === 'Guardia (Fin de semana/Feriado)');
    const vacationShiftsOnDate = shiftsOnDate.filter((s) => s.shiftType === 'Vacaciones');

    const dateObj = new Date(dateStr + 'T00:00:00');
    const dateFormatted = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : dateStr;

    const lead = guardShiftsOnDate.find((s) => s.isLead);
    const regular = guardShiftsOnDate.filter((s) => !s.isLead);
    const notes = guardShiftsOnDate[0]?.notes;

    let text = `📺 *VTV - REPORTE DE GUARDIA DE ARCHIVO* 📺\n`;
    text += `📅 *FECHA:* ${dateFormatted.toUpperCase()}\n\n`;

    if (lead) {
      text += `👑 *ENCARGADO DE GUARDIA:*\n`;
      text += `• ${lead.personnelName} (${lead.division})\n\n`;
    }

    if (regular.length > 0) {
      text += `👥 *PERSONAL DE GUARDIA:*\n`;
      regular.forEach((r) => {
        text += `• ${r.personnelName} (${r.division})\n`;
      });
      text += `\n`;
    }

    if (vacationShiftsOnDate.length > 0) {
      text += `🌴 *PERSONAL DE VACACIONES:*\n`;
      vacationShiftsOnDate.forEach((v) => {
        text += `• ${v.personnelName} (${v.date} al ${v.endDate || v.date})\n`;
      });
      text += `\n`;
    }

    if (notes) {
      text += `📝 *OBSERVACIONES:*\n${notes}\n\n`;
    }

    text += `--------------------------------\n`;
    text += `_Gerencia de Archivo Audiovisual - VTV_`;

    return text;
  };

  // Send Report to WhatsApp
  const handleSendWhatsApp = (dateStr: string) => {
    const reportText = generateWhatsAppReport(dateStr);
    if (!reportText) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(reportText)}`;
    window.open(url, '_blank');
  };

  // Copy Report to Clipboard
  const handleCopyReport = (dateStr: string) => {
    const reportText = generateWhatsAppReport(dateStr);
    if (!reportText) return;
    navigator.clipboard.writeText(reportText);
    setCopyFeedback('¡Reporte copiado para WhatsApp!');
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // Execute Duplication
  const handleDuplicateGuardConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateFromDate || !duplicateTargetDate) return;

    const existingOnDate = guardShifts.filter(
      (s) => (s.date ? s.date.substring(0, 10) : '') === duplicateFromDate && s.shiftType === 'Guardia (Fin de semana/Feriado)'
    );

    if (existingOnDate.length === 0) return;

    const newClonedShifts = existingOnDate.map((s) => ({
      personnelId: s.personnelId,
      personnelName: s.personnelName,
      division: s.division,
      date: duplicateTargetDate,
      shiftType: s.shiftType,
      isLead: s.isLead,
      assignedBy: `${currentUser.name} (${currentUser.role})`,
      notes: s.notes ? `[Copia de ${duplicateFromDate}] ${s.notes}` : `Copia de guardia del ${duplicateFromDate}`,
    }));

    if (onAddBatchGuardShifts) {
      onAddBatchGuardShifts(newClonedShifts);
    } else {
      newClonedShifts.forEach((cs) => onAddGuardShift(cs));
    }

    setDuplicateFromDate(null);
    setDuplicateTargetDate('');
    setCopyFeedback(`¡Guardia duplicada al ${duplicateTargetDate}!`);
    setTimeout(() => setCopyFeedback(null), 3500);
  };

  const handleCreatePersonnel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;

    onAddPersonnel({
      name: newPersonName.trim(),
      role: newPersonRole,
      division: newPersonDivision,
      pin: newPersonPin.trim() || undefined,
    });

    setIsAddingPersonnel(false);
    setNewPersonName('');
    setNewPersonPin('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Feedback Toast */}
      {copyFeedback && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-200 text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{copyFeedback}</span>
        </div>
      )}

      {/* Notice Header */}
      {!hasAccess && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            <strong>Modo de Consulta:</strong> Módulo de gestión de personal reservado para Coordinadores, Jefes de División, Asistente Administrativa y Gerencia.
          </span>
        </div>
      )}

      {/* Rule Highlight Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] border border-slate-700/80 rounded-xl shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 overflow-hidden">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white">
                Gestión de Personal, Guardias y Vacaciones VTV
              </h2>
              <span className="px-2 py-0.5 rounded bg-purple-900/40 border border-purple-700/60 text-purple-300 font-bold font-mono text-[9px] uppercase whitespace-nowrap">
                SISTEMA INTEGRAL
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Asignación de guardias con múltiples trabajadores y <strong>Encargado de Guardia 👑</strong>, gestión de <strong>Vacaciones con rango 🌴</strong>, reporte formateado para <strong>WhatsApp 📱</strong> y duplicado rápido.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end shrink-0">
          {onOpenPinModal && (
            <button
              onClick={onOpenPinModal}
              className={`px-3 py-2 rounded-xl border font-bold text-xs transition-all flex items-center gap-2 shadow-md shrink-0 ${
                userHasPin
                  ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 hover:bg-amber-900'
                  : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 animate-pulse'
              }`}
              title={userHasPin ? 'Modificar PIN de seguridad' : 'Crear PIN de seguridad de personal'}
            >
              <KeyRound className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="whitespace-nowrap">{userHasPin ? 'Modificar mi PIN' : 'Crear mi PIN'}</span>
              {userHasPin && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            </button>
          )}

          {hasAccess && (
            <>
              {onClearAllGuardShifts && guardShifts.length > 0 && (
                <button
                  onClick={onClearAllGuardShifts}
                  className="px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-300 font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-md"
                  title="Eliminar todas las guardias del calendario"
                >
                  <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="whitespace-nowrap">Limpiar Guardias ({guardShifts.length})</span>
                </button>
              )}
              <button
                onClick={() => setIsAddingPersonnel(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-lg"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">NUEVO PERSONAL</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Layout: Calendar Row and Personnel Balances Row Stacked */}
      <div className="flex flex-col gap-6 w-full">
        {/* ROW 1: Interactive Monthly Calendar (Full Width) */}
        <div className="w-full bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div>
            {/* Calendar Header with Navigation */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold uppercase tracking-wider text-white">
                    Calendario de Guardias y Vacaciones — {monthNames[month]} {year}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Haga clic en cualquier fecha para asignar guardias, vacaciones o días libres
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1 text-xs font-semibold"
                  title="Mes Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>
                <span className="px-3 text-xs font-bold font-mono text-purple-300 hidden md:inline">
                  {monthNames[month]} {year}
                </span>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1 text-xs font-semibold"
                  title="Mes Siguiente"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header (Monday to Sunday) */}
            <div className="grid grid-cols-7 text-center font-bold text-xs text-slate-400 uppercase tracking-widest py-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span>LUNES</span>
              <span>MARTES</span>
              <span>MIÉRCOLES</span>
              <span>JUEVES</span>
              <span>VIERNES</span>
              <span className="text-red-400">SÁBADO</span>
              <span className="text-red-400">DOMINGO</span>
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mt-2.5">
              {/* Empty offset cells */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[90px] sm:min-h-[110px] rounded-xl bg-slate-950/20 border border-slate-900/40"></div>
              ))}

              {/* Month Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const pad = (n: number) => n.toString().padStart(2, '0');
                const dateStr = `${year}-${pad(month + 1)}-${pad(dayNum)}`;

                // Find active shifts on this day
                const dayShifts = getShiftsForDate(dateStr);
                const dayOfWeek = new Date(year, month, dayNum).getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                const hasVacations = dayShifts.some((s) => s.shiftType === 'Vacaciones');

                return (
                  <button
                    key={dateStr}
                    disabled={!hasAccess}
                    onClick={() => handleOpenAssignModal(dayNum)}
                    className={`min-h-[90px] sm:min-h-[110px] p-2 rounded-xl border flex flex-col justify-between text-left transition-all relative overflow-hidden group shadow-sm ${
                      hasVacations
                        ? 'bg-cyan-950/40 border-cyan-800/80 hover:border-cyan-400 hover:shadow-cyan-950/50'
                        : isWeekend
                        ? 'bg-slate-950/80 border-slate-800 hover:border-purple-500/80'
                        : 'bg-slate-900/90 border-slate-800/80 hover:border-blue-500/80'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded-md flex items-center justify-between ${
                        isWeekend ? 'bg-red-950/50 text-red-400 border border-red-900/40' : 'bg-slate-800/60 text-slate-200'
                      }`}
                    >
                      <span>{dayNum}</span>
                      {hasVacations && <span className="text-xs">🌴</span>}
                    </span>

                    {/* Shifts Chips inside Calendar Cell */}
                    <div className="space-y-1 overflow-y-auto max-h-16 sm:max-h-20 no-scrollbar w-full mt-1">
                      {dayShifts.map((sh, idx) => (
                        <div
                          key={`${sh.id}-${dateStr}-${idx}`}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md truncate flex items-center gap-1 shadow-xs ${
                            sh.shiftType === 'Vacaciones'
                              ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/40'
                              : sh.shiftType === 'Guardia (Fin de semana/Feriado)'
                              ? sh.isLead
                                ? 'bg-amber-500/30 text-amber-200 border border-amber-400/60 font-bold'
                                : 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                              : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                          }`}
                          title={`${sh.personnelName} - ${sh.shiftType} ${sh.isLead ? '(Encargado)' : ''}`}
                        >
                          {sh.isLead && <span className="shrink-0">👑</span>}
                          <span className="truncate">{sh.personnelName}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendar Legend */}
          <div className="mt-5 pt-3.5 border-t border-slate-800/80 text-xs text-slate-400 flex flex-wrap items-center justify-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> 👑 Encargado de Guardia
              </span>
              <span className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Guardia FDS / Feriado
              </span>
              <span className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> 🌴 Vacaciones
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              * Haga clic en un día para ver opciones de asignación y reportes de WhatsApp
            </span>
          </div>
        </div>

        {/* ROW 2: Personnel Balance Panel Table (Full Width) */}
        <div className="w-full bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300">
                  <Users className="w-5 h-5" />
                </div>
                Panel de Saldos de Personal VTV
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Resumen consolidado de guardias trabajadas, días compensatorios generados, disfrutados y balance actual
              </p>
            </div>

            {/* Search Bar for Panel */}
            <div className="relative min-w-[240px] md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={panelSearchQuery}
                onChange={(e) => setPanelSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o rol..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors shadow-inner"
              />
              {panelSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPanelSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Division Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2.5 mb-4 no-scrollbar border-b border-slate-800/80">
            {[
              { id: 'all', label: 'Todas las Divisiones' },
              { id: 'Prensa', label: 'Prensa' },
              { id: 'Programación', label: 'Programación' },
              { id: 'Ingesta', label: 'Ingesta' },
              { id: 'Gerencia', label: 'Gerencia' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPanelDivisionFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  panelDivisionFilter === tab.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Full Width Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40 shadow-inner">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800/80">
                <tr>
                  <th className="py-3 px-4">Personal</th>
                  <th className="py-3 px-4">División</th>
                  <th className="py-3 px-3 text-center">Guardias Trabajadas</th>
                  <th className="py-3 px-3 text-center">Días Generados</th>
                  <th className="py-3 px-3 text-center">Días Disfrutados</th>
                  <th className="py-3 px-3 text-center">Balance Pendiente</th>
                  {hasAccess && <th className="py-3 px-4 text-right">Ajuste Rápido de Días</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredPanelPersonnel.map((per, idx) => (
                  <tr key={per.id ? `per-${per.id}` : `per-idx-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{per.name}</span>
                        {per.pin && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-extrabold flex items-center gap-1 shrink-0" title="Perfil Protegido con PIN">
                            <Lock className="w-2.5 h-2.5 text-amber-400" /> PIN
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-normal mt-0.5">{per.role}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-medium">{per.division}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-purple-300 bg-purple-950/20">
                      {per.guardDaysWorked}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-300 bg-emerald-950/20">
                      {per.daysOffGenerated}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-amber-300 bg-amber-950/20">
                      {per.daysOffTaken}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block font-mono font-extrabold px-2.5 py-1 rounded-lg text-xs ${
                          per.balanceDays > 0
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {per.balanceDays} días
                      </span>
                    </td>
                    {hasAccess && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onQuickAdjustDays(per.id, 'guard')}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1"
                            title="Añadir 1 Guardia trabajada"
                          >
                            + Guardia
                          </button>
                          <button
                            onClick={() => onQuickAdjustDays(per.id, 'dayOff')}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-sm flex items-center gap-1"
                            title="Añadir 1 Día Libre disfrutado"
                          >
                            + Libre
                          </button>
                          {onDeletePersonnel && (
                            <button
                              onClick={() => {
                                if (window.confirm(`¿Está seguro de eliminar a "${per.name}" de la lista de personal?`)) {
                                  onDeletePersonnel(per.id);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-400 border border-red-800/80 transition-colors ml-1"
                              title="Eliminar personal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredPanelPersonnel.length === 0 && (
                  <tr>
                    <td colSpan={hasAccess ? 7 : 6} className="p-8 text-center text-slate-400 text-xs font-medium">
                      No se encontró personal registrado en esta categoría.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Assignment Modal (Multiple Workers, Lead/Encargado, Vacaciones Range & WhatsApp Report) */}
      {selectedCalendarDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-purple-400" />
                  Asignaciones del Día: {selectedCalendarDate}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configuración de guardias, encargado, vacaciones y reporte
                </p>
              </div>
              <button
                onClick={() => setSelectedCalendarDate(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Existing Assignments on this date & WhatsApp Report Bar */}
            {getShiftsForDate(selectedCalendarDate).length > 0 && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    Asignados el {selectedCalendarDate}:
                  </h4>

                  {/* WhatsApp & Duplicate Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleSendWhatsApp(selectedCalendarDate)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={() => handleCopyReport(selectedCalendarDate)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 whitespace-nowrap"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </button>

                    <button
                      onClick={() => {
                        setDuplicateFromDate(selectedCalendarDate);
                        setDuplicateTargetDate('');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow whitespace-nowrap"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>Duplicar a Fecha</span>
                    </button>
                  </div>
                </div>

                {/* List of current assignments */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {getShiftsForDate(selectedCalendarDate).map((sh, idx) => (
                    <div
                      key={`${sh.id}-${idx}`}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-white flex items-center gap-1.5 truncate">
                          {sh.isLead && <span title="Encargado de Guardia">👑</span>}
                          <span className="truncate">{sh.personnelName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {sh.division} • {sh.shiftType}
                          {sh.endDate && ` (${sh.date} al ${sh.endDate})`}
                        </div>
                      </div>

                      {onDeleteGuardShift && (
                        <button
                          onClick={() => onDeleteGuardShift(sh.id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                          title="Eliminar asignación"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mode Switcher Tabs */}
            <div className={`grid gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 ${canAssignVacations ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <button
                type="button"
                onClick={() => setAssignmentMode('guardia')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  assignmentMode === 'guardia'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span>Guardia (Múltiples)</span>
              </button>

              {canAssignVacations && (
                <button
                  type="button"
                  onClick={() => setAssignmentMode('vacaciones')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    assignmentMode === 'vacaciones'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Palmtree className="w-3.5 h-3.5 shrink-0" />
                  <span>Vacaciones</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setAssignmentMode('diaLibre')}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  assignmentMode === 'diaLibre'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 shrink-0" />
                <span>Día Libre</span>
              </button>
            </div>

            {/* Assignment Form */}
            <form onSubmit={handleSaveAssignment} className="space-y-4">
              {/* Buscador de Personal en Asignaciones del Día */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  🔍 Buscar Personal para Asignación:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={assignSearchQuery}
                    onChange={(e) => setAssignSearchQuery(e.target.value)}
                    placeholder="Escriba nombre, división o rol para filtrar..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-all shadow-inner"
                  />
                  {assignSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setAssignSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white p-0.5 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* MODE 1: GUARDIA (Multiple Workers & Encargado) */}
              {assignmentMode === 'guardia' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Seleccionar Trabajadores de Guardia por División & Designar Encargado 👑
                    </label>
                    <span className="text-[10px] text-purple-300 font-mono font-bold">
                      {selectedWorkerIds.length} seleccionados
                    </span>
                  </div>

                  {/* Multi Worker Checklist Divided by Division */}
                  <div className="max-h-60 overflow-y-auto space-y-3 pr-1 border border-slate-800 rounded-xl p-2.5 bg-slate-950">
                    {(Object.entries(groupedPersonnelForAssign) as [string, Personnel[]][]).map(([divisionName, members]) => {
                      if (members.length === 0) return null;
                      const selectedInDivCount = members.filter((m) => selectedWorkerIds.includes(m.id)).length;

                      return (
                        <div key={divisionName} className="space-y-1.5">
                          {/* Division Header */}
                          <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                              División {divisionName}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              {selectedInDivCount} de {members.length} sel.
                            </span>
                          </div>

                          {/* Members List in Division */}
                          <div className="space-y-1 pl-1">
                            {members.map((p) => {
                              const isSelected = selectedWorkerIds.includes(p.id);
                              const isLead = leadWorkerId === p.id;

                              return (
                                <div
                                  key={p.id}
                                  className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-all ${
                                    isSelected
                                      ? 'bg-purple-950/40 border-purple-500/50 text-white shadow-sm'
                                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleWorker(p.id)}
                                      className="rounded border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4"
                                    />
                                    <div>
                                      <div className="font-semibold text-white">{p.name}</div>
                                      <div className="text-[10px] text-slate-400">{p.role}</div>
                                    </div>
                                  </label>

                                  {/* Lead / Encargado Designation Button */}
                                  {isSelected && (
                                    <button
                                      type="button"
                                      onClick={() => setLeadWorkerId(p.id)}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold flex items-center gap-1 border transition-all ${
                                        isLead
                                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md ring-1 ring-amber-300'
                                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-amber-300'
                                      }`}
                                    >
                                      <Crown className="w-3 h-3" />
                                      <span>{isLead ? 'Encargado 👑' : 'Hacer Encargado'}</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {filteredPersonnelForAssign.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">
                        No se encontró personal con "{assignSearchQuery}".
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Observaciones / Instrucciones de Guardia
                    </label>
                    <input
                      type="text"
                      value={guardNotes}
                      onChange={(e) => setGuardNotes(e.target.value)}
                      placeholder="Ej: Transmisión especial de fin de semana, cobertura Noticiero."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500"
                    />
                  </div>
                </div>
              )}

              {/* MODE 2: VACACIONES CON RANGO DE FECHAS */}
              {assignmentMode === 'vacaciones' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Trabajador para Vacaciones (Agrupado por División) *
                    </label>
                    <select
                      value={vacationPersonId}
                      onChange={(e) => setVacationPersonId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold"
                    >
                      {(Object.entries(groupedPersonnelForAssign) as [string, Personnel[]][]).map(([divisionName, members]) => {
                        if (members.length === 0) return null;
                        return (
                          <optgroup key={divisionName} label={`DIVISIÓN: ${divisionName.toUpperCase()}`}>
                            {members.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.role} - Balance: {p.balanceDays}d)
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Fecha Inicio Vacaciones *
                      </label>
                      <input
                        type="date"
                        required
                        value={vacationStartDate}
                        onChange={(e) => setVacationStartDate(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Fecha Fin Vacaciones *
                      </label>
                      <input
                        type="date"
                        required
                        value={vacationEndDate}
                        onChange={(e) => setVacationEndDate(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Notas de Vacaciones
                    </label>
                    <input
                      type="text"
                      value={vacationNotes}
                      onChange={(e) => setVacationNotes(e.target.value)}
                      placeholder="Ej: Periodo Vacacional Anual 2025-2026 aprobado por Recursos Humanos."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500"
                    />
                  </div>
                </div>
              )}

              {/* MODE 3: DIA LIBRE COMPENSATORIO */}
              {assignmentMode === 'diaLibre' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Trabajador (Agrupado por División) *
                    </label>
                    <select
                      value={dayOffPersonId}
                      onChange={(e) => setDayOffPersonId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold"
                    >
                      {(Object.entries(groupedPersonnelForAssign) as [string, Personnel[]][]).map(([divisionName, members]) => {
                        if (members.length === 0) return null;
                        return (
                          <optgroup key={divisionName} label={`DIVISIÓN: ${divisionName.toUpperCase()}`}>
                            {members.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.role} - Balance: {p.balanceDays}d libres)
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Notas
                    </label>
                    <input
                      type="text"
                      value={dayOffNotes}
                      onChange={(e) => setDayOffNotes(e.target.value)}
                      placeholder="Ej: Disfrute de día libre por guardia anterior."
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedCalendarDate(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg"
                >
                  Guardar Asignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplication Modal */}
      {duplicateFromDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-blue-400" />
                Duplicar Guardia del {duplicateFromDate}
              </h3>
              <button
                onClick={() => setDuplicateFromDate(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Esta acción copiará exactamente la misma lista de trabajadores y al <strong>Encargado de Guardia 👑</strong> asignados el <strong>{duplicateFromDate}</strong> a la nueva fecha seleccionada:
            </p>

            <form onSubmit={handleDuplicateGuardConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Fecha Destino *
                </label>
                <input
                  type="date"
                  required
                  value={duplicateTargetDate}
                  onChange={(e) => setDuplicateTargetDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDuplicateFromDate(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg"
                >
                  Duplicar Guardia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Personnel Modal */}
      {isAddingPersonnel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Registrar Nuevo Personal
              </h3>
              <button
                onClick={() => setIsAddingPersonnel(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePersonnel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="Ej: Lic. Alexander Briceño"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Rol *
                  </label>
                  <select
                    value={newPersonRole}
                    onChange={(e) => setNewPersonRole(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm"
                  >
                    <option value="Gerente de Archivo">Gerente de Archivo</option>
                    <option value="Adjunta de Gerencia">Adjunta de Gerencia</option>
                    <option value="Asistente Administrativa">Asistente Admin</option>
                    <option value="Jefe de División">Jefe de División</option>
                    <option value="Coordinador">Coordinador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    División *
                  </label>
                  <select
                    value={newPersonDivision}
                    onChange={(e) => setNewPersonDivision(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm"
                  >
                    <option value="Gerencia">Gerencia</option>
                    <option value="Prensa">Prensa</option>
                    <option value="Programación">Programación</option>
                    <option value="Ingesta">Ingesta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  PIN de Seguridad (Opcional, 4-6 dígitos)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPersonPin}
                  onChange={(e) => setNewPersonPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ej: 1234 (Dejar vacío para sin PIN)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono tracking-widest placeholder-slate-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingPersonnel(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg"
                >
                  Guardar Personal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
