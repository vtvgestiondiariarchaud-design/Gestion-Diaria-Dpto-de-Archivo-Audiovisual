import React, { useState } from 'react';
import { GOOGLE_APPS_SCRIPT_CODE } from '../data/appsScriptCode';
import { 
  Database, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink, 
  FileCode, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Layers
} from 'lucide-react';

interface GoogleAppsScriptModalProps {
  appsScriptUrl: string;
  onSaveUrl: (url: string) => void;
  onOpenBackupModal?: () => void;
  lastSyncTime?: string;
}

export const GoogleAppsScriptModal: React.FC<GoogleAppsScriptModalProps> = ({
  appsScriptUrl,
  onSaveUrl,
  onOpenBackupModal,
  lastSyncTime,
}) => {
  const [urlInput, setUrlInput] = useState(appsScriptUrl);
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveUrl(urlInput.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Configuration Header Card */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Conexión con Google Drive / Sheets para Respaldos Diarios y Mensuales
            </h2>
            <p className="text-xs text-slate-400">
              Cree hojas independientes por fecha y período con toda la metadata en su Google Drive
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              URL de la Aplicación Web de Google Apps Script (Web App URL)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Guardar URL</span>
              </button>
            </div>
            {savedSuccess && (
              <p className="text-xs text-emerald-400 font-medium mt-1">
                ✓ URL de Google Apps Script guardada correctamente.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
            <div className="text-xs text-slate-400">
              Estado actual:{' '}
              {appsScriptUrl ? (
                <span className="text-emerald-400 font-bold">Conectado a Google Drive / Sheets</span>
              ) : (
                <span className="text-amber-400 font-bold">Modo Local (Sin URL configurada)</span>
              )}
            </div>

            {onOpenBackupModal && (
              <button
                type="button"
                onClick={onOpenBackupModal}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-300" />
                <span>Abrir Centro de Respaldos (Diario y Mensual)</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Code.gs Script & Instructions Card */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              Código del Backend Google Apps Script (`Code.gs`)
            </h3>
          </div>

          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '¡Copiado!' : 'Copiar Código Google Apps Script'}</span>
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
          <h4 className="font-bold text-white flex items-center gap-1.5 text-sm">
            <HelpCircle className="w-4 h-4 text-blue-400" />
            Pasos para la instalación en su Google Drive / Google Sheets:
          </h4>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed pl-1">
            <li>Abra o cree una hoja de cálculo en <strong>Google Sheets</strong>.</li>
            <li>En el menú superior, seleccione <strong>Extensiones → Apps Script</strong>.</li>
            <li>Copie el código de abajo y reemplácelo completamente en el archivo <code className="text-amber-300 font-mono">Código.gs</code>.</li>
            <li>Guarde los cambios y haga clic en el botón azul <strong>Desplegar → Nuevo despliegue</strong>.</li>
            <li>Seleccione tipo: <strong>Aplicación Web</strong>.</li>
            <li>Configure: <em>Ejecutar como:</em> <strong>Yo</strong> | <em>Quién tiene acceso:</em> <strong>Cualquier persona (Anyone)</strong> (fundamental para permitir la conexión).</li>
            <li>Haga clic en <strong>Desplegar</strong>, autorice los permisos y copie la Web App URL que termina en <code className="text-emerald-300 font-mono">/exec</code>.</li>
            <li>Pegue la URL arriba y presione <strong>Guardar URL</strong>.</li>
          </ol>

          <div className="mt-3 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200">
            <p className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Protección de Datos & Respaldos Locales Integrados
            </p>
            <p className="text-[11px] text-emerald-300/80 mt-1">
              Todos los materiales creados se guardan de forma instantánea en la memoria local segura y cuentan con copias de seguridad automáticas accesibles desde el botón <strong>Respaldos</strong> en la barra superior.
            </p>
          </div>
        </div>

        {/* Code View */}
        <div className="relative">
          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400/90 overflow-x-auto max-h-96 leading-relaxed">
            {GOOGLE_APPS_SCRIPT_CODE}
          </pre>
        </div>
      </div>
    </div>
  );
};
