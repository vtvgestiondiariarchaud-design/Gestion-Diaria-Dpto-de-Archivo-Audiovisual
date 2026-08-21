import React from 'react';
import { UserProfile, RoleType } from '../types';
import { DEFAULT_USERS, GUEST_USER } from '../data/initialData';
import { isGuestUser } from '../utils/permissions';
import { ShieldCheck, User, X, Check, Lock, KeyRound, Eye, LogOut } from 'lucide-react';

interface UserRoleSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  userPins?: Record<string, string>;
  users?: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  onOpenPinConfig?: () => void;
  onLogout?: () => void;
}

export const UserRoleSelectorModal: React.FC<UserRoleSelectorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  userPins = {},
  users,
  onSelectUser,
  onOpenPinConfig,
  onLogout,
}) => {
  if (!isOpen) return null;

  const isCurrentGuest = isGuestUser(currentUser);
  const userList = (users && users.length > 0) ? users : DEFAULT_USERS;

  const getRoleDescription = (role: RoleType) => {
    switch (role) {
      case 'Gerente de Archivo':
      case 'Adjunta de Gerencia':
        return 'Acceso Total: Lectura, Escritura, Catalogación, Finalización, Reportes y Control Administrativo.';
      case 'Asistente Administrativa':
        return 'Acceso Exclusivo: Gestión de Vacaciones, Días Libres y Guardias del Personal + Vista de Consulta de Archivo.';
      case 'Jefe de División':
        return 'Control de División: Creación de tarjetas (Ingesta y Solicitudes), Catalogación ("Para Archivar"), "Finalizado", vinculación de señales y gestión de Prensa, Programación o Ingesta.';
      case 'Coordinador':
        return 'Control Operativo: Creación de tarjetas (Ingesta y Solicitudes), Asignación de equipo, Catalogación ("Para Archivar"), "Finalizado" y vinculación de señales.';
      case 'Documentalista':
        return 'Documentación y Archivo: Catalogación de señales ("Para Archivar"), carga de fichas técnicas y organización del acervo.';
      case 'Ingestador':
      case 'Operador de Ingesta':
        return 'Ingesta de Señales: Registro de señales recibidas, cómputo de duración y marcado "Para Archivar".';
      default:
        return 'Consulta general del sistema sin privilegios de modificación.';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Seleccionar Perfil / Control de Sesión</h2>
              <p className="text-xs text-slate-400">
                Estructura Organizacional VTV • Control de Acceso y Permisos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body List */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Read-Only Guest Mode / Log Out Option Card */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-850 to-slate-900 border border-amber-500/30 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${isCurrentGuest ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 ring-1 ring-amber-400/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">Modo Consulta (Solo Lectura)</span>
                    {isCurrentGuest && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/50 text-[10px] font-extrabold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Sesión Cerrada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Permite visualizar todos los materiales, guardias y estadísticas sin poder modificar datos.
                  </p>
                </div>
              </div>

              {!isCurrentGuest && onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/60 hover:border-amber-400 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <p className="text-xs text-slate-300 font-semibold">
              Usuarios Disponibles (Haz clic para iniciar sesión):
            </p>

            {!isCurrentGuest && onOpenPinConfig && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPinConfig();
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Configurar mi PIN ({currentUser.name})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userList.map((user, idx) => {
              const isSelected = !isCurrentGuest && (currentUser.id === user.id || currentUser.name === user.name);
              const hasPin = Boolean(userPins[user.id] || userPins[user.name] || (user as any).pin);

              return (
                <button
                  key={user.id ? `usr-${user.id}` : `usr-idx-${idx}`}
                  onClick={() => {
                    onSelectUser(user);
                    onClose();
                  }}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-blue-950/50 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                      : 'bg-slate-800/60 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-semibold text-sm text-white flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {user.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {hasPin && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold" title="Perfil Protegido con PIN">
                          <Lock className="w-3 h-3 text-amber-400" /> PIN
                        </span>
                      )}
                      {isSelected && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                          <Check className="w-3 h-3" /> Activo
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        user.role === 'Gerente de Archivo' || user.role === 'Adjunta de Gerencia'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : user.role === 'Asistente Administrativa'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : user.role === 'Jefe de División'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {user.role}
                    </span>
                    {user.division && (
                      <span className="text-[11px] font-medium text-slate-300">
                        • {user.division}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {getRoleDescription(user.role)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Debes tener un usuario activo para registrar, archivar o modificar datos.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
