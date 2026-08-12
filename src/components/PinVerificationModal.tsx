import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Lock, KeyRound, X, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';

interface PinVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserProfile | null;
  correctPin: string;
  onSuccess: () => void;
}

export const PinVerificationModal: React.FC<PinVerificationModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  correctPin,
  onSuccess,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === correctPin) {
      onSuccess();
      onClose();
    } else {
      setErrorMsg('PIN de seguridad incorrecto. Intente de nuevo.');
      setPinInput('');
    }
  };

  const handleKeyPress = (num: string) => {
    if (pinInput.length < 6) {
      setPinInput((prev) => prev + num);
      setErrorMsg('');
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col items-center text-center p-6 space-y-4">
        {/* Top Lock Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-950/40">
          <Lock className="w-7 h-7" />
        </div>

        <div>
          <h3 className="text-base font-extrabold text-white">Verificación de Seguridad</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingrese el PIN de acceso para el perfil:
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-amber-300 text-xs font-bold">
            <span>{targetUser.name}</span>
            <span className="text-[10px] text-slate-400">({targetUser.role})</span>
          </div>
        </div>

        {/* PIN Dots / Display */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="relative">
            <input
              type="password"
              autoFocus
              maxLength={6}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, ''));
                setErrorMsg('');
              }}
              placeholder="••••"
              className="w-full py-3 bg-slate-950 border-2 border-slate-700 focus:border-amber-500 rounded-2xl text-center text-2xl font-mono tracking-[0.5em] text-amber-400 font-extrabold focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="p-2 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* On-screen Keypad */}
          <div className="grid grid-cols-3 gap-2 w-full pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                className="py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-mono text-base font-bold text-white transition-all active:scale-95 shadow-sm"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              className="py-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all active:scale-95"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-mono text-base font-bold text-white transition-all active:scale-95 shadow-sm"
            >
              0
            </button>
            <button
              type="submit"
              disabled={!pinInput}
              className="py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 border border-amber-500 rounded-xl text-xs font-extrabold text-white transition-all active:scale-95 shadow-lg shadow-amber-950/50"
            >
              Entrar
            </button>
          </div>

          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-white font-medium"
            >
              Cancelar y Volver
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
