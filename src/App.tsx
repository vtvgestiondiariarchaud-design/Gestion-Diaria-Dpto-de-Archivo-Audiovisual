import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckSquare, Calendar, Database, Shield, AlertTriangle, Sparkles, 
  Bell, CheckCircle2, Info, UserCircle, LogOut, Loader2, KeyRound, UserPlus, 
  Plus, Umbrella, RefreshCw, FileSpreadsheet, ExternalLink, Sliders
} from 'lucide-react';

import { Division, Worker, ShiftAssignment, UserRole, TaskBoard, TaskCard, TaskNotification, FreeDayRequest } from './types';
import { db, getLocalDb, DEFAULT_DIVISIONS } from './supabaseClient';
import { pullLatestFromGoogleSheets, pushLatestToGoogleSheets, getCachedAccessToken } from './googleSheetsService';

import TaskManager from './components/TaskManager';
import VacationControl from './components/VacationControl';
import DatabaseSchema from './components/DatabaseSchema';
import AdminPanel from './components/AdminPanel';

interface NotificationToast {
  id: string;
  title: string;
  desc: string;
  type: 'success' | 'info';
}

export default function App() {
  const getTodayDateStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // State Management
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [freeDayRequests, setFreeDayRequests] = useState<FreeDayRequest[]>([]);

  // Task Management States
  const [taskBoards, setTaskBoards] = useState<TaskBoard[]>([]);
  const [taskCards, setTaskCards] = useState<TaskCard[]>([]);
  const [taskNotifications, setTaskNotifications] = useState<TaskNotification[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => localStorage.getItem('vtv_google_spreadsheet_id'));

  // Authentication & User Session
  const [currentSession, setCurrentSession] = useState<{
    userId: string;
    name: string;
    role: UserRole;
    divisionId?: string;
    email: string;
    cargo: string;
  } | null>(() => {
    const saved = localStorage.getItem('vtv_real_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Navigation Tab ('tareas' | 'vacaciones' | 'perfil')
  const [activeTab, setActiveTab] = useState<'tareas' | 'vacaciones' | 'perfil'>('tareas');
  const [showBlueprintModal, setShowBlueprintModal] = useState<boolean>(false);

  // Auth Form States
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCargo, setRegCargo] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regDivisionId, setRegDivisionId] = useState('div_archivo_prensa');
  const [regRole, setRegRole] = useState<UserRole>('worker');
  const [authError, setAuthError] = useState<string | null>(null);

  // Toast Notifications State
  const [notifications, setNotifications] = useState<NotificationToast[]>([]);

  const addNotification = (title: string, desc: string, type: 'success' | 'info' = 'info') => {
    const uniqueId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newNotif: NotificationToast = { id: uniqueId, title, desc, type };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
    }, 4500);
  };

  // Sync data function
  const syncData = async () => {
    setLoading(true);
    try {
      // Pull latest from Google Sheets if configured
      await pullLatestFromGoogleSheets().catch(() => null);

      const [
        fetchedDivisions,
        fetchedWorkers,
        fetchedAssignments,
        fetchedFreeDayRequests,
        fetchedTaskBoards,
        fetchedTaskCards,
        fetchedTaskNotifs
      ] = await Promise.all([
        db.fetchDivisions(),
        db.fetchWorkers(),
        db.fetchAssignments(),
        db.fetchFreeDayRequests(),
        db.fetchTaskBoards(),
        db.fetchTaskCards(),
        db.fetchTaskNotifications()
      ]);

      // Ensure default initial task boards exist if empty
      let finalBoards = fetchedTaskBoards;
      if (finalBoards.length === 0) {
        finalBoards = [
          {
            id: 'board_ingesta',
            name: 'Ingesta',
            description: 'Recepción, digitalización y control de calidad de materiales audiovisuales entrantes.',
            color: 'cyan',
            createdAt: new Date().toISOString()
          },
          {
            id: 'board_prensa',
            name: 'Prensa',
            description: 'Redacción, cobertura periodística y notas informativas de canal VTV.',
            color: 'blue',
            createdAt: new Date().toISOString()
          },
          {
            id: 'board_programacion',
            name: 'Programación',
            description: 'Planificación, escaletas y emisión de la parrilla de programación.',
            color: 'indigo',
            createdAt: new Date().toISOString()
          },
          {
            id: 'board_mantenimiento',
            name: 'Mantenimiento & Equipos Técnicos',
            description: 'Soporte técnico, mantenimiento preventivo y supervisión de infraestructura.',
            color: 'amber',
            createdAt: new Date().toISOString()
          },
          {
            id: 'board_digitalizacion',
            name: 'Digitalización',
            description: 'Migración y resguardo de cintas históricas y acervo audiovisual.',
            color: 'purple',
            createdAt: new Date().toISOString()
          },
          {
            id: 'board_administracion',
            name: 'Administración',
            description: 'Logística, gestión de personal, asignaciones y procesos administrativos.',
            color: 'emerald',
            createdAt: new Date().toISOString()
          }
        ];
        localStorage.setItem('vtv_task_boards', JSON.stringify(finalBoards));
        for (const b of finalBoards) {
          db.createTaskBoard(b);
        }
      }

      setDivisions(fetchedDivisions.length > 0 ? fetchedDivisions : DEFAULT_DIVISIONS);
      setWorkers(fetchedWorkers);
      setAssignments(fetchedAssignments);
      setFreeDayRequests(fetchedFreeDayRequests);
      setTaskBoards(finalBoards);
      setTaskCards(fetchedTaskCards);
      setTaskNotifications(fetchedTaskNotifs);
    } catch (err) {
      console.error('Error al sincronizar datos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncData();
    const interval = setInterval(() => {
      const sheetId = localStorage.getItem('vtv_google_spreadsheet_id');
      setSpreadsheetId(sheetId);
      if (sheetId) {
        pullLatestFromGoogleSheets().catch(() => null);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const sortedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const divA = divisions.find(d => d.id === a.divisionId);
      const divB = divisions.find(d => d.id === b.divisionId);
      const nameA = divA ? divA.name : 'Sin división';
      const nameB = divB ? divB.name : 'Sin división';
      const divCompare = nameA.localeCompare(nameB);
      if (divCompare !== 0) return divCompare;
      return a.name.localeCompare(b.name);
    });
  }, [workers, divisions]);

  // Handle Standard Login
  const handleCredentialsLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const trimmedEmail = loginEmail.trim().toLowerCase();
    const matchedWorker = workers.find(w => w.email.toLowerCase() === trimmedEmail);

    if (matchedWorker) {
      if (matchedWorker.password && matchedWorker.password !== loginPassword) {
        setAuthError('Contraseña incorrecta.');
        return;
      }

      const sessionData = {
        userId: matchedWorker.id,
        name: matchedWorker.name,
        role: matchedWorker.role,
        divisionId: matchedWorker.divisionId,
        email: matchedWorker.email,
        cargo: matchedWorker.cargo
      };

      setCurrentSession(sessionData);
      localStorage.setItem('vtv_real_session', JSON.stringify(sessionData));
      addNotification('Sesión Iniciada', `Hola de nuevo, ${matchedWorker.name}`, 'success');
    } else {
      setAuthError('Correo de usuario no encontrado en el sistema.');
    }
  };

  // Handle Register
  const handleRegisterWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!regName.trim() || !regEmail.trim()) {
      setAuthError('Nombre y correo son campos obligatorios.');
      return;
    }

    const newWorker: Worker = {
      id: `w_${Date.now()}`,
      name: regName.trim(),
      email: regEmail.trim().toLowerCase(),
      cedula: regCedula.trim(),
      cargo: regCargo.trim() || 'Colaborador VTV',
      divisionId: regDivisionId,
      role: regRole,
      password: regPassword.trim() || '12345678',
      fixedShift: 'pool'
    };

    try {
      await db.registerWorker(newWorker);
      setWorkers(prev => [...prev, newWorker]);
      const sessionData = {
        userId: newWorker.id,
        name: newWorker.name,
        role: newWorker.role,
        divisionId: newWorker.divisionId,
        email: newWorker.email,
        cargo: newWorker.cargo
      };
      setCurrentSession(sessionData);
      localStorage.setItem('vtv_real_session', JSON.stringify(sessionData));
      addNotification('Cuenta Creada', `Registro exitoso como ${newWorker.name}`, 'success');
      pushLatestToGoogleSheets().catch(() => null);
    } catch (err) {
      setAuthError('Error al crear la cuenta. Intenta de nuevo.');
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setCurrentSession(null);
    localStorage.removeItem('vtv_real_session');
    addNotification('Sesión Cerrada', 'Has salido del sistema.', 'info');
  };

  // Task Handlers
  const handleSaveCard = async (card: TaskCard) => {
    const existingIdx = taskCards.findIndex(c => c.id === card.id);
    let updated: TaskCard[];
    if (existingIdx >= 0) {
      updated = [...taskCards];
      updated[existingIdx] = card;
    } else {
      updated = [card, ...taskCards];
    }
    setTaskCards(updated);
    localStorage.setItem('vtv_task_cards', JSON.stringify(updated));
    await db.upsertTaskCard(card);
    pushLatestToGoogleSheets().catch(() => null);
  };

  const handleDeleteCard = async (cardId: string) => {
    const updated = taskCards.filter(c => c.id !== cardId);
    setTaskCards(updated);
    localStorage.setItem('vtv_task_cards', JSON.stringify(updated));
    await db.deleteTaskCard(cardId);
    pushLatestToGoogleSheets().catch(() => null);
  };

  const handleAddBoard = async (board: TaskBoard) => {
    const updated = [...taskBoards, board];
    setTaskBoards(updated);
    localStorage.setItem('vtv_task_boards', JSON.stringify(updated));
    await db.createTaskBoard(board);
    pushLatestToGoogleSheets().catch(() => null);
  };

  const handleDeleteBoard = async (boardId: string) => {
    const updated = taskBoards.filter(b => b.id !== boardId);
    setTaskBoards(updated);
    localStorage.setItem('vtv_task_boards', JSON.stringify(updated));
    await db.deleteTaskBoard(boardId);
    pushLatestToGoogleSheets().catch(() => null);
  };

  // Notification Handlers
  const handleMarkNotificationRead = (id: string) => {
    const updated = taskNotifications.map(n => n.id === id ? { ...n, read: true } : n);
    setTaskNotifications(updated);
    localStorage.setItem('vtv_task_notifications', JSON.stringify(updated));
  };

  const handleMarkAllNotificationsRead = (workerId?: string) => {
    const updated = taskNotifications.map(n => {
      if (!workerId || n.workerId === workerId) return { ...n, read: true };
      return n;
    });
    setTaskNotifications(updated);
    localStorage.setItem('vtv_task_notifications', JSON.stringify(updated));
  };

  const handleClearAllNotifications = (workerId?: string) => {
    const updated = workerId ? taskNotifications.filter(n => n.workerId !== workerId) : [];
    setTaskNotifications(updated);
    localStorage.setItem('vtv_task_notifications', JSON.stringify(updated));
  };

  const handleDeleteNotification = (id: string) => {
    const updated = taskNotifications.filter(n => n.id !== id);
    setTaskNotifications(updated);
    localStorage.setItem('vtv_task_notifications', JSON.stringify(updated));
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await pullLatestFromGoogleSheets();
      await pushLatestToGoogleSheets();
      await syncData();
      addNotification('Sincronización Completa', 'Datos actualizados desde Google Sheets.', 'success');
    } catch (err) {
      addNotification('Sincronización Interrumpida', 'Verifica tu conexión a Google Sheets.', 'info');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateWorkers = (updated: Worker[]) => {
    setWorkers(updated);
    localStorage.setItem('vtv_workers', JSON.stringify(updated));
    pushLatestToGoogleSheets().catch(() => null);
  };

  const handleUpdateDivisions = (updated: Division[]) => {
    setDivisions(updated);
    localStorage.setItem('vtv_divisions', JSON.stringify(updated));
    pushLatestToGoogleSheets().catch(() => null);
  };

  const handleUpdateAssignments = (updated: ShiftAssignment[]) => {
    setAssignments(updated);
    localStorage.setItem('vtv_assignments', JSON.stringify(updated));
    pushLatestToGoogleSheets().catch(() => null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950 pb-20 md:pb-8">
      
      {/* If No Session -> Render Auth Page */}
      {!currentSession ? (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-slate-900/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            {/* Header / Logo */}
            <div className="text-center mb-6 space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-1">
                <CheckSquare size={32} />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">VTV - Gestión & Vacaciones</h1>
              <p className="text-xs text-slate-400">Canal Venezolana de Televisión • Sistema Integrado</p>
            </div>

            {/* Tabs for Credentials / Register */}
            <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-2xl border border-white/5 mb-4 text-xs font-bold">
              <button
                onClick={() => { setAuthTab('login'); setAuthError(null); }}
                className={`py-2 rounded-xl transition-all ${authTab === 'login' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                Ingresar
              </button>
              <button
                onClick={() => { setAuthTab('register'); setAuthError(null); }}
                className={`py-2 rounded-xl transition-all ${authTab === 'register' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                Registrarse
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {authTab === 'login' ? (
              <form onSubmit={handleCredentialsLogin} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="usuario@vtv.gob.ve"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer mt-2"
                >
                  Iniciar Sesión
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterWorker} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cédula</label>
                    <input
                      type="text"
                      value={regCedula}
                      onChange={(e) => setRegCedula(e.target.value)}
                      placeholder="V-12345678"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cargo</label>
                    <input
                      type="text"
                      value={regCargo}
                      onChange={(e) => setRegCargo(e.target.value)}
                      placeholder="Productor / Operador"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="correo@vtv.gob.ve"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">División</label>
                  <select
                    value={regDivisionId}
                    onChange={(e) => setRegDivisionId(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    {divisions.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer mt-2"
                >
                  Registrar Cuenta
                </button>
              </form>
            )}
          </motion.div>
        </div>
      ) : (
        /* Authenticated Main App Interface */
        <div className="min-h-screen flex flex-col">
          
          {/* Header Bar */}
          <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-white/10 px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
              
              {/* App Brand */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <CheckSquare size={20} />
                </div>
                <div>
                  <h1 className="text-sm font-black text-white tracking-tight leading-tight">VTV Gestión & Vacaciones</h1>
                  <p className="text-[10px] text-slate-400 font-medium">Google Sheets Database • Tiempo Real</p>
                </div>
              </div>

              {/* Google Sheets Status Badge & Header Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBlueprintModal(true)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    spreadsheetId 
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                  }`}
                  title="Gestionar Base de Datos en Google Sheets"
                >
                  <FileSpreadsheet size={14} />
                  <span className="hidden sm:inline">
                    {spreadsheetId ? '🟢 Google Sheets Conectado' : '🟡 Modo Local (Conectar)'}
                  </span>
                  <span className="sm:hidden">
                    {spreadsheetId ? '🟢 Sheets' : '🟡 Conectar'}
                  </span>
                </button>

                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                  title="Sincronizar ahora con Google Sheets"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin text-cyan-400' : ''} />
                </button>

                {/* User Session Dropdown / Logout */}
                <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                  <div className="hidden sm:block text-right">
                    <span className="text-xs font-bold text-white block">{currentSession.name}</span>
                    <span className="text-[10px] text-cyan-400 uppercase font-semibold block">{currentSession.cargo}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                    title="Cerrar Sesión"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </div>

            </div>

            {/* Desktop Navigation Tabs */}
            <div className="hidden sm:flex items-center justify-center gap-2 mt-3 pt-2 border-t border-white/5">
              <button
                onClick={() => setActiveTab('tareas')}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'tareas'
                    ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <CheckSquare size={16} />
                <span>Gestión de Tareas</span>
              </button>

              <button
                onClick={() => setActiveTab('vacaciones')}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'vacaciones'
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Umbrella size={16} />
                <span>Vacaciones y Días Libres</span>
              </button>

              <button
                onClick={() => setActiveTab('perfil')}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'perfil'
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <UserCircle size={16} />
                <span>Mi Perfil & Personal</span>
              </button>
            </div>
          </header>

          {/* Main View Container */}
          <main className="max-w-7xl w-full mx-auto p-3 sm:p-6 flex-grow">
            {loading ? (
              <div className="min-h-[400px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={36} className="text-cyan-400 animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Sincronizando registros con Google Sheets...</p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeTab === 'tareas' && (
                    <TaskManager
                      boards={taskBoards}
                      cards={taskCards}
                      notifications={taskNotifications}
                      workers={sortedWorkers}
                      divisions={divisions}
                      currentSession={currentSession}
                      onAddBoard={handleAddBoard}
                      onDeleteBoard={handleDeleteBoard}
                      onSaveCard={handleSaveCard}
                      onDeleteCard={handleDeleteCard}
                      onMarkNotificationRead={handleMarkNotificationRead}
                      onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
                      onClearAllNotifications={handleClearAllNotifications}
                      onDeleteNotification={handleDeleteNotification}
                      onAddNotificationToast={addNotification}
                      onManualSync={handleManualSync}
                      isSyncing={isSyncing}
                    />
                  )}

                  {activeTab === 'vacaciones' && (
                    <VacationControl
                      divisions={divisions}
                      workers={sortedWorkers}
                      assignments={assignments}
                      onUpdateWorkers={handleUpdateWorkers}
                      userRole={currentSession.role}
                      userDivisionId={currentSession.divisionId}
                      currentSession={currentSession}
                      freeDayRequests={freeDayRequests}
                      onUpdateFreeDayRequests={(updatedReqs) => {
                        setFreeDayRequests(updatedReqs);
                        getLocalDb.saveFreeDayRequests(updatedReqs);
                        pushLatestToGoogleSheets().catch(() => null);
                      }}
                      onUpdateAssignments={handleUpdateAssignments}
                      onAddNotification={addNotification}
                    />
                  )}

                  {activeTab === 'perfil' && (
                    <div className="space-y-6">
                      {/* Profile Overview Card */}
                      <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-xl font-bold">
                            {currentSession.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-white">{currentSession.name}</h2>
                            <p className="text-xs text-slate-400">{currentSession.email}</p>
                            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              {currentSession.cargo} • Rol: {currentSession.role}
                            </span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-white/10 flex flex-wrap gap-3">
                          <button
                            onClick={() => setShowBlueprintModal(true)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-white/10 flex items-center gap-2 cursor-pointer transition-all"
                          >
                            <FileSpreadsheet size={16} className="text-emerald-400" />
                            <span>Configurar Google Sheets</span>
                          </button>
                        </div>
                      </div>

                      {/* Admin Panel for Superadmin / Gerencia */}
                      {(currentSession.role === 'superadmin' || currentSession.cargo.toLowerCase().includes('gerente')) && (
                        <AdminPanel
                          divisions={divisions}
                          workers={sortedWorkers}
                          onUpdateDivisions={handleUpdateDivisions}
                          onUpdateWorkers={handleUpdateWorkers}
                          onAddNotification={addNotification}
                          onOpenBlueprint={() => setShowBlueprintModal(true)}
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </main>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-white/10 px-3 py-2 flex items-center justify-around text-[10px] font-bold">
            <button
              onClick={() => setActiveTab('tareas')}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === 'tareas' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckSquare size={18} />
              <span>Tareas</span>
            </button>

            <button
              onClick={() => setActiveTab('vacaciones')}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === 'vacaciones' ? 'text-purple-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Umbrella size={18} />
              <span>Vacaciones</span>
            </button>

            <button
              onClick={() => setShowBlueprintModal(true)}
              className="flex flex-col items-center gap-1 text-emerald-400 hover:text-emerald-300"
            >
              <FileSpreadsheet size={18} />
              <span>Sheets</span>
            </button>

            <button
              onClick={() => setActiveTab('perfil')}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === 'perfil' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCircle size={18} />
              <span>Perfil</span>
            </button>
          </nav>

        </div>
      )}

      {/* Blueprint / Google Sheets Modal Overlay */}
      <AnimatePresence>
        {showBlueprintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBlueprintModal(false)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-md cursor-pointer"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-3xl p-4 sm:p-8 shadow-[0_0_50px_rgba(34,211,238,0.15)] space-y-6"
            >
              <DatabaseSchema onClose={() => setShowBlueprintModal(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className="fixed bottom-16 sm:bottom-5 right-3 sm:right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {notifications.map((notif, idx) => (
            <motion.div
              key={notif.id || `toast_${idx}`}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="p-3.5 bg-slate-950/95 border border-cyan-500/20 shadow-xl rounded-2xl flex items-start gap-3 pointer-events-auto backdrop-blur-lg"
            >
              {notif.type === 'success' ? (
                <CheckCircle2 size={18} className="text-cyan-400 shrink-0 mt-0.5" />
              ) : (
                <Info size={18} className="text-violet-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <h5 className="font-bold text-xs text-white leading-tight">{notif.title}</h5>
                <p className="text-[11px] text-slate-300 leading-normal">{notif.desc}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
