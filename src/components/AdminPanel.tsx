import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash, Edit2, Shield, UserCheck, Settings, AlertCircle, Layers, Check, KeyRound, Database } from 'lucide-react';
import { Division, Worker, UserRole } from '../types';

interface AdminPanelProps {
  divisions: Division[];
  workers: Worker[];
  onUpdateDivisions: (updated: Division[]) => void;
  onUpdateWorkers: (updated: Worker[]) => void;
  onAddNotification: (title: string, desc: string, type: 'success' | 'info') => void;
  onOpenBlueprint?: () => void;
}

export default function AdminPanel({
  divisions,
  workers,
  onUpdateDivisions,
  onUpdateWorkers,
  onAddNotification,
  onOpenBlueprint
}: AdminPanelProps) {
  const [newDivName, setNewDivName] = useState('');
  const [newDivDesc, setNewDivDesc] = useState('');
  const [editingDivId, setEditingDivId] = useState<string | null>(null);
  const [editDivName, setEditDivName] = useState('');
  const [editDivDesc, setEditDivDesc] = useState('');

  // Division CRUD
  const handleCreateDivision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivName.trim()) return;

    const newDiv: Division = {
      id: `div_${Date.now()}`,
      name: newDivName.trim(),
      description: newDivDesc.trim(),
      coordinatorId: null,
      coordinatorName: null
    };

    onUpdateDivisions([...divisions, newDiv]);
    setNewDivName('');
    setNewDivDesc('');
    onAddNotification('División Creada', `La división "${newDiv.name}" fue agregada de forma exclusiva por el Gerente.`, 'success');
  };

  const handleStartEditDivision = (div: Division) => {
    setEditingDivId(div.id);
    setEditDivName(div.name);
    setEditDivDesc(div.description);
  };

  const handleSaveEditDivision = (divId: string) => {
    if (!editDivName.trim()) return;
    const updated = divisions.map(d => {
      if (d.id === divId) {
        return { ...d, name: editDivName.trim(), description: editDivDesc.trim() };
      }
      return d;
    });
    onUpdateDivisions(updated);
    setEditingDivId(null);
    onAddNotification('División Actualizada', 'Los cambios en la división fueron aplicados.', 'success');
  };

  const handleDeleteDivision = (divId: string, divName: string) => {
    if (confirm(`¿Estás seguro de eliminar la división "${divName}"? Se desvinculará al personal.`)) {
      onUpdateDivisions(divisions.filter(d => d.id !== divId));
      onAddNotification('División Eliminada', `Se eliminó la división "${divName}" de manera permanente.`, 'info');
    }
  };

  // Update worker division and role
  const handleUpdateWorkerDivisionAndRole = (workerId: string, divId: string, role: UserRole) => {
    const targetWorker = workers.find(w => w.id === workerId);
    if (!targetWorker) return;

    // Update worker role and division
    const updatedWorkers = workers.map(w => {
      if (w.id === workerId) {
        const nextDiv = divId === 'none' ? '' : divId;
        const nextFixedShift = (w.fixedShift === 'noche' && nextDiv !== 'div_ingesta') ? 'pool' : w.fixedShift;
        return { 
          ...w, 
          divisionId: nextDiv, 
          role,
          fixedShift: nextFixedShift
        };
      }
      return w;
    });
    onUpdateWorkers(updatedWorkers);

    // Update division coordinator fields automatically
    let updatedDivisions = divisions.map(d => {
      // Demote if they were coordinator of this division
      if (d.coordinatorId === workerId) {
        return { ...d, coordinatorId: null, coordinatorName: null };
      }
      return d;
    });

    if (role === 'coordinator' && divId !== 'none' && divId !== '') {
      updatedDivisions = updatedDivisions.map(d => {
        if (d.id === divId) {
          return { ...d, coordinatorId: workerId, coordinatorName: targetWorker.name };
        }
        return d;
      });
    }
    onUpdateDivisions(updatedDivisions);

    onAddNotification(
      'Usuario Actualizado',
      `${targetWorker.name} ahora es ${
        role === 'superadmin' ? 'Gerente' :
        role === 'deputy' ? 'Adjunto' :
        role === 'coordinator' ? 'Coordinador de División' : 'Técnico'
      } y pertenece a ${divId === 'none' ? 'ninguna división' : (divisions.find(d => d.id === divId)?.name || 'su división')}.`,
      'success'
    );
  };

  const handleUpdateWorkerFixedShift = (workerId: string, fixedShift: any) => {
    const updatedWorkers = workers.map(w => {
      if (w.id === workerId) {
        return { ...w, fixedShift };
      }
      return w;
    });
    onUpdateWorkers(updatedWorkers);
    onAddNotification('Turno Fijo Actualizado', 'Se configuró el turno preestablecido para este usuario.', 'success');
  };

  const handleResetPassword = (workerId: string) => {
    const targetWorker = workers.find(w => w.id === workerId);
    if (!targetWorker) return;

    if (confirm(`¿Estás seguro de restablecer la contraseña de ${targetWorker.name}?\nSe colocará la contraseña provisional "12345678" y se le exigirá cambiarla al iniciar sesión.`)) {
      const updatedWorkers = workers.map(w => {
        if (w.id === workerId) {
          return {
            ...w,
            password: '12345678',
            mustChangePassword: true
          };
        }
        return w;
      });
      onUpdateWorkers(updatedWorkers);
      onAddNotification(
        'Contraseña Restablecida',
        `La contraseña de ${targetWorker.name} ahora es "12345678".`,
        'success'
      );
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Warning of Exclusivity */}
      <div className="p-4 bg-sky-950/20 backdrop-blur-md border border-sky-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-start gap-3">
          <Shield size={22} className="text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-white text-sm">Consola del Gerente del Dpto de Archivo Audiovisual (SuperAdmin)</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Como **Gerente del Dpto de Archivo Audiovisual**, tienes atribuciones exclusivas en la base de datos de VTV: solo tú puedes agregar o disolver divisiones operativas y promover cargos a Jefes de División / Coordinadores de Guardia.
            </p>
          </div>
        </div>

        {onOpenBlueprint && (
          <button
            onClick={onOpenBlueprint}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/35 hover:to-cyan-500/35 text-emerald-300 hover:text-white border border-emerald-500/35 hover:border-cyan-500/40 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center whitespace-nowrap shrink-0"
          >
            <Database size={14} className="text-emerald-400" />
            <span>🔌 Ver Complemento: Planos BD</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Create and manage divisions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers size={14} className="text-cyan-400" />
              Estructura de Divisiones de VTV
            </h4>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
              {divisions.length} Activas
            </span>
          </div>

          <div className="space-y-3.5">
            <AnimatePresence>
              {divisions.map((div) => {
                const isEditing = editingDivId === div.id;
                const divWorkersCount = workers.filter(w => w.divisionId === div.id).length;

                return (
                  <motion.div
                    key={div.id}
                    layout
                    className="p-4 bg-slate-950/60 backdrop-blur-md border border-white/5 rounded-2xl shadow-md space-y-3"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editDivName}
                          onChange={(e) => setEditDivName(e.target.value)}
                          className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                        />
                        <textarea
                          value={editDivDesc}
                          onChange={(e) => setEditDivDesc(e.target.value)}
                          rows={2}
                          className="w-full bg-slate-900 border border-white/15 rounded-xl p-3 py-1.5 text-xs text-white"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditingDivId(null)}
                            className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSaveEditDivision(div.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold"
                          >
                            <Check size={12} />
                            <span>Guardar</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h5 className="font-bold text-slate-100 text-sm">{div.name}</h5>
                          <p className="text-xs text-slate-400 leading-relaxed">{div.description}</p>
                          <div className="flex flex-wrap gap-2.5 pt-2">
                            <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/10">
                              Coordinador: {div.coordinatorName || 'Sin asignar'}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                              {divWorkersCount} Empleados
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEditDivision(div)}
                            className="p-1.5 hover:bg-white/5 hover:text-cyan-400 rounded-lg text-slate-400 transition-all"
                            title="Editar división"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteDivision(div.id, div.name)}
                            className="p-1.5 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg text-slate-400 transition-all"
                            title="Eliminar división"
                          >
                            <Trash size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Right column: Create a new division & promote personnel */}
        <div className="space-y-6">
          {/* New Division Form */}
          <div className="p-4 bg-slate-950/60 backdrop-blur-md border border-white/5 rounded-2xl shadow-md space-y-4">
            <h4 className="text-xs font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
              <Plus size={13} className="text-cyan-400" />
              Nueva División
            </h4>

            <form onSubmit={handleCreateDivision} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Nombre de la División:</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Archivo Audiovisual"
                  value={newDivName}
                  onChange={(e) => setNewDivName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Descripción / Alcance:</label>
                <textarea
                  placeholder="Escribe brevemente el campo operativo de este equipo..."
                  rows={3}
                  value={newDivDesc}
                  onChange={(e) => setNewDivDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-xl text-xs font-bold text-cyan-300 transition-all cursor-pointer"
              >
                Crear Nueva División
              </button>
            </form>
          </div>

          {/* Promote Personnel list */}
          <div className="p-4 bg-slate-950/60 backdrop-blur-md border border-white/5 rounded-2xl shadow-md space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
              <UserCheck size={14} className="text-indigo-400" />
              Gestión de Usuarios y Roles de Guardia
            </h4>
            <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
              Cambia la división y el rol asignado a cada usuario en tiempo real. Los Gerentes y Adjuntos tienen permisos globales.
            </p>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {workers.map((worker) => {
                return (
                  <div key={worker.id} className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2.5">
                    <div className="truncate">
                      <div className="text-xs font-bold text-white truncate">{worker.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">{worker.cargo} • {worker.email}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase tracking-wider font-bold text-slate-500 block">División</span>
                        <select
                          value={worker.divisionId || 'none'}
                          onChange={(e) => handleUpdateWorkerDivisionAndRole(worker.id, e.target.value, worker.role)}
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          <option value="none">Sin división</option>
                          {divisions.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] uppercase tracking-wider font-bold text-slate-500 block">Rol</span>
                        <select
                          value={worker.role}
                          onChange={(e) => handleUpdateWorkerDivisionAndRole(worker.id, worker.divisionId, e.target.value as any)}
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          <option value="worker">Técnico</option>
                          <option value="coordinator">Coordinador de División</option>
                          <option value="deputy">Adjunto</option>
                          <option value="superadmin">Gerente</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[8px] uppercase tracking-wider font-bold text-slate-500 block">Turno Fijo Preestablecido (Lunes a Viernes)</span>
                      <select
                        value={worker.fixedShift || 'pool'}
                        onChange={(e) => handleUpdateWorkerFixedShift(worker.id, e.target.value as any)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        <option value="pool">Pool / Sin Turno Preestablecido</option>
                        <option value="manana">Turno Mañana (06:00 - 14:00)</option>
                        <option value="tarde">Turno Tarde (14:00 - 22:00)</option>
                        {worker.divisionId === 'div_ingesta' && (
                          <option value="noche">Turno Noche (22:00 - 06:00)</option>
                        )}
                        <option value="libre">Día Libre</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                      <span className="text-[9px] text-slate-400">
                        {worker.mustChangePassword ? (
                          <span className="text-amber-400 font-semibold flex items-center gap-1">
                            ⚠️ Cambio pendiente
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-medium">Contraseña Activa</span>
                        )}
                      </span>
                      <button
                        onClick={() => handleResetPassword(worker.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/30 rounded-lg text-[9px] font-bold text-amber-300 transition-all cursor-pointer"
                        title="Restablecer contraseña a 12345678"
                      >
                        <KeyRound size={10} />
                        <span>Reiniciar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
