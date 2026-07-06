import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Coffee, Utensils, Moon, RefreshCw, Layers, Check, Users, Calendar } from 'lucide-react';
import { Division, Worker, ShiftAssignment, ShiftType, DivisionComedorDetails } from '../types';

interface ComedorLogisticsProps {
  divisions: Division[];
  workers: Worker[];
  assignments: ShiftAssignment[];
  selectedDateStr: string;
  setSelectedDateStr: (date: string) => void;
  operationalDates: string[];
  onAddOperationalDate: (date: string) => void;
  mealsPreferences: Record<string, { desayuno: boolean; almuerzo: boolean; cena: boolean }>;
  onUpdateMealsPreference: (workerId: string, prefs: { desayuno: boolean; almuerzo: boolean; cena: boolean }) => void;
}

export default function ComedorLogistics({ 
  divisions, 
  workers, 
  assignments,
  selectedDateStr,
  setSelectedDateStr,
  operationalDates,
  onAddOperationalDate,
  mealsPreferences,
  onUpdateMealsPreference
}: ComedorLogisticsProps) {
  // Let the user interactively override yesterday's night shift status for testing the dining logic!
  const [yesterdayNightOverrides, setYesterdayNightOverrides] = useState<Record<string, boolean>>({});

  // Automatically sync overrides based on actual previous day night shift assignments
  useEffect(() => {
    const parts = selectedDateStr.split('-').map(Number);
    if (parts.length !== 3) return;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() - 1);
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dStr = String(date.getDate()).padStart(2, '0');
    const previousDateStr = `${y}-${m}-${dStr}`;

    const previousNightWorkers = new Set(
      assignments
        .filter(a => a.date === previousDateStr && a.shiftType === 'noche')
        .map(a => a.workerId)
    );

    setYesterdayNightOverrides(prev => {
      const next = { ...prev };
      workers.forEach(w => {
        next[w.id] = previousNightWorkers.has(w.id);
      });
      return next;
    });
  }, [workers, assignments, selectedDateStr]);

  const toggleYesterdayNight = (workerId: string) => {
    setYesterdayNightOverrides(prev => ({
      ...prev,
      [workerId]: !prev[workerId]
    }));
  };

  // The actual dining algorithm requested by the user
  const comedorData = useMemo(() => {
    const details: DivisionComedorDetails[] = [];
    let grandDesayuno = 0;
    let grandAlmuerzo = 0;
    let grandCena = 0;

    divisions.forEach(div => {
      let divDesayuno = 0;
      let divAlmuerzo = 0;
      let divCena = 0;
      const divWorkersList: any[] = [];

      const divWorkers = workers.filter(w => w.divisionId === div.id);

      divWorkers.forEach(worker => {
        const workerAssigns = assignments.filter(
          a => a.workerId === worker.id && a.divisionId === div.id && a.date === selectedDateStr
        );
        const currentShifts = workerAssigns.map(a => a.shiftType);
        const wasNightYesterday = yesterdayNightOverrides[worker.id] || false;

        let meals = { desayuno: false, almuerzo: false, cena: false };
        const prefs = mealsPreferences[worker.id] || { desayuno: true, almuerzo: true, cena: true };

        // 1. Empleados en Turno Mañana (Actual): Reciben 1 Desayuno + 1 Almuerzo.
        if (currentShifts.includes('manana')) {
          if (prefs.desayuno) meals.desayuno = true;
          if (prefs.almuerzo) meals.almuerzo = true;
        }

        // 2. Empleados en Turno Tarde (Actual): Reciben 1 Almuerzo + 1 Cena.
        if (currentShifts.includes('tarde')) {
          if (prefs.almuerzo) meals.almuerzo = true;
          if (prefs.cena) meals.cena = true;
        }

        // 3. Empleados en Turno Noche (Actual): Reciben 1 Cena.
        if (currentShifts.includes('noche')) {
          if (prefs.cena) meals.cena = true;
        }

        // 4. Empleados en Turno Noche (Día Anterior / Salientes hoy en la mañana): Reciben 1 Desayuno hoy (incondicional).
        if (wasNightYesterday) {
          meals.desayuno = true;
        }

        // Increment counts if meals are awarded
        if (meals.desayuno) divDesayuno++;
        if (meals.almuerzo) divAlmuerzo++;
        if (meals.cena) divCena++;

        divWorkersList.push({
          id: worker.id,
          name: worker.name,
          cargo: worker.cargo,
          currentShift: currentShifts.length > 0 ? (currentShifts.join(', ') as any) : 'pool',
          previousShift: wasNightYesterday ? 'noche' : 'libre',
          meals
        });
      });

      grandDesayuno += divDesayuno;
      grandAlmuerzo += divAlmuerzo;
      grandCena += divCena;

      details.push({
        divisionName: div.name,
        desayuno: divDesayuno,
        almuerzo: divAlmuerzo,
        cena: divCena,
        workers: divWorkersList
      });
    });

    return {
      grandTotal: { desayuno: grandDesayuno, almuerzo: grandAlmuerzo, cena: grandCena },
      divisionsBreakdown: details
    };
  }, [divisions, workers, assignments, yesterdayNightOverrides, selectedDateStr, mealsPreferences]);

  return (
    <div className="space-y-6">
      {/* Overview Cards & Stats */}

      {/* Introduction Card */}
      <div className="p-5 glass flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Utensils className="text-cyan-400" size={20} />
            Logística de Comedor Automatizada
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            Cálculo inteligente del servicio de comedor diario cruzando los turnos del 
            <strong className="text-cyan-400"> Día Actual</strong> con los salientes del 
            <strong className="text-violet-400"> Turno de la Noche Anterior</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-xl border border-white/10 text-[10px] text-slate-400">
          <Check size={11} className="text-emerald-400" />
          <span>Fórmulas de Negocio Aplicadas</span>
        </div>
      </div>

      {/* Grand Total Cards - Liquid Glass Style */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Desayuno */}
        <div className="relative overflow-hidden p-5 glass border-cyan-500/20 shadow-lg flex items-center justify-between glow-cyan">
          <div className="absolute right-[-10px] top-[-10px] opacity-10">
            <Coffee size={100} className="text-cyan-400" />
          </div>
          <div>
            <span className="text-xs font-semibold text-cyan-400">Desayunos Totales</span>
            <h4 className="text-4xl font-extrabold text-white mt-2 font-sans">
              {comedorData.grandTotal.desayuno}
            </h4>
          </div>
          <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
            <Coffee className="text-cyan-400" size={24} />
          </div>
        </div>

        {/* Almuerzo */}
        <div className="relative overflow-hidden p-5 glass border-pink-500/20 shadow-lg flex items-center justify-between glow-pink">
          <div className="absolute right-[-10px] top-[-10px] opacity-10">
            <Utensils size={100} className="text-pink-400" />
          </div>
          <div>
            <span className="text-xs font-semibold text-pink-400">Almuerzos Totales</span>
            <h4 className="text-4xl font-extrabold text-white mt-2 font-sans">
              {comedorData.grandTotal.almuerzo}
            </h4>
          </div>
          <div className="p-3 bg-pink-500/10 rounded-xl border border-pink-500/20">
            <Utensils className="text-pink-400" size={24} />
          </div>
        </div>

        {/* Cena */}
        <div className="relative overflow-hidden p-5 glass border-purple-500/20 shadow-lg flex items-center justify-between glow-purple">
          <div className="absolute right-[-10px] top-[-10px] opacity-10">
            <Moon size={100} className="text-purple-400" />
          </div>
          <div>
            <span className="text-xs font-semibold text-purple-400">Cenas Totales</span>
            <h4 className="text-4xl font-extrabold text-white mt-2 font-sans">
              {comedorData.grandTotal.cena}
            </h4>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <Moon className="text-purple-400" size={24} />
          </div>
        </div>

        {/* Conteo Total General de Comida */}
        <div className="p-5 glass border-emerald-500/20 shadow-lg flex flex-col justify-center glow-emerald">
          <span className="text-xs font-semibold text-emerald-400">Orden General al Proveedor</span>
          <h4 className="text-2xl font-bold text-white mt-2 font-sans">
            {comedorData.grandTotal.desayuno + comedorData.grandTotal.almuerzo + comedorData.grandTotal.cena} platos
          </h4>
          <p className="text-[10px] text-slate-400 mt-1">
            Total General acumulado para el canal VTV
          </p>
        </div>
      </div>

      {/* Interactive Simulator and Division Breakdown Container */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Cols: Division breakdown and meal rosters */}
        <div className="xl:col-span-2 space-y-6">
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <Layers size={16} className="text-cyan-400" />
            Desglose Detallado de Raciones por División
          </h4>

          {comedorData.divisionsBreakdown.map((div, i) => (
            <div key={i} className="p-4 glass-panel space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="font-bold text-slate-200 text-sm">
                  {div.divisionName}
                </span>
                <div className="flex gap-3 text-xs">
                  <span className="text-sky-300 font-medium">D: {div.desayuno}</span>
                  <span className="text-violet-300 font-medium">A: {div.almuerzo}</span>
                  <span className="text-indigo-300 font-medium">C: {div.cena}</span>
                </div>
              </div>

              {/* Desktop Roster Table of who eats what */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-white/5 font-mono text-[10px]">
                      <th className="pb-2">Trabajador / Cargo</th>
                      <th className="pb-2">Turno Hoy</th>
                      <th className="pb-2">Turno Ayer</th>
                      <th className="pb-2 text-center">Desayuno</th>
                      <th className="pb-2 text-center">Almuerzo</th>
                      <th className="pb-2 text-center">Cena</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {div.workers.map((worker: any, idx: number) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="py-2 pr-2">
                          <div className="font-semibold text-white">{worker.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{worker.cargo}</div>
                        </td>
                        <td className="py-2 pr-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            worker.currentShift === 'manana' ? 'bg-sky-500/10 text-sky-400' :
                            worker.currentShift === 'tarde' ? 'bg-violet-500/10 text-violet-400' :
                            worker.currentShift === 'noche' ? 'bg-indigo-500/10 text-indigo-400' :
                            worker.currentShift === 'libre' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-slate-500/10 text-slate-400'
                          }`}>
                            {worker.currentShift.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          <span className={`text-[10px] font-mono ${worker.previousShift === 'noche' ? 'text-indigo-400 font-semibold' : 'text-slate-500'}`}>
                            {worker.previousShift.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => {
                              const currentPrefs = mealsPreferences[worker.id] || { desayuno: true, almuerzo: true, cena: true };
                              onUpdateMealsPreference(worker.id, {
                                ...currentPrefs,
                                desayuno: !currentPrefs.desayuno
                              });
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-extrabold transition-all border inline-flex items-center gap-1 cursor-pointer ${
                              (mealsPreferences[worker.id] ?? { desayuno: true, almuerzo: true, cena: true }).desayuno
                                ? worker.meals.desayuno
                                  ? 'bg-sky-500/20 text-sky-400 border-sky-500/30 shadow-[0_0_8px_rgba(14,165,233,0.15)]'
                                  : 'bg-slate-800/80 text-sky-400/60 border-slate-700/50 border-dashed'
                                : 'bg-slate-950 text-slate-600 border-white/5'
                            }`}
                            title={
                              (mealsPreferences[worker.id] ?? { desayuno: true, almuerzo: true, cena: true }).desayuno
                                ? worker.meals.desayuno
                                  ? 'Solicitado y Asignado (Trabaja en Turno Mañana / Salió de Noche)'
                                  : 'Solicitado pero No Asignado (No trabaja en turno correspondiente)'
                                : 'No Solicitado'
                            }
                          >
                            <span>D</span>
                            <span className="text-[9px] font-black">
                              {(mealsPreferences[worker.id] ?? { desayuno: true, almuerzo: true, cena: true }).desayuno
                                ? (worker.meals.desayuno ? '✓' : '✗')
                                : '—'}
                            </span>
                          </button>
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => {
                              const currentPrefs = mealsPreferences[worker.id] || { desayuno: true, almuerzo: true, cena: true };
                              onUpdateMealsPreference(worker.id, {
                                ...currentPrefs,
                                almuerzo: !currentPrefs.almuerzo
                              });
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-extrabold transition-all border inline-flex items-center gap-1 cursor-pointer ${
                              (mealsPreferences[worker.id] ?? { desayuno: true, almuerzo: true, cena: true }).almuerzo
                                ? worker.meals.almuerzo
                                  ? 'bg-pink-500/20 text-pink-400 border-pink-500/30 shadow-[0_0_8px_rgba(236,72,153,0.15)]'
                                  : 'bg-slate-800/80 text-pink-400/60 border-slate-700/50 border-dashed'
                                : 'bg-slate-950 text-slate-600 border-white/5'
                            }`}
                            title={
                              (mealsPreferences[worker.id] ?? { desayuno: true, almuerzo: true, cena: true }).almuerzo
                                ? worker.meals.almuerzo
                                  ? 'Solicitado y Asignado (Trabaja en Turno Mañana / Tarde)'
                                  : 'Solicitado pero No Asignado (No trabaja en turno correspondiente)'
                                : 'No Solicitado'
                            }
                          >
                            <span>A</span>
                            <span className="text-[9px] font-black">
                              {(mealsPreferences[worker.id] ?? { desayuno: true, almuerzo: true, cena: true }).almuerzo
                                ? (worker.meals.almuerzo ? '✓' : '✗')
                                : '—'}
                            </span>
                          </button>
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => {
                              const currentPrefs = mealsPreferences[worker.id] || { desayuno: true, almuerzo: true, cena: true };
                              onUpdateMealsPreference(worker.id, {
                                ...currentPrefs,
                                cena: !currentPrefs.cena
                              });
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-extrabold transition-all border inline-flex items-center gap-1 cursor-pointer ${
                              (mealsPreferences[worker.id] ?? { desayuno: true, almuerzo: true, cena: true }).cena
                                ? worker.meals.cena
                                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                                  : 'bg-slate-800/80 text-purple-400/60 border-slate-700/50 border-dashed'
                                : 'bg-slate-950 text-slate-600 border-white/5'
                            }`}
                            title={
                              (mealsPreferences[worker.id] ?? { desayuno: true, almuerzo: true, cena: true }).cena
                                ? worker.meals.cena
                                  ? 'Solicitado y Asignado (Trabaja en Turno Tarde / Noche)'
                                  : 'Solicitado pero No Asignado (No trabaja en turno correspondiente)'
                                : 'No Solicitado'
                            }
                          >
                            <span>C</span>
                            <span className="text-[9px] font-black">
                              {(mealsPreferences[worker.id] ?? { desayuno: true, almuerzo: true, cena: true }).cena
                                ? (worker.meals.cena ? '✓' : '✗')
                                : '—'}
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View Card List */}
              <div className="block md:hidden space-y-3">
                {div.workers.map((worker: any, idx: number) => {
                  const currentPrefs = mealsPreferences[worker.id] || { desayuno: true, almuerzo: true, cena: true };
                  
                  return (
                    <div key={idx} className="p-4 bg-slate-900/40 border border-white/5 rounded-xl space-y-3.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-white text-xs leading-snug">{worker.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 leading-snug">{worker.cargo}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 font-mono">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            Hoy: 
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              worker.currentShift === 'manana' ? 'bg-sky-500/10 text-sky-400' :
                              worker.currentShift === 'tarde' ? 'bg-violet-500/10 text-violet-400' :
                              worker.currentShift === 'noche' ? 'bg-indigo-500/10 text-indigo-400' :
                              worker.currentShift === 'libre' ? 'bg-emerald-500/10 text-emerald-400' :
                              'bg-slate-500/10 text-slate-400'
                            }`}>
                              {worker.currentShift.toUpperCase()}
                            </span>
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            Ayer: 
                            <span className={`text-[10px] font-bold ${worker.previousShift === 'noche' ? 'text-indigo-400' : 'text-slate-500'}`}>
                              {worker.previousShift.toUpperCase()}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Meal selections on mobile - touch friendly */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => {
                            onUpdateMealsPreference(worker.id, {
                              ...currentPrefs,
                              desayuno: !currentPrefs.desayuno
                            });
                          }}
                          className={`py-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            currentPrefs.desayuno
                              ? worker.meals.desayuno
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/30 shadow-[0_0_8px_rgba(14,165,233,0.15)] font-black'
                                : 'bg-slate-800/80 text-sky-300/60 border-slate-700/50 border-dashed'
                              : 'bg-slate-950 text-slate-600 border-white/5'
                          }`}
                        >
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider">Desayuno</span>
                          <span className="text-xs">
                            {currentPrefs.desayuno
                              ? (worker.meals.desayuno ? '✓' : '✗')
                              : '—'}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            onUpdateMealsPreference(worker.id, {
                              ...currentPrefs,
                              almuerzo: !currentPrefs.almuerzo
                            });
                          }}
                          className={`py-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            currentPrefs.almuerzo
                              ? worker.meals.almuerzo
                                ? 'bg-pink-500/20 text-pink-300 border-pink-500/30 shadow-[0_0_8px_rgba(236,72,153,0.15)] font-black'
                                : 'bg-slate-800/80 text-pink-300/60 border-slate-700/50 border-dashed'
                              : 'bg-slate-950 text-slate-600 border-white/5'
                          }`}
                        >
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider">Almuerzo</span>
                          <span className="text-xs">
                            {currentPrefs.almuerzo
                              ? (worker.meals.almuerzo ? '✓' : '✗')
                              : '—'}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            onUpdateMealsPreference(worker.id, {
                              ...currentPrefs,
                              cena: !currentPrefs.cena
                            });
                          }}
                          className={`py-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            currentPrefs.cena
                              ? worker.meals.cena
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)] font-black'
                                : 'bg-slate-800/80 text-purple-300/60 border-slate-700/50 border-dashed'
                              : 'bg-slate-950 text-slate-600 border-white/5'
                          }`}
                        >
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider">Cena</span>
                          <span className="text-xs">
                            {currentPrefs.cena
                              ? (worker.meals.cena ? '✓' : '✗')
                              : '—'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Col: Yesterday's Night Shift Override Panel */}
        <div className="space-y-4">
          <div className="p-4 glass-panel">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <RefreshCw className="text-indigo-400" size={14} />
              Simulador de Guardia Anterior
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
              La lógica de comida requiere verificar si el personal laboró en el 
              <strong> Turno Noche de Ayer (22:00 - 06:00)</strong> para asignarle Desayuno.
              Activa o desactiva la casilla de ayer de cada trabajador para simular la variación en la entrega de comida.
            </p>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {workers.map((worker) => {
                const isOverridden = yesterdayNightOverrides[worker.id] || false;
                const division = divisions.find(d => d.id === worker.divisionId);
                
                return (
                  <div 
                    key={worker.id}
                    onClick={() => toggleYesterdayNight(worker.id)}
                    className={`p-2 bg-white/5 hover:bg-white/10 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                      isOverridden ? 'border-indigo-500/40 bg-indigo-950/10' : 'border-white/5'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">{worker.name}</div>
                      <div className="text-[9px] text-slate-400 font-mono">
                        {division?.name || 'General'} • {worker.cargo}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {isOverridden ? 'Noche ayer' : 'Libre ayer'}
                      </span>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                        isOverridden ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-white/25 bg-slate-900/50'
                      }`}>
                        {isOverridden && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
