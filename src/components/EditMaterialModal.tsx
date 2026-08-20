import React, { useState, useEffect } from 'react';
import { MaterialSignal, DivisionType, SignalType, MaterialStatus } from '../types';
import { X, Edit3, Save, Clock, Ban, Info, Sparkles, Trash2 } from 'lucide-react';
import { formatDurationHHMMSS, durationToSeconds } from '../services/apiService';

interface EditMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  signal: MaterialSignal | null;
  onSave: (updatedSignal: MaterialSignal) => void;
  onDelete?: (signalId: string) => void;
}

const COMMON_SIGNAL_PRESETS = [
  'Limpio',
  'Insert',
  'Master',
  'Promo',
  'Clip',
  'Cápsula',
  'Extra',
  'Resumen',
  'Audio',
  'Crudo',
  'Nota',
];

export const EditMaterialModal: React.FC<EditMaterialModalProps> = ({
  isOpen,
  onClose,
  signal,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [division, setDivision] = useState<DivisionType>('Prensa');
  const [signalPreset, setSignalPreset] = useState<string>('Limpio');
  const [customSignalName, setCustomSignalName] = useState<string>('');
  const [status, setStatus] = useState<MaterialStatus>('Registrado');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setIsConfirmingDelete(false);
    if (signal) {
      setTitle(signal.title);
      setDivision(signal.division);
      setStatus(signal.status || (signal.isDiscarded ? 'Descartado' : 'Registrado'));
      setNotes(signal.notes || '');

      const currentSig = signal.signalType || 'Limpio';
      if (COMMON_SIGNAL_PRESETS.includes(currentSig)) {
        setSignalPreset(currentSig);
        setCustomSignalName('');
      } else {
        setSignalPreset('custom');
        setCustomSignalName(currentSig);
      }

      // Parse duration safely using durationToSeconds
      if (signal.duration) {
        const secs = durationToSeconds(signal.duration);
        setHours(Math.floor(secs / 3600));
        setMinutes(Math.floor((secs % 3600) / 60));
        setSeconds(secs % 60);
      }
    }
  }, [signal]);

  if (!isOpen || !signal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalSignalType =
      signalPreset === 'custom'
        ? customSignalName.trim() || 'Personalizada'
        : signalPreset;

    const pad = (num: number) => num.toString().padStart(2, '0');
    const formattedDuration = formatDurationHHMMSS(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);

    const isDiscarded = status === 'Descartado';
    const isFinalized = status === 'Finalizado';
    const isCataloged = status === 'Por Archivar' || isFinalized;

    const updatedSignal: MaterialSignal = {
      ...signal,
      title: title.trim(),
      division,
      signalType: finalSignalType,
      status,
      isDiscarded,
      isIngested: signal.isIngested !== false,
      isCataloged: isDiscarded ? false : isCataloged,
      isFinalized: isDiscarded ? false : isFinalized,
      duration: formattedDuration,
      notes: notes.trim(),
    };

    onSave(updatedSignal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Editar Registro de Material</h2>
              <p className="text-xs text-slate-400 font-mono">ID: {signal.id} • Familia: {signal.familyId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Título del Material / Programa *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Noticiero Emisión Estelar - Cobertura Especial"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-sm font-medium"
            />
          </div>

          {/* Division & Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                División Origen
              </label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value as DivisionType)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500 text-xs font-bold"
              >
                <option value="Prensa">Prensa</option>
                <option value="Programación">Programación</option>
                <option value="Ingesta">Ingesta</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Estatus del Material
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MaterialStatus)}
                className={`w-full px-3 py-2 bg-slate-950 border rounded-xl text-xs font-bold focus:outline-none ${
                  status === 'Descartado'
                    ? 'border-rose-500 text-rose-300 bg-rose-950/40'
                    : status === 'Finalizado'
                    ? 'border-emerald-500 text-emerald-300 bg-emerald-950/40'
                    : status === 'Por Archivar'
                    ? 'border-amber-500 text-amber-300 bg-amber-950/40'
                    : 'border-slate-700 text-blue-300'
                }`}
              >
                <option value="Registrado">Registrado (Trabajo Activo)</option>
                <option value="Por Archivar">Por Archivar (Catalogado)</option>
                <option value="Finalizado">Finalizado (Carpeta Histórica)</option>
                <option value="Descartado">🚫 Descartado (No archivar)</option>
              </select>
            </div>
          </div>

          {/* Discarded Notice */}
          {status === 'Descartado' && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2">
              <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-white block mb-0.5">Material Descartado:</span>
                <span>Este material seguirá sumando al total de horas ingestadas, pero <strong>no contará</strong> como una tarea pendiente para ser archivada.</span>
              </div>
            </div>
          )}

          {/* Signal Type with Custom Support */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center justify-between">
              <span>Tipo de Señal / Nombre</span>
              <span className="text-[10px] font-normal text-slate-400">Personalizable</span>
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Preestablecidas</span>
                <select
                  value={signalPreset}
                  onChange={(e) => {
                    setSignalPreset(e.target.value);
                    if (e.target.value !== 'custom') {
                      setCustomSignalName('');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500 text-xs font-bold"
                >
                  <optgroup label="Estándar">
                    <option value="Limpio">Limpio (Clean Feed)</option>
                    <option value="Insert">Insert (Con Gráficos)</option>
                    <option value="Master">Master (Emisión)</option>
                  </optgroup>
                  <optgroup label="Señales Adicionales">
                    <option value="Promo">Promo</option>
                    <option value="Clip">Clip</option>
                    <option value="Cápsula">Cápsula</option>
                    <option value="Extra">Extra</option>
                    <option value="Resumen">Resumen</option>
                    <option value="Audio">Audio</option>
                    <option value="Crudo">Crudo</option>
                    <option value="Nota">Nota</option>
                  </optgroup>
                  <option value="custom">✏️ Nombre Personalizado...</option>
                </select>
              </div>

              {signalPreset === 'custom' ? (
                <div>
                  <span className="text-[10px] text-purple-300 block mb-1 font-bold">Escribe el nombre</span>
                  <input
                    type="text"
                    required
                    value={customSignalName}
                    onChange={(e) => setCustomSignalName(e.target.value)}
                    placeholder="Ej: Cámara 2, Audio Ambiente, etc."
                    className="w-full px-3 py-2 bg-slate-900 border border-purple-500 rounded-lg text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              ) : (
                <div className="flex items-center text-[11px] text-slate-400 pt-5 italic">
                  Señal: <strong className="text-purple-300 ml-1">{signalPreset}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Duration Inputs */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5">
            <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Duración (Horas : Minutos : Segundos)
            </label>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5 font-mono">Horas</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center font-bold text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5 font-mono">Minutos</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center font-bold text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5 font-mono">Segundos</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={seconds}
                  onChange={(e) => setSeconds(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center font-bold text-xs"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Observaciones / Detalles Técnicos
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles de audio, timecode, novedades o motivo de descarte..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500 text-xs font-medium resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
            {onDelete ? (
              isConfirmingDelete ? (
                <div className="flex items-center gap-2 p-1.5 bg-rose-950/80 border border-rose-600 rounded-xl">
                  <span className="text-[11px] font-bold text-rose-200">¿Eliminar?</span>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-bold hover:bg-slate-700"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsConfirmingDelete(false);
                      onDelete(signal.id);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 shadow"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Sí, Eliminar</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/80 text-rose-400 hover:text-rose-200 border border-slate-800 hover:border-rose-800 text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="Eliminar esta señal"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Señal</span>
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 flex items-center gap-1.5 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
