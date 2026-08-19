import React, { useMemo, useState } from 'react';
import { MaterialSignal, DivisionType } from '../types';
import { groupMaterialsByFamily, durationToSeconds, formatHoursVerbose, secondsToDuration, parseAnyDate } from '../services/apiService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { 
  BarChart3, 
  Film, 
  Clock, 
  Layers, 
  CheckCircle2, 
  Archive, 
  Download, 
  Calendar as CalendarIcon,
  Users,
  Award,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckSquare,
  HardDrive
} from 'lucide-react';

interface DashboardModuleProps {
  materials: MaterialSignal[];
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ materials }) => {
  const [filterDivision, setFilterDivision] = useState<DivisionType | 'Todas'>('Todas');
  
  // Period Selector State: 'daily' | 'monthly' | 'annual' | 'all'
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'annual' | 'all'>('monthly');

  // Selected Month & Year for Calendar view
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(7); // 0-indexed: 7 = August
  const [selectedDayDetail, setSelectedDayDetail] = useState<number | null>(null);

  // Month names in Spanish
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Base filtered materials by division
  const divisionFilteredMaterials = useMemo(() => {
    if (filterDivision === 'Todas') return materials;
    return materials.filter((m) => m.division === filterDivision);
  }, [materials, filterDivision]);

  // Filter materials based on selected Period
  const periodFilteredMaterials = useMemo(() => {
    return divisionFilteredMaterials.filter((m) => {
      if (!m.creationDate) return true;
      const dateObj = parseAnyDate(m.creationDate);
      if (isNaN(dateObj.getTime())) return true;

      const now = new Date();
      if (period === 'daily') {
        return (
          dateObj.getDate() === now.getDate() &&
          dateObj.getMonth() === now.getMonth() &&
          dateObj.getFullYear() === now.getFullYear()
        );
      } else if (period === 'monthly') {
        return (
          dateObj.getMonth() === selectedMonth &&
          dateObj.getFullYear() === selectedYear
        );
      } else if (period === 'annual') {
        return dateObj.getFullYear() === selectedYear;
      }
      return true; // 'all'
    });
  }, [divisionFilteredMaterials, period, selectedMonth, selectedYear]);

  // Ingested Materials in Selected Period
  const ingestedMaterialsInPeriod = useMemo(() => {
    return periodFilteredMaterials.filter((m) => m.isIngested !== false);
  }, [periodFilteredMaterials]);

  // Total Ingested Seconds & Hours in Period
  const totalIngestedSecondsInPeriod = useMemo(() => {
    return ingestedMaterialsInPeriod.reduce((sum, mat) => sum + durationToSeconds(mat.duration), 0);
  }, [ingestedMaterialsInPeriod]);

  // Cataloged Tasks ("Para Archivar") in Period
  const catalogedTasksInPeriod = useMemo(() => {
    return periodFilteredMaterials.filter((m) => m.isCataloged === true);
  }, [periodFilteredMaterials]);

  // Grouped families in period
  const familyGroups = useMemo(() => {
    return groupMaterialsByFamily(periodFilteredMaterials);
  }, [periodFilteredMaterials]);

  // Metric 1: Unique Material Families Count
  const uniqueMaterialCount = familyGroups.length;

  // Metric 2: Individual Signals Count
  const totalSignalsCount = periodFilteredMaterials.length;

  // Division Metrics Data for Bar Chart
  const divisionData = useMemo(() => {
    const divisions: DivisionType[] = ['Prensa', 'Programación', 'Ingesta'];

    return divisions.map((div) => {
      const divMats = periodFilteredMaterials.filter((m) => m.division === div);
      const divFamilies = groupMaterialsByFamily(divMats);
      const divSecs = divMats.reduce((acc, m) => acc + durationToSeconds(m.duration), 0);
      const divHours = +(divSecs / 3600).toFixed(2);

      const catalogedCount = divMats.filter((m) => m.isCataloged).length;
      const finalizedCount = divMats.filter((m) => m.isFinalized).length;

      return {
        name: div,
        'Materiales Únicos': divFamilies.length,
        'Señales Registradas': divMats.length,
        'Para Archivar': catalogedCount,
        'Finalizados': finalizedCount,
        'Horas Totales': divHours,
      };
    });
  }, [periodFilteredMaterials]);

  // Signal Type Hours Breakdown (Limpio vs Insert vs Master)
  const signalTypeHoursData = useMemo(() => {
    const types: ('Limpio' | 'Insert' | 'Master')[] = ['Limpio', 'Insert', 'Master'];

    return types.map((t) => {
      const mats = periodFilteredMaterials.filter((m) => m.signalType === t);
      const secs = mats.reduce((acc, m) => acc + durationToSeconds(m.duration), 0);
      return {
        name: `Señal ${t}`,
        value: +(secs / 3600).toFixed(2),
        totalSeconds: secs,
        count: mats.length,
      };
    });
  }, [periodFilteredMaterials]);

  // User Productivity Breakdown (Tasks Performed & Ingested Hours by User)
  const userTaskStats = useMemo(() => {
    const map = new Map<
      string,
      { 
        name: string; 
        createdCount: number; 
        catalogedTasks: number; 
        finalizedTasks: number; 
        ingestedSeconds: number;
      }
    >();

    periodFilteredMaterials.forEach((m) => {
      const creator = m.createdBy || 'Sistema';
      if (!map.has(creator)) {
        map.set(creator, {
          name: creator,
          createdCount: 0,
          catalogedTasks: 0,
          finalizedTasks: 0,
          ingestedSeconds: 0,
        });
      }
      const item = map.get(creator)!;
      item.createdCount += 1;
      if (m.isIngested !== false) {
        item.ingestedSeconds += durationToSeconds(m.duration);
      }

      // Cataloger user tracking
      const cataloger = m.catalogedBy || m.createdBy || 'Sistema';
      if (!map.has(cataloger)) {
        map.set(cataloger, {
          name: cataloger,
          createdCount: 0,
          catalogedTasks: 0,
          finalizedTasks: 0,
          ingestedSeconds: 0,
        });
      }
      if (m.isCataloged) {
        map.get(cataloger)!.catalogedTasks += 1;
      }

      // Finalizer user tracking
      const finalizer = m.finalizedBy || m.createdBy || 'Sistema';
      if (!map.has(finalizer)) {
        map.set(finalizer, {
          name: finalizer,
          createdCount: 0,
          catalogedTasks: 0,
          finalizedTasks: 0,
          ingestedSeconds: 0,
        });
      }
      if (m.isFinalized) {
        map.get(finalizer)!.finalizedTasks += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.catalogedTasks - a.catalogedTasks);
  }, [periodFilteredMaterials]);

  // CALENDAR COMPUTATION LOGIC (For Monthly View)
  const calendarDaysData = useMemo(() => {
    if (period !== 'monthly') return [];

    // Get number of days in selected month
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    // Get starting day of week (0 = Sun, 1 = Mon, etc.)
    const firstDayOfWeek = new Date(selectedYear, selectedMonth, 1).getDay();

    const days = [];
    
    // Empty padding cells for previous month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ dayNumber: null, seconds: 0, count: 0, materials: [] });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dayMats = divisionFilteredMaterials.filter((m) => {
        if (!m.creationDate) return false;
        const dateObj = parseAnyDate(m.creationDate);
        if (isNaN(dateObj.getTime())) return false;
        return (
          dateObj.getDate() === d &&
          dateObj.getMonth() === selectedMonth &&
          dateObj.getFullYear() === selectedYear
        );
      });

      const daySecs = dayMats.reduce((acc, m) => acc + (m.isIngested !== false ? durationToSeconds(m.duration) : 0), 0);

      days.push({
        dayNumber: d,
        seconds: daySecs,
        count: dayMats.length,
        materials: dayMats,
      });
    }

    return days;
  }, [divisionFilteredMaterials, period, selectedMonth, selectedYear]);

  // Selected Day Materials List
  const selectedDayMaterials = useMemo(() => {
    if (!selectedDayDetail || period !== 'monthly') return [];
    const cell = calendarDaysData.find((c) => c.dayNumber === selectedDayDetail);
    return cell ? cell.materials : [];
  }, [selectedDayDetail, calendarDaysData, period]);

  const COLORS = ['#10b981', '#3b82f6', '#a855f7'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filter Controls */}
      <div className="p-5 bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] border border-slate-700/80 rounded-2xl shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Dashboard y Métricas del Departamento de Archivo
              </h2>
              <p className="text-xs text-slate-400">
                Monitoreo de Horas Ingestadas, Tareas por Usuario y Control Periódico
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector Controls (Requirement: Diario, Mensual, Anual) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Division Filter */}
          <select
            value={filterDivision}
            onChange={(e) => setFilterDivision(e.target.value as any)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500"
          >
            <option value="Todas">Todas las Divisiones</option>
            <option value="Prensa">División 1: Prensa</option>
            <option value="Programación">División 2: Programación</option>
            <option value="Ingesta">División 3: Ingesta</option>
          </select>

          {/* Period Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => { setPeriod('daily'); setSelectedDayDetail(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'daily'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Diario (Hoy)
            </button>
            <button
              onClick={() => { setPeriod('monthly'); setSelectedDayDetail(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'monthly'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => { setPeriod('annual'); setSelectedDayDetail(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'annual'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Anual
            </button>
            <button
              onClick={() => { setPeriod('all'); setSelectedDayDetail(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todo
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row with Gradient Backdrop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Horas Totales Ingestadas (Requirement: Si esta ingestado se suma) */}
        <div className="p-5 bg-gradient-to-br from-[#1E293B] via-[#1E293B]/90 to-[#0F172A] border border-blue-500/30 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              1. Horas Ingestadas ({period === 'daily' ? 'Hoy' : period === 'monthly' ? monthNames[selectedMonth] : period === 'annual' ? selectedYear : 'Total'})
            </span>
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-extrabold text-blue-300 font-mono block">
              {formatHoursVerbose(totalIngestedSecondsInPeriod)}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Suma de material ingestado ({ingestedMaterialsInPeriod.length} señales)
            </span>
          </div>
        </div>

        {/* KPI 2: Tareas Realizadas ("Para Archivar" / Catalogados) */}
        <div className="p-5 bg-gradient-to-br from-[#1E293B] via-[#1E293B]/90 to-[#0F172A] border border-amber-500/30 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              2. Tareas Catalogadas
            </span>
            <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-extrabold text-amber-300 font-mono block">
              {catalogedTasksInPeriod.length}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Materiales marcados "Para Archivar"
            </span>
          </div>
        </div>

        {/* KPI 3: Materiales Únicos (Familias) */}
        <div className="p-5 bg-gradient-to-br from-[#1E293B] via-[#1E293B]/90 to-[#0F172A] border border-slate-700/80 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              3. Materiales Únicos
            </span>
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-extrabold text-white font-mono block">
              {uniqueMaterialCount}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Familias contenedoras registradas
            </span>
          </div>
        </div>

        {/* KPI 4: Materiales Finalizados */}
        <div className="p-5 bg-gradient-to-br from-[#1E293B] via-[#1E293B]/90 to-[#0F172A] border border-emerald-500/30 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              4. Finalizados (Cerrados)
            </span>
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-extrabold text-emerald-300 font-mono block">
              {periodFilteredMaterials.filter((m) => m.isFinalized).length}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              En carpeta histórica aislada
            </span>
          </div>
        </div>
      </div>

      {/* CALENDAR VISUALIZATION (Requirement: Si está seleccionado mensual que se vea un calendario con la cantidad de horas grabadas en cada día) */}
      {period === 'monthly' && (
        <div className="p-5 bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] border border-slate-700/80 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  Calendario de Ingesta Diaria ({monthNames[selectedMonth]} {selectedYear})
                </h3>
                <p className="text-xs text-slate-400">
                  Haz clic en un día para ver el detalle de horas y materiales grabados
                </p>
              </div>
            </div>

            {/* Month & Year Selectors */}
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(Number(e.target.value)); setSelectedDayDetail(null); }}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500"
              >
                {monthNames.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedDayDetail(null); }}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>
            </div>
          </div>

          {/* Calendar Grid Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 uppercase py-1">
            <div>Dom</div>
            <div>Lun</div>
            <div>Mar</div>
            <div>Mié</div>
            <div>Jue</div>
            <div>Vie</div>
            <div>Sáb</div>
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDaysData.map((cell, idx) => {
              if (cell.dayNumber === null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="h-20 rounded-xl bg-slate-950/30 border border-slate-900/50"
                  />
                );
              }

              const hasRecordedHours = cell.seconds > 0;
              const isSelected = selectedDayDetail === cell.dayNumber;

              return (
                <div
                  key={`day-${cell.dayNumber}`}
                  onClick={() => setSelectedDayDetail(isSelected ? null : cell.dayNumber)}
                  className={`h-22 p-2 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-600/30 border-blue-400 ring-2 ring-blue-500/50 shadow-lg'
                      : hasRecordedHours
                      ? 'bg-slate-900/90 hover:bg-slate-800 border-blue-500/40 hover:border-blue-400'
                      : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800/80 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isSelected
                          ? 'text-blue-300'
                          : hasRecordedHours
                          ? 'text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {cell.count > 0 && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {cell.count} seg
                      </span>
                    )}
                  </div>

                  <div>
                    {hasRecordedHours ? (
                      <div className="mt-1">
                        <span className="text-[11px] font-mono font-extrabold text-amber-300 block">
                          ⏱️ {formatHoursVerbose(cell.seconds)}
                        </span>
                        <span className="text-[9px] text-slate-400 block font-semibold">
                          Ingestado
                        </span>
                      </div>
                    ) : (
                      <span className="text-[9px] text-slate-600 italic block mt-2">
                        Sin ingesta
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Day Details Drawer */}
          {selectedDayDetail && (
            <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-blue-500/40 animate-fade-in space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-blue-300 flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  Materiales Grabados el {selectedDayDetail} de {monthNames[selectedMonth]} {selectedYear}:
                </h4>
                <button
                  onClick={() => setSelectedDayDetail(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cerrar Detalle ✕
                </button>
              </div>

              {selectedDayMaterials.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  No hay registros de ingesta guardados para este día.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  {selectedDayMaterials.map((mat, mIdx) => (
                    <div
                      key={`daymat-${mat.id}-${mat.signalType}-${mIdx}`}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-white">{mat.title}</p>
                        <p className="text-[10px] text-slate-400">
                          {mat.id} | {mat.division} | {mat.signalType}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                        {mat.duration}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Operator Tasks Breakdown Table (Requirement: cantidad de tareas realizadas por usuario) */}
      <div className="bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            Tareas Realizadas por Usuario ("Para Archivar" / Catalogación)
          </h3>
          <span className="text-xs text-slate-400">
            Conteo de tareas catalogadas e ingestadas por operador
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">Usuario / Operador</th>
                <th className="p-3 text-center">Tareas Catalogadas ("Para Archivar")</th>
                <th className="p-3 text-center">Materiales Creados</th>
                <th className="p-3 text-center">Tareas Finalizadas</th>
                <th className="p-3 text-right">Tiempo Ingestado Procesa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {userTaskStats.map((user, uIdx) => (
                <tr key={`userstat-${user.name}-${uIdx}`} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-semibold text-white flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-300 border border-blue-500/40 flex items-center justify-center font-bold text-[10px]">
                      {user.name.charAt(0)}
                    </div>
                    <span>{user.name}</span>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-amber-300">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                      {user.catalogedTasks} tareas
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-blue-300">
                    {user.createdCount}
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-emerald-300">
                    {user.finalizedTasks}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-200">
                    {formatHoursVerbose(user.ingestedSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Material Families vs Signals per Division */}
        <div className="lg:col-span-7 bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] border border-slate-700/80 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            Materiales Únicos vs Señales por División
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Comparativa entre cantidad de familias (material único) y total de señales en el periodo
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={divisionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Materiales Únicos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Para Archivar" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Finalizados" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Hours Breakdown by Signal Type */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] border border-slate-700/80 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Horas por Tipo de Señal
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Suma total de horas de señales Limpio, Insert y Master
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={signalTypeHoursData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}h`}
                >
                  {signalTypeHoursData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
