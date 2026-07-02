import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { FileText, Copy, Printer, Check, Info, Share2, Calendar } from 'lucide-react';
import { Division, Worker, ShiftAssignment } from '../types';

interface ReportGeneratorProps {
  divisions: Division[];
  workers: Worker[];
  assignments: ShiftAssignment[];
  onAddNotification: (title: string, desc: string, type: 'success' | 'info') => void;
  selectedDateStr: string;
  setSelectedDateStr: (date: string) => void;
  operationalDates: string[];
  onAddOperationalDate: (date: string) => void;
}

export default function ReportGenerator({ 
  divisions, 
  workers, 
  assignments, 
  onAddNotification,
  selectedDateStr,
  setSelectedDateStr,
  operationalDates,
  onAddOperationalDate
}: ReportGeneratorProps) {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('todos');
  const [copied, setCopied] = useState(false);

  // Get current date formatted based on selectedDateStr
  const currentDateInfo = useMemo(() => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const parts = selectedDateStr.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayName = days[date.getDay()];
    
    return {
      dayName,
      formattedDate: `${parts[2]} de ${months[date.getMonth()]} de ${parts[0]}`,
      raw: selectedDateStr
    };
  }, [selectedDateStr]);

  const selectedDivision = useMemo(() => {
    return divisions.find(d => d.id === selectedDivisionId);
  }, [divisions, selectedDivisionId]);

  // Generate the formatted report text matching the strict specifications
  const reportText = useMemo(() => {
    if (selectedDivisionId === 'todos') {
      let fullReport = `REPORTE CONSOLIDADO DE GUARDIA - VTV\n`;
      fullReport += `Día: ${currentDateInfo.dayName} ${currentDateInfo.formattedDate}\n`;
      fullReport += `========================================\n\n`;

      const getWorkerNames = (shiftType: 'manana' | 'tarde' | 'noche') => {
        const shiftAssignments = assignments.filter(a => a.date === selectedDateStr && a.shiftType === shiftType);
        return workers
          .filter(w => shiftAssignments.some(assign => assign.workerId === w.id))
          .map(w => `- ${w.name}${w.cedula ? ` - C.I: ${w.cedula}` : ''}`);
      };

      const mananaList = getWorkerNames('manana');
      const tardeList = getWorkerNames('tarde');
      const nocheList = getWorkerNames('noche');

      // Automatic coordinator detection across all divisions
      const assignedCoordinators = workers.filter(w => {
        const isCoord = w.role === 'coordinator' || w.role === 'superadmin' || w.role === 'deputy';
        const hasAssignment = assignments.some(assign => assign.workerId === w.id && assign.date === selectedDateStr && assign.shiftType !== 'pool' && assign.shiftType !== 'libre');
        return isCoord && hasAssignment;
      });

      const coordinatorName = assignedCoordinators.length > 0 
        ? assignedCoordinators.map(c => c.name).join(', ') 
        : 'No asignado';

      fullReport += `Turno Mañana:\n`;
      fullReport += `${mananaList.length > 0 ? mananaList.join('\n') : '(Ninguno asignado)'}\n\n`;
      fullReport += `Turno Tarde:\n`;
      fullReport += `${tardeList.length > 0 ? tardeList.join('\n') : '(Ninguno asignado)'}\n\n`;
      fullReport += `Turno Noche:\n`;
      fullReport += `${nocheList.length > 0 ? nocheList.join('\n') : '(Ninguno asignado)'}\n\n`;
      fullReport += `Encargado/Coordinador de Guardia: ${coordinatorName}\n`;

      return fullReport;
    }

    if (!selectedDivision) return '';

    // Filter workers and assignments
    const divWorkers = workers.filter(w => w.divisionId === selectedDivision.id);
    const divAssignments = assignments.filter(a => a.divisionId === selectedDivision.id && a.date === selectedDateStr);

    const getWorkerNames = (shiftType: 'manana' | 'tarde' | 'noche') => {
      return divWorkers
        .filter(w => {
          return divAssignments.some(assign => assign.workerId === w.id && assign.shiftType === shiftType);
        })
        .map(w => {
          const isCoord = w.role === 'coordinator' || w.role === 'superadmin' || w.role === 'deputy';
          const suffix = isCoord ? ' (Encargado)' : '';
          return `- ${w.name}${w.cedula ? ` - C.I: ${w.cedula}` : ''} (${w.cargo})${suffix}`;
        });
    };

    const mananaList = getWorkerNames('manana');
    const tardeList = getWorkerNames('tarde');
    const nocheList = getWorkerNames('noche');

    // Automatic coordinator detection
    const assignedCoordinators = divWorkers.filter(w => {
      const isCoord = w.role === 'coordinator' || w.role === 'superadmin' || w.role === 'deputy';
      const hasAssignment = divAssignments.some(assign => assign.workerId === w.id && assign.shiftType !== 'pool' && assign.shiftType !== 'libre');
      return isCoord && hasAssignment;
    });

    const coordinatorName = assignedCoordinators.length > 0 
      ? assignedCoordinators.map(c => c.name).join(', ') 
      : (selectedDivision.coordinatorName || 'No asignado');

    return `Grupo de ${selectedDivision.name} para el ${currentDateInfo.dayName} ${currentDateInfo.formattedDate}

Turno Mañana:
${mananaList.length > 0 ? mananaList.join('\n') : '(Ninguno asignado)'}

Turno Tarde:
${tardeList.length > 0 ? tardeList.join('\n') : '(Ninguno asignado)'}

Turno Noche:
${nocheList.length > 0 ? nocheList.join('\n') : '(Ninguno asignado)'}

Encargado/Coordinador de Guardia: ${coordinatorName}`;
  }, [selectedDivisionId, selectedDivision, divisions, workers, assignments, currentDateInfo, selectedDateStr]);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    onAddNotification('Copiado', 'El reporte fue copiado al portapapeles en formato estricto.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte de Guardia - VTV</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 40px; color: #111; line-height: 1.6; }
            pre { white-space: pre-wrap; font-size: 14px; border-left: 3px solid #000; padding-left: 15px; }
            .header { text-align: center; border-bottom: 2px double #111; padding-bottom: 10px; margin-bottom: 30px; }
            .footer { border-top: 1px solid #ccc; margin-top: 50px; padding-top: 10px; font-size: 12px; text-align: center; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>VENEZOLANA DE TELEVISIÓN - VTV</h2>
            <h3>REPORTE DE ASISTENCIA Y OPERACIONES DE GUARDIA</h3>
          </div>
          <pre>${reportText}</pre>
          <div class="footer">
            Generado automáticamente por el Sistema de Guardia VTV - ${new Date().toLocaleString()}
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Multi-day Operational Checklist */}
      <div className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar size={16} className="text-cyan-400" />
              <span>Lista de Verificación de Días de Guardia (Reportes)</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Selecciona el día para compilar y generar el reporte oficial de guardia.
            </p>
          </div>
          
          {/* Create new operational date */}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              id="new-guard-date-reportes"
              className="bg-slate-900/60 border border-white/10 hover:border-white/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all font-mono"
            />
            <button
              onClick={() => {
                const el = document.getElementById('new-guard-date-reportes') as HTMLInputElement;
                if (el && el.value) {
                  onAddOperationalDate(el.value);
                  el.value = '';
                }
              }}
              className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Habilitar Día</span>
            </button>
          </div>
        </div>

        {/* Checklist of Dates */}
        <div className="flex flex-wrap gap-2 pt-1">
          {operationalDates.map((dateVal) => {
            const isSelected = selectedDateStr === dateVal;
            const parts = dateVal.split('-').map(Number);
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const dayName = dayNamesShort[d.getDay()];
            const formatted = `${dayName} ${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}`;

            return (
              <button
                key={dateVal}
                onClick={() => setSelectedDateStr(dateVal)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)] font-bold'
                    : 'bg-slate-900/40 text-slate-400 border-white/5 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                  isSelected ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-white/20'
                }`}>
                  {isSelected && <Check size={10} strokeWidth={4} />}
                </div>
                <span className="font-mono">{formatted}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Intro */}
      <div className="p-4 glass">
        <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
          <FileText className="text-cyan-400" size={18} />
          Generador Automatizado de Reportes de Asistencia
        </h3>
        <p className="text-xs text-slate-400">
          Obtén al instante un formato estricto y limpio listo para ser compartido por correo, memorando impreso o mensajería instantánea.
        </p>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selection Sidebar */}
        <div className="space-y-4">
          <div className="p-4 glass-panel">
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Seleccionar División:
            </label>
            <select
              value={selectedDivisionId}
              onChange={(e) => setSelectedDivisionId(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all mb-4"
            >
              <option value="todos">-- Todas las Divisiones --</option>
              {divisions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Quick Helper card */}
            <div className="p-3.5 bg-cyan-950/10 border border-cyan-500/10 rounded-xl flex items-start gap-2.5">
              <Info className="text-cyan-400 shrink-0 mt-0.5" size={14} />
              <div className="text-[11px] text-slate-300 leading-relaxed">
                Este reporte organiza en tiempo real a los trabajadores asignados a los turnos 
                <strong> Mañana, Tarde y Noche</strong>, omitiendo a quienes tienen libre o están en el pool.
              </div>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 glass-panel flex items-center justify-between">
            <span className="text-xs font-semibold text-white">Vista Previa del Reporte Oficial</span>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-slate-200 font-medium transition-all cursor-pointer"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? 'Copiado' : 'Copiar Texto'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-xs text-cyan-300 font-semibold transition-all cursor-pointer"
              >
                <Printer size={13} />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          </div>

          {/* Telex Style Paper View */}
          <div className="relative overflow-hidden bg-white text-slate-950 p-6 md:p-8 rounded-2xl shadow-2xl border border-black/5 min-h-[400px]">
            {/* Stamp / Decorative header */}
            <div className="border-b border-black/10 pb-4 mb-6 flex justify-between items-start">
              <div>
                <h4 className="font-extrabold text-sm tracking-wider font-mono text-black">
                  VENEZOLANA DE TELEVISIÓN (VTV)
                </h4>
                <p className="text-[10px] text-slate-500 font-mono uppercase">
                  Área de Transmisión y Archivo • Reporte de Guardia
                </p>
              </div>
              <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 border rounded uppercase font-bold text-slate-700">
                Oficial
              </span>
            </div>

            {/* Simulated Paper Texture */}
            <div className="font-mono text-xs md:text-sm whitespace-pre-wrap leading-relaxed text-slate-900">
              {reportText}
            </div>

            {/* Bottom stamp watermark */}
            <div className="mt-12 pt-4 border-t border-dashed border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-mono">
              <span>SISTEMA DE ASISTENCIA VTV v2.0</span>
              <span>ESTATUS: SINCRO EN LA NUBE OK</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
