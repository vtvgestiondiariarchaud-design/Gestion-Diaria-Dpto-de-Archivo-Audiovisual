import React, { useState, useMemo } from 'react';
import { MaterialSignal, MaterialStatus, DivisionType, SignalType, UserProfile } from '../types';
import { groupMaterialsByFamily } from '../services/apiService';
import { MaterialContainerCard } from './MaterialContainerCard';
import { 
  Film, 
  Search, 
  Filter, 
  Plus, 
  Layers, 
  List, 
  CheckCircle2, 
  Clock, 
  Archive, 
  Tv, 
  Calendar,
  Sparkles,
  FolderArchive,
  FolderOpen,
  FolderCheck,
  Edit3
} from 'lucide-react';

interface MaterialListModuleProps {
  materials: MaterialSignal[];
  currentUser: UserProfile;
  onUpdateSignalStatus: (signalId: string, newStatus: MaterialStatus) => void;
  onBatchUpdateFamilyStatus: (familyId: string, newStatus: MaterialStatus) => void;
  onToggleSignalBoolean?: (signalId: string, flag: 'isIngested' | 'isCataloged' | 'isFinalized') => void;
  onBatchToggleFamilyBoolean?: (familyId: string, flag: 'isIngested' | 'isCataloged' | 'isFinalized', value: boolean) => void;
  onOpenNewMaterialModal: (familyId?: string, title?: string, division?: DivisionType) => void;
  onDeleteSignal: (signalId: string) => void;
  onEditSignal?: (signal: MaterialSignal) => void;
}

export const MaterialListModule: React.FC<MaterialListModuleProps> = ({
  materials,
  currentUser,
  onUpdateSignalStatus,
  onBatchUpdateFamilyStatus,
  onToggleSignalBoolean,
  onBatchToggleFamilyBoolean,
  onOpenNewMaterialModal,
  onDeleteSignal,
  onEditSignal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [folderTab, setFolderTab] = useState<'active' | 'finalized' | 'all'>('active');
  const [selectedDivision, setSelectedDivision] = useState<DivisionType | 'Todas'>('Todas');
  const [selectedStatus, setSelectedStatus] = useState<MaterialStatus | 'Todos'>('Todos');
  const [selectedSignalType, setSelectedSignalType] = useState<SignalType | 'Todos'>('Todos');
  const [viewMode, setViewMode] = useState<'families' | 'flat'>('families');

  // Permission check to add material
  const canCreate =
    currentUser.role === 'Gerente de Archivo' ||
    currentUser.role === 'Adjunta de Gerencia' ||
    currentUser.role === 'Jefe de División' ||
    currentUser.role === 'Coordinador';

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((mat) => {
      // Folder Separation logic (requirement 2)
      if (folderTab === 'active' && mat.isFinalized) return false;
      if (folderTab === 'finalized' && !mat.isFinalized) return false;

      // Search
      const matchesSearch =
        mat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.familyId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.createdBy.toLowerCase().includes(searchTerm.toLowerCase());

      // Division
      const matchesDivision =
        selectedDivision === 'Todas' || mat.division === selectedDivision;

      // Status
      const matchesStatus =
        selectedStatus === 'Todos' || mat.status === selectedStatus;

      // Signal Type
      const matchesSignalType =
        selectedSignalType === 'Todos' || mat.signalType === selectedSignalType;

      return matchesSearch && matchesDivision && matchesStatus && matchesSignalType;
    }).sort((a, b) => (b.creationDate || '').localeCompare(a.creationDate || ''));
  }, [materials, folderTab, searchTerm, selectedDivision, selectedStatus, selectedSignalType]);

  // Grouped into families
  const familyGroups = useMemo(() => {
    return groupMaterialsByFamily(filteredMaterials);
  }, [filteredMaterials]);

  // Metrics summary
  const totalCount = materials.length;
  const uniqueFamilyCount = groupMaterialsByFamily(materials).length;
  const activeCount = materials.filter((m) => !m.isFinalized).length;
  const porArchivarCount = materials.filter((m) => m.isCataloged && !m.isFinalized).length;
  const finalizadoCount = materials.filter((m) => m.isFinalized).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Quick Summary Cards with Gradient Backdrops */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Unique Material Families */}
        <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
              Materiales Únicos (Familias)
            </span>
            <span className="text-2xl font-extrabold text-white font-mono mt-1 block">
              {uniqueFamilyCount}
            </span>
            <span className="text-[11px] text-slate-400">
              {totalCount} señales registradas en total
            </span>
          </div>
          <div className="p-3 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Por Archivar (Catalogados) */}
        <div className="p-4 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-800/40 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-400 block uppercase tracking-wider">
              Por Archivar (Catalogados)
            </span>
            <span className="text-2xl font-extrabold text-amber-300 font-mono mt-1 block">
              {porArchivarCount}
            </span>
            <span className="text-[11px] text-slate-400">
              Tareas de catalogación de usuarios
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Archive className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Carpeta Finalizados */}
        <div className="p-4 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-400 block uppercase tracking-wider">
              Carpeta Finalizados (Acervo)
            </span>
            <span className="text-2xl font-extrabold text-emerald-300 font-mono mt-1 block">
              {finalizadoCount}
            </span>
            <span className="text-[11px] text-slate-400">
              En carpeta separada
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <FolderCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 bg-gradient-to-br from-blue-950/80 via-slate-900 to-blue-900/40 border border-blue-800/60 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-blue-300 block">
              Gestión de Archivo VTV
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Role: <strong className="text-white">{currentUser.role}</strong>
            </span>
          </div>

          {canCreate ? (
            <button
              onClick={() => onOpenNewMaterialModal()}
              className="w-full mt-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-900/50 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Registro Audiovisual</span>
            </button>
          ) : (
            <span className="text-xs text-slate-500 italic mt-2 block">
              Modo Solo Consulta
            </span>
          )}
        </div>
      </div>

      {/* Carpetas Separadas Header Selector (Requirement 2: Finalizado en carpeta separada) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFolderTab('active')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              folderTab === 'active'
                ? 'bg-blue-600 text-white shadow-lg ring-1 ring-blue-400/50'
                : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FolderOpen className="w-4 h-4 text-blue-300" />
            <span>Ingesta y Trabajo Activo ({activeCount})</span>
          </button>

          <button
            onClick={() => setFolderTab('finalized')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              folderTab === 'finalized'
                ? 'bg-emerald-600 text-white shadow-lg ring-1 ring-emerald-400/50'
                : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FolderArchive className="w-4 h-4 text-emerald-300" />
            <span>Carpeta Histórica Finalizados ({finalizadoCount})</span>
          </button>

          <button
            onClick={() => setFolderTab('all')}
            className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              folderTab === 'all'
                ? 'bg-slate-700 text-white shadow-lg'
                : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 text-slate-300" />
            <span>Ver Todos ({totalCount})</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 font-mono px-3 py-1 bg-slate-950 rounded-lg border border-slate-800 hidden md:inline">
          {folderTab === 'active' && '💡 Materiales en edición/catalogación'}
          {folderTab === 'finalized' && '🔒 Carpeta aislada de materiales cerrados'}
          {folderTab === 'all' && '🗂️ Vista unificada del repositorio completo'}
        </span>
      </div>

      {/* Control Bar: Search, Filters, View Mode */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, ID o persona..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Division Filter */}
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value as any)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="Todas">Todas las Divisiones</option>
              <option value="Prensa">División 1: Prensa</option>
              <option value="Programación">División 2: Programación</option>
              <option value="Ingesta">División 3: Ingesta</option>
            </select>

            {/* Signal Type Filter */}
            <select
              value={selectedSignalType}
              onChange={(e) => setSelectedSignalType(e.target.value as any)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="Todos">Todos los Tipos de Señal</option>
              <option value="Limpio">Limpio</option>
              <option value="Insert">Insert</option>
              <option value="Master">Master</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 ml-auto md:ml-0">
              <button
                onClick={() => setViewMode('families')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'families'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista Agrupada en Familias Contenedoras"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Familias</span>
              </button>

              <button
                onClick={() => setViewMode('flat')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'flat'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista Plana Individual de Señales"
              >
                <List className="w-3.5 h-3.5" />
                <span>Señales</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Materials Render Section with Darker Background & Dark Purple Gradient */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#050711] via-[#0B081A] to-[#1C0835] border border-purple-900/50 shadow-2xl space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between px-1 pb-3 border-b border-purple-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-purple-200">
              {folderTab === 'active' && 'Bandeja de Ingesta y Trabajo Activo'}
              {folderTab === 'finalized' && 'Carpeta Histórica (Acervo de Materiales Finalizados)'}
              {folderTab === 'all' && 'Repositorio General de Materiales'}
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-950/80 px-3 py-1 rounded-full border border-purple-800/60 shadow-inner">
            {familyGroups.length} familias • {filteredMaterials.length} señales
          </span>
        </div>

        {viewMode === 'families' ? (
          /* Family Container Mode */
          familyGroups.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/80 border border-purple-900/40 rounded-2xl">
              <Film className="w-12 h-12 text-purple-400/60 mx-auto mb-3 animate-bounce" />
              <h3 className="text-base font-bold text-white">No se encontraron materiales</h3>
              <p className="text-xs text-purple-300/70 mt-1 max-w-sm mx-auto">
                No hay registros que coincidan con la carpeta activa o los filtros seleccionados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-1">
              {familyGroups.map((group) => (
                <MaterialContainerCard
                  key={group.familyId}
                  group={group}
                  currentUser={currentUser}
                  onUpdateSignalStatus={onUpdateSignalStatus}
                  onBatchUpdateFamilyStatus={onBatchUpdateFamilyStatus}
                  onToggleSignalBoolean={onToggleSignalBoolean}
                  onBatchToggleFamilyBoolean={onBatchToggleFamilyBoolean}
                  onAddSignalToFamily={(fid, title, div) =>
                    onOpenNewMaterialModal(fid, title, div)
                  }
                  onDeleteSignal={onDeleteSignal}
                  onEditSignal={onEditSignal}
                />
              ))}
            </div>
          )
        ) : (
        /* Flat Individual Signals List Mode */
        <div className="bg-gradient-to-br from-[#1E293B] via-[#1E293B] to-[#0F172A] border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/90 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">ID Señal / Familia</th>
                  <th className="p-3.5">Tipo</th>
                  <th className="p-3.5">Título / Descripción</th>
                  <th className="p-3.5">División</th>
                  <th className="p-3.5">Duración</th>
                  <th className="p-3.5">Booleans (Estado)</th>
                  <th className="p-3.5">Creado Por</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMaterials.map((mat) => (
                  <tr key={mat.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-white">
                      <div>{mat.id}</div>
                      <div className="text-[10px] text-slate-400">FAM: {mat.familyId}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800">
                        {mat.signalType}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-white max-w-xs truncate">
                      {mat.title}
                    </td>
                    <td className="p-3.5">{mat.division}</td>
                    <td className="p-3.5 font-mono font-bold text-amber-300">
                      {mat.duration}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onToggleSignalBoolean && onToggleSignalBoolean(mat.id, 'isIngested')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            mat.isIngested !== false ? 'bg-blue-600/30 text-blue-300 border-blue-500' : 'bg-slate-900 text-slate-600 border-slate-800'
                          }`}
                        >
                          ING
                        </button>
                        <button
                          onClick={() => onToggleSignalBoolean && onToggleSignalBoolean(mat.id, 'isCataloged')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            mat.isCataloged ? 'bg-amber-600/30 text-amber-300 border-amber-500' : 'bg-slate-900 text-slate-600 border-slate-800'
                          }`}
                        >
                          CAT
                        </button>
                        <button
                          onClick={() => onToggleSignalBoolean && onToggleSignalBoolean(mat.id, 'isFinalized')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            mat.isFinalized ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500' : 'bg-slate-900 text-slate-600 border-slate-800'
                          }`}
                        >
                          FIN
                        </button>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-400">
                      <div>{mat.createdBy}</div>
                      <div className="text-[10px]">{mat.creationDate}</div>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onEditSignal && (
                          <button
                            onClick={() => onEditSignal(mat)}
                            className="p-1.5 rounded bg-purple-950 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-800 transition-all font-bold text-[10px]"
                            title="Modificar material"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onToggleSignalBoolean && onToggleSignalBoolean(mat.id, 'isCataloged')}
                          className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px]"
                        >
                          {mat.isCataloged ? 'Catalogado' : 'Para Archivar'}
                        </button>
                        <button
                          onClick={() => onToggleSignalBoolean && onToggleSignalBoolean(mat.id, 'isFinalized')}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px]"
                        >
                          {mat.isFinalized ? 'Cerrado' : 'Finalizar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
