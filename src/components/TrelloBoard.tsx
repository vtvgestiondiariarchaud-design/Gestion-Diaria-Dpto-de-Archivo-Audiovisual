import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Briefcase, Clock, Save, Download, 
  Trash, Search, Calendar, RefreshCw, AlertCircle, Check, Lock
} from 'lucide-react';
import { Division, Worker, ShiftAssignment, ShiftType, ShiftTemplate, UserRole } from '../types';

interface TrelloBoardProps {
  currentDivisionId: string;
  divisions: Division[];
  workers: Worker[];
  assignments: ShiftAssignment[];
  onUpdateAssignments: (updated: ShiftAssignment[], divisionId?: string, date?: string) => void;
  userRole: UserRole;
  userDivisionId?: string;
  onAddNotification: (title: string, desc: string, type: 'success' | 'info') => void;
  selectedDateStr: string;
  setSelectedDateStr: (date: string) => void;
  operationalDates: string[];
  onAddOperationalDate: (date: string) => void;
}

const SHIFT_COLUMNS: { key: ShiftType; title: string; time: string; color: string; border: string; glow: string }[] = [
  { 
    key: 'pool', 
    title: 'Personal Disponible / Pool', 
    time: 'Sin turno hoy', 
    color: 'glass bg-white/2', 
    border: 'border-white/5', 
    glow: 'shadow-slate-500/5' 
  },
  { 
    key: 'manana', 
    title: 'Turno Mañana', 
    time: '06:00 - 14:00', 
    color: 'glass bg-[#00f2ff]/5', 
    border: 'border-[#00f2ff]/20', 
    glow: 'glow-cyan' 
  },
  { 
    key: 'tarde', 
    title: 'Turno Tarde', 
    time: '14:00 - 22:00', 
    color: 'glass bg-[#ff00c8]/5', 
    border: 'border-[#ff00c8]/20', 
    glow: 'glow-pink' 
  },
  { 
    key: 'noche', 
    title: 'Turno Noche', 
    time: '22:00 - 06:00', 
    color: 'glass bg-[#8a2be2]/5', 
    border: 'border-[#8a2be2]/20', 
    glow: 'glow-purple' 
  }
];

const getDivisionBadge = (divId: string) => {
  switch (divId) {
    case 'div_archivo_prensa':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'div_archivo_programacion':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'div_ingesta':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    default:
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
  }
};

interface SingleDivisionBoardProps {
  division: Division;
  divisions: Division[];
  workers: Worker[];
  assignments: ShiftAssignment[];
  onUpdateAssignments: (updated: ShiftAssignment[], divisionId?: string, date?: string) => void;
  userRole: UserRole;
  userDivisionId?: string;
  onAddNotification: (title: string, desc: string, type: 'success' | 'info') => void;
  selectedDateStr: string;
  searchTerm: string;
}

function SingleDivisionBoard({
  division,
  divisions,
  workers,
  assignments,
  onUpdateAssignments,
  userRole,
  userDivisionId,
  onAddNotification,
  selectedDateStr,
  searchTerm
}: SingleDivisionBoardProps) {
  const [newTemplateName, setNewTemplateName] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<ShiftType | null>(null);

  // Template System using LocalStorage
  const [savedTemplates, setSavedTemplates] = useState<ShiftTemplate[]>(() => {
    const saved = localStorage.getItem('vtv_shift_templates');
    return saved ? JSON.parse(saved) : [];
  });

  // For the consolidated view, write access overall is shown if user has any administrative power.
  // Individual card actions have more specific checks.
  const hasWriteAccess = useMemo(() => {
    if (userRole === 'superadmin' || userRole === 'deputy') return true;
    if (userRole === 'coordinator') {
      if (division.id === 'todos') return true; // Can edit their own area in consolidated view
      return userDivisionId === division.id;
    }
    return false;
  }, [userRole, userDivisionId, division]);

  // Get all workers for this division (or all workers if 'todos' is selected)
  const boardWorkers = useMemo(() => {
    if (division.id === 'todos') {
      return workers;
    }
    return workers.filter(w => w.divisionId === division.id);
  }, [workers, division]);

  // Group workers by their current shift
  const columnWorkers = useMemo(() => {
    const grouped: Record<ShiftType, Worker[]> = {
      pool: [],
      manana: [],
      tarde: [],
      noche: [],
      libre: []
    };

    boardWorkers.forEach(worker => {
      // Find assignments on the selected date
      const workerAssigns = assignments.filter(
        a => a.workerId === worker.id && a.date === selectedDateStr
      );

      // Filter out pool/libre
      const activeAssigns = workerAssigns.filter(a => a.shiftType !== 'pool' && a.shiftType !== 'libre');

      if (activeAssigns.length > 0) {
        activeAssigns.forEach(asg => {
          if (grouped[asg.shiftType]) {
            if (!grouped[asg.shiftType].some(w => w.id === worker.id)) {
              grouped[asg.shiftType].push(worker);
            }
          }
        });
      } else {
        grouped['pool'].push(worker);
      }
    });

    return grouped;
  }, [boardWorkers, assignments, selectedDateStr]);

  const filteredTemplates = useMemo(() => {
    return savedTemplates.filter(t => t.divisionId === division.id);
  }, [savedTemplates, division]);

  // Toggle individual worker shift
  const toggleWorkerShift = (worker: Worker, shiftType: 'manana' | 'tarde' | 'noche') => {
    const canEditWorker = userRole === 'superadmin' || userRole === 'deputy' || (userRole === 'coordinator' && userDivisionId === worker.divisionId);
    if (!canEditWorker) {
      onAddNotification('Acceso Denegado', 'No tienes permisos para modificar el turno de personal de otra división.', 'info');
      return;
    }

    const updated = [...assignments];
    // Find if they already have this assignment on this date
    const existingIndex = updated.findIndex(
      a => a.workerId === worker.id && a.shiftType === shiftType && a.date === selectedDateStr
    );

    if (existingIndex > -1) {
      // Toggle off
      updated.splice(existingIndex, 1);
    } else {
      // Toggle on - adding a shift assignment
      updated.push({
        id: `as_${worker.id}_${shiftType}_${Date.now()}`,
        workerId: worker.id,
        divisionId: worker.divisionId,
        date: selectedDateStr,
        shiftType
      });
    }

    onUpdateAssignments(updated, worker.divisionId, selectedDateStr);
  };

  // Handle Drag Start
  const handleDragStart = (e: React.DragEvent, worker: Worker) => {
    const canEditWorker = userRole === 'superadmin' || userRole === 'deputy' || (userRole === 'coordinator' && userDivisionId === worker.divisionId);
    if (!canEditWorker) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', worker.id);
    setActiveDragId(worker.id);
  };

  // Handle Drag End
  const handleDragEnd = () => {
    setActiveDragId(null);
    setDraggedOverColumn(null);
  };

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent, colKey: ShiftType) => {
    if (!hasWriteAccess) return;
    e.preventDefault();
    if (draggedOverColumn !== colKey) {
      setDraggedOverColumn(colKey);
    }
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent, targetShift: ShiftType) => {
    e.preventDefault();
    const workerId = e.dataTransfer.getData('text/plain') || activeDragId;
    
    if (!workerId) return;

    const workerObj = workers.find(w => w.id === workerId);
    if (!workerObj) return;

    // Verify permission for this specific worker
    const canEditWorker = userRole === 'superadmin' || userRole === 'deputy' || (userRole === 'coordinator' && userDivisionId === workerObj.divisionId);
    if (!canEditWorker) {
      onAddNotification('Acceso Denegado', `No tienes permisos para reubicar a ${workerObj.name} (pertenece a otra división).`, 'info');
      setActiveDragId(null);
      setDraggedOverColumn(null);
      return;
    }

    let updated = [...assignments];

    if (targetShift === 'pool') {
      // Remove all assignments for this worker ON THIS DATE
      updated = updated.filter(a => !(a.workerId === workerId && a.date === selectedDateStr));
      onUpdateAssignments(updated, workerObj.divisionId, selectedDateStr);
      onAddNotification(
        'Personal al Pool',
        `${workerObj.name} fue devuelto al Pool de Disponibles para el ${selectedDateStr}.`,
        'info'
      );
    } else {
      // Adding/moving to an active shift - first clean previous assignments of this worker for this day
      updated = updated.filter(a => !(a.workerId === workerId && a.date === selectedDateStr));
      
      updated.push({
        id: `as_${workerId}_${targetShift}_${Date.now()}`,
        workerId,
        divisionId: workerObj.divisionId,
        date: selectedDateStr,
        shiftType: targetShift
      });
      onUpdateAssignments(updated, workerObj.divisionId, selectedDateStr);
      onAddNotification(
        'Turno Asignado',
        `${workerObj.name} fue asignado a ${SHIFT_COLUMNS.find(c => c.key === targetShift)?.title} para el ${selectedDateStr}`,
        'success'
      );
    }

    setActiveDragId(null);
    setDraggedOverColumn(null);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    const templateAssignments: Record<string, any> = {};
    boardWorkers.forEach(w => {
      const activeAsgs = assignments
        .filter(a => a.workerId === w.id && a.divisionId === division.id && a.shiftType !== 'pool' && a.date === selectedDateStr)
        .map(a => a.shiftType);
      
      templateAssignments[w.id] = activeAsgs.length > 0 ? activeAsgs : ['pool'];
    });

    const newTemplate: ShiftTemplate = {
      id: `tmpl_${Date.now()}`,
      name: newTemplateName.trim(),
      divisionId: division.id,
      assignments: templateAssignments as any
    };

    const updated = [...savedTemplates, newTemplate];
    setSavedTemplates(updated);
    localStorage.setItem('vtv_shift_templates', JSON.stringify(updated));
    setNewTemplateName('');
    onAddNotification('Plantilla Guardada', `Se guardó la distribución "${newTemplate.name}" con éxito para el día ${selectedDateStr}.`, 'success');
  };

  const handleLoadTemplate = (template: ShiftTemplate) => {
    let updated = assignments.filter(a => !(a.divisionId === division.id && a.date === selectedDateStr));
    
    Object.entries(template.assignments).forEach(([workerId, val]) => {
      const shifts: ShiftType[] = Array.isArray(val) ? val : [val];
      
      shifts.forEach(shiftType => {
        if (shiftType !== 'pool' && shiftType !== 'libre') {
          updated.push({
            id: `as_${workerId}_${shiftType}_${Date.now()}`,
            workerId,
            divisionId: division.id,
            date: selectedDateStr,
            shiftType
          });
        }
      });
    });

    onUpdateAssignments(updated, division.id, selectedDateStr);
    onAddNotification('Plantilla Cargada', `Se aplicó la plantilla "${template.name}" para el día ${selectedDateStr}.`, 'info');
  };

  const handleDeleteTemplate = (id: string, name: string) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    localStorage.setItem('vtv_shift_templates', JSON.stringify(updated));
    onAddNotification('Plantilla Eliminada', `Se eliminó la plantilla "${name}".`, 'info');
  };

  const handleResetBoard = () => {
    const updated = assignments.filter(a => !(a.divisionId === division.id && a.date === selectedDateStr));
    onUpdateAssignments(updated, division.id, selectedDateStr);
    onAddNotification('Tablero Reiniciado', `Todos los trabajadores volvieron al Pool de Disponibles para el día ${selectedDateStr}.`, 'info');
  };

  const filteredColumnWorkers = (shiftKey: ShiftType) => {
    const list = columnWorkers[shiftKey] || [];
    if (!searchTerm.trim()) return list;
    return list.filter(w => 
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      w.cargo.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-slate-950/20 border border-white/5">
      {/* Board Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
        {/* Left Side: Division Info & Permissions warning */}
        <div className="flex flex-col gap-1 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Users size={18} />
            </span>
            <h3 className="text-sm font-bold text-white">
              {division.name}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {division.id === 'todos' ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-semibold border border-violet-500/20">
                Consolidado de Guardia General (VTV)
              </span>
            ) : hasWriteAccess ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                Edición Activa (Coordinador / Gerente)
              </span>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-amber-400">
                <AlertCircle size={10} />
                <span>Solo Lectura</span>
              </div>
            )}
          </div>
        </div>

        {/* Template Quick Loader & Reset (Visible for single division writers) */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {division.id === 'todos' ? (
            <div className="text-[11px] text-slate-400 italic">
              Para aplicar plantillas o reiniciar, filtra por una división específica.
            </div>
          ) : hasWriteAccess ? (
            <>
              {filteredTemplates.length > 0 && (
                <div className="relative group">
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 rounded-xl text-xs text-sky-300 font-medium transition-all cursor-pointer">
                    <Download size={13} />
                    <span>Plantillas ({filteredTemplates.length})</span>
                  </div>
                  <div className="absolute right-0 mt-2 w-56 hidden group-hover:flex flex-col bg-slate-950/95 border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-fade-in">
                    <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-white/5 mb-1">
                      Selecciona una Plantilla
                    </div>
                    {filteredTemplates.map(t => (
                      <div 
                        key={t.id} 
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/5 text-slate-200 text-xs cursor-pointer"
                      >
                        <span onClick={() => handleLoadTemplate(t)} className="flex-1 text-left truncate font-medium hover:text-cyan-400 transition-colors">
                          {t.name}
                        </span>
                        <button 
                          onClick={() => handleDeleteTemplate(t.id, t.name)}
                          className="p-1 hover:text-rose-400 rounded transition-all"
                          title="Eliminar plantilla"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleResetBoard}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/30 hover:bg-rose-950/50 border border-rose-500/20 rounded-xl text-xs text-rose-300 font-medium transition-all cursor-pointer"
                title="Reiniciar tablero al pool"
              >
                <RefreshCw size={13} />
                <span>Reiniciar</span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Save Template mini form (if single division write-access) */}
      {hasWriteAccess && division.id !== 'todos' && (
        <form onSubmit={handleSaveTemplate} className="flex gap-2 p-2 bg-white/5 backdrop-blur-md border border-white/5 rounded-xl">
          <input
            type="text"
            required
            placeholder="Guardar distribución actual como plantilla (ej: Fin de Semana)..."
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            className="flex-1 bg-slate-900/40 border border-white/10 rounded-lg px-3 py-1 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-all"
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-4 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            <Save size={13} />
            <span>Guardar</span>
          </button>
        </form>
      )}

      {/* Board Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
        {SHIFT_COLUMNS.map((col) => {
          const isOver = draggedOverColumn === col.key;
          const list = filteredColumnWorkers(col.key);

          return (
            <div
              key={col.key}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDrop={(e) => handleDrop(e, col.key)}
              className={`flex flex-col min-h-[380px] p-4 rounded-2xl border transition-all duration-300 ${col.color} ${col.border} ${col.glow} ${
                isOver ? 'ring-2 ring-cyan-500 border-cyan-400 bg-cyan-950/20 scale-[1.01]' : ''
              }`}
            >
              {/* Column Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm truncate">{col.title}</h4>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                    {list.length}
                  </span>
                </div>
                {col.key === 'pool' && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                    <span>Sin turno hoy</span>
                  </div>
                )}
              </div>

              {/* Column Body / Drop Zone */}
              <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-[400px] pr-1">
                {list.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-white/5 rounded-xl text-center">
                    <span className="text-[11px] text-slate-500 italic">
                      {hasWriteAccess ? 'Arrastra personal aquí' : 'Sin personal'}
                    </span>
                  </div>
                ) : (
                  <AnimatePresence>
                    {list.map((worker) => {
                      const canEditWorker = userRole === 'superadmin' || userRole === 'deputy' || (userRole === 'coordinator' && userDivisionId === worker.divisionId);

                      return (
                        <motion.div
                          key={`${col.key}-${worker.id}`}
                          layoutId={`${col.key}-${worker.id}`}
                          draggable={canEditWorker}
                          onDragStart={(e) => handleDragStart(e, worker)}
                          onDragEnd={handleDragEnd}
                          className={`p-3.5 frosted-card shadow-md flex flex-col gap-2 transition-all ${
                            canEditWorker 
                              ? 'cursor-grab active:cursor-grabbing hover:border-white/25' 
                              : 'cursor-default opacity-85'
                          }`}
                          whileHover={canEditWorker ? { y: -2, scale: 1.02 } : {}}
                        >
                          {/* Worker Identity */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col">
                              <span className="font-semibold text-white text-xs leading-tight">
                                {worker.name}
                              </span>
                              {worker.cedula && (
                                <span className="text-[9px] text-cyan-400 font-mono mt-0.5 font-bold">
                                  C.I: {worker.cedula}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-300 font-medium mt-1 truncate max-w-[140px]">
                                {worker.cargo}
                              </span>
                            </div>
                            
                            {/* Colored indicator bulb or Lock icon */}
                            {canEditWorker ? (
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                col.key === 'manana' ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]' :
                                col.key === 'tarde' ? 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]' :
                                col.key === 'noche' ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]' :
                                'bg-slate-400'
                              }`} />
                            ) : (
                              <span className="text-slate-500 shrink-0" title="Solo lectura (pertenece a otra división)">
                                <Lock size={12} />
                              </span>
                            )}
                          </div>

                          {/* Division Badge (Only in consolidated view) */}
                          {division.id === 'todos' && (
                            <div className="flex items-center gap-1">
                              <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border font-mono tracking-wider ${getDivisionBadge(worker.divisionId)}`}>
                                {divisions.find(d => d.id === worker.divisionId)?.name || 'Sin Área'}
                              </span>
                            </div>
                          )}

                          {/* Active Shifts Multi-Selector */}
                          <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] uppercase font-bold text-slate-400 font-mono">
                                Asignar Turno:
                              </span>
                              {/* Multi-turn label indicator */}
                              {assignments.filter(a => a.workerId === worker.id).length > 1 && (
                                <span className="text-[8px] font-bold text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded font-mono uppercase">
                                  Multi-turno
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {[
                                { key: 'manana', label: 'M', title: 'Turno Mañana', color: 'bg-sky-500/25 text-sky-300 border-sky-500/30', activeColor: 'bg-sky-500 text-slate-950 font-bold border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]' },
                                { key: 'tarde', label: 'T', title: 'Turno Tarde', color: 'bg-pink-500/25 text-pink-300 border-pink-500/30', activeColor: 'bg-pink-500 text-slate-950 font-bold border-pink-400 shadow-[0_0_10px_rgba(244,63,94,0.4)]' },
                                { key: 'noche', label: 'N', title: 'Turno Noche', color: 'bg-purple-500/25 text-purple-300 border-purple-500/30', activeColor: 'bg-purple-500 text-slate-950 font-bold border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]' }
                              ].map(btn => {
                                const isActive = assignments.some(
                                  a => a.workerId === worker.id && a.shiftType === btn.key
                                );
                                return (
                                  <button
                                    key={btn.key}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canEditWorker) {
                                        toggleWorkerShift(worker, btn.key as any);
                                      }
                                    }}
                                    disabled={!canEditWorker}
                                    className={`flex-1 py-0.5 rounded text-[9px] border transition-all cursor-pointer text-center ${
                                      isActive ? btn.activeColor : `${btn.color} opacity-60 hover:opacity-100`
                                    } ${!canEditWorker ? 'cursor-not-allowed opacity-40' : ''}`}
                                    title={!canEditWorker ? 'No tienes permisos en esta división' : `${isActive ? 'Remover de' : 'Asignar a'} ${btn.title}`}
                                  >
                                    {btn.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrelloBoard({
  currentDivisionId,
  divisions,
  workers,
  assignments,
  onUpdateAssignments,
  userRole,
  userDivisionId,
  onAddNotification,
  selectedDateStr,
  setSelectedDateStr,
  operationalDates,
  onAddOperationalDate
}: TrelloBoardProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const activeDivision = useMemo(() => {
    return divisions.find(d => d.id === currentDivisionId);
  }, [divisions, currentDivisionId]);

  return (
    <div className="space-y-6">
      {/* Dynamic Multi-day Operational Checklist */}
      <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar size={16} className="text-cyan-400" />
              <span>Lista de Verificación de Días de Guardia</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Selecciona el día para ver o planificar la distribución de turnos de este tablero operativo.
            </p>
          </div>
          
          {/* Create new operational date */}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              id="new-guard-date-board"
              className="bg-slate-900/60 border border-white/10 hover:border-white/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all font-mono"
            />
            <button
              onClick={() => {
                const el = document.getElementById('new-guard-date-board') as HTMLInputElement;
                if (el && el.value) {
                  onAddOperationalDate(el.value);
                  el.value = '';
                }
              }}
              className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Habilitar Día</span>
            </button>
          </div>
        </div>

        {/* Checklist of Dates */}
        <div className="flex flex-wrap gap-2 pt-1">
          {operationalDates.map((dateVal) => {
            const isSelected = selectedDateStr === dateVal;
            const parts = dateVal.split('-').map(Number);
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const dayName = dayNamesShort[d.getDay()];
            const formatted = `${dayName} ${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}`;

            return (
              <button
                key={dateVal}
                onClick={() => setSelectedDateStr(dateVal)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)] font-bold'
                    : 'bg-slate-900/40 text-slate-400 border-white/5 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                  isSelected ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-white/20'
                }`}>
                  {isSelected && <Check size={10} strokeWidth={4} />}
                </div>
                <span className="font-mono">{formatted}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Unified Search across all boards */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
        <div>
          <span className="text-[10px] font-mono text-slate-500 block uppercase">Visualización</span>
          <span className="text-sm font-extrabold text-white font-sans mt-0.5 block">
            {currentDivisionId === 'todos' ? 'Tablero General (Consolidado de Divisiones)' : `Tablero de la División: ${activeDivision?.name || ''}`}
          </span>
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Buscar por personal o cargo en todo el tablero..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
          />
          <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
        </div>
      </div>

      {/* Render Consolidated or Single Division Board */}
      {currentDivisionId === 'todos' ? (
        <SingleDivisionBoard
          division={{
            id: 'todos',
            name: 'Tablero Consolidado (Todas las Divisiones)',
            description: 'Vista unificada de todas las divisiones operativas de guardia de VTV.',
            coordinatorId: null,
            coordinatorName: null
          }}
          divisions={divisions}
          workers={workers}
          assignments={assignments}
          onUpdateAssignments={onUpdateAssignments}
          userRole={userRole}
          userDivisionId={userDivisionId}
          onAddNotification={onAddNotification}
          selectedDateStr={selectedDateStr}
          searchTerm={searchTerm}
        />
      ) : (
        activeDivision ? (
          <SingleDivisionBoard
            division={activeDivision}
            divisions={divisions}
            workers={workers}
            assignments={assignments}
            onUpdateAssignments={onUpdateAssignments}
            userRole={userRole}
            userDivisionId={userDivisionId}
            onAddNotification={onAddNotification}
            selectedDateStr={selectedDateStr}
            searchTerm={searchTerm}
          />
        ) : (
          <div className="p-8 text-center bg-slate-950/40 border border-white/5 rounded-2xl">
            <p className="text-xs text-slate-400">Selecciona una división válida o la opción de ver todas.</p>
          </div>
        )
      )}
    </div>
  );
}
