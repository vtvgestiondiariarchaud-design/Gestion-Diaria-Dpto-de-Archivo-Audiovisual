import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, RefreshCw, Check, X, Plus, Clock, MessageSquare, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { Division, Worker, ShiftAssignment, ShiftChangeRequest, ShiftType, UserRole } from '../types';

interface ShiftChangesProps {
  workers: Worker[];
  divisions: Division[];
  assignments: ShiftAssignment[];
  requests: ShiftChangeRequest[];
  userRole: UserRole;
  userDivisionId?: string;
  currentUserId?: string;
  onUpdateRequests: (updated: ShiftChangeRequest[]) => void;
  onUpdateAssignments: (updated: ShiftAssignment[]) => void;
  onAddNotification: (title: string, desc: string, type: 'success' | 'info') => void;
}

export default function ShiftChanges({
  workers,
  divisions,
  assignments,
  requests,
  userRole,
  userDivisionId,
  currentUserId,
  onUpdateRequests,
  onUpdateAssignments,
  onAddNotification
}: ShiftChangesProps) {
  const [activeTab, setActiveTab] = useState<'view_schedule' | 'create_request' | 'manage_requests'>('view_schedule');
  
  // Create Request State
  const [targetWorkerId, setTargetWorkerId] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Current worker's profile
  const currentWorker = useMemo(() => {
    return workers.find(w => w.id === currentUserId);
  }, [workers, currentUserId]);

  // Current worker's division
  const currentDivision = useMemo(() => {
    const divId = currentWorker?.divisionId || userDivisionId;
    return divisions.find(d => d.id === divId);
  }, [divisions, currentWorker, userDivisionId]);

  // Filter possible swap partners (must be in the same division and NOT the same worker)
  const swapPartners = useMemo(() => {
    if (!currentWorker) return [];
    return workers.filter(w => w.divisionId === currentWorker.divisionId && w.id !== currentWorker.id);
  }, [workers, currentWorker]);

  // Current worker's personalized calendar/schedule list
  const currentWorkerSchedule = useMemo(() => {
    if (!currentWorker) return [];
    // Just find today's assignments as a demo, but let's list the assignment info
    return assignments.filter(a => a.workerId === currentWorker.id);
  }, [assignments, currentWorker]);

  // Filter requests that are manageable by the current user
  const manageableRequests = useMemo(() => {
    if (userRole === 'superadmin' || userRole === 'deputy') return requests;
    if (userRole === 'coordinator') {
      return requests.filter(r => r.divisionId === userDivisionId);
    }
    // Workers can only see requests they created or are targeted in
    return requests.filter(r => r.requesterId === currentUserId || r.targetWorkerId === currentUserId);
  }, [requests, userRole, userDivisionId, currentUserId]);

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorker || !targetWorkerId || !requestReason.trim()) return;

    const target = workers.find(w => w.id === targetWorkerId);
    if (!target) return;

    const newRequest: ShiftChangeRequest = {
      id: `req_${Date.now()}`,
      requesterId: currentWorker.id,
      requesterName: currentWorker.name,
      targetWorkerId: target.id,
      targetWorkerName: target.name,
      divisionId: currentWorker.divisionId,
      date: requestDate,
      reason: requestReason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    onUpdateRequests([newRequest, ...requests]);
    setRequestReason('');
    setTargetWorkerId('');
    onAddNotification('Solicitud Registrada', `Se envió la propuesta de intercambio a ${target.name}.`, 'success');
    setActiveTab('view_schedule');
  };

  // Process shift swap in the assignments array on Approval!
  const handleApproveRequest = (request: ShiftChangeRequest) => {
    const requesterId = request.requesterId;
    const targetId = request.targetWorkerId;
    const date = request.date;

    const updatedAssignments = [...assignments];

    // Find assignments of both workers on that specific date
    const reqAssignIdx = updatedAssignments.findIndex(a => a.workerId === requesterId && a.date === date);
    const tarAssignIdx = updatedAssignments.findIndex(a => a.workerId === targetId && a.date === date);

    const reqShift: ShiftType = reqAssignIdx > -1 ? updatedAssignments[reqAssignIdx].shiftType : 'pool';
    const tarShift: ShiftType = tarAssignIdx > -1 ? updatedAssignments[tarAssignIdx].shiftType : 'pool';

    // Perform swap or insert assignments if they didn't exist
    if (reqAssignIdx > -1) {
      updatedAssignments[reqAssignIdx] = { ...updatedAssignments[reqAssignIdx], shiftType: tarShift };
    } else {
      updatedAssignments.push({
        id: `as_${requesterId}_${Date.now()}`,
        workerId: requesterId,
        divisionId: request.divisionId,
        date,
        shiftType: tarShift
      });
    }

    if (tarAssignIdx > -1) {
      updatedAssignments[tarAssignIdx] = { ...updatedAssignments[tarAssignIdx], shiftType: reqShift };
    } else {
      updatedAssignments.push({
        id: `as_${targetId}_${Date.now()}`,
        workerId: targetId,
        divisionId: request.divisionId,
        date,
        shiftType: reqShift
      });
    }

    // Save assignments and mark request as approved
    onUpdateAssignments(updatedAssignments);

    const updatedRequests = requests.map(r => {
      if (r.id === request.id) {
        return { ...r, status: 'approved' as const };
      }
      return r;
    });
    onUpdateRequests(updatedRequests);

    onAddNotification(
      'Intercambio Aprobado',
      `Se han intercambiado con éxito los turnos de ${request.requesterName} y ${request.targetWorkerName}.`,
      'success'
    );
  };

  const handleRejectRequest = (requestId: string) => {
    const updatedRequests = requests.map(r => {
      if (r.id === requestId) {
        return { ...r, status: 'rejected' as const };
      }
      return r;
    });
    onUpdateRequests(updatedRequests);
    onAddNotification('Solicitud Rechazada', 'Se denegó la propuesta de cambio de guardia.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-2 p-1 bg-slate-900/50 border border-white/10 rounded-xl max-w-lg">
        <button
          onClick={() => setActiveTab('view_schedule')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'view_schedule' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar size={13} />
          <span>Mi Cronograma</span>
        </button>
        {userRole === 'worker' && (
          <button
            onClick={() => setActiveTab('create_request')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'create_request' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus size={13} />
            <span>Intercambiar Turno</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('manage_requests')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'manage_requests' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <RefreshCw size={13} />
          <span>
            {userRole === 'worker' ? 'Mis Solicitudes' : 'Gestionar Cambios'}
            {manageableRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-bold text-[9px]">
                {manageableRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Panels */}
      <div>
        {activeTab === 'view_schedule' && (
          <div className="space-y-6 animate-fade-in">
            {/* Quick Profile Overview */}
            {currentWorker ? (
              <div className="p-4 glass-panel flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white">{currentWorker.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    División: <span className="text-cyan-400 font-medium">{currentDivision?.name}</span> • Cargo: <span className="text-slate-300 font-medium">{currentWorker.cargo}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/10">
                    Sincronizado
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 glass-panel">
                <p className="text-xs text-slate-400 italic">
                  Inicia sesión o regístrate como Trabajador en la cabecera superior para visualizar tu calendario personalizado y agendar intercambios.
                </p>
              </div>
            )}

            {/* Simulated Calendar Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 glass-card flex flex-col justify-between min-h-[120px]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Guardia de Hoy</span>
                  <h5 className="text-lg font-bold text-white mt-1.5">
                    {currentWorkerSchedule.length > 0 
                      ? currentWorkerSchedule[0].shiftType === 'manana' ? 'Turno Mañana (06:00 - 14:00)' :
                        currentWorkerSchedule[0].shiftType === 'tarde' ? 'Turno Tarde (14:00 - 22:00)' :
                        currentWorkerSchedule[0].shiftType === 'noche' ? 'Turno Noche (22:00 - 06:00)' :
                        currentWorkerSchedule[0].shiftType === 'libre' ? 'Día de Descanso / Libre' : 'Sin asignar (Pool)'
                      : 'Disponible en Pool'}
                  </h5>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2 border-t border-white/5 pt-2">
                  <Clock size={11} />
                  <span>Próxima ración: {currentWorkerSchedule.length > 0 && currentWorkerSchedule[0].shiftType !== 'libre' ? 'Servicio Activo' : 'Ninguno'}</span>
                </div>
              </div>

              <div className="p-4 glass-card flex flex-col justify-between min-h-[120px]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Días Libres de esta semana</span>
                  <h5 className="text-lg font-bold text-slate-200 mt-1.5">Sábado y Domingo</h5>
                </div>
                <div className="text-[11px] text-slate-400">
                  Guardia de contingencia inactiva
                </div>
              </div>

              <div className="p-4 glass-card flex flex-col justify-between min-h-[120px]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Alertas de Guardia</span>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    Mantén tus notificaciones push activas para recibir avisos de reasignación al instante.
                  </p>
                </div>
                <div className="text-[11px] text-cyan-400 flex items-center gap-1">
                  <Info size={11} />
                  <span>Sin solicitudes entrantes</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'create_request' && userRole === 'worker' && (
          <div className="p-5 glass-panel max-w-xl animate-fade-in space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
              <Plus size={14} className="text-cyan-400" />
              Solicitar Intercambio de Guardia
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Elige a un compañero de tu misma división (<strong>{currentDivision?.name}</strong>) y envía una propuesta de swap. La solicitud requerirá la aprobación posterior de un Jefe de División para tener efecto en el tablero.
            </p>

            <form onSubmit={handleCreateRequest} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Compañero Destinatario:</label>
                  <select
                    required
                    value={targetWorkerId}
                    onChange={(e) => setTargetWorkerId(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Selecciona un compañero --</option>
                    {swapPartners.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.cargo})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Fecha del Cambio:</label>
                  <input
                    type="date"
                    required
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Motivo de la Solicitud:</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explica detalladamente por qué requieres el intercambio (ej: Asistencia familiar, compensación de horas)..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-xl text-xs font-bold text-cyan-300 transition-all cursor-pointer"
              >
                Enviar Solicitud al Coordinador
              </button>
            </form>
          </div>
        )}

        {activeTab === 'manage_requests' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare size={14} className="text-cyan-400" />
                Historial y Solicitudes de Cambios
              </h4>
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                {manageableRequests.length} Registradas
              </span>
            </div>

            {manageableRequests.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/5 bg-slate-950/20 rounded-2xl">
                <span className="text-xs text-slate-500">No se encontraron solicitudes vigentes en esta división.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                  {manageableRequests.map((req) => {
                    const reqDivision = divisions.find(d => d.id === req.divisionId);
                    const isPending = req.status === 'pending';

                    return (
                      <motion.div
                        key={req.id}
                        layout
                        className="p-4 glass-panel space-y-4 flex flex-col justify-between"
                      >
                        {/* Requester & Target swap layout */}
                        <div>
                          <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2.5">
                            <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">
                              {reqDivision?.name || 'VTV'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                              req.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' :
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {req.status === 'approved' ? 'Aprobado' :
                               req.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <div className="text-xs">
                              <span className="font-semibold text-white">{req.requesterName}</span>
                              <p className="text-[10px] text-slate-400">Solicitante</p>
                            </div>
                            <ChevronRight size={14} className="text-slate-500 shrink-0" />
                            <div className="text-xs">
                              <span className="font-semibold text-white">{req.targetWorkerName}</span>
                              <p className="text-[10px] text-slate-400">Compañero</p>
                            </div>
                          </div>

                          <p className="text-xs text-slate-300 bg-white/5 p-2.5 rounded-xl border border-white/5 mt-3 italic">
                            "{req.reason}"
                          </p>
                        </div>

                        {/* Date and actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-300">
                            Fecha: {req.date}
                          </span>

                          {isPending && (userRole === 'coordinator' || userRole === 'superadmin' || userRole === 'deputy') ? (
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => handleRejectRequest(req.id)}
                                className="p-1 hover:bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg transition-all"
                                title="Rechazar solicitud"
                              >
                                <X size={13} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => handleApproveRequest(req)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg font-bold"
                                title="Aprobar e Intercambiar Turnos"
                              >
                                <Check size={13} strokeWidth={2.5} />
                                <span>Aprobar Swap</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">
                              Creado: {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
