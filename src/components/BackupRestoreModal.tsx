import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Download, 
  Upload, 
  RotateCcw, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Save, 
  Database,
  Trash2,
  HardDrive,
  Calendar,
  Layers,
  Sparkles,
  FileSpreadsheet,
  Film,
  User,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import { BackupSnapshot, AppState, MaterialSignal } from '../types';
import { 
  loadBackupSnapshots, 
  createBackupSnapshot, 
  clearBackupSnapshots, 
  exportStateToJSON, 
  parseImportedJSON,
  getLocalDateISOString,
  normalizeDateString,
  formatDurationHHMMSS,
  durationToSeconds,
  secondsToDuration,
  createDailyBackupInDrive,
  createMonthlyBackupInDrive,
  exportDailyBackupToCSV,
  exportMonthlyBackupToCSV
} from '../services/apiService';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onRestoreState: (restored: {
    materials: any[];
    personnel: any[];
    guardShifts: any[];
    monthlyArchives?: any[];
  }) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type ActiveSubTab = 'daily' | 'monthly' | 'snapshots';

const MONTH_NAMES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  state,
  onRestoreState,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveSubTab>('daily');
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(() => getLocalDateISOString());
  const [selectedMonth, setSelectedMonth] = useState<string>('08');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  
  const [isGeneratingDrive, setIsGeneratingDrive] = useState(false);
  const [driveResult, setDriveResult] = useState<{ success: boolean; message: string; sheetName?: string } | null>(null);

  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [newSnapshotNote, setNewSnapshotNote] = useState('');
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const refreshSnapshots = () => {
    setSnapshots(loadBackupSnapshots());
  };

  useEffect(() => {
    if (isOpen) {
      refreshSnapshots();
      setDriveResult(null);
    }
  }, [isOpen]);

  // 1. Filtered materials for selected Daily date
  const dailyMaterials = useMemo(() => {
    if (!state.materials || state.materials.length === 0) return [];
    return state.materials.filter((m) => {
      const normalized = normalizeDateString(m.creationDate);
      return normalized === selectedDailyDate;
    });
  }, [state.materials, selectedDailyDate]);

  const dailyDurationTotal = useMemo(() => {
    const totalSecs = dailyMaterials.reduce((acc, m) => acc + durationToSeconds(m.duration), 0);
    return secondsToDuration(totalSecs);
  }, [dailyMaterials]);

  // 2. Filtered materials for selected Monthly period
  const selectedYearMonth = `${selectedYear}-${selectedMonth}`;
  const monthlyMaterials = useMemo(() => {
    if (!state.materials || state.materials.length === 0) return [];
    return state.materials.filter((m) => {
      const normalized = normalizeDateString(m.creationDate);
      return normalized.startsWith(selectedYearMonth);
    });
  }, [state.materials, selectedYearMonth]);

  const monthlySummary = useMemo(() => {
    const totalSecs = monthlyMaterials.reduce((acc, m) => acc + durationToSeconds(m.duration), 0);
    const prensa = monthlyMaterials.filter(m => m.division === 'Prensa').length;
    const prog = monthlyMaterials.filter(m => m.division === 'Programación').length;
    const ingesta = monthlyMaterials.filter(m => m.division === 'Ingesta').length;
    const finalized = monthlyMaterials.filter(m => m.status === 'Finalizado' || m.isFinalized).length;

    return {
      totalCount: monthlyMaterials.length,
      formattedDuration: secondsToDuration(totalSecs),
      totalSeconds: totalSecs,
      prensaCount: prensa,
      programacionCount: prog,
      ingestaCount: ingesta,
      finalizedCount: finalized,
    };
  }, [monthlyMaterials]);

  if (!isOpen) return null;

  // Handler: Create Daily Backup in Google Drive
  const handleCreateDailyDriveBackup = async () => {
    if (!state.appsScriptUrl) {
      onToast('Para guardar en Google Drive, configure la URL de Google Apps Script en la pestaña de Configuración.', 'error');
      return;
    }

    if (dailyMaterials.length === 0) {
      if (!window.confirm(`No se encontraron tareas registradas en la fecha ${selectedDailyDate}. ¿Desea crear la hoja de respaldo de todas formas?`)) {
        return;
      }
    }

    setIsGeneratingDrive(true);
    setDriveResult(null);

    // Format DD/MM/YYYY
    const parts = selectedDailyDate.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : selectedDailyDate;

    const result = await createDailyBackupInDrive(
      state.appsScriptUrl,
      formattedDate,
      dailyMaterials,
      state.currentUser.name || 'Operador VTV'
    );

    setIsGeneratingDrive(false);
    setDriveResult(result);

    if (result.success) {
      onToast(`✓ Respaldo Diario creado en Google Drive: Hoja '${result.sheetName || formattedDate}'`, 'success');
    } else {
      onToast(result.message, 'error');
    }
  };

  // Handler: Create Monthly Backup in Google Drive
  const handleCreateMonthlyDriveBackup = async () => {
    if (!state.appsScriptUrl) {
      onToast('Para guardar en Google Drive, configure la URL de Google Apps Script en la pestaña de Configuración.', 'error');
      return;
    }

    setIsGeneratingDrive(true);
    setDriveResult(null);

    const monthObj = MONTH_NAMES.find(m => m.value === selectedMonth);
    const periodLabel = `${monthObj?.label || selectedMonth} ${selectedYear}`;

    const result = await createMonthlyBackupInDrive(
      state.appsScriptUrl,
      periodLabel,
      monthlyMaterials,
      monthlySummary,
      state.currentUser.name || 'Gerencia de Archivo'
    );

    setIsGeneratingDrive(false);
    setDriveResult(result);

    if (result.success) {
      onToast(`✓ Respaldo Mensual creado en Google Drive: Hoja '${result.sheetName || periodLabel}'`, 'success');
    } else {
      onToast(result.message, 'error');
    }
  };

  // Quick Date presets
  const setDateOffset = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDailyDate(getLocalDateISOString(d));
    setDriveResult(null);
  };

  const handleCreateManualSnapshot = () => {
    const note = newSnapshotNote.trim() || 'Copia de seguridad manual del usuario';
    const created = createBackupSnapshot(
      state.materials,
      state.personnel,
      state.guardShifts,
      state.monthlyArchives || [],
      note
    );
    if (created) {
      onToast('Copia de seguridad manual guardada con éxito.', 'success');
      setNewSnapshotNote('');
      refreshSnapshots();
    } else {
      onToast('No se pudo crear la copia de seguridad local.', 'error');
    }
  };

  const handleRestore = (snap: BackupSnapshot) => {
    onRestoreState({
      materials: snap.materials || [],
      personnel: snap.personnel || [],
      guardShifts: snap.guardShifts || [],
      monthlyArchives: snap.monthlyArchives || [],
    });
    setConfirmRestoreId(null);
    onToast(`Restaurada con éxito la copia del ${snap.timestamp} (${snap.materialsCount} materiales).`, 'success');
    onClose();
  };

  const handleExportJSON = () => {
    exportStateToJSON(
      state.materials,
      state.personnel,
      state.guardShifts,
      state.monthlyArchives || []
    );
    onToast('Archivo JSON de respaldo exportado a su equipo.', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const result = parseImportedJSON(content);
      if (result.success && result.data) {
        onRestoreState(result.data);
        onToast(result.message, 'success');
        onClose();
      } else {
        onToast(result.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearAll = () => {
    if (window.confirm('¿Está seguro de eliminar el historial de copias locales de seguridad?')) {
      clearBackupSnapshots();
      refreshSnapshots();
      onToast('Historial de copias de seguridad locales limpiado.', 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Centro de Respaldos (Diario y Mensual)
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                  Google Drive & Local
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Genere hojas nuevas de cálculo en Google Drive por fecha/mes con toda la metadata y tareas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 pt-3 gap-2">
          <button
            onClick={() => { setActiveTab('daily'); setDriveResult(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x ${
              activeTab === 'daily'
                ? 'bg-slate-900 text-sky-400 border-slate-700 shadow-md'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Calendar className="w-4 h-4 text-sky-400" />
            <span>1. Respaldo Diario (Por Fecha)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-950 text-sky-300 font-semibold">
              {dailyMaterials.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('monthly'); setDriveResult(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x ${
              activeTab === 'monthly'
                ? 'bg-slate-900 text-emerald-400 border-slate-700 shadow-md'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>2. Respaldo Mensual</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 font-semibold">
              {monthlyMaterials.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('snapshots'); setDriveResult(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-t border-x ${
              activeTab === 'snapshots'
                ? 'bg-slate-900 text-amber-400 border-slate-700 shadow-md'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>3. Copias Locales y JSON</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950 text-amber-300 font-semibold">
              {snapshots.length}
            </span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* TAB 1: RESUMEN Y GENERACIÓN DE RESPALDO DIARIO */}
          {activeTab === 'daily' && (
            <div className="space-y-6">
              {/* Date Selector Box */}
              <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Seleccione la Fecha del Respaldo:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={selectedDailyDate}
                        onChange={(e) => { setSelectedDailyDate(e.target.value); setDriveResult(null); }}
                        className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-sky-500 shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Preset chips */}
                  <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
                    <span className="text-[11px] text-slate-500 mr-1">Atajos:</span>
                    <button
                      onClick={() => setDateOffset(0)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors ${
                        selectedDailyDate === getLocalDateISOString()
                          ? 'bg-sky-600 text-white border-sky-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      Hoy
                    </button>
                    <button
                      onClick={() => setDateOffset(-1)}
                      className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
                    >
                      Ayer
                    </button>
                    <button
                      onClick={() => { setSelectedDailyDate('2026-08-18'); setDriveResult(null); }}
                      className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
                    >
                      18/08
                    </button>
                    <button
                      onClick={() => { setSelectedDailyDate('2026-08-17'); setDriveResult(null); }}
                      className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
                    >
                      17/08
                    </button>
                    <button
                      onClick={() => { setSelectedDailyDate('2026-08-16'); setDriveResult(null); }}
                      className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
                    >
                      16/08
                    </button>
                  </div>
                </div>

                {/* Daily Metrics Pill */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Tareas del Día</span>
                    <span className="text-xl font-extrabold text-sky-400">{dailyMaterials.length}</span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Duración Total</span>
                    <span className="text-xl font-extrabold text-amber-400 font-mono">{dailyDurationTotal}</span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Prensa / Prog</span>
                    <span className="text-sm font-bold text-slate-200 mt-1 block">
                      {dailyMaterials.filter(m => m.division === 'Prensa').length} Prensa • {dailyMaterials.filter(m => m.division === 'Programación').length} Prog
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Finalizados</span>
                    <span className="text-sm font-bold text-emerald-400 mt-1 block">
                      {dailyMaterials.filter(m => m.status === 'Finalizado' || m.isFinalized).length} de {dailyMaterials.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Daily Backup */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-950/60 to-slate-950 border border-sky-800/60 space-y-3 flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white">
                        Crear Hoja en Google Drive / Sheets
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      Crea automáticamente una nueva pestaña en tu Google Drive nombrada <code className="text-sky-300 font-mono font-bold">Diario_{selectedDailyDate.replace(/-/g, '/')}</code> conteniendo todas las tareas creadas ese día con su metadata completa.
                    </p>
                  </div>

                  <button
                    onClick={handleCreateDailyDriveBackup}
                    disabled={isGeneratingDrive}
                    className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {isGeneratingDrive ? (
                      <>
                        <RotateCcw className="w-4 h-4 animate-spin text-sky-200" />
                        <span>Generando hoja en Google Drive...</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Crear Respaldo Diario en Google Drive</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3 flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Download className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white">
                        Descargar Respaldo Diario (.CSV / Excel)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Descarga a tu computadora un archivo de hoja de cálculo compatible con Excel con todas las {dailyMaterials.length} tareas y columnas de metadata de la fecha seleccionada.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      exportDailyBackupToCSV(selectedDailyDate, dailyMaterials);
                      onToast(`Archivo CSV de respaldo diario descargado (${dailyMaterials.length} tareas).`, 'success');
                    }}
                    className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 hover:border-emerald-500 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar CSV para Excel</span>
                  </button>
                </div>
              </div>

              {/* Status feedback */}
              {driveResult && (
                <div className={`p-4 rounded-2xl border ${
                  driveResult.success 
                    ? 'bg-emerald-950/50 border-emerald-700 text-emerald-200' 
                    : 'bg-rose-950/50 border-rose-700 text-rose-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {driveResult.success ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                    <span className="text-xs font-bold">{driveResult.message}</span>
                  </div>
                  {driveResult.sheetName && (
                    <p className="text-[11px] text-emerald-300 mt-1 pl-7">
                      Nombre de la hoja creada: <strong>{driveResult.sheetName}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Daily Tasks Preview Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Tareas y Materiales a Respaldar ({dailyMaterials.length})</span>
                  <span className="text-[11px] text-slate-500 font-normal">Fecha: {selectedDailyDate}</span>
                </h4>

                {dailyMaterials.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950/40 rounded-xl border border-slate-800/80">
                    <Film className="w-7 h-7 text-slate-600 mx-auto mb-1.5" />
                    <p className="text-xs text-slate-400">No hay materiales creados en la fecha seleccionada ({selectedDailyDate}).</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Seleccione otra fecha arriba para ver los registros correspondientes.</p>
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-[10px] text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">ID</th>
                          <th className="py-2.5 px-3">Título / Descripción</th>
                          <th className="py-2.5 px-3">Señal</th>
                          <th className="py-2.5 px-3">División</th>
                          <th className="py-2.5 px-3">Duración</th>
                          <th className="py-2.5 px-3">Creador</th>
                          <th className="py-2.5 px-3">Asignado</th>
                          <th className="py-2.5 px-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {dailyMaterials.map((m, mIdx) => (
                          <tr key={`daily-mat-${m.id}-${m.signalType}-${mIdx}`} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2 px-3 font-mono text-[11px] text-sky-400 font-semibold">{m.id}</td>
                            <td className="py-2 px-3 font-medium text-white max-w-xs truncate">{m.title}</td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-semibold">
                                {m.signalType}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-400">{m.division}</td>
                            <td className="py-2 px-3 font-mono text-slate-300">{m.duration}</td>
                            <td className="py-2 px-3 text-slate-400">{m.createdBy}</td>
                            <td className="py-2 px-3 text-slate-400">{m.assignedPersons?.join(', ') || m.assignedTo || 'Sin asignar'}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                m.status === 'Finalizado' || m.isFinalized
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : m.status === 'Por Archivar'
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                  : 'bg-blue-950 text-blue-400 border border-blue-800'
                              }`}>
                                {m.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RESUMEN Y GENERACIÓN DE RESPALDO MENSUAL */}
          {activeTab === 'monthly' && (
            <div className="space-y-6">
              {/* Month Selector Box */}
              <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Seleccione el Mes y Año del Respaldo:
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedMonth}
                        onChange={(e) => { setSelectedMonth(e.target.value); setDriveResult(null); }}
                        className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                      >
                        {MONTH_NAMES.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>

                      <select
                        value={selectedYear}
                        onChange={(e) => { setSelectedYear(e.target.value); setDriveResult(null); }}
                        className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                      >
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                        <option value="2027">2027</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 self-start sm:self-center">
                    Período: <strong className="text-emerald-400">{MONTH_NAMES.find(m => m.value === selectedMonth)?.label} {selectedYear}</strong>
                  </div>
                </div>

                {/* Monthly Metrics Pill */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Materiales del Mes</span>
                    <span className="text-xl font-extrabold text-emerald-400">{monthlySummary.totalCount}</span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Horas Acumuladas</span>
                    <span className="text-xl font-extrabold text-amber-400 font-mono">{monthlySummary.formattedDuration}</span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Prensa / Prog / Ing</span>
                    <span className="text-xs font-bold text-slate-200 mt-1 block">
                      {monthlySummary.prensaCount} Pre • {monthlySummary.programacionCount} Prog • {monthlySummary.ingestaCount} Ing
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Finalizados</span>
                    <span className="text-sm font-bold text-emerald-400 mt-1 block">
                      {monthlySummary.finalizedCount} ({monthlySummary.totalCount > 0 ? Math.round((monthlySummary.finalizedCount / monthlySummary.totalCount) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Monthly Backup */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-slate-950 border border-emerald-800/60 space-y-3 flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white">
                        Crear Hoja Mensual en Google Drive
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      Genera una hoja nombrada <code className="text-emerald-300 font-mono font-bold">Mensual_{selectedYear}_{selectedMonth}</code> en tu Google Drive con un bloque de resumen ejecutivo + el desglose completo de tareas.
                    </p>
                  </div>

                  <button
                    onClick={handleCreateMonthlyDriveBackup}
                    disabled={isGeneratingDrive}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {isGeneratingDrive ? (
                      <>
                        <RotateCcw className="w-4 h-4 animate-spin text-emerald-200" />
                        <span>Generando hoja en Google Drive...</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Crear Respaldo Mensual en Google Drive</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3 flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                        <Download className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white">
                        Descargar Respaldo Mensual (.CSV / Excel)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Descarga el consolidado mensual de materiales de {MONTH_NAMES.find(m => m.value === selectedMonth)?.label} {selectedYear} para análisis o reportes en Excel.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      exportMonthlyBackupToCSV(`${MONTH_NAMES.find(m => m.value === selectedMonth)?.label} ${selectedYear}`, monthlyMaterials, monthlySummary);
                      onToast(`Respaldo mensual descargado (${monthlyMaterials.length} materiales).`, 'success');
                    }}
                    className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 hover:border-teal-500 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar CSV Mensual para Excel</span>
                  </button>
                </div>
              </div>

              {/* Status feedback */}
              {driveResult && (
                <div className={`p-4 rounded-2xl border ${
                  driveResult.success 
                    ? 'bg-emerald-950/50 border-emerald-700 text-emerald-200' 
                    : 'bg-rose-950/50 border-rose-700 text-rose-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {driveResult.success ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                    <span className="text-xs font-bold">{driveResult.message}</span>
                  </div>
                  {driveResult.sheetName && (
                    <p className="text-[11px] text-emerald-300 mt-1 pl-7">
                      Nombre de la hoja creada: <strong>{driveResult.sheetName}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COPIAS DE SEGURIDAD LOCALES Y ARCHIVOS JSON */}
          {activeTab === 'snapshots' && (
            <div className="space-y-6">
              {/* Quick Actions Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Download className="w-4 h-4 text-blue-400" />
                      Descargar Copia Completa de Base de Datos (JSON)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Guarda un archivo seguro en tu computadora con todos los materiales ({state.materials.length}), personal ({state.personnel.length}) y guardias ({state.guardShifts.length}).
                    </p>
                  </div>
                  <button
                    onClick={handleExportJSON}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar Archivo .JSON</span>
                  </button>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Upload className="w-4 h-4 text-emerald-400" />
                      Restaurar desde Archivo (JSON)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Carga aquí un archivo de respaldo JSON descargado previamente para restaurar toda la información.
                    </p>
                  </div>
                  <label className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>Seleccionar y Cargar Archivo .JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Create Manual Snapshot Box */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Save className="w-4 h-4 text-amber-400" />
                  Crear Nuevo Punto de Restauración Local Inmediato
                </h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newSnapshotNote}
                    onChange={(e) => setNewSnapshotNote(e.target.value)}
                    placeholder="Ejemplo: Respaldo antes de guardia o entrega de turno..."
                    className="flex-1 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleCreateManualSnapshot}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Punto Local</span>
                  </button>
                </div>
              </div>

              {/* Automatic Snapshots List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Historial de Puntos de Restauración Automáticos ({snapshots.length})
                  </h3>
                  {snapshots.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Limpiar historial</span>
                    </button>
                  )}
                </div>

                {snapshots.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/80">
                    <HardDrive className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400 font-medium">No hay copias de seguridad anteriores registradas.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {snapshots.map((snap) => {
                      const isConfirming = confirmRestoreId === snap.id;
                      return (
                        <div
                          key={snap.id}
                          className="p-3.5 bg-slate-950/80 border border-slate-800/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-all"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{snap.timestamp}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                                {snap.note}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span>📦 <strong>{snap.materialsCount}</strong> materiales</span>
                              <span>👥 <strong>{snap.personnelCount}</strong> personal</span>
                              <span>📅 <strong>{snap.shiftsCount}</strong> guardias</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            {isConfirming ? (
                              <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-800 p-1 rounded-lg">
                                <span className="text-[11px] text-rose-300 font-bold px-1">¿Sobrescribir?</span>
                                <button
                                  onClick={() => handleRestore(snap)}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded"
                                >
                                  Sí, Restaurar
                                </button>
                                <button
                                  onClick={() => setConfirmRestoreId(null)}
                                  className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmRestoreId(snap.id)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 hover:border-emerald-500 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Restaurar Esta Copia</span>
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
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {state.appsScriptUrl ? (
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                Google Drive Conectado
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Google Drive no configurado (Descargas locales CSV/JSON habilitadas)
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

