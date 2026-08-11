import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Database, Code, Check, Copy, Link2, Sparkles, X, Download, FileSpreadsheet, RefreshCw, ExternalLink, ShieldCheck, CheckCircle2, CloudDownload, CloudUpload } from 'lucide-react';
import { downloadLocalStorageCsvDump, downloadSpecificTableCSV, getLocalDb, db } from '../supabaseClient';
import { signInWithGoogle, createGoogleSpreadsheet, populateAllSheets, syncLocalDbWithGoogleSheets, FullAppData, auth } from '../googleSheetsService';

export default function DatabaseSchema({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<'google_sheets' | 'csv_export' | 'algorithm'>('google_sheets');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => localStorage.getItem('vtv_google_spreadsheet_url'));
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => localStorage.getItem('vtv_google_spreadsheet_id'));
  const [customInputUrl, setCustomInputUrl] = useState('');
  const [copiedCsv, setCopiedCsv] = useState(false);

  useEffect(() => {
    const url = localStorage.getItem('vtv_google_spreadsheet_url');
    const id = localStorage.getItem('vtv_google_spreadsheet_id');
    if (url) setSpreadsheetUrl(url);
    if (id) setSpreadsheetId(id);
  }, []);

  const collectCurrentAppData = async (): Promise<FullAppData> => {
    const workers = getLocalDb.getWorkers();
    const divisions = getLocalDb.getDivisions();
    const assignments = getLocalDb.getAssignments();
    const requests = getLocalDb.getRequests();
    const freeDayRequests = getLocalDb.getFreeDayRequests();
    const physicalMaterials = getLocalDb.getPhysicalMaterials([]);
    
    // Read task cards and task boards from LocalStorage
    const taskCardsRaw = localStorage.getItem('vtv_task_cards');
    const taskCards = taskCardsRaw ? JSON.parse(taskCardsRaw) : [];

    const taskBoardsRaw = localStorage.getItem('vtv_task_boards');
    const taskBoards = taskBoardsRaw ? JSON.parse(taskBoardsRaw) : [];

    const notificationsRaw = localStorage.getItem('vtv_task_notifications');
    const notifications = notificationsRaw ? JSON.parse(notificationsRaw) : [];

    return {
      workers,
      divisions,
      assignments,
      taskCards,
      taskBoards,
      requests,
      freeDayRequests,
      physicalMaterials,
      notifications
    };
  };

  const handleCreateAndMigrateSheets = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus('Iniciando autenticación Google OAuth...');

      const authRes = await signInWithGoogle();
      if (!authRes?.accessToken) {
        throw new Error('No se pudo verificar el acceso de Google.');
      }

      setSyncStatus('Recopilando registros de la aplicación...');
      const fullData = await collectCurrentAppData();

      setSyncStatus('Creando Hoja de Cálculo en Google Drive con 9 pestañas...');
      const sheetRes = await createGoogleSpreadsheet(authRes.accessToken, fullData);

      setSpreadsheetUrl(sheetRes.spreadsheetUrl);
      setSpreadsheetId(sheetRes.spreadsheetId);
      setSyncStatus('¡Migración exitosa a Google Sheets!');
    } catch (err: any) {
      console.error('Error al crear Google Sheet:', err);
      setSyncStatus(`Error: ${err?.message || 'Fallo la migración a Google Sheets'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncToExistingSheets = async () => {
    if (!spreadsheetId) return;
    try {
      setIsSyncing(true);
      setSyncStatus('Conectando con Google Drive...');
      const authRes = await signInWithGoogle();
      if (!authRes?.accessToken) throw new Error('Acceso a Google requerido.');

      setSyncStatus('Actualizando pestañas en la Hoja de Cálculo de Google...');
      const fullData = await collectCurrentAppData();
      await populateAllSheets(authRes.accessToken, spreadsheetId, fullData);

      setSyncStatus('¡Datos guardados correctamente en Google Sheets!');
    } catch (err: any) {
      console.error('Error al sincronizar con Google Sheets:', err);
      setSyncStatus(`Error: ${err?.message || 'Fallo la actualización'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromSheets = async () => {
    if (!spreadsheetId) return;
    try {
      setIsSyncing(true);
      setSyncStatus('Obteniendo datos de Google Sheets...');
      const authRes = await signInWithGoogle();
      if (!authRes?.accessToken) throw new Error('Acceso a Google requerido.');

      await syncLocalDbWithGoogleSheets(authRes.accessToken, spreadsheetId);
      setSyncStatus('¡Datos cargados correctamente desde Google Sheets a la aplicación!');
    } catch (err: any) {
      console.error('Error al cargar de Google Sheets:', err);
      setSyncStatus(`Error: ${err?.message || 'Fallo la descarga'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLinkCustomSheet = () => {
    if (!customInputUrl.trim()) return;
    let extractedId = customInputUrl.trim();
    if (extractedId.includes('/d/')) {
      const parts = extractedId.split('/d/');
      if (parts[1]) {
        extractedId = parts[1].split('/')[0];
      }
    }
    const cleanUrl = `https://docs.google.com/spreadsheets/d/${extractedId}`;
    localStorage.setItem('vtv_google_spreadsheet_id', extractedId);
    localStorage.setItem('vtv_google_spreadsheet_url', cleanUrl);
    setSpreadsheetId(extractedId);
    setSpreadsheetUrl(cleanUrl);
    setCustomInputUrl('');
    setSyncStatus(`¡Vinculado con éxito a la hoja ID: ${extractedId}!`);
  };


  const algorithmCode = `
/**
 * Algoritmo Oficial de Logística de Comedor - VTV
 * Procesa las raciones diarias cruzando el Turno Actual y el Turno de la Noche Anterior.
 */
export function calcularLogisticaComedor(workers: Worker[], todayAssignments: ShiftAssignment[], yesterdayNightWorkerIds: string[]) {
  // Reglas:
  // Mañana: Desayuno + Almuerzo
  // Tarde: Almuerzo + Cena
  // Noche: Cena
  // Saliente de Noche (Ayer): Desayuno
}
  `;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 glass flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-lg transition-all cursor-pointer"
            title="Cerrar Planos"
          >
            <X size={16} />
          </button>
        )}
        <div className="space-y-1 pr-8">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
            <Database className="text-emerald-400" size={18} />
            Gestión Centralizada - Google Sheets & Google Drive
          </h3>
          <p className="text-xs text-slate-400">
            Base de datos migrada a Google Sheets. Todos tus registros de Personal, Guardias, Tareas y Archivo Físico están vinculados.
          </p>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-slate-900/60 border-emerald-500/30 self-start md:self-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-emerald-400">
            {spreadsheetId ? 'Google Sheets Activo' : 'Base de Datos Lista'}
          </div>
        </div>
      </div>

      {/* Main Banner */}
      <div className="p-5 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-teal-950/80 border border-emerald-500/40 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400 shrink-0">
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              Google Drive / Google Sheets Integration
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Base Centralizada Real Time
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Toda la información del sistema se sincroniza en vivo con tu Hoja de Cálculo de Google Drive.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto shrink-0">
          {spreadsheetId && (
            <>
              <button
                onClick={handlePullFromSheets}
                disabled={isSyncing}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-emerald-500/30 transition-all cursor-pointer"
                title="Cargar y sincronizar datos actualizados desde la Hoja de Google"
              >
                <CloudDownload size={16} className={isSyncing ? 'animate-spin' : ''} />
                <span>Cargar de Google Sheets</span>
              </button>

              <button
                onClick={handleSyncToExistingSheets}
                disabled={isSyncing}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                title="Publicar estado actual a la Hoja de Google"
              >
                <CloudUpload size={16} className={isSyncing ? 'animate-spin' : ''} />
                <span>Guardar en Google Sheets</span>
              </button>
            </>
          )}

          {spreadsheetUrl ? (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer"
            >
              <ExternalLink size={15} />
              <span>Abrir Hoja</span>
            </a>
          ) : (
            <button
              onClick={handleCreateAndMigrateSheets}
              disabled={isSyncing}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Creando...' : 'Crear Nueva Hoja en Google Drive'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Shared Google Sheet Linker input */}
      <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="space-y-1 w-full sm:w-auto">
          <label className="text-xs font-bold text-white flex items-center gap-2">
            <Link2 size={14} className="text-emerald-400" />
            Vincular Hoja Compartida de Google Sheets (ID o URL)
          </label>
          <p className="text-[11px] text-slate-400">
            Ingresa el enlace o ID de la hoja central para que todos los usuarios se conecten a la misma base de datos.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <input
            type="text"
            value={customInputUrl}
            onChange={(e) => setCustomInputUrl(e.target.value)}
            placeholder="Pegar URL o ID de Google Spreadsheet..."
            className="px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-full sm:w-64 font-mono"
          />
          <button
            onClick={handleLinkCustomSheet}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shrink-0 transition-all cursor-pointer"
          >
            Vincular
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="p-3 bg-slate-900/90 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 font-mono">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-900/50 border border-white/10 rounded-xl">
        <button
          onClick={() => setActiveTab('google_sheets')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'google_sheets' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet size={14} />
          <span>Pestañas Google Sheets</span>
        </button>

        <button
          onClick={() => setActiveTab('csv_export')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'csv_export' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Download size={14} />
          <span>Exportación .CSV por Tablas</span>
        </button>

        <button
          onClick={() => setActiveTab('algorithm')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'algorithm' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code size={14} />
          <span>Lógica Comedor VTV</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'google_sheets' && (
          <div className="space-y-4">
            <div className="p-4 glass rounded-2xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <ShieldCheck className="text-emerald-400" size={16} />
                Estructura de la Hoja de Cálculo Migrada
              </h4>
              <p className="text-xs text-slate-400">
                La base de datos se organiza automáticamente en las siguientes pestañas dentro de tu Google Spreadsheet:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {[
                  { title: 'Personal_y_Usuarios', desc: 'IDs, Nombres, Cédula, Email, Cargo, Rol y estado de Clave (12345678).' },
                  { title: 'Divisiones', desc: 'Estructura de departamentos VTV y coordinadores asignados.' },
                  { title: 'Turnos_y_Guardias', desc: 'Historial de turnos Mañana, Tarde, Noche y Libres por fecha.' },
                  { title: 'Tareas_y_Pautas', desc: 'Pautas de trabajo, ingesta, edición, tiempos y estados.' },
                  { title: 'Tableros_de_Trabajo', desc: 'Categorías de producción (Prensa, Programación, Ingesta).' },
                  { title: 'Cambios_de_Guardia', desc: 'Solicitudes y permutas aprobadas entre operadores.' },
                  { title: 'Dias_Libres_Solicitados', desc: 'Días libres continuos y acumulados solicitados.' },
                  { title: 'Archivo_Fisico_Audiovisual', desc: 'Cintas LTO, Betacam, U-matic, códigos y estantes.' },
                  { title: 'Notificaciones', desc: 'Registro de alertas y asignaciones del sistema.' }
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/60 border border-white/5 rounded-xl space-y-1">
                    <span className="text-xs font-mono font-bold text-emerald-400 block">{item.title}</span>
                    <p className="text-[11px] text-slate-400 leading-snug">{item.desc}</p>
                  </div>
                ))}
              </div>

              {spreadsheetId && (
                <div className="pt-3 flex justify-end">
                  <button
                    onClick={handleSyncToExistingSheets}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    <span>Sincronizar Cambios a Google Sheets</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'csv_export' && (
          <div className="p-5 glass rounded-2xl space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Descarga Individual de Tablas (.CSV para Excel / Google Drive)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Usuarios y Personal', key: 'workers' },
                { label: 'Tareas y Pautas', key: 'task_cards' },
                { label: 'Archivo Físico', key: 'physical_materials' },
                { label: 'Guardias Asignadas', key: 'shift_assignments' }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => downloadSpecificTableCSV(t.key)}
                  className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-white/10 rounded-xl text-left space-y-1 transition-all cursor-pointer group"
                >
                  <span className="text-xs font-bold text-white group-hover:text-emerald-400 block transition-colors">
                    {t.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block">Descargar .csv</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'algorithm' && (
          <div className="p-4 glass rounded-2xl space-y-2 font-mono text-xs text-slate-300">
            <pre className="p-3 bg-slate-950 rounded-xl overflow-x-auto text-[11px] leading-relaxed text-cyan-300">
              {algorithmCode}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
