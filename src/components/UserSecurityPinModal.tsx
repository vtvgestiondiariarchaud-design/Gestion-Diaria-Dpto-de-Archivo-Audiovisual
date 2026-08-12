import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { ShieldCheck, Lock, KeyRound, X, Check, Trash2, AlertCircle } from 'lucide-react';

interface UserSecurityPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  userPins: Record<string, string>;
  onSavePin: (userId: string, pin: string | null) => void;
}

export const UserSecurityPinModal: React.FC<UserSecurityPinModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  userPins,
  onSavePin,
}) => {
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const existingPin = (userPins && currentUser?.id) ? (userPins[currentUser.id] || null) : null;

  useEffect(() => {
    if (isOpen) {
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // If user already has a PIN, verify current pin
    if (existingPin && currentPinInput !== existingPin) {
      setErrorMsg('El PIN actual introducido es incorrecto.');
      return;
    }

    // Validate new pin
    if (!/^\d{4,6}$/.test(newPinInput)) {
      setErrorMsg('El PIN debe ser estrictamente de 4 a 6 dígitos numéricos.');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setErrorMsg('El nuevo PIN y su confirmación no coinciden.');
      return;
    }

    onSavePin(currentUser.id, newPinInput);
    setSuccessMsg('¡PIN de seguridad actualizado exitosamente!');
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleRemovePin = () => {
    if (existingPin && currentPinInput !== existingPin) {
      setErrorMsg('Para eliminar el PIN, debes introducir primero tu PIN actual.');
      return;
    }

    onSavePin(currentUser.id, null);
    setSuccessMsg('PIN de seguridad eliminado.');
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configurar PIN de Seguridad</h2>
              <p className="text-xs text-slate-400">Protección de Perfil: {currentUser.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-sm">
          {/* Status Badge */}
          <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
            existingPin 
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
              : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
          }`}>
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <div className="text-xs">
              <span className="font-bold block">
                {existingPin ? 'Perfil Protegido con PIN' : 'Sin PIN de Seguridad'}
              </span>
              <span className="text-slate-400 text-[11px]">
                {existingPin 
                  ? 'Se solicitará tu clave al cambiar a este perfil.' 
                  : 'Asigna un PIN numérico de 4 dígitos para resguardar tus acciones.'}
              </span>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current PIN (If already exists) */}
          {existingPin && (
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                PIN Actual *
              </label>
              <input
                type="password"
                maxLength={6}
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="****"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest text-lg font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* New PIN */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              {existingPin ? 'Nuevo PIN (4 a 6 dígitos) *' : 'Crear PIN (4 a 6 dígitos) *'}
            </label>
            <input
              type="password"
              maxLength={6}
              required
              value={newPinInput}
              onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej. 1234"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest text-lg font-bold focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Confirm PIN */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
              Confirmar Nuevo PIN *
            </label>
            <input
              type="password"
              maxLength={6}
              required
              value={confirmPinInput}
              onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej. 1234"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest text-lg font-bold focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            {existingPin ? (
              <button
                type="button"
                onClick={handleRemovePin}
                className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-bold flex items-center gap-1 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar PIN</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-950/50 flex items-center gap-1.5 transition-all"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Guardar PIN</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
