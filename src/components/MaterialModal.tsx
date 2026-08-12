import React, { useState } from 'react';
import { MaterialSignal, DivisionType, SignalType, UserProfile } from '../types';
import { X, Film, Layers, Clock, Calendar, User, FileText, CheckCircle2 } from 'lucide-react';

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSave: (newSignals: MaterialSignal[]) => void;
  presetFamilyId?: string;
  presetTitle?: string;
  presetDivision?: DivisionType;
}

export const MaterialModal: React.FC<MaterialModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSave,
  presetFamilyId,
  presetTitle,
  presetDivision,
}) => {
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  const [mode, setMode] = useState<'batch' | 'single'>(presetFamilyId ? 'single' : 'batch');
  const [title, setTitle] = useState(presetTitle || '');
  const [division, setDivision] = useState<DivisionType>(
    presetDivision || currentUser.division || 'Prensa'
  );
  const [signalType, setSignalType] = useState<SignalType>('Limpio');
  
  // Duration inputs
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('30');
  const [seconds, setSeconds] = useState('00');

  const [creationDate, setCreationDate] = useState(todayStr);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const pad = (v: string) => v.padStart(2, '0');
    const formattedDuration = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

    const familyId = presetFamilyId || `FAM-2026-${Math.floor(100 + Math.random() * 900)}`;
    const currentTime = new Date().toTimeString().split(' ')[0];
    const fullCreationTimestamp = creationDate.includes(' ') ? creationDate : `${creationDate} ${currentTime}`;

    const generatedSignals: MaterialSignal[] = [];

    if (mode === 'batch' && !presetFamilyId) {
      // Create 3 signals: Limpio, Insert, Master
      const signalTypes: SignalType[] = ['Limpio', 'Insert', 'Master'];

      signalTypes.forEach((stype, idx) => {
        const matId = `MAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        generatedSignals.push({
          id: matId,
          familyId,
          signalType: stype,
          title: title.trim(),
          division,
          duration: formattedDuration,
          creationDate: fullCreationTimestamp,
          createdBy: currentUser.name,
          creatorRole: `${currentUser.role}${currentUser.division ? ` (${currentUser.division})` : ''}`,
          status: 'Registrado',
          isIngested: true,
          isCataloged: false,
          isFinalized: false,
          notes: notes.trim() || `Señal ${stype} registrada automáticamente en familia.`,
        });
      });
    } else {
      // Create single signal
      const matId = `MAT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      generatedSignals.push({
        id: matId,
        familyId,
        signalType,
        title: title.trim(),
        division,
        duration: formattedDuration,
        creationDate: fullCreationTimestamp,
        createdBy: currentUser.name,
        creatorRole: `${currentUser.role}${currentUser.division ? ` (${currentUser.division})` : ''}`,
        status: 'Registrado',
        isIngested: true,
        isCataloged: false,
        isFinalized: false,
        notes: notes.trim(),
      });
    }

    onSave(generatedSignals);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {presetFamilyId ? 'Añadir Señal a Familia Existente' : 'Registrar Nuevo Material Audiovisual'}
              </h2>
              <p className="text-xs text-slate-400">
                Departamento de Archivo Audiovisual VTV
              </p>
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Mode Selector (Batch 3 Signals vs Single) */}
          {!presetFamilyId && (
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Modo de Registro
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('batch')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    mode === 'batch'
                      ? 'bg-blue-950/50 border-blue-500 text-white shadow-md ring-1 ring-blue-500/50'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>Familia Completa (3 Señales)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight">
                    Crea automáticamente las 3 señales (Limpio, Insert y Master) agrupadas.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    mode === 'single'
                      ? 'bg-blue-950/50 border-blue-500 text-white shadow-md ring-1 ring-blue-500/50'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Film className="w-4 h-4 text-emerald-400" />
                    <span>Señal Individual</span>
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight">
                    Registra una única señal específica (ej. sólo Limpio).
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Título / Descripción del Material *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Noticiero VTV Emisión Estelar - Avance Noticioso Especial"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Division & Signal Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                División *
              </label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value as DivisionType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                <option value="Prensa">División 1: Archivo de Prensa</option>
                <option value="Programación">División 2: Archivo de Programación</option>
                <option value="Ingesta">División 3: Ingesta</option>
              </select>
            </div>

            {mode === 'single' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Tipo de Señal *
                </label>
                <select
                  value={signalType}
                  onChange={(e) => setSignalType(e.target.value as SignalType)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 text-sm font-semibold"
                >
                  <option value="Limpio">Limpio (Sin cintillos ni gráficos)</option>
                  <option value="Insert">Insert (Con gráficos/subtítulos)</option>
                  <option value="Master">Master (Señal final comprimida/aire)</option>
                </select>
              </div>
            )}
          </div>

          {/* Duration (HH : MM : SS) */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Duración del Material (HH:MM:SS) *
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <span className="text-[10px] text-slate-400 block mb-0.5">Horas</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-center font-mono text-white text-sm rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="text-xl font-bold text-slate-500 mt-4">:</span>
              <div className="flex-1">
                <span className="text-[10px] text-slate-400 block mb-0.5">Minutos</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-center font-mono text-white text-sm rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="text-xl font-bold text-slate-500 mt-4">:</span>
              <div className="flex-1">
                <span className="text-[10px] text-slate-400 block mb-0.5">Segundos</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-center font-mono text-white text-sm rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Creation Date & Audit Creator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Fecha de Creación (Editable)
              </label>
              <input
                type="date"
                required
                value={creationDate}
                onChange={(e) => setCreationDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-400" />
                Creado Por (Rol Activo)
              </label>
              <input
                type="text"
                disabled
                value={`${currentUser.name} (${currentUser.role})`}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-300 text-sm cursor-not-allowed"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Observaciones / Notas de Producción
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles técnicos, número de cinta, locación, temas o palabras clave..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* Submit Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-900/40 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {mode === 'batch' && !presetFamilyId
                  ? 'Guardar Familia (3 Señales)'
                  : 'Guardar Señal'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
