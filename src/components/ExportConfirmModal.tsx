import React from 'react';
import { MaterialSignal, MonthlyArchiveLog } from '../types';
import { 
  Download, 
  Trash2, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Clock, 
  HardDrive,
  FileSpreadsheet
} from 'lucide-react';

interface ExportConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  finalizedCount: number;
  monthlyLog: MonthlyArchiveLog;
  onConfirmPurge: () => void;
  onKeepData: () => void;
}

export const ExportConfirmModal: React.FC<ExportConfirmModalProps> = ({
  isOpen,
  onClose,
  finalizedCount,
  monthlyLog,
  onConfirmPurge,
  onKeepData,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-purple-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-950 via-slate-900 to-purple-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <span>Exportación Exitosa Descargada</span>
                <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Se ha generado el archivo CSV con los materiales finalizados.
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

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Summary Box */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-purple-900/50 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Período de Cierre</span>
              <span className="text-xs font-extrabold text-purple-300 font-mono">{monthlyLog.monthPeriod}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Materiales Exportados</span>
                <span className="text-xl font-extrabold text-white font-mono">{finalizedCount} señales</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Horas Grabadas Total</span>
                <span className="text-xl font-extrabold text-amber-300 font-mono">{monthlyLog.formattedDuration}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
              <span>Registrado por: <strong className="text-white">{monthlyLog.exportedBy}</strong></span>
              <span>{monthlyLog.exportDate}</span>
            </div>
          </div>

          {/* Question / Prompt */}
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/50 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-xs font-extrabold text-amber-200 uppercase tracking-wider">
                ¿Desea depurar estos materiales de la base de datos?
              </h3>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                Eliminar los materiales finalizados mantendrá la base de datos liviana, acelerará la carga en todos los dispositivos y reducirá el consumo de memoria. El resumen mensual de horas y estadísticas quedará guardado permanentemente en el historial.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            onClick={onKeepData}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all flex items-center justify-center gap-2"
          >
            <Database className="w-4 h-4 text-slate-400" />
            <span>No, Conservar en Base de Datos</span>
          </button>

          <button
            onClick={onConfirmPurge}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-xs shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Sí, Depurar y Guardar Estatus Mensual</span>
          </button>
        </div>
      </div>
    </div>
  );
};
