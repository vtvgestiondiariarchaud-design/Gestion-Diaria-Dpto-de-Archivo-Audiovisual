import React, { useState, useEffect } from 'react';
import { MaterialSignal, DivisionType, SignalType } from '../types';
import { X, Edit3, Save, Clock, Film, AlertCircle } from 'lucide-react';
import { formatDurationHHMMSS, durationToSeconds } from '../services/apiService';

interface EditMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  signal: MaterialSignal | null;
  onSave: (updatedSignal: MaterialSignal) => void;
}

export const EditMaterialModal: React.FC<EditMaterialModalProps> = ({
  isOpen,
  onClose,
  signal,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [division, setDivision] = useState<DivisionType>('Prensa');
  const [signalType, setSignalType] = useState<SignalType>('Limpio');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (signal) {
      setTitle(signal.title);
      setDivision(signal.division);
      setSignalType(signal.signalType);
      setNotes(signal.notes || '');

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

    const pad = (num: number) => num.toString().padStart(2, '0');
    const formattedDuration = formatDurationHHMMSS(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);

    const updatedSignal: MaterialSignal = {
      ...signal,
      title: title.trim(),
      division,
      signalType,
      duration: formattedDuration,
      notes: notes.trim(),
    };

    onSave(updatedSignal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
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

          {/* Division & Signal Type Grid */}
          <div className="grid grid-cols-2 gap-3">
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
                Tipo de Señal
              </label>
              <select
                value={signalType}
                onChange={(e) => setSignalType(e.target.value as SignalType)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500 text-xs font-bold"
              >
                <option value="Limpio">Limpio (Clean Feed)</option>
                <option value="Insert">Insert (Con Gráficos)</option>
                <option value="Master">Master (Emisión)</option>
              </select>
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
              placeholder="Detalles de audio, timecode, novedades o estado..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-purple-500 text-xs font-medium resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
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
        </form>
      </div>
    </div>
  );
};
