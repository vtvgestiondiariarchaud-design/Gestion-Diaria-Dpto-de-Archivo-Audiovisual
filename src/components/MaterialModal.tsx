import React, { useState, useEffect } from 'react';
import { MaterialSignal, DivisionType, SignalType, UserProfile, MaterialStatus } from '../types';
import { X, Film, Layers, Clock, Calendar, User, FileText, CheckCircle2, Copy, Sparkles, Ban } from 'lucide-react';
import { getFormattedDateTime, formatDurationHHMMSS, getLocalDateISOString } from '../services/apiService';

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSave: (newSignals: MaterialSignal[]) => void;
  presetFamilyId?: string;
  presetTitle?: string;
  presetDivision?: DivisionType;
  presetIsRequestTask?: boolean;
}

interface SignalDuration {
  hours: string;
  minutes: string;
  seconds: string;
}

const DEFAULT_ZERO_DURATION: SignalDuration = {
  hours: '00',
  minutes: '00',
  seconds: '00',
};

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

export const MaterialModal: React.FC<MaterialModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSave,
  presetFamilyId,
  presetTitle,
  presetDivision,
  presetIsRequestTask = false,
}) => {
  const todayStr = getLocalDateISOString();

  const [mode, setMode] = useState<'batch' | 'single'>(
    presetFamilyId || presetIsRequestTask ? 'single' : 'batch'
  );
  const [isRequestTask, setIsRequestTask] = useState<boolean>(presetIsRequestTask);
  const [title, setTitle] = useState(presetTitle || '');
  const [division, setDivision] = useState<DivisionType>(
    presetDivision || (currentUser.division && currentUser.division !== 'Gerencia' ? currentUser.division : 'Prensa')
  );
  const [signalPreset, setSignalPreset] = useState<string>('Limpio');
  const [customSignalName, setCustomSignalName] = useState<string>('');
  const [status, setStatus] = useState<MaterialStatus>('Registrado');

  // Durations default to 00:00:00
  const [singleDuration, setSingleDuration] = useState<SignalDuration>({ ...DEFAULT_ZERO_DURATION });
  const [batchDurations, setBatchDurations] = useState<Record<string, SignalDuration>>({
    Limpio: { ...DEFAULT_ZERO_DURATION },
    Insert: { ...DEFAULT_ZERO_DURATION },
    Master: { ...DEFAULT_ZERO_DURATION },
  });

  const [creationDate, setCreationDate] = useState(todayStr);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens or presets change
  useEffect(() => {
    if (isOpen) {
      setMode(presetFamilyId || presetIsRequestTask ? 'single' : 'batch');
      setIsRequestTask(Boolean(presetIsRequestTask));
      setTitle(presetTitle || '');
      setDivision(
        presetDivision || (currentUser.division && currentUser.division !== 'Gerencia' ? currentUser.division : 'Prensa')
      );
      setSignalPreset('Limpio');
      setCustomSignalName('');
      setStatus('Registrado');
      setSingleDuration({ ...DEFAULT_ZERO_DURATION });
      setBatchDurations({
        Limpio: { ...DEFAULT_ZERO_DURATION },
        Insert: { ...DEFAULT_ZERO_DURATION },
        Master: { ...DEFAULT_ZERO_DURATION },
      });
      setCreationDate(getLocalDateISOString());
      setNotes('');
    }
  }, [isOpen, presetFamilyId, presetTitle, presetDivision, presetIsRequestTask, currentUser]);

  if (!isOpen) return null;

  const handleCopyLimpioToAll = () => {
    const limpioDur = { ...batchDurations.Limpio };
    setBatchDurations({
      Limpio: limpioDur,
      Insert: { ...limpioDur },
      Master: { ...limpioDur },
    });
  };

  const handleBatchDurationChange = (
    type: string,
    field: 'hours' | 'minutes' | 'seconds',
    val: string
  ) => {
    const sanitized = val.replace(/\D/g, '').slice(0, 2);
    setBatchDurations((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: sanitized,
      },
    }));
  };

  const handleSingleDurationChange = (
    field: 'hours' | 'minutes' | 'seconds',
    val: string
  ) => {
    const sanitized = val.replace(/\D/g, '').slice(0, 2);
    setSingleDuration((prev) => ({
      ...prev,
      [field]: sanitized,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);

    const pad = (v: string) => (v || '0').padStart(2, '0');

    // High entropy unique seed to prevent collisions with existing cards
    const timestampSeed = Date.now().toString().slice(-6);
    const randomSeed = Math.floor(100 + Math.random() * 900);
    const familyId = presetFamilyId ? presetFamilyId.trim() : `FAM-2026-${timestampSeed}${randomSeed}`;

    const now = new Date();
    const numPad = (v: number) => String(v).padStart(2, '0');
    const currentTime = `${numPad(now.getHours())}:${numPad(now.getMinutes())}`;
    const rawTimestamp = creationDate.includes(' ') ? creationDate : `${creationDate} ${currentTime}`;
    const fullCreationTimestamp = getFormattedDateTime(rawTimestamp);

    const generatedSignals: MaterialSignal[] = [];

    const isDiscarded = status === 'Descartado';
    const computedStatus: MaterialStatus = isDiscarded
      ? 'Descartado'
      : isRequestTask
      ? 'Por Archivar'
      : status;

    if (mode === 'batch' && !presetFamilyId) {
      // Create 3 distinct signals with individual durations: Limpio, Insert, Master
      const standardTypes = [
        { type: 'Limpio', code: 'LIM' },
        { type: 'Insert', code: 'INS' },
        { type: 'Master', code: 'MAS' },
      ];

      standardTypes.forEach(({ type: stype, code }) => {
        const matId = `MAT-2026-${timestampSeed}${randomSeed}-${code}`;
        const d = batchDurations[stype] || DEFAULT_ZERO_DURATION;
        const formattedDuration = formatDurationHHMMSS(`${pad(d.hours)}:${pad(d.minutes)}:${pad(d.seconds)}`);

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
          status: computedStatus,
          isDiscarded,
          isIngested: true,
          isCataloged: !isDiscarded && isRequestTask,
          isFinalized: false,
          isRequestTask,
          catalogedBy: !isDiscarded && isRequestTask ? currentUser.name : undefined,
          catalogedAt: !isDiscarded && isRequestTask ? fullCreationTimestamp : undefined,
          notes: notes.trim(),
        });
      });
    } else {
      // Create a single unique signal (standard or custom)
      const finalSignalType =
        signalPreset === 'custom'
          ? customSignalName.trim() || 'Personalizada'
          : signalPreset;

      let code = 'SIG';
      if (finalSignalType === 'Limpio') code = 'LIM';
      else if (finalSignalType === 'Insert') code = 'INS';
      else if (finalSignalType === 'Master') code = 'MAS';
      else if (finalSignalType.length >= 3) {
        code = finalSignalType.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
      }

      const matId = `MAT-2026-${timestampSeed}${randomSeed}-${code}`;
      const d = singleDuration;
      const formattedDuration = formatDurationHHMMSS(`${pad(d.hours)}:${pad(d.minutes)}:${pad(d.seconds)}`);

      generatedSignals.push({
        id: matId,
        familyId,
        signalType: finalSignalType,
        title: title.trim(),
        division,
        duration: formattedDuration,
        creationDate: fullCreationTimestamp,
        createdBy: currentUser.name,
        creatorRole: `${currentUser.role}${currentUser.division ? ` (${currentUser.division})` : ''}`,
        status: computedStatus,
        isDiscarded,
        isIngested: true,
        isCataloged: !isDiscarded && isRequestTask,
        isFinalized: false,
        isRequestTask,
        catalogedBy: !isDiscarded && isRequestTask ? currentUser.name : undefined,
        catalogedAt: !isDiscarded && isRequestTask ? fullCreationTimestamp : undefined,
        notes: notes.trim(),
      });
    }

    onSave(generatedSignals);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isRequestTask
                  ? 'bg-purple-600/20 text-purple-400 border-purple-500/30'
                  : 'bg-blue-600/20 text-blue-400 border-blue-500/30'
              }`}
            >
              {isRequestTask ? <FileText className="w-5 h-5" /> : <Film className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {presetFamilyId
                  ? 'Añadir Señal a Familia Existente'
                  : isRequestTask
                  ? 'Registrar Solicitud / Otra Tarea'
                  : 'Nuevo Registro de Ingesta'}
              </h2>
              <p className="text-xs text-slate-400">
                {presetFamilyId
                  ? `Se asociará a la tarjeta "${presetTitle || presetFamilyId}"`
                  : isRequestTask
                  ? 'Genera una tarea directa para asignación y catalogación documental'
                  : 'Registra materiales audiovisuales con duraciones y señales personalizadas'}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm overflow-y-auto">
          {/* Mode Selector (Only if not a preset family and not request task) */}
          {!presetFamilyId && !isRequestTask && (
            <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-xl grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setMode('batch')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === 'batch'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Familia Completa (3 Señales Estándar)
              </button>
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === 'single'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                Señal Individual / Personalizada
              </button>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Nombre de la Actividad / Programa *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Rueda de Prensa Min. Comunicación, Reportaje Especial..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm font-medium"
            />
          </div>

          {/* Division & Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                División *
              </label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value as DivisionType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 text-sm font-medium"
              >
                <option value="Prensa">División 1: Archivo de Prensa</option>
                <option value="Programación">División 2: Archivo de Programación</option>
                <option value="Ingesta">División 3: Ingesta</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                Estado Inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MaterialStatus)}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border text-sm font-bold focus:outline-none ${
                  status === 'Descartado'
                    ? 'border-rose-500 text-rose-300 bg-rose-950/30'
                    : 'border-slate-800 text-white focus:border-blue-500'
                }`}
              >
                <option value="Registrado">Registrado (Activo)</option>
                <option value="Descartado">🚫 Descartado (Solo suma horas ingestadas)</option>
              </select>
            </div>
          </div>

          {/* Discarded Notice */}
          {status === 'Descartado' && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2">
              <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block mb-0.5">Material Descartado:</span>
                <span>Las horas ingestadas de este material se contabilizarán en el balance total, pero no aparecerá como tarea pendiente por archivar.</span>
              </div>
            </div>
          )}

          {/* Single Mode: Signal Type & Custom Signal Support */}
          {mode === 'single' && (
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center justify-between">
                <span>Tipo de Señal para esta tarjeta</span>
                <span className="text-[10px] font-normal text-slate-400">Personalizable</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Elegir Tipo / Predefinido</span>
                  <select
                    value={signalPreset}
                    onChange={(e) => {
                      setSignalPreset(e.target.value);
                      if (e.target.value !== 'custom') {
                        setCustomSignalName('');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 text-xs font-bold"
                  >
                    <optgroup label="Estándar">
                      <option value="Limpio">Limpio (Clean Feed)</option>
                      <option value="Insert">Insert (Con Gráficos)</option>
                      <option value="Master">Master (Emisión/Aire)</option>
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
                    <span className="text-[10px] text-purple-300 block mb-1 font-bold">Escribe el nombre de la señal</span>
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
                    Señal: <strong className="text-blue-300 ml-1">{signalPreset}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Duration Section */}
          {mode === 'single' ? (
            /* Single Duration Input */
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Duración de la Señal (HH:MM:SS)
              </label>
              <div className="flex items-center gap-2 max-w-xs">
                <div className="flex-1">
                  <span className="text-[10px] text-slate-400 block mb-0.5 text-center">Horas</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={singleDuration.hours}
                    onChange={(e) => handleSingleDurationChange('hours', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-center font-mono text-white text-sm rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <span className="text-lg font-bold text-slate-500 mt-3.5">:</span>
                <div className="flex-1">
                  <span className="text-[10px] text-slate-400 block mb-0.5 text-center">Minutos</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={singleDuration.minutes}
                    onChange={(e) => handleSingleDurationChange('minutes', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-center font-mono text-white text-sm rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <span className="text-lg font-bold text-slate-500 mt-3.5">:</span>
                <div className="flex-1">
                  <span className="text-[10px] text-slate-400 block mb-0.5 text-center">Segundos</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={singleDuration.seconds}
                    onChange={(e) => handleSingleDurationChange('seconds', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-center font-mono text-white text-sm rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Batch Durations: Independent duration inputs for Limpio, Insert, Master */
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Duración Individual por Señal (HH:MM:SS)
                </label>
                <button
                  type="button"
                  onClick={handleCopyLimpioToAll}
                  className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-medium bg-blue-950/40 border border-blue-800/40 px-2 py-1 rounded-md transition-colors"
                  title="Aplica la duración de la señal Limpio a Insert y Master"
                >
                  <Copy className="w-3 h-3" />
                  Copiar Limpio a todas
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Señal Limpio */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-blue-900/40 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                      Limpio
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      placeholder="00"
                      value={batchDurations.Limpio.hours}
                      onChange={(e) => handleBatchDurationChange('Limpio', 'hours', e.target.value)}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 text-center font-mono text-white text-xs rounded focus:outline-none focus:border-blue-500"
                      title="Horas"
                    />
                    <span className="text-slate-500 font-bold text-xs">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="00"
                      value={batchDurations.Limpio.minutes}
                      onChange={(e) => handleBatchDurationChange('Limpio', 'minutes', e.target.value)}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 text-center font-mono text-white text-xs rounded focus:outline-none focus:border-blue-500"
                      title="Minutos"
                    />
                    <span className="text-slate-500 font-bold text-xs">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="00"
                      value={batchDurations.Limpio.seconds}
                      onChange={(e) => handleBatchDurationChange('Limpio', 'seconds', e.target.value)}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 text-center font-mono text-white text-xs rounded focus:outline-none focus:border-blue-500"
                      title="Segundos"
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 px-1 font-mono">
                    <span>H</span>
                    <span>M</span>
                    <span>S</span>
                  </div>
                </div>

                {/* Señal Insert */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-amber-900/40 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                      Insert
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      placeholder="00"
                      value={batchDurations.Insert.hours}
                      onChange={(e) => handleBatchDurationChange('Insert', 'hours', e.target.value)}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 text-center font-mono text-white text-xs rounded focus:outline-none focus:border-amber-500"
                      title="Horas"
                    />
                    <span className="text-slate-500 font-bold text-xs">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="00"
                      value={batchDurations.Insert.minutes}
                      onChange={(e) => handleBatchDurationChange('Insert', 'minutes', e.target.value)}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 text-center font-mono text-white text-xs rounded focus:outline-none focus:border-amber-500"
                      title="Minutos"
                    />
                    <span className="text-slate-500 font-bold text-xs">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="00"
                      value={batchDurations.Insert.seconds}
                      onChange={(e) => handleBatchDurationChange('Insert', 'seconds', e.target.value)}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 text-center font-mono text-white text-xs rounded focus:outline-none focus:border-amber-500"
                      title="Segundos"
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 px-1 font-mono">
                    <span>H</span>
                    <span>M</span>
                    <span>S</span>
                  </div>
                </div>

                {/* Señal Master */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-purple-900/40 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                      Master
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      placeholder="00"
                      value={batchDurations.Master.hours}
                      onChange={(e) => handleBatchDurationChange('Master', 'hours', e.target.value)}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 text-center font-mono text-white text-xs rounded focus:outline-none focus:border-purple-500"
                      title="Horas"
                    />
                    <span className="text-slate-500 font-bold text-xs">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="00"
                      value={batchDurations.Master.minutes}
                      onChange={(e) => handleBatchDurationChange('Master', 'minutes', e.target.value)}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 text-center font-mono text-white text-xs rounded focus:outline-none focus:border-purple-500"
                      title="Minutos"
                    />
                    <span className="text-slate-500 font-bold text-xs">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="00"
                      value={batchDurations.Master.seconds}
                      onChange={(e) => handleBatchDurationChange('Master', 'seconds', e.target.value)}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 text-center font-mono text-white text-xs rounded focus:outline-none focus:border-purple-500"
                      title="Segundos"
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 px-1 font-mono">
                    <span>H</span>
                    <span>M</span>
                    <span>S</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg transition-all flex items-center gap-2 ${
                isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
              } ${
                isRequestTask
                  ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-950/60'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {presetFamilyId
                  ? 'Añadir Señal a Tarjeta'
                  : isRequestTask
                  ? mode === 'batch'
                    ? 'Guardar Solicitud (3 Señales)'
                    : 'Guardar Solicitud / Tarea'
                  : mode === 'batch'
                  ? 'Guardar Familia (3 Señales)'
                  : 'Guardar Señal de Ingesta'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
