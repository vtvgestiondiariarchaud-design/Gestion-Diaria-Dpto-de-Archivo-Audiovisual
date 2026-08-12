import React, { useState } from 'react';
import { MonthlyArchiveLog } from '../types';
import { 
  X, 
  Calendar, 
  UserCheck, 
  Clock, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronUp, 
  Film, 
  Trash2,
  HardDrive,
  Award,
  Layers
} from 'lucide-react';

interface MonthlyArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthlyArchives: MonthlyArchiveLog[];
  onClearHistory?: () => void;
}

export const MonthlyArchiveModal: React.FC<MonthlyArchiveModalProps> = ({
  isOpen,
  onClose,
  monthlyArchives,
  onClearHistory,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const totalAllHoursSecs = monthlyArchives.reduce((acc, log) => acc + log.totalDurationSeconds, 0);
  const totalAllItems = monthlyArchives.reduce((acc, log) => acc + log.materialsCount, 0);

  const formatHours = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-purple-800/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-950 via-slate-900 to-slate-950 border-b border-purple-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <span>Histórico Mensual de Cierres y Horas</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-purple-900/80 text-purple-300 border border-purple-700">
                  {monthlyArchives.length} reportes
                </span>
              </h2>
              <p className="text-xs text-purple-300/70">
                Resumen consolidado de horas grabadas, cierres mensuales y depuración de la base de datos.
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

        {/* Global Summary KPI Bar */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Materiales Depurados</span>
              <span className="text-lg font-extrabold text-white font-mono">{totalAllItems} señales</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Horas Grabadas Acumuladas</span>
              <span className="text-lg font-extrabold text-amber-300 font-mono">{formatHours(totalAllHoursSecs)}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Cierres Mensuales Registrados</span>
              <span className="text-lg font-extrabold text-emerald-300 font-mono">{monthlyArchives.length} períodos</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {monthlyArchives.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/50 border border-slate-800 rounded-2xl space-y-3">
              <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">No hay reportes de cierre registrados</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Al realizar una exportación de material finalizado y confirmar su depuración de la base de datos, los resúmenes mensuales con horas grabadas se guardarán automáticamente aquí.
              </p>
            </div>
          ) : (
            monthlyArchives.map((log) => {
              const isExpanded = expandedId === log.id;
              return (
                <div
                  key={log.id}
                  className="bg-slate-950/80 border border-purple-900/40 hover:border-purple-700/60 rounded-2xl overflow-hidden transition-all shadow-md"
                >
                  {/* Card Header */}
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="p-4 cursor-pointer hover:bg-slate-850 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-950 text-purple-300 border border-purple-800 shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-white">{log.monthPeriod}</h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-purple-300">
                            {log.id}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                            <strong>{log.exportedBy}</strong> ({log.exporterRole})
                          </span>
                          <span>•</span>
                          <span>{log.exportDate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-2 md:pt-0 border-slate-800">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Horas Grabadas</span>
                        <span className="text-sm font-extrabold text-amber-300 font-mono">
                          {log.formattedDuration}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Materiales</span>
                        <span className="text-sm font-extrabold text-purple-300 font-mono">
                          {log.materialsCount} ítems
                        </span>
                      </div>

                      <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="p-4 border-t border-slate-800 bg-slate-900/90 space-y-4 text-xs animate-fade-in">
                      {/* Breakdown by division */}
                      <div>
                        <h4 className="font-bold text-purple-300 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                          Desglose por División
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {Object.entries(log.divisionBreakdown || {}).map(([divName, data]) => {
                            const info = data as { count: number; seconds: number };
                            return (
                              <div key={divName} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                                <span className="font-semibold text-slate-300">{divName}</span>
                                <div className="text-right font-mono">
                                  <span className="font-bold text-white block">{info.count} materiales</span>
                                  <span className="text-[10px] text-amber-300">{formatHours(info.seconds)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Exported Items List */}
                      <div>
                        <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] mb-2">
                          Listado de Señales Depuradas ({log.exportedItems?.length || 0})
                        </h4>
                        <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 p-2 space-y-1">
                          {log.exportedItems?.map((item) => (
                            <div
                              key={item.id}
                              className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-800/60 flex items-center justify-between text-[11px]"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono font-bold text-blue-400 shrink-0">{item.id}</span>
                                <span className="text-white truncate font-medium">{item.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{item.division}</span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">{item.duration}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          {onClearHistory && monthlyArchives.length > 0 ? (
            <button
              onClick={onClearHistory}
              className="px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-rose-900/40 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>Limpiar Historial</span>
            </button>
          ) : (
            <span className="text-xs text-slate-500 italic">Registros protegidos localmente</span>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
