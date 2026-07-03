import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Database, Code, Cpu, Server, Check, Copy, Link2, AlertCircle, Sparkles } from 'lucide-react';
import { isSupabaseConfigured, getSupabaseSQLScript } from '../supabaseClient';

export default function DatabaseSchema() {
  const [activeTab, setActiveTab] = useState<'supabase_sql' | 'env_setup' | 'algorithm'>('supabase_sql');
  const [copiedCode, setCopiedCode] = useState(false);

  const supabaseSQL = getSupabaseSQLScript();

  const algorithmCode = `
/**
 * Algoritmo Oficial de Logística de Comedor - VTV
 * Procesa las raciones diarias cruzando el Turno Actual y el Turno de la Noche Anterior.
 * 
 * Reglas de negocio estrictas:
 * 1. Turno Mañana (Hoy): 1 Desayuno + 1 Almuerzo
 * 2. Turno Tarde (Hoy): 1 Almuerzo + 1 Cena
 * 3. Turno Noche (Hoy): 1 Cena
 * 4. Turno Noche (Ayer / Salientes hoy): 1 Desayuno
 */

interface Worker {
  id: string;
  name: string;
  cargo: string;
  divisionId: string;
}

interface ShiftAssignment {
  workerId: string;
  shiftType: 'pool' | 'manana' | 'tarde' | 'noche' | 'libre';
}

interface MealCount {
  desayunos: number;
  almuerzos: number;
  cenas: number;
}

export function calcularLogisticaComedor(
  workers: Worker[],
  todayAssignments: ShiftAssignment[],
  yesterdayNightWorkerIds: string[] // List of worker IDs who worked last night
): { grandTotal: MealCount; detailedRoster: any[] } {
  
  let desayunosCount = 0;
  let almuerzosCount = 0;
  let cenasCount = 0;
  const detailedRoster: any[] = [];

  workers.forEach(worker => {
    // 1. Get today's shift
    const todayAssign = todayAssignments.find(a => a.workerId === worker.id);
    const currentShift = todayAssign ? todayAssign.shiftType : 'pool';
    
    // 2. Check if worker completed yesterday's night shift
    const workedNightYesterday = yesterdayNightWorkerIds.includes(worker.id);

    const meals = {
      desayuno: false,
      almuerzo: false,
      cena: false
    };

    // Aplicar lógica estricta de negocio
    if (currentShift === 'manana') {
      meals.desayuno = true;
      meals.almuerzo = true;
    }
    if (currentShift === 'tarde') {
      meals.almuerzo = true;
      meals.cena = true;
    }
    if (currentShift === 'noche') {
      meals.cena = true;
    }
    if (workedNightYesterday) {
      meals.desayuno = true;
    }

    // Incrementadores
    if (meals.desayuno) desayunosCount++;
    if (meals.almuerzo) almuerzosCount++;
    if (meals.cena) cenasCount++;

    detailedRoster.push({
      workerId: worker.id,
      name: worker.name,
      currentShift,
      workedNightYesterday,
      meals
    });
  });

  return {
    grandTotal: {
      desayunos: desayunosCount,
      almuerzos: almuerzosCount,
      cenas: cenasCount
    },
    detailedRoster
  };
}
  `;

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="p-5 glass flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
            <Database className="text-cyan-400" size={18} />
            Planos Técnicos y Conexión Supabase
          </h3>
          <p className="text-xs text-slate-400">
            Revisión del esquema SQL DDL para Supabase en la nube y la lógica del algoritmo automatizado del comedor.
          </p>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-slate-900/60 border-white/10 self-start md:self-auto">
          <span className={`w-2.5 h-2.5 rounded-full ${isSupabaseConfigured ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'}`} />
          <div className="text-[10px] font-mono uppercase tracking-wider font-bold">
            {isSupabaseConfigured ? (
              <span className="text-cyan-400">Conectado a Supabase</span>
            ) : (
              <span className="text-amber-400">Local Simulado (Listo para conectar)</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-2 p-1 bg-slate-900/50 border border-white/10 rounded-xl max-w-lg">
        <button
          onClick={() => setActiveTab('supabase_sql')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'supabase_sql' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database size={13} />
          <span>Esquema SQL Supabase</span>
        </button>
        <button
          onClick={() => setActiveTab('env_setup')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'env_setup' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Link2 size={13} />
          <span>Guía de Integración</span>
        </button>
        <button
          onClick={() => setActiveTab('algorithm')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'algorithm' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code size={13} />
          <span>Algoritmo Comedor</span>
        </button>
      </div>

      {/* Tab Content Panels */}
      <div>
        {activeTab === 'supabase_sql' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Este es el script SQL oficial para aprovisionar tu base de datos relacional en <strong>Supabase</strong>. Ejecútalo en el editor SQL para crear las tablas necesarias e inicializar las divisiones de VTV:
              </p>
              <button
                onClick={() => handleCopyCode(supabaseSQL)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs hover:bg-cyan-500/20 transition-all cursor-pointer self-start sm:self-auto"
              >
                {copiedCode ? <Check size={13} className="text-cyan-400" /> : <Copy size={13} />}
                <span>{copiedCode ? '¡Copiado!' : 'Copiar Script SQL'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950/80 border border-white/5 rounded-2xl text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-[450px] leading-relaxed shadow-lg">
              {supabaseSQL}
            </pre>
          </div>
        )}

        {activeTab === 'env_setup' && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Sparkles className="text-cyan-400" size={16} />
                ¿Cómo enlazar tu base de datos de Supabase real?
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Para que la aplicación interactúe directamente con tu nube de Supabase, solo necesitas proporcionar tus variables de entorno en el menú de <strong>Ajustes (Settings)</strong> de AI Studio, o crear un archivo <code>.env</code> con las siguientes claves:
              </p>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-white/5 font-mono text-xs text-cyan-400 space-y-1.5">
                <div>VITE_SUPABASE_URL=tu-url-de-supabase-aqui</div>
                <div>VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-cyan-400 font-mono">Paso 1: Crear Proyecto</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Crea un proyecto gratuito de PostgreSQL en Supabase.com en menos de 1 minuto.
                </p>
              </div>

              <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-cyan-400 font-mono">Paso 2: Correr el SQL</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Copia el script SQL de la pestaña anterior y ejecútalo en la pestaña "SQL Editor" de Supabase para inicializar la base de datos limpia de VTV.
                </p>
              </div>

              <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-cyan-400 font-mono">Paso 3: Colocar Credenciales</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Copia los valores "Project URL" y "API anon key" desde la pestaña Settings {`->`} API en Supabase y colócalos en las variables de entorno. ¡Y listo!
                </p>
              </div>
            </div>

            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-start gap-3">
              <AlertCircle size={18} className="text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="font-bold text-xs text-cyan-300">Conexión Directa a Base de Datos Requerida</h5>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Esta aplicación está configurada para funcionar **exclusivamente con Supabase**. No se almacenan datos locales temporales para garantizar la consistencia en la nube de VTV. Si aún no has enlazado tu base de datos, ve al panel de **Ajustes (Settings)** en AI Studio y define las claves URL y Anon Key.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'algorithm' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Este es el algoritmo oficial de VTV que calcula las porciones del comedor cruzando hoy y ayer, previniendo fugas en el conteo de raciones para el proveedor:
              </p>
              <button
                onClick={() => handleCopyCode(algorithmCode)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs hover:bg-cyan-500/20 transition-all cursor-pointer self-start sm:self-auto"
              >
                {copiedCode ? <Check size={13} className="text-cyan-400" /> : <Copy size={13} />}
                <span>{copiedCode ? '¡Copiado!' : 'Copiar Algoritmo'}</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950/80 border border-white/5 rounded-2xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[450px] leading-relaxed shadow-lg">
              {algorithmCode.trim()}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
