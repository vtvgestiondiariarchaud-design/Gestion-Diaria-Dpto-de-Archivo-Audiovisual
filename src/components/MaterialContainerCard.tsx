import React, { useState } from 'react';
import { MaterialFamilyGroup, MaterialSignal, UserProfile } from '../types';
import { durationToSeconds, formatHoursVerbose, getFormattedDateTime, formatDurationHHMMSS } from '../services/apiService';
import {
  canUserCreateMaterial,
  canUserAssignSignal,
  canUserUnassignSignal,
  canUserCatalogSignal,
  canUserFinalizeSignal,
  canUserDeleteMaterial
} from '../utils/permissions';
import { 
  Film, 
  CheckCircle2, 
  Clock, 
  Archive, 
  Layers, 
  Plus, 
  Trash2, 
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  User,
  Edit3,
  UserCheck,
  UserX,
  Lock,
  Ban,
  Tag
} from 'lucide-react';

interface MaterialContainerCardProps {
  group: MaterialFamilyGroup;
  currentUser: UserProfile;
  onUpdateSignalStatus: (signalId: string, newStatus: MaterialSignal['status']) => void;
  onBatchUpdateFamilyStatus: (familyId: string, newStatus: MaterialSignal['status']) => void;
  onToggleSignalBoolean?: (signalId: string, flag: 'isIngested' | 'isCataloged' | 'isFinalized' | 'isDiscarded') => void;
  onBatchToggleFamilyBoolean?: (familyId: string, flag: 'isIngested' | 'isCataloged' | 'isFinalized' | 'isDiscarded', value: boolean) => void;
  onAssignSignal?: (signalId: string, assignToUser: string | null) => void;
  onOpenMultiAssign?: (signal: MaterialSignal) => void;
  onAddSignalToFamily: (familyId: string, title: string, division: MaterialSignal['division']) => void;
  onDeleteSignal: (signalId: string) => void;
  onEditSignal?: (signal: MaterialSignal) => void;
}

export const MaterialContainerCard: React.FC<MaterialContainerCardProps> = ({
  group,
  currentUser,
  onUpdateSignalStatus,
  onBatchUpdateFamilyStatus,
  onToggleSignalBoolean,
  onBatchToggleFamilyBoolean,
  onAssignSignal,
  onOpenMultiAssign,
  onAddSignalToFamily,
  onDeleteSignal,
  onEditSignal,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeSignalIndex, setActiveSignalIndex] = useState<number>(0);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);

  // Permission checks from permissions utility
  const canCreate = canUserCreateMaterial(currentUser);

  const canCatalogOrFinalize =
    currentUser.role === 'Gerente de Archivo' ||
    currentUser.role === 'Adjunta de Gerencia' ||
    currentUser.role === 'Jefe de División' ||
    currentUser.role === 'Coordinador' ||
    currentUser.role === 'Documentalista';

  const canDelete = canUserDeleteMaterial(currentUser);

  const currentSignal = group.signals[activeSignalIndex] || group.signals[0];

  const getStatusBadge = (status: MaterialSignal['status']) => {
    switch (status) {
      case 'Descartado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <Ban className="w-3 h-3 text-rose-400" />
            Descartado
          </span>
        );
      case 'Finalizado':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Finalizado
          </span>
        );
      case 'Por Archivar':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Archive className="w-3 h-3" />
            Por Archivar
          </span>
        );
      case 'Registrado':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Clock className="w-3 h-3" />
            Registrado
          </span>
        );
    }
  };

  const getDivisionBadge = (division: MaterialSignal['division']) => {
    switch (division) {
      case 'Prensa':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'Programación':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Ingesta':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  };

  const getSignalPillStyle = (sig: MaterialSignal, isActive: boolean) => {
    const isDiscarded = sig.status === 'Descartado' || sig.isDiscarded;

    if (isDiscarded) {
      if (isActive) {
        return 'bg-rose-900/90 text-rose-200 shadow-md ring-2 ring-rose-400 border border-rose-500';
      }
      return 'bg-rose-950/40 text-rose-400 hover:bg-rose-900/50 hover:text-white border border-rose-800/50';
    }

    const type = sig.signalType;
    if (isActive) {
      switch (type) {
        case 'Limpio':
          return 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400';
        case 'Insert':
          return 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400';
        case 'Master':
          return 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400';
        default:
          return 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400';
      }
    } else {
      switch (type) {
        case 'Limpio':
        case 'Insert':
        case 'Master':
          return 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700';
        default:
          return 'bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/60 hover:text-white border border-indigo-800/60';
      }
    }
  };

  // Latest timestamp among signals for display
  const latestCreationDate = getFormattedDateTime(group.signals[0]?.creationDate || group.creationDate);

  return (
    <div className={`bg-gradient-to-br from-[#1A2333] via-[#161F2E] to-[#0D131F] border rounded-2xl shadow-xl transition-all overflow-hidden flex flex-col ${
      group.isAllDiscarded ? 'border-rose-900/40 opacity-85' : 'border-slate-700/70 hover:border-purple-800/60'
    }`}>
      {/* Compact Header */}
      <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900/95 via-slate-900 to-slate-950/95 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${
            group.isAllDiscarded
              ? 'bg-rose-600/20 text-rose-400 border-rose-500/30'
              : 'bg-purple-600/20 text-purple-400 border-purple-500/30'
          }`}>
            {group.isAllDiscarded ? <Ban className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="font-mono text-[11px] font-extrabold text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/60">
                {group.familyId}
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${getDivisionBadge(group.division)}`}>
                {group.division}
              </span>
              {getStatusBadge(group.overallStatus)}
            </div>
            <h3 className="text-sm font-bold text-white leading-tight truncate" title={group.title}>
              {group.title}
            </h3>
          </div>
        </div>

        {/* Right Header Controls (Total Duration, Edit & Expand Toggle) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
          <div className="text-left sm:text-right mr-1">
            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
              Duración Total
            </span>
            <span className="text-xs font-extrabold font-mono text-amber-400">
              {formatHoursVerbose(group.totalDurationSeconds)}
            </span>
          </div>

          {/* Quick Edit Button */}
          {onEditSignal && (
            <button
              onClick={() => onEditSignal(currentSignal)}
              className="p-1.5 rounded-xl bg-slate-800/90 hover:bg-purple-950/80 text-purple-300 hover:text-white border border-slate-700/80 hover:border-purple-600 transition-all shadow-sm"
              title="Modificar/Editar detalles del material"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}

          {/* Expand / Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm border ${
              isExpanded
                ? 'bg-purple-600 text-white border-purple-400 shadow-purple-950/50'
                : 'bg-slate-800 text-purple-300 hover:bg-purple-950/60 hover:text-white border-slate-700 hover:border-purple-700'
            }`}
          >
            <span>{isExpanded ? 'Ocultar' : 'Detalles'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Signals Quick Summary Bar (Always Visible, Compact) */}
      <div className="px-3.5 py-2 bg-slate-950/60 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Signal Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 font-semibold mr-1 flex items-center gap-1 shrink-0">
            <Film className="w-3 h-3 text-purple-400" />
            Señales ({group.signals.length}):
          </span>
          {group.signals.map((sig, idx) => {
            const isActive = idx === activeSignalIndex;
            const isDiscarded = sig.status === 'Descartado' || sig.isDiscarded;

            return (
              <button
                key={`sig-pill-${sig.id || group.familyId}-${sig.signalType || 'sig'}-${idx}`}
                onClick={() => {
                  setActiveSignalIndex(idx);
                  setIsConfirmingDelete(false);
                  if (!isExpanded) setIsExpanded(true);
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${getSignalPillStyle(
                  sig,
                  isActive
                )}`}
                title={`Haz clic para seleccionar ${sig.signalType}${isDiscarded ? ' (Descartado)' : ''}`}
              >
                <span>{sig.signalType}</span>
                <span className="font-mono text-[9px] opacity-80">({formatDurationHHMMSS(sig.duration)})</span>
                {isDiscarded ? (
                  <Ban className="w-3 h-3 text-rose-400" />
                ) : sig.isFinalized ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Compact Timestamp & Author */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          <Calendar className="w-3 h-3 text-purple-400 shrink-0" />
          <span className="text-slate-300">{latestCreationDate}</span>
          <span className="text-slate-500">•</span>
          <User className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate max-w-[130px]" title={group.createdBy}>{group.createdBy}</span>
        </div>
      </div>

      {/* Quick Batch Actions Row (When Collapsed) */}
      {!isExpanded && canCatalogOrFinalize && onBatchToggleFamilyBoolean && (
        <div className="px-3.5 py-2 bg-slate-900/40 flex items-center justify-between gap-2 text-xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            Acciones Rápidas de Familia:
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onBatchToggleFamilyBoolean(group.familyId, 'isCataloged', !group.hasCataloged)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border flex items-center gap-1 ${
                group.hasCataloged
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Archive className="w-3 h-3 text-amber-400" />
              <span>{group.hasCataloged ? 'Archivada' : 'Para Archivar'}</span>
            </button>

            <button
              onClick={() => {
                const check = canUserFinalizeSignal(currentUser);
                if (!check.allowed) {
                  alert(check.reason);
                  return;
                }
                onBatchToggleFamilyBoolean(group.familyId, 'isFinalized', !group.isAllFinalized);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border flex items-center gap-1 ${
                group.isAllFinalized
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>{group.isAllFinalized ? 'Finalizada' : 'Finalizar Familia'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Expanded Detailed View Section */}
      {isExpanded && currentSignal && (
        <div className="p-4 bg-slate-950/80 border-t border-slate-800/80 space-y-3.5 animate-fade-in">
          {/* Signal Switcher + Add Custom/Standard Signal */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-300">Seleccionar Señal:</span>
              <div className="flex gap-1.5 flex-wrap">
                {group.signals.map((sig, idx) => (
                  <button
                    key={`sig-btn-${sig.id || group.familyId}-${sig.signalType || 'sig'}-${idx}`}
                    onClick={() => {
                      setActiveSignalIndex(idx);
                      setIsConfirmingDelete(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${getSignalPillStyle(
                      sig,
                      idx === activeSignalIndex
                    )}`}
                  >
                    {sig.signalType}
                    {(sig.status === 'Descartado' || sig.isDiscarded) && (
                      <span className="ml-1 text-[10px] text-rose-300 font-normal">(Descartado)</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {canCreate && (
              <button
                onClick={() => onAddSignalToFamily(group.familyId, group.title, group.division)}
                className="px-2.5 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-600 hover:text-white border border-purple-800 text-purple-200 text-xs font-bold flex items-center gap-1 transition-all shrink-0 shadow-sm"
                title="Añadir otra señal estándar o personalizada (Promo, Clip, Cápsula, etc.) a esta tarjeta"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Añadir Señal Personalizada</span>
              </button>
            )}
          </div>

          {/* Assignment Bar for Documentalistas and Multi-person Assignment */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border ${currentSignal.assignedTo || (currentSignal.assignedPersons && currentSignal.assignedPersons.length > 0) ? 'bg-blue-600/20 text-blue-400 border-blue-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Asignación de Personal / Equipo:
                </span>
                {currentSignal.assignedPersons && currentSignal.assignedPersons.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {currentSignal.assignedPersons.map((pName) => (
                      <span key={pName} className="px-2 py-0.5 rounded-md bg-purple-950 text-purple-200 border border-purple-800 text-[11px] font-bold">
                        {pName}
                      </span>
                    ))}
                    {currentSignal.assignedAt && (
                      <span className="text-[10px] font-mono text-slate-400 ml-1">• {currentSignal.assignedAt}</span>
                    )}
                  </div>
                ) : currentSignal.assignedTo ? (
                  <p className="text-xs font-bold text-white flex items-center flex-wrap gap-1.5 mt-0.5">
                    <span className="text-blue-300 font-extrabold">{currentSignal.assignedTo}</span>
                    <span className="text-[10px] font-semibold text-blue-200 bg-blue-950 px-1.5 py-0.2 rounded border border-blue-800/80">
                      {currentSignal.assignedToRole || 'Documentalista'}
                    </span>
                    {currentSignal.assignedAt && (
                      <span className="text-[10px] font-mono text-slate-400">• {currentSignal.assignedAt}</span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-amber-300/90 font-semibold italic mt-0.5">
                    Sin asignación • Asigna a tu perfil o a múltiples trabajadores
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {onOpenMultiAssign && (
                <button
                  type="button"
                  onClick={() => onOpenMultiAssign(currentSignal)}
                  className="px-3 py-1.5 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  title="Asignar varias personas a esta tarea"
                >
                  <UserCheck className="w-3.5 h-3.5 text-purple-300" />
                  <span>Asignar Equipo ({currentSignal.assignedPersons?.length || (currentSignal.assignedTo ? 1 : 0)})</span>
                </button>
              )}

              {currentSignal.assignedTo ? (
                canUserUnassignSignal(currentUser, currentSignal) ? (
                  <button
                    type="button"
                    onClick={() => onAssignSignal && onAssignSignal(currentSignal.id, null)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-950/90 text-red-300 hover:text-white border border-slate-700 hover:border-red-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    title="Desasignar tarjeta para que quede libre"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Liberar</span>
                  </button>
                ) : (
                  <span className="px-2.5 py-1 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-400 text-[11px] font-semibold flex items-center gap-1.5 shadow-sm">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tomada</span>
                  </span>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => onAssignSignal && onAssignSignal(currentSignal.id, currentUser.name)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-400 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-blue-950/60"
                  title="Asignarme esta tarjeta a mi perfil activo"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Asignármela</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Signal Main Meta Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-extrabold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60">
                ID: {currentSignal.id}
              </span>
              <span className="text-xs font-bold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40 flex items-center gap-1">
                <Tag className="w-3 h-3 text-purple-400" />
                {currentSignal.signalType}
              </span>
              {getStatusBadge(currentSignal.status)}
            </div>

            <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Duración: {formatDurationHHMMSS(currentSignal.duration)}</span>
            </div>
          </div>

          {/* Discarded Banner */}
          {(currentSignal.status === 'Descartado' || currentSignal.isDiscarded) && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2">
              <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block mb-0.5">Señal Descartada</span>
                <span>Esta señal continúa sumando a las horas totales de ingesta, pero está excluida de las tareas pendientes de archivo.</span>
              </div>
            </div>
          )}

          {/* Independent Booleans Controls Row */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] font-extrabold uppercase text-purple-300 tracking-wider block mb-2">
              Estados e Indicadores de la Señal Activa:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Boolean 1: Ingestado */}
              <button
                type="button"
                onClick={() => onToggleSignalBoolean && onToggleSignalBoolean(currentSignal.id, 'isIngested')}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  currentSignal.isIngested !== false
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                title="Suma al balance de horas ingestadas"
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${currentSignal.isIngested !== false ? 'text-blue-400' : 'text-slate-600'}`} />
                <span>Ingestado</span>
              </button>

              {/* Boolean 2: Para Archivar (Catalogado) */}
              <button
                type="button"
                onClick={() => {
                  const check = canUserCatalogSignal(currentUser, currentSignal);
                  if (!check.allowed) {
                    alert(check.reason);
                    return;
                  }
                  if (onToggleSignalBoolean) {
                    onToggleSignalBoolean(currentSignal.id, 'isCataloged');
                  }
                }}
                disabled={currentSignal.status === 'Descartado' || currentSignal.isDiscarded}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  currentSignal.status === 'Descartado' || currentSignal.isDiscarded
                    ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600'
                    : currentSignal.isCataloged
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                title={
                  currentSignal.status === 'Descartado' || currentSignal.isDiscarded
                    ? 'Material descartado no requiere archivar'
                    : currentSignal.assignedTo && currentSignal.assignedTo !== currentUser.name
                    ? `Asignado a ${currentSignal.assignedTo}`
                    : 'Marcar como documentado / Para Archivar'
                }
              >
                <Archive className={`w-3.5 h-3.5 ${currentSignal.isCataloged ? 'text-amber-400' : 'text-slate-600'}`} />
                <span>Para Archivar</span>
              </button>

              {/* Boolean 3: Finalizado */}
              <button
                type="button"
                onClick={() => {
                  const check = canUserFinalizeSignal(currentUser);
                  if (!check.allowed) {
                    alert(check.reason);
                    return;
                  }
                  if (onToggleSignalBoolean) {
                    onToggleSignalBoolean(currentSignal.id, 'isFinalized');
                  }
                }}
                disabled={currentSignal.status === 'Descartado' || currentSignal.isDiscarded}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  currentSignal.status === 'Descartado' || currentSignal.isDiscarded
                    ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600'
                    : currentSignal.isFinalized
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                title={
                  currentSignal.status === 'Descartado' || currentSignal.isDiscarded
                    ? 'Material descartado'
                    : 'Marcar como finalizado'
                }
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${currentSignal.isFinalized ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span>Finalizado</span>
              </button>

              {/* Boolean 4: Descartado */}
              <button
                type="button"
                onClick={() => {
                  const isCurrentlyDiscarded = currentSignal.status === 'Descartado' || currentSignal.isDiscarded;
                  const newStatus = isCurrentlyDiscarded ? 'Registrado' : 'Descartado';
                  onUpdateSignalStatus(currentSignal.id, newStatus);
                }}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  currentSignal.status === 'Descartado' || currentSignal.isDiscarded
                    ? 'bg-rose-600/30 border-rose-500/60 text-rose-300 ring-1 ring-rose-500/40'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-rose-300'
                }`}
                title="Descartar material (sigue contando en total de horas ingestadas, pero no cuenta para archivar)"
              >
                <Ban className={`w-3.5 h-3.5 ${currentSignal.status === 'Descartado' || currentSignal.isDiscarded ? 'text-rose-400' : 'text-slate-600'}`} />
                <span>{currentSignal.status === 'Descartado' || currentSignal.isDiscarded ? 'Descartado' : 'Descartar'}</span>
              </button>
            </div>
          </div>

          {/* Notes */}
          {currentSignal.notes && (
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-purple-300 block mb-0.5">Observaciones:</span>
                <span>{currentSignal.notes}</span>
              </div>
            </div>
          )}

          {/* Detailed Audit Trail with Date and Time */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
              Historial de Auditoría con Fecha y Hora:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-300">
              {/* Step 1: Registro / Creación */}
              <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] font-extrabold uppercase text-blue-400 block mb-1">
                  1. Registro / Creación
                </span>
                <p className="font-bold text-white truncate">{currentSignal.createdBy}</p>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">{getFormattedDateTime(currentSignal.creationDate)}</p>
              </div>

              {/* Step 2: Catalogación */}
              <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] font-extrabold uppercase text-amber-400 block mb-1">
                  2. Catalogación ("Para Archivar")
                </span>
                {currentSignal.catalogedBy ? (
                  <>
                    <p className="font-bold text-amber-300 truncate">{currentSignal.catalogedBy}</p>
                    <p className="text-[10px] font-mono text-amber-400/80 mt-0.5">{getFormattedDateTime(currentSignal.catalogedAt)}</p>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    {currentSignal.status === 'Descartado' ? 'Excluido (Descartado)' : 'Pendiente de catalogar'}
                  </p>
                )}
              </div>

              {/* Step 3: Finalización */}
              <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] font-extrabold uppercase text-emerald-400 block mb-1">
                  3. Finalización (Carpeta Histórica)
                </span>
                {currentSignal.finalizedBy ? (
                  <>
                    <p className="font-bold text-emerald-300 truncate">{currentSignal.finalizedBy}</p>
                    <p className="text-[10px] font-mono text-emerald-400/80 mt-0.5">{getFormattedDateTime(currentSignal.finalizedAt)}</p>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    {currentSignal.status === 'Descartado' ? 'Excluido (Descartado)' : 'Pendiente de finalizar'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Row */}
          {isConfirmingDelete ? (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-lg">
              <div className="flex items-center gap-2.5 text-xs text-rose-200">
                <div className="p-2 rounded-lg bg-rose-900/80 text-rose-300 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold text-white block">¿Eliminar esta señal activa?</span>
                  <span className="text-[11px] text-rose-300 font-mono">
                    ID: {currentSignal.id} • {currentSignal.title} ({currentSignal.signalType})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingDelete(false);
                    onDeleteSignal(currentSignal.id);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-rose-950 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sí, Eliminar Señal</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
              {onEditSignal && (
                <button
                  type="button"
                  onClick={() => onEditSignal(currentSignal)}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-800 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Modificar Señal</span>
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-red-950/90 text-red-400 hover:text-red-200 border border-slate-800 hover:border-red-800 transition-all text-xs font-bold flex items-center gap-1.5 ml-auto shadow-sm"
                  title="Eliminar señal activa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Señal Activa</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
