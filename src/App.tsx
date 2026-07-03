import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, Layers, Utensils, FileText, Calendar, 
  Database, Shield, AlertTriangle, Sparkles, 
  Bell, CheckCircle2, Info, ChevronDown, UserCircle, LogOut, Loader2, KeyRound, UserPlus, Edit2, Check, X
} from 'lucide-react';

import { Division, Worker, ShiftAssignment, ShiftChangeRequest, UserRole } from './types';
import { db, DEFAULT_DIVISIONS, isSupabaseConfigured, supabaseConnectionStatus, lastSupabaseError } from './supabaseClient';

import TrelloBoard from './components/TrelloBoard';
import ComedorLogistics from './components/ComedorLogistics';
import ReportGenerator from './components/ReportGenerator';
import DatabaseSchema from './components/DatabaseSchema';
import AdminPanel from './components/AdminPanel';
import ShiftChanges from './components/ShiftChanges';

interface NotificationToast {
  id: string;
  title: string;
  desc: string;
  type: 'success' | 'info';
}

export default function App() {
  // Operational Days list with default initial values and local storage persistence
  const [operationalDates, setOperationalDates] = useState<string[]>(() => {
    const saved = localStorage.getItem('vtv_operational_dates');
    return saved ? JSON.parse(saved) : ['2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'];
  });
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-07-02');

  const handleAddOperationalDate = (newDateStr: string) => {
    if (!newDateStr) return;
    const matched = newDateStr.match(/^\d{4}-\d{2}-\d{2}$/);
    if (!matched) {
      addNotification('Formato Inválido', 'Por favor usa el formato AAAA-MM-DD.', 'info');
      return;
    }
    if (operationalDates.includes(newDateStr)) {
      addNotification('Día Existente', `El día ${newDateStr} ya está registrado.`, 'info');
      setSelectedDateStr(newDateStr);
      return;
    }
    const updated = [...operationalDates, newDateStr].sort();
    setOperationalDates(updated);
    localStorage.setItem('vtv_operational_dates', JSON.stringify(updated));
    setSelectedDateStr(newDateStr);
    addNotification('Día Habilitado', `Se habilitaron los tableros y raciones para el día ${newDateStr}.`, 'success');
  };

  const formattedSelectedDate = useMemo(() => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return `${days[date.getDay()]}, ${String(day).padStart(2, '0')} de ${months[date.getMonth()]} ${year}`;
  }, [selectedDateStr]);

  // Core Sync States
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [requests, setRequests] = useState<ShiftChangeRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'not_configured'>(
    isSupabaseConfigured ? 'connected' : 'not_configured'
  );
  const [dbError, setDbError] = useState<string | null>(null);

  // Authentication & Session
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

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<'tablero' | 'comedor' | 'reportes' | 'solicitudes' | 'admin' | 'blueprint'>('tablero');

  // Currently Selected Division in Trello Board view
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('todos');

  // Auth form states
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

  // Username change editing state
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newCedula, setNewCedula] = useState('');

  // Individual food preference states derived dynamically from workers' profiles
  const mealsPreferences = useMemo(() => {
    const prefs: Record<string, { desayuno: boolean; almuerzo: boolean; cena: boolean }> = {};
    
    // 1. Load preferences stored on each worker in the DB
    workers.forEach(w => {
      if (w.mealsPreference) {
        prefs[w.id] = w.mealsPreference;
      }
    });

    // 2. Overlay / merge local storage as fallback for instant reactivity
    try {
      const saved = localStorage.getItem('vtv_meals_preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(id => {
          if (!prefs[id]) {
            prefs[id] = parsed[id];
          }
        });
      }
    } catch (e) {
      console.error('Error parsing local meals preferences:', e);
    }

    return prefs;
  }, [workers]);

  const handleUpdateMealsPreference = async (workerId: string, prefs: { desayuno: boolean; almuerzo: boolean; cena: boolean }) => {
    // Save to local storage for local persistence & fast feedback
    try {
      const saved = localStorage.getItem('vtv_meals_preferences');
      const parsed = saved ? JSON.parse(saved) : {};
      parsed[workerId] = prefs;
      localStorage.setItem('vtv_meals_preferences', JSON.stringify(parsed));
    } catch (e) {
      console.error(e);
    }

    // Instantly update workers state so the UI updates without a network round-trip delay
    const updatedWorkers = workers.map(w => {
      if (w.id === workerId) {
        return { ...w, mealsPreference: prefs };
      }
      return w;
    });
    setWorkers(updatedWorkers);

    // Save to the database (Supabase or localDB fallback)
    const targetWorker = updatedWorkers.find(w => w.id === workerId);
    if (targetWorker) {
      try {
        await db.updateWorker(targetWorker);
      } catch (err) {
        console.error('Error persisting meal preference updates to database:', err);
      }
    }
  };

  // Toast Notification State
  const [notifications, setNotifications] = useState<NotificationToast[]>([]);

  // Push notifications helper
  const addNotification = (title: string, desc: string, type: 'success' | 'info' = 'info') => {
    const newNotif: NotificationToast = {
      id: `notif_${Date.now()}`,
      title,
      desc,
      type
    };
    setNotifications(prev => [newNotif, ...prev]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
    }, 4500);
  };

  // Sync data function
  const syncData = async () => {
    setLoading(true);
    try {
      const fetchedDivisions = await db.fetchDivisions();
      const fetchedWorkers = await db.fetchWorkers();
      const fetchedAssignments = await db.fetchAssignments();
      const fetchedRequests = await db.fetchRequests();

      setDivisions(fetchedDivisions.length > 0 ? fetchedDivisions : DEFAULT_DIVISIONS);
      setWorkers(fetchedWorkers);
      setAssignments(fetchedAssignments);
      setRequests(fetchedRequests);

      setDbStatus(supabaseConnectionStatus);
      setDbError(lastSupabaseError);
    } catch (e: any) {
      console.error('Error synchronizing database data:', e);
      addNotification('Error de Conexión', 'No se pudo sincronizar con la base de datos.', 'info');
      setDbStatus('error');
      setDbError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    syncData();
  }, []);

  // Update selected division ID when session changes
  useEffect(() => {
    if (currentSession && currentSession.role === 'coordinator' && currentSession.divisionId) {
      setSelectedDivisionId(currentSession.divisionId);
    }
  }, [currentSession]);

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailStr = loginEmail.trim().toLowerCase();
    if (!emailStr) return;

    setLoading(true);
    try {
      // Fetch latest workers list
      const latestWorkers = await db.fetchWorkers();
      let workerFound = latestWorkers.find(w => w.email.toLowerCase() === emailStr);

      const isSuperEmail = emailStr === 'vtvgestiondiariarchaud@gmail.com';

      // Verify passwords
      if (isSuperEmail) {
        if (loginPassword !== 'Moonshade.1') {
          addNotification('Contraseña Incorrecta', 'La contraseña para el superusuario es inválida.', 'info');
          setLoading(false);
          return;
        }
      } else if (workerFound) {
        if (workerFound.password && workerFound.password !== loginPassword) {
          addNotification('Contraseña Incorrecta', 'La contraseña ingresada es incorrecta.', 'info');
          setLoading(false);
          return;
        }
      }

      // Auto-register SuperAdmin if they don't exist yet
      if (!workerFound && isSuperEmail) {
        const superAdmin: Worker = {
          id: 'sa_vtv_1',
          name: 'Fredd Rojas - Gerente',
          email: emailStr,
          cargo: 'Gerente del Dpto de Archivo Audiovisual',
          divisionId: 'div_archivo_prensa',
          role: 'superadmin',
          password: 'Moonshade.1'
        };
        await db.registerWorker(superAdmin);
        workerFound = superAdmin;
        await syncData();
      } else if (workerFound && isSuperEmail && (workerFound.name !== 'Fredd Rojas - Gerente' || workerFound.cargo !== 'Gerente del Dpto de Archivo Audiovisual')) {
        // Automatically enforce correct details on login
        workerFound.name = 'Fredd Rojas - Gerente';
        workerFound.cargo = 'Gerente del Dpto de Archivo Audiovisual';
        workerFound.divisionId = 'div_archivo_prensa';
        workerFound.password = 'Moonshade.1';
        await db.registerWorker(workerFound);
        await syncData();
      }

      if (workerFound) {
        const session = {
          userId: workerFound.id,
          name: workerFound.name,
          role: workerFound.role,
          divisionId: workerFound.divisionId,
          email: workerFound.email,
          cargo: workerFound.cargo
        };
        setCurrentSession(session);
        localStorage.setItem('vtv_real_session', JSON.stringify(session));
        addNotification('Sesión Iniciada', `Bienvenido(a) de vuelta, ${workerFound.name}.`, 'success');
        
        // Reset login password
        setLoginPassword('');
      } else {
        addNotification('Acceso Denegado', 'El correo no está registrado como personal de VTV. Regístrate primero.', 'info');
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Fallo al iniciar sesión.', 'info');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameStr = regName.trim();
    const emailStr = regEmail.trim().toLowerCase();
    const cargoStr = regCargo.trim();
    const cedulaStr = regCedula.trim();
    const passStr = regPassword;

    if (!nameStr || !emailStr || !cargoStr || !cedulaStr || !passStr) {
      addNotification('Campos vacíos', 'Por favor, llena todos los campos, incluyendo la contraseña y Cédula.', 'info');
      return;
    }

    setLoading(true);
    try {
      const isSuperEmail = emailStr === 'vtvgestiondiariarchaud@gmail.com';
      const selectedRole: UserRole = isSuperEmail ? 'superadmin' : regRole;

      const newWorker: Worker = {
        id: isSuperEmail ? 'sa_vtv_1' : `work_${Date.now()}`,
        name: isSuperEmail ? 'Fredd Rojas - Gerente' : nameStr,
        email: emailStr,
        cargo: isSuperEmail ? 'Gerente del Dpto de Archivo Audiovisual' : cargoStr,
        divisionId: isSuperEmail ? 'div_archivo_prensa' : regDivisionId,
        role: selectedRole,
        cedula: isSuperEmail ? 'V-12345678' : cedulaStr,
        password: isSuperEmail ? 'Moonshade.1' : passStr
      };

      await db.registerWorker(newWorker);
      addNotification('Registro Exitoso', `Cuenta creada como ${selectedRole === 'superadmin' ? 'Gerente del Dpto de Archivo Audiovisual' : cargoStr}.`, 'success');

      // If registered worker is coordinator, update division coordinator record automatically
      if (selectedRole === 'coordinator') {
        await db.updateDivisionCoordinator(regDivisionId, newWorker.id, nameStr);
      }

      await syncData();

      // Log in
      const session = {
        userId: newWorker.id,
        name: newWorker.name,
        role: newWorker.role,
        divisionId: newWorker.divisionId,
        email: newWorker.email,
        cargo: newWorker.cargo
      };
      setCurrentSession(session);
      localStorage.setItem('vtv_real_session', JSON.stringify(session));

      // Reset fields
      setRegName('');
      setRegEmail('');
      setRegCargo('');
      setRegCedula('');
      setRegPassword('');
    } catch (err) {
      console.error(err);
      addNotification('Error', 'No se pudo realizar el registro.', 'info');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    const cleanName = newUsername.trim();
    const cleanCedula = newCedula.trim();
    if (!cleanName) {
      addNotification('Nombre vacío', 'Por favor ingresa un nombre válido.', 'info');
      return;
    }

    setLoading(true);
    try {
      const latestWorkers = await db.fetchWorkers();
      const currentWorker = latestWorkers.find(w => w.id === currentSession.userId);
      if (currentWorker) {
        currentWorker.name = cleanName;
        currentWorker.cedula = cleanCedula;
        
        // Also update coordinatorName if they are coordinator of some division
        const updatedDivisions = divisions.map(d => {
          if (d.coordinatorId === currentWorker.id) {
            return { ...d, coordinatorName: cleanName };
          }
          return d;
        });

        await db.updateWorker(currentWorker);
        
        for (const d of updatedDivisions) {
          if (d.coordinatorId === currentWorker.id) {
            await db.updateDivision(d);
          }
        }

        // Update active session
        const updatedSession = { ...currentSession, name: cleanName };
        setCurrentSession(updatedSession);
        localStorage.setItem('vtv_real_session', JSON.stringify(updatedSession));
        
        addNotification('Perfil Actualizado', 'Tu nombre y cédula han sido modificados con éxito.', 'success');
        setIsEditingUsername(false);
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'No se pudo actualizar el perfil.', 'info');
    } finally {
      setLoading(false);
      await syncData();
    }
  };

  const handleLogout = () => {
    setCurrentSession(null);
    localStorage.removeItem('vtv_real_session');
    addNotification('Sesión Finalizada', 'Has cerrado tu sesión de forma segura.', 'info');
  };

  // Sync wrappers to pass to child components
  const handleUpdateAssignments = async (updated: ShiftAssignment[], divisionId?: string, date?: string) => {
    setAssignments(updated);
    try {
      if (divisionId && date) {
        // Clear existing assignments for this division and date to avoid duplicates / stale items
        await db.deleteAssignmentsForDivisionAndDate(divisionId, date);
      }
      for (const asg of updated) {
        await db.upsertAssignment(asg);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateRequests = async (updated: ShiftChangeRequest[]) => {
    setRequests(updated);
    try {
      for (const req of updated) {
        const exists = requests.find(r => r.id === req.id);
        if (!exists) {
          await db.createRequest(req);
        } else if (exists.status !== req.status) {
          await db.updateRequestStatus(req.id, req.status);
        }
      }
    } catch (e) {
      console.error(e);
    }
    await syncData();
  };

  const handleUpdateWorkers = async (updated: Worker[]) => {
    setWorkers(updated);
    try {
      for (const w of updated) {
        const old = workers.find(o => o.id === w.id);
        if (old) {
          if (old.role !== w.role || old.divisionId !== w.divisionId || old.name !== w.name) {
            await db.updateWorker(w);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    await syncData();
  };

  const handleUpdateDivisions = async (updated: Division[]) => {
    setDivisions(updated);
    try {
      for (const d of updated) {
        const exists = divisions.find(div => div.id === d.id);
        if (!exists) {
          await db.createDivision(d);
        } else if (exists.coordinatorId !== d.coordinatorId || exists.name !== d.name || exists.description !== d.description) {
          await db.updateDivision(d);
        }
      }
      for (const d of divisions) {
        const exists = updated.find(div => div.id === d.id);
        if (!exists) {
          await db.deleteDivision(d.id);
        }
      }
    } catch (e: any) {
      console.error(e);
      addNotification(
        'Error de Base de Datos',
        e?.message || 'No se pudo actualizar la estructura de divisiones en Supabase.',
        'info'
      );
    }
    await syncData();
  };

  return (
    <div className="min-h-screen text-slate-100 font-sans relative overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-300">
      
      {/* Frosted Glass Liquid background */}
      <div className="liquid-bg" />

      {/* NO SESSION LOGGED IN - RENDER AUTHENTICATION PLATFORM */}
      {!currentSession ? (
        <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md p-6 glass border-white/15 rounded-3xl shadow-2xl relative overflow-hidden space-y-6"
          >
            {/* Header VTV */}
            <div className="text-center space-y-3">
              <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-600 items-center justify-center shadow-lg shadow-cyan-500/20">
                <Tv className="text-white animate-pulse" size={28} strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-white tracking-tight">VTV GUARDIA</h1>
                <p className="text-xs text-slate-400">Sistema Automatizado de Control de Guardia y Raciones de Comedor</p>
              </div>
            </div>

            {/* Cloud Status */}
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-slate-900/60 rounded-xl border border-white/5 font-mono text-[10px] uppercase font-bold text-center w-full">
                <span className={`w-2 h-2 rounded-full ${
                  dbStatus === 'connected' ? 'bg-cyan-400 animate-pulse' :
                  dbStatus === 'error' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'
                }`} />
                {dbStatus === 'connected' ? (
                  <span className="text-cyan-400">Canal Seguro Supabase Cloud Activo</span>
                ) : dbStatus === 'error' ? (
                  <span className="text-amber-400">Error de Conexión (Supabase con Error o Tablas faltantes)</span>
                ) : (
                  <span className="text-slate-400">Supabase Desconectado / Sin Configurar</span>
                )}
              </div>
              
              {dbStatus === 'error' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-[11px] text-slate-300 w-full text-center leading-normal">
                  <span className="text-amber-400 font-bold block mb-1">⚠️ Error en la Base de Datos Supabase</span>
                  Ocurrió un error al cargar o guardar los datos. Asegúrate de haber creado las tablas de la base de datos ejecutando el script SQL actualizado y desactivado RLS.
                  <div className="mt-2 text-[10px] text-cyan-300 font-mono">
                    Para solucionarlo de inmediato: copia y ejecuta el script SQL actualizado en el SQL Editor de tu Supabase.
                  </div>
                </div>
              )}
            </div>

            {/* Tabs Selector */}
            <div className="flex gap-2 p-1 bg-slate-950/80 border border-white/5 rounded-xl">
              <button
                onClick={() => setAuthTab('login')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  authTab === 'login' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound size={13} />
                <span>Iniciar Sesión</span>
              </button>
              <button
                onClick={() => setAuthTab('register')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  authTab === 'register' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus size={13} />
                <span>Registrar Personal</span>
              </button>
            </div>

            {/* Form */}
            {authTab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Correo Electrónico:</label>
                  <input
                    type="email"
                    required
                    placeholder="ej: nombre.apellido@vtv.gob.ve"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-500 leading-normal">
                    * Si eres el Gerente del Dpto de Archivo Audiovisual, ingresa tu correo <strong>vtvgestiondiariarchaud@gmail.com</strong> para auto-inicializar la cuenta como SuperAdmin.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Contraseña:</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : 'Entrar al Sistema'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Nombre Completo:</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Carlos Mendoza"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Correo Electrónico:</label>
                  <input
                    type="email"
                    required
                    placeholder="ej: carlos.m@vtv.gob.ve"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Cargo / Puesto de Trabajo:</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Editor de Guardia Principal"
                    value={regCargo}
                    onChange={(e) => setRegCargo(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Cédula de Identidad:</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: V-12345678"
                    value={regCedula}
                    onChange={(e) => setRegCedula(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Contraseña:</label>
                  <input
                    type="password"
                    required
                    placeholder="Crea una contraseña segura"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 hover:border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400">División:</label>
                    <div className="relative">
                      <select
                        value={regDivisionId}
                        onChange={(e) => setRegDivisionId(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all appearance-none cursor-pointer"
                      >
                        {divisions.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Tipo de Acceso:</label>
                    <div className="relative">
                      <select
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value as any)}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="worker">Trabajador</option>
                        <option value="coordinator">Coordinador / Jefe</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : 'Registrarse e Ingresar'}
                </button>
              </form>
            )}

            {/* Instruction footnote */}
            <div className="pt-2 border-t border-white/5 text-[10px] text-slate-400 text-center leading-relaxed">
              Venezolana de Televisión • Canal de Integridad de Guardias
            </div>
          </motion.div>
        </div>
      ) : (
        /* CORE APPLICATION LAYOUT */
        <div className="relative z-10">
          
          {/* Header & Logo */}
          <header className="border-b border-white/5 bg-slate-950/40 glass sticky top-0 z-40 px-4 py-3">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Logo & Title */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                  <Tv className="text-white" size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold tracking-wider text-white text-base">VTV</span>
                    <span className="h-4 w-px bg-white/20" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400 font-mono">Control de Guardia</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Venezolana de Televisión • Gerencia de Archivo Audiovisual</p>
                </div>
              </div>

              {/* User Session Profile & Logout */}
              <div className="flex items-center gap-3.5 bg-slate-900/60 p-2 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 px-1">
                  <UserCircle size={16} className="text-cyan-400 shrink-0" />
                  {isEditingUsername ? (
                    <form onSubmit={handleChangeUsername} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="bg-slate-950 border border-cyan-500/30 rounded px-2 py-0.5 text-[11px] text-white focus:outline-none w-28 font-sans font-medium"
                        placeholder="Nuevo nombre..."
                        title="Nombre"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={newCedula}
                        onChange={(e) => setNewCedula(e.target.value)}
                        className="bg-slate-950 border border-cyan-500/30 rounded px-2 py-0.5 text-[11px] text-white focus:outline-none w-20 font-mono text-[10px]"
                        placeholder="Cédula..."
                        title="Cédula"
                      />
                      <button
                        type="submit"
                        className="p-1 bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/30 rounded cursor-pointer transition-all shrink-0"
                        title="Guardar cambios"
                      >
                        <Check size={10} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingUsername(false)}
                        className="p-1 bg-white/5 hover:bg-white/10 text-slate-400 rounded cursor-pointer transition-all shrink-0"
                        title="Cancelar"
                      >
                        <X size={10} strokeWidth={2.5} />
                      </button>
                    </form>
                  ) : (
                    <div className="text-left">
                      <div className="text-[11px] font-bold text-white leading-tight flex items-center gap-1.5">
                        <span
                          className="cursor-pointer hover:text-cyan-300 transition-all"
                          onClick={() => {
                            const wFound = workers.find(w => w.id === currentSession.userId);
                            setNewUsername(currentSession.name);
                            setNewCedula(wFound?.cedula || '');
                            setIsEditingUsername(true);
                          }}
                          title="Click para editar perfil"
                        >
                          {currentSession.name}
                        </span>
                        <button
                          onClick={() => {
                            const wFound = workers.find(w => w.id === currentSession.userId);
                            setNewUsername(currentSession.name);
                            setNewCedula(wFound?.cedula || '');
                            setIsEditingUsername(true);
                          }}
                          className="p-0.5 text-slate-400 hover:text-cyan-300 rounded hover:bg-white/5 transition-all cursor-pointer shrink-0"
                          title="Cambiar nombre y cédula de usuario"
                        >
                          <Edit2 size={9} />
                        </button>
                      </div>
                      <div className="text-[9px] text-slate-400 uppercase font-mono mt-0.5">
                        {currentSession.role === 'superadmin' ? 'Gerente (SuperAdmin)' : currentSession.cargo}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-xl transition-all cursor-pointer"
                  title="Cerrar Sesión"
                >
                  <LogOut size={14} />
                </button>
              </div>

            </div>
          </header>

          {/* Main Container */}
          <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

            {/* Global Welcome Banner & Division Filter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Welcome Info */}
              <div className="md:col-span-2 p-5 glass flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider font-mono">Panel de Control Activo</span>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Hola, {currentSession.name.split(' ')[0]}
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {currentSession.role === 'superadmin' && 'Tienes acceso completo para orquestar la logística de guardia diaria y administrar divisiones.'}
                    {currentSession.role === 'coordinator' && `Coordinas los turnos de la división: ${divisions.find(d => d.id === currentSession.divisionId)?.name || 'Tu división'}.`}
                    {currentSession.role === 'worker' && 'Visualiza tus asignaciones de comedor y solicita intercambios de guardia.'}
                  </p>
                </div>
                
                <div className="hidden sm:block text-right">
                  <span className="text-[10px] font-mono text-slate-500 block uppercase">Fecha de Operación</span>
                  <span className="text-sm font-extrabold text-cyan-400 font-sans mt-1 block">{formattedSelectedDate}</span>
                </div>
              </div>

              {/* Quick Division Selector */}
              <div className="p-4 glass flex flex-col justify-center gap-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                  Filtrar Tablero por División:
                </label>
                
                {currentSession.role === 'coordinator' && currentSession.divisionId ? (
                  <div className="p-2.5 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-xs text-cyan-300 font-semibold truncate font-mono">
                    {divisions.find(d => d.id === selectedDivisionId)?.name} (Mi División)
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedDivisionId}
                      onChange={(e) => setSelectedDivisionId(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="todos">Todas las Divisiones</option>
                      {divisions.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>

            </div>

            {/* Navigation Tabs - Glassmorphic Toolbar */}
            <div className="flex overflow-x-auto gap-2 p-1.5 glass rounded-2xl">
              <button
                onClick={() => setActiveTab('tablero')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'tablero' 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Layers size={14} className={activeTab === 'tablero' ? 'text-cyan-400' : 'text-slate-400'} />
                <span>Tableros Diarios</span>
              </button>

              <button
                onClick={() => setActiveTab('comedor')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'comedor' 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Utensils size={14} className={activeTab === 'comedor' ? 'text-violet-400' : 'text-slate-400'} />
                <span>Logística Comedor</span>
              </button>

              <button
                onClick={() => setActiveTab('reportes')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'reportes' 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <FileText size={14} className={activeTab === 'reportes' ? 'text-cyan-400' : 'text-slate-400'} />
                <span>Generador Reportes</span>
              </button>

              <button
                onClick={() => setActiveTab('solicitudes')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'solicitudes' 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Calendar size={14} className={activeTab === 'solicitudes' ? 'text-indigo-400' : 'text-slate-400'} />
                <span>Permisos e Intercambios</span>
                {requests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block animate-pulse" />
                )}
              </button>

              {/* SuperAdmin Exclusivity Tab */}
              {currentSession.role === 'superadmin' && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'admin' 
                      ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white border border-cyan-500/30 font-extrabold' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Shield size={14} className={activeTab === 'admin' ? 'text-sky-400' : 'text-slate-400'} />
                  <span>Consola Gerencial</span>
                </button>
              )}

              {/* Technical Specs Blueprints Tab */}
              <button
                onClick={() => setActiveTab('blueprint')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ml-auto ${
                  activeTab === 'blueprint' 
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-white border border-emerald-500/30 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Database size={14} className={activeTab === 'blueprint' ? 'text-emerald-400' : 'text-slate-400'} />
                <span>Planos BD y Código</span>
              </button>
            </div>

            {/* RLS policy violation / schema error warning banner */}
            {dbStatus === 'error' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-300 leading-relaxed mb-4"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="text-amber-400 font-bold block mb-0.5">⚠️ Sincronización en la Nube Pausada por Políticas RLS en Supabase</span>
                    La conexión con la URL de tu Supabase es correcta, pero el servidor rechazó guardar la información debido a políticas de seguridad activas en tus tablas (Row-Level Security).
                    <span className="text-white font-medium block mt-1">La aplicación ha cambiado al Almacenamiento Local de forma automática para que puedas interactuar y registrar todo al 100% sin perder datos.</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('blueprint')}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl font-bold transition-all whitespace-nowrap shrink-0 self-stretch md:self-auto text-center cursor-pointer"
                >
                  Ver Solución SQL 🛠️
                </button>
              </motion.div>
            )}

            {/* Core Tab Render Switcher */}
            <div className="min-h-[500px]">
              {loading ? (
                <div className="min-h-[400px] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={36} className="text-cyan-400 animate-spin" />
                    <p className="text-xs text-slate-400">Sincronizando base de datos...</p>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'tablero' && (
                      <TrelloBoard
                        currentDivisionId={selectedDivisionId}
                        divisions={divisions}
                        workers={workers}
                        assignments={assignments}
                        onUpdateAssignments={handleUpdateAssignments}
                        userRole={currentSession.role}
                        userDivisionId={currentSession.divisionId}
                        onAddNotification={addNotification}
                        selectedDateStr={selectedDateStr}
                        setSelectedDateStr={setSelectedDateStr}
                        operationalDates={operationalDates}
                        onAddOperationalDate={handleAddOperationalDate}
                      />
                    )}

                    {activeTab === 'comedor' && (
                      <ComedorLogistics
                        divisions={divisions}
                        workers={workers}
                        assignments={assignments}
                        selectedDateStr={selectedDateStr}
                        setSelectedDateStr={setSelectedDateStr}
                        operationalDates={operationalDates}
                        onAddOperationalDate={handleAddOperationalDate}
                        mealsPreferences={mealsPreferences}
                        onUpdateMealsPreference={handleUpdateMealsPreference}
                      />
                    )}

                    {activeTab === 'reportes' && (
                      <ReportGenerator
                        divisions={divisions}
                        workers={workers}
                        assignments={assignments}
                        onAddNotification={addNotification}
                        selectedDateStr={selectedDateStr}
                        setSelectedDateStr={setSelectedDateStr}
                        operationalDates={operationalDates}
                        onAddOperationalDate={handleAddOperationalDate}
                      />
                    )}

                    {activeTab === 'solicitudes' && (
                      <ShiftChanges
                        workers={workers}
                        divisions={divisions}
                        assignments={assignments}
                        requests={requests}
                        userRole={currentSession.role}
                        userDivisionId={currentSession.divisionId}
                        currentUserId={currentSession.userId}
                        onUpdateRequests={handleUpdateRequests}
                        onUpdateAssignments={handleUpdateAssignments}
                        onAddNotification={addNotification}
                      />
                    )}

                    {activeTab === 'admin' && currentSession.role === 'superadmin' && (
                      <AdminPanel
                        divisions={divisions}
                        workers={workers}
                        onUpdateDivisions={handleUpdateDivisions}
                        onUpdateWorkers={handleUpdateWorkers}
                        onAddNotification={addNotification}
                      />
                    )}

                    {activeTab === 'blueprint' && (
                      <DatabaseSchema />
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

          </main>

        </div>
      )}

      {/* Floating Liquid-Style Notifications Center */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="p-4 bg-slate-950/95 border border-cyan-500/20 shadow-xl rounded-2xl flex items-start gap-3 pointer-events-auto backdrop-blur-lg"
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
