import React from 'react';
import { UserProfile, RoleType } from '../types';
import { isGuestUser } from '../utils/permissions';
import { 
  Film, 
  Users, 
  BarChart3, 
  Settings, 
  UserCheck, 
  ShieldAlert, 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  Tv, 
  KeyRound, 
  Lock, 
  ShieldCheck, 
  LogOut, 
  LogIn, 
  Eye 
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'materials' | 'personnel' | 'dashboard' | 'settings';
  setActiveTab: (tab: 'materials' | 'personnel' | 'dashboard' | 'settings') => void;
  currentUser: UserProfile;
  onOpenUserSelector: () => void;
  onOpenPinModal?: () => void;
  onOpenBackupModal?: () => void;
  onLogout?: () => void;
  userHasPin?: boolean;
  appsScriptUrl?: string;
  isSyncing?: boolean;
  lastSyncTime?: string;
  onTriggerSync?: () => void;
  syncError?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenUserSelector,
  onOpenPinModal,
  onOpenBackupModal,
  onLogout,
  userHasPin,
  appsScriptUrl,
  isSyncing,
  lastSyncTime,
  onTriggerSync,
  syncError,
}) => {
  const isGuest = isGuestUser(currentUser);

  const getRoleBadgeColor = (role: RoleType) => {
    switch (role) {
      case 'Gerente de Archivo':
      case 'Adjunta de Gerencia':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Asistente Administrativa':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'Jefe de División':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'Coordinador':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Documentalista':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'Ingestador':
      case 'Operador de Ingesta':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'Invitado (Solo Lectura)':
        return 'bg-amber-600/30 text-amber-300 border-amber-500/50';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row items-center justify-between py-3 gap-3 border-b border-slate-800/80">
          {/* Logo & Station Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-amber-500 to-blue-600 flex items-center justify-center shadow-md shadow-red-950/40 ring-1 ring-white/20">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-wider text-white">VTV ARCHIVO</span>
                <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest font-extrabold bg-red-600 text-white rounded-md shadow-sm">
                  OFICIAL
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Venezolana de Televisión • Depto. de Archivo Audiovisual
              </p>
            </div>
          </div>

          {/* User Profile Pill & Actions */}
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            {/* Google Sheets Multi-Device Sync Button */}
            {onTriggerSync && (
              <button
                onClick={onTriggerSync}
                disabled={isSyncing}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-md group ${
                  isSyncing
                    ? 'bg-blue-950/80 border-blue-500/60 text-blue-300 animate-pulse'
                    : syncError
                    ? 'bg-amber-950/80 border-amber-600/70 text-amber-300 hover:bg-amber-900/90'
                    : 'bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border-emerald-600/60 hover:border-emerald-400'
                }`}
                title={
                  isSyncing
                    ? 'Sincronizando con Google Sheets...'
                    : syncError
                    ? `Error: ${syncError}. Haga clic para reintentar sincronizar.`
                    : `Conectado a Google Sheets. Última sincronización: ${lastSyncTime || 'Reciente'}. Haga clic para sincronizar todos los dispositivos.`
                }
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : 'text-emerald-400 group-hover:rotate-180 transition-transform duration-500'}`} />
                <span className="hidden sm:inline">
                  {isSyncing ? 'Sincronizando...' : syncError ? 'Reintentar Sync' : 'Sincronizar'}
                </span>
                {lastSyncTime && !isSyncing && !syncError && (
                  <span className="hidden md:inline text-[10px] text-emerald-400/80 font-normal">
                    ({lastSyncTime.split(' ').slice(-2).join(' ')})
                  </span>
                )}
              </button>
            )}

            {/* Backup & Recovery Button */}
            {onOpenBackupModal && (
              <button
                onClick={onOpenBackupModal}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/70 hover:border-emerald-500 transition-all shadow-md group"
                title="Crear Respaldo Diario / Mensual en Google Drive y Copias de Seguridad"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Crear Respaldo</span>
              </button>
            )}

            {/* Security PIN Button (Only for logged-in users) */}
            {!isGuest && onOpenPinModal && (
              <button
                onClick={onOpenPinModal}
                className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
                  userHasPin
                    ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 hover:bg-amber-900/90 shadow-sm'
                    : 'bg-amber-600/20 border-amber-500/60 text-amber-300 hover:bg-amber-600/30 shadow-sm animate-pulse'
                }`}
                title={userHasPin ? 'Perfil protegido con PIN (Clic para modificar)' : 'Crear PIN de seguridad para este perfil'}
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">
                  {userHasPin ? 'Modificar PIN' : 'Crear PIN'}
                </span>
                {userHasPin ? (
                  <Lock className="w-3 h-3 text-amber-400" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                )}
              </button>
            )}

            {/* User Profile Switcher & Session State */}
            {isGuest ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold">
                  <Eye className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span className="hidden sm:inline">Modo Consulta</span>
                  <span className="text-[10px] font-normal text-amber-400/80">(Solo Lectura)</span>
                </div>
                <button
                  onClick={onOpenUserSelector}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 border border-blue-400 rounded-xl text-white font-bold text-xs transition-all shadow-md shadow-blue-950/50 group"
                  title="Iniciar sesión con un usuario para realizar acciones y modificaciones"
                >
                  <LogIn className="w-3.5 h-3.5 text-white" />
                  <span>Iniciar Sesión</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onOpenUserSelector}
                  className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700/90 border border-slate-700 rounded-xl transition-all shadow-sm group text-left"
                  title="Cambiar perfil de usuario"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-xs">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-100 group-hover:text-blue-300 transition-colors">
                      <span className="truncate max-w-[130px]">{currentUser.name}</span>
                      <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`px-1.5 py-0.2 text-[9px] rounded font-semibold border ${getRoleBadgeColor(currentUser.role)}`}>
                        {currentUser.role}
                      </span>
                      {currentUser.division && (
                        <span className="text-[10px] text-slate-400">
                          • {currentUser.division}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Logout Button */}
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-2 rounded-xl bg-slate-800/90 hover:bg-amber-950/80 text-slate-400 hover:text-amber-300 border border-slate-700 hover:border-amber-600 transition-all shadow-sm flex items-center justify-center"
                    title="Cerrar sesión (Cambiar a Modo Consulta / Solo Lectura)"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Read-Only Notice Bar if in Guest Mode */}
        {isGuest && (
          <div className="bg-amber-950/50 border-b border-amber-800/40 px-3 py-1.5 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                <strong>Modo Consulta (Solo Lectura):</strong> Puedes explorar todos los materiales, guardias y métricas. Para registrar, archivar o modificar, inicia sesión.
              </span>
            </div>
            <button
              onClick={onOpenUserSelector}
              className="text-xs font-bold text-amber-300 hover:text-white underline ml-2 shrink-0"
            >
              Iniciar Sesión
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex items-center overflow-x-auto no-scrollbar gap-1 pt-2 pb-2 text-sm font-medium">
          <button
            onClick={() => setActiveTab('materials')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'materials'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Materiales Audiovisuales</span>
          </button>

          <button
            onClick={() => setActiveTab('personnel')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap relative ${
              activeTab === 'personnel'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Personal y Guardias</span>
            {(currentUser.role === 'Asistente Administrativa' || currentUser.role === 'Gerente de Archivo' || currentUser.role === 'Adjunta de Gerencia') && (
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard & Métricas</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-slate-700 text-white shadow-md shadow-slate-900/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Google Apps Script</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
