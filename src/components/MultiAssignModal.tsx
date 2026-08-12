import React, { useState, useEffect } from 'react';
import { MaterialSignal, Personnel } from '../types';
import { X, Users, UserCheck, Check, Plus, Search, Shield } from 'lucide-react';

interface MultiAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  signal: MaterialSignal | null;
  personnel: Personnel[];
  onSaveAssignments: (signalId: string, assignedPersons: string[]) => void;
}

export const MultiAssignModal: React.FC<MultiAssignModalProps> = ({
  isOpen,
  onClose,
  signal,
  personnel,
  onSaveAssignments,
}) => {
  if (!isOpen || !signal) return null;

  const [selectedNames, setSelectedNames] = useState<string[]>(
    signal.assignedPersons && signal.assignedPersons.length > 0
      ? signal.assignedPersons
      : signal.assignedTo
      ? signal.assignedTo.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (signal) {
      const initial = signal.assignedPersons && signal.assignedPersons.length > 0
        ? signal.assignedPersons
        : signal.assignedTo
        ? signal.assignedTo.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      setSelectedNames(initial);
    }
  }, [signal]);

  const togglePerson = (name: string) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleAddCustomName = () => {
    if (!customName.trim()) return;
    const trimmed = customName.trim();
    if (!selectedNames.includes(trimmed)) {
      setSelectedNames((prev) => [...prev, trimmed]);
    }
    setCustomName('');
  };

  const handleSave = () => {
    onSaveAssignments(signal.id, selectedNames);
    onClose();
  };

  const filteredPersonnel = personnel.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.division.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Asignar Equipo / Personas</h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">
                {signal.id} - {signal.title}
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

        {/* Selected People Chips */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Personas Asignadas ({selectedNames.length}):
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {selectedNames.length === 0 ? (
              <span className="text-xs text-amber-400/90 italic">
                Ninguna persona asignada aún. Selecciona de la lista abajo.
              </span>
            ) : (
              selectedNames.map((name) => (
                <span
                  key={name}
                  className="px-2.5 py-1 rounded-lg bg-purple-950 text-purple-200 border border-purple-800 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <UserCheck className="w-3 h-3 text-purple-400" />
                  <span>{name}</span>
                  <button
                    onClick={() => togglePerson(name)}
                    className="hover:text-red-400 ml-0.5 text-slate-400 font-extrabold"
                    title="Remover"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Search & Custom Name */}
        <div className="p-4 space-y-3 bg-slate-900 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar trabajador por nombre o división..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomName())}
              placeholder="Añadir nombre externo u otro trabajador..."
              className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={handleAddCustomName}
              disabled={!customName.trim()}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir</span>
            </button>
          </div>
        </div>

        {/* Personnel List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Personal de la Base de Datos:
          </span>
          {filteredPersonnel.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-4">
              No se encontraron trabajadores con ese término.
            </p>
          ) : (
            filteredPersonnel.map((p) => {
              const isSelected = selectedNames.includes(p.name);
              return (
                <div
                  key={p.id}
                  onClick={() => togglePerson(p.name)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500/60 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-purple-600 border-purple-400 text-white'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{p.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {p.role} • <span className="text-blue-400">{p.division}</span>
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-bold text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded border border-purple-700">
                      Asignado
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <span className="text-xs text-slate-400">
            {selectedNames.length} persona(s) seleccionada(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-900/50 transition-all flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              <span>Guardar Asignaciones</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
