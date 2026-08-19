import React, { useState, useMemo, useEffect } from 'react';
import { 
  MaterialSignal, 
  MaterialStatus, 
  DivisionType, 
  SignalType, 
  UserProfile, 
  Personnel,
  MonthlyArchiveLog 
} from '../types';
import { 
  groupMaterialsByFamily, 
  exportMaterialsToCSV, 
  generateMonthlyArchiveLog,
  getFormattedDateTime,
  formatDurationHHMMSS,
  parseAnyDate
} from '../services/apiService';
import {
  canUserCreateMaterial,
  canUserAssignSignal,
  canUserUnassignSignal,
  canUserCatalogSignal,
  canUserFinalizeSignal
} from '../utils/permissions';
import { MaterialContainerCard } from './MaterialContainerCard';
import { ExportConfirmModal } from './ExportConfirmModal';
import { MonthlyArchiveModal } from './MonthlyArchiveModal';
import { MultiAssignModal } from './MultiAssignModal';
import { 
  Film, 
  Search, 
  Plus, 
  Layers, 
  List, 
  Archive, 
  FolderArchive, 
  FolderOpen, 
  FolderCheck, 
  Edit3,
  Download,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  UserCheck,
  UserX,
  Lock,
  Calendar,
  Filter,
  FileText,
  ClipboardList,
  Users,
  X
} from 'lucide-react';

interface MaterialListModuleProps {
  materials: MaterialSignal[];
  currentUser: UserProfile;
  personnel?: Personnel[];
  monthlyArchives?: MonthlyArchiveLog[];
  onUpdateSignalStatus: (signalId: string, newStatus: MaterialStatus) => void;
  onBatchUpdateFamilyStatus: (familyId: string, newStatus: MaterialStatus) => void;
  onToggleSignalBoolean?: (signalId: string, flag: 'isIngested' | 'isCataloged' | 'isFinalized') => void;
  onBatchToggleFamilyBoolean?: (familyId: string, flag: 'isIngested' | 'isCataloged' | 'isFinalized', value: boolean) => void;
  onAssignSignal?: (signalId: string, assignToUser: string | null) => void;
  onAssignMultiplePersons?: (signalId: string, assignedPersons: string[]) => void;
  onOpenNewMaterialModal: (familyId?: string, title?: string, division?: DivisionType, isRequestTask?: boolean) => void;
  onDeleteSignal: (signalId: string) => void;
  onEditSignal?: (signal: MaterialSignal) => void;
  onPurgeFinalizedMaterials?: (signalIds: string[], monthlyLog: MonthlyArchiveLog) => void;
  onSaveMonthlyLogOnly?: (monthlyLog: MonthlyArchiveLog) => void;
  onClearMonthlyArchives?: () => void;
}

const ITEMS_PER_PAGE = 20;

export const MaterialListModule: React.FC<MaterialListModuleProps> = ({
  materials,
  currentUser,
  personnel = [],
  monthlyArchives = [],
  onUpdateSignalStatus,
  onBatchUpdateFamilyStatus,
  onToggleSignalBoolean,
  onBatchToggleFamilyBoolean,
  onAssignSignal,
  onAssignMultiplePersons,
  onOpenNewMaterialModal,
  onDeleteSignal,
  onEditSignal,
  onPurgeFinalizedMaterials,
  onSaveMonthlyLogOnly,
  onClearMonthlyArchives,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [folderTab, setFolderTab] = useState<'active' | 'requests' | 'finalized' | 'all'>('active');
  const [selectedDivision, setSelectedDivision] = useState<DivisionType | 'Todas'>('Todas');
  const [selectedStatus, setSelectedStatus] = useState<MaterialStatus | 'Todos'>('Todos');
  const [selectedSignalType, setSelectedSignalType] = useState<SignalType | 'Todos'>('Todos');
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [viewMode, setViewMode] = useState<'families' | 'flat'>('families');

  // Multi-person assign modal
  const [multiAssignSignal, setMultiAssignSignal] = useState<MaterialSignal | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Export & Archival Modals
  const [isExportConfirmOpen, setIsExportConfirmOpen] = useState(false);
  const [isMonthlyArchiveModalOpen, setIsMonthlyArchiveModalOpen] = useState(false);
  const [pendingMonthlyLog, setPendingMonthlyLog] = useState<MonthlyArchiveLog | null>(null);
  const [pendingFinalizedCount, setPendingFinalizedCount] = useState<number>(0);
  const [pendingFinalizedIds, setPendingFinalizedIds] = useState<string[]>([]);

  // Permission check to add material
  const canCreate = canUserCreateMaterial(currentUser);

  // Check if any filter is active
  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    selectedDivision !== 'Todas' ||
    selectedStatus !== 'Todos' ||
    selectedSignalType !== 'Todos' ||
    selectedDate !== ''
  );

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((mat) => {
      // Folder Separation logic
      if (folderTab === 'active') {
        if (mat.isFinalized || mat.isRequestTask) return false;
      } else if (folderTab === 'requests') {
        if (!mat.isRequestTask) return false;
      } else if (folderTab === 'finalized') {
        if (!mat.isFinalized) return false;
      }

      // Search
      const matchesSearch =
        mat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.familyId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mat.createdBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (mat.creationDate && mat.creationDate.toLowerCase().includes(searchTerm.toLowerCase()));

      // Division
      const matchesDivision =
        selectedDivision === 'Todas' || mat.division === selectedDivision;

      // Status
      const matchesStatus =
        selectedStatus === 'Todos' || mat.status === selectedStatus;

      // Signal Type
      const matchesSignalType =
        selectedSignalType === 'Todos' || mat.signalType === selectedSignalType;

      // Date Filter (matches creationDate, catalogedAt, or finalizedAt)
      let matchesDate = true;
      if (selectedDate) {
        const [sYear, sMonth, sDay] = selectedDate.split('-').map(Number);
        const matDate = parseAnyDate(mat.creationDate);
        const catDate = mat.catalogedAt ? parseAnyDate(mat.catalogedAt) : null;
        const finDate = mat.finalizedAt ? parseAnyDate(mat.finalizedAt) : null;

        const isCreationMatch =
          matDate.getFullYear() === sYear &&
          matDate.getMonth() + 1 === sMonth &&
          matDate.getDate() === sDay;

        const isCatMatch = catDate ? (
          catDate.getFullYear() === sYear &&
          catDate.getMonth() + 1 === sMonth &&
          catDate.getDate() === sDay
        ) : false;

        const isFinMatch = finDate ? (
          finDate.getFullYear() === sYear &&
          finDate.getMonth() + 1 === sMonth &&
          finDate.getDate() === sDay
        ) : false;

        matchesDate = isCreationMatch || isCatMatch || isFinMatch;
      }

      return matchesSearch && matchesDivision && matchesStatus && matchesSignalType && matchesDate;
    }).sort((a, b) => parseAnyDate(b.creationDate).getTime() - parseAnyDate(a.creationDate).getTime());
  }, [materials, folderTab, searchTerm, selectedDivision, selectedStatus, selectedSignalType, selectedDate]);

  // Grouped into families
  const familyGroups = useMemo(() => {
    return groupMaterialsByFamily(filteredMaterials);
  }, [filteredMaterials]);

  // Whenever filters change, reset pagination to page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDivision, selectedStatus, selectedSignalType, selectedDate, folderTab, viewMode]);

  // Pagination Calculations
  const totalItems = viewMode === 'families' ? familyGroups.length : filteredMaterials.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

  const paginatedFamilyGroups = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return familyGroups.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [familyGroups, currentPage]);

  const paginatedFilteredMaterials = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMaterials.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  }, [filteredMaterials, currentPage]);

  // Metrics summary
  const totalCount = materials.length;
  const uniqueFamilyCount = groupMaterialsByFamily(materials).length;
  const activeCount = materials.filter((m) => !m.isFinalized && !m.isRequestTask).length;
  const requestsCount = materials.filter((m) => m.isRequestTask).length;
  const porArchivarCount = materials.filter((m) => (m.isCataloged || m.isRequestTask) && !m.isFinalized).length;
  const finalizadoCount = materials.filter((m) => m.isFinalized).length;

  // Handle Export Finalized Materials
  const handleTriggerExport = () => {
    const finalizedList = materials.filter((m) => m.isFinalized || m.status === 'Finalizado');
    if (finalizedList.length === 0) {
      alert('No hay materiales con estatus "Finalizado" en la base de datos para exportar.');
      return;
    }

    // 1. Download CSV File
    exportMaterialsToCSV(finalizedList);

    // 2. Generate Monthly Log
    const log = generateMonthlyArchiveLog(finalizedList, currentUser);
    setPendingMonthlyLog(log);
    setPendingFinalizedCount(finalizedList.length);
    setPendingFinalizedIds(finalizedList.map((m) => m.id));

    // 3. Open Confirmation Modal
    setIsExportConfirmOpen(true);
  };

  const handleConfirmPurge = () => {
    if (pendingMonthlyLog && onPurgeFinalizedMaterials) {
      onPurgeFinalizedMaterials(pendingFinalizedIds, pendingMonthlyLog);
    }
    setIsExportConfirmOpen(false);
    setPendingMonthlyLog(null);
  };

  const handleKeepData = () => {
    if (pendingMonthlyLog && onSaveMonthlyLogOnly) {
      onSaveMonthlyLogOnly(pendingMonthlyLog);
    }
    setIsExportConfirmOpen(false);
    setPendingMonthlyLog(null);
  };

  // Render Pagination Control Bar
  const renderPaginationBar = () => {
    if (totalItems === 0) return null;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-slate-950/90 border border-purple-900/50 rounded-2xl shadow-inner">
        <div className="text-xs text-slate-400 font-mono">
          Mostrando <strong className="text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> - <strong className="text-white">{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</strong> de <strong className="text-purple-300">{totalItems}</strong> {viewMode === 'families' ? 'familias' : 'señales'} (Máx 20/pág)
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 text-xs font-bold flex items-center gap-1 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <div className="flex items-center gap-1 px-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .map((p, idx, arr) => {
                const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                return (
                  <React.Fragment key={p}>
                    {showEllipsis && <span className="text-slate-600 px-1 text-xs font-mono">...</span>}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        currentPage === p
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50 ring-1 ring-purple-400'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300 text-xs font-bold flex items-center gap-1 transition-all"
          >
            <span>Siguiente</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modals */}
      <MultiAssignModal
        isOpen={multiAssignSignal !== null}
        onClose={() => setMultiAssignSignal(null)}
        signal={multiAssignSignal}
        personnel={personnel}
        onSaveAssignments={(sigId, names) => {
          if (onAssignMultiplePersons) {
            onAssignMultiplePersons(sigId, names);
          }
        }}
      />

      {pendingMonthlyLog && (
        <ExportConfirmModal
          isOpen={isExportConfirmOpen}
          onClose={() => setIsExportConfirmOpen(false)}
          finalizedCount={pendingFinalizedCount}
          monthlyLog={pendingMonthlyLog}
          onConfirmPurge={handleConfirmPurge}
          onKeepData={handleKeepData}
        />
      )}

      <MonthlyArchiveModal
        isOpen={isMonthlyArchiveModalOpen}
        onClose={() => setIsMonthlyArchiveModalOpen(false)}
        monthlyArchives={monthlyArchives}
        onClearHistory={onClearMonthlyArchives}
      />

      {/* Top Banner & Quick Summary Cards */}
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
              Tareas de catalogación
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Archive className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Carpeta Finalizados & Export Trigger */}
        <div className="p-4 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-emerald-400 block uppercase tracking-wider">
              Carpeta Finalizados (Acervo)
            </span>
            <span className="text-2xl font-extrabold text-emerald-300 font-mono mt-1 block">
              {finalizadoCount}
            </span>
            <button
              onClick={handleTriggerExport}
              disabled={finalizadoCount === 0}
              className="mt-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 disabled:opacity-40 flex items-center gap-1 underline transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar y Depurar</span>
            </button>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <FolderCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Action Buttons Box */}
        <div className="p-4 bg-gradient-to-br from-purple-950/80 via-slate-900 to-blue-900/40 border border-purple-800/60 rounded-2xl shadow-xl flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-200">
              Gestión de Archivo VTV
            </span>
            <button
              onClick={() => setIsMonthlyArchiveModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-700 font-bold text-[10px] flex items-center gap-1 transition-all"
            >
              <HardDrive className="w-3 h-3 text-purple-300" />
              <span>Histórico Mensual ({monthlyArchives.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {canCreate ? (
              <button
                onClick={() => onOpenNewMaterialModal(undefined, undefined, undefined, folderTab === 'requests')}
                className={`flex-1 py-2 px-3 rounded-xl text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                  folderTab === 'requests'
                    ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/50'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/50'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>{folderTab === 'requests' ? 'Nueva Solicitud / Tarea' : 'Nuevo Registro (Ingesta)'}</span>
              </button>
            ) : (
              <span className="text-xs text-slate-500 italic">
                Modo Solo Consulta
              </span>
            )}

            <button
              onClick={handleTriggerExport}
              disabled={finalizadoCount === 0}
              className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-emerald-900/50 transition-all flex items-center justify-center gap-1.5"
              title="Exportar material finalizado en CSV y registrar estatus mensual"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Carpetas Separadas Header Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center flex-wrap gap-2">
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
            onClick={() => setFolderTab('requests')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              folderTab === 'requests'
                ? 'bg-purple-600 text-white shadow-lg ring-1 ring-purple-400/50'
                : 'bg-slate-950/60 text-purple-300 hover:text-white hover:bg-purple-950/60 border border-purple-800/60'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-purple-300" />
            <span>Solicitudes y Otras Tareas ({requestsCount})</span>
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

        <div className="flex items-center gap-2">
          {finalizadoCount > 0 && (
            <button
              onClick={handleTriggerExport}
              className="px-3 py-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 font-extrabold text-xs flex items-center gap-1.5 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Finalizados ({finalizadoCount})</span>
            </button>
          )}

          <button
            onClick={() => setIsMonthlyArchiveModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 font-extrabold text-xs flex items-center gap-1.5 transition-all"
          >
            <HardDrive className="w-4 h-4" />
            <span>Estatus Mensual de Horas</span>
          </button>
        </div>
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
            {/* Status Filter */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-purple-400 mr-1.5 shrink-0" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer pr-1"
                title="Filtrar por Estatus"
              >
                <option value="Todos" className="bg-slate-900 text-white">Todos los Estatus</option>
                <option value="Registrado" className="bg-slate-900 text-white">Registrado</option>
                <option value="En Catalogación" className="bg-slate-900 text-white">En Catalogación</option>
                <option value="Por Archivar" className="bg-slate-900 text-white">Por Archivar</option>
                <option value="Finalizado" className="bg-slate-900 text-white">Finalizado</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-300 font-mono text-xs focus:outline-none cursor-pointer py-0.5"
                title="Filtrar por fecha de registro/catalogación"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate('')}
                  className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all ml-1"
                  title="Limpiar fecha"
                >
                  <X className="w-3.5 h-3.5 text-rose-400" />
                </button>
              )}
            </div>

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

            {/* Reset All Filters button */}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedDivision('Todas');
                  setSelectedStatus('Todos');
                  setSelectedSignalType('Todos');
                  setSelectedDate('');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold flex items-center gap-1 transition-all shadow-sm"
                title="Limpiar todos los filtros aplicados"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Limpiar</span>
              </button>
            )}

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

      {/* Top Pagination Bar */}
      {renderPaginationBar()}

      {/* Materials Render Section */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#050711] via-[#0B081A] to-[#1C0835] border border-purple-900/50 shadow-2xl space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-1 pb-3 border-b border-purple-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-purple-200">
              {folderTab === 'active' && 'Bandeja de Ingesta y Trabajo Activo'}
              {folderTab === 'requests' && 'Solicitudes y Otras Tareas (Contabilizan por archivar)'}
              {folderTab === 'finalized' && 'Carpeta Histórica (Acervo de Materiales Finalizados)'}
              {folderTab === 'all' && 'Repositorio General de Materiales'}
            </h3>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {folderTab === 'active' && canCreate && (
              <button
                onClick={() => onOpenNewMaterialModal(undefined, undefined, undefined, false)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-950/80 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Registro de Ingesta</span>
              </button>
            )}

            {folderTab === 'requests' && canCreate && (
              <button
                onClick={() => onOpenNewMaterialModal(undefined, undefined, undefined, true)}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-950/80 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Solicitud / Otra Tarea</span>
              </button>
            )}

            {(folderTab === 'all' || folderTab === 'finalized') && canCreate && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onOpenNewMaterialModal(undefined, undefined, undefined, false)}
                  className="px-2.5 py-1.5 rounded-xl bg-blue-600/90 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow transition-all"
                  title="Crear registro de material audiovisual de Ingesta"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Ingesta</span>
                </button>
                <button
                  onClick={() => onOpenNewMaterialModal(undefined, undefined, undefined, true)}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow transition-all"
                  title="Crear solicitud o tarea asignada"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Solicitud</span>
                </button>
              </div>
            )}
            <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-950/80 px-3 py-1 rounded-full border border-purple-800/60 shadow-inner">
              Página {currentPage} de {totalPages} • {familyGroups.length} familias ({filteredMaterials.length} señales)
            </span>
          </div>
        </div>

        {viewMode === 'families' ? (
          /* Family Container Mode (Paginated to max 20 families per page) */
          paginatedFamilyGroups.length === 0 ? (
            <div className="p-12 text-center bg-slate-950/80 border border-purple-900/40 rounded-2xl">
              <Film className="w-12 h-12 text-purple-400/60 mx-auto mb-3 animate-bounce" />
              <h3 className="text-base font-bold text-white">No se encontraron materiales</h3>
              <p className="text-xs text-purple-300/70 mt-1 max-w-sm mx-auto">
                No hay registros que coincidan con la carpeta activa o los filtros seleccionados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-1">
              {paginatedFamilyGroups.map((group, gIdx) => (
                <MaterialContainerCard
                  key={`${group.familyId || 'fam'}-${gIdx}`}
                  group={group}
                  currentUser={currentUser}
                  onUpdateSignalStatus={onUpdateSignalStatus}
                  onBatchUpdateFamilyStatus={onBatchUpdateFamilyStatus}
                  onToggleSignalBoolean={onToggleSignalBoolean}
                  onBatchToggleFamilyBoolean={onBatchToggleFamilyBoolean}
                  onAssignSignal={onAssignSignal}
                  onOpenMultiAssign={(sig) => setMultiAssignSignal(sig)}
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
          /* Flat Individual Signals List Mode (Paginated to max 20 signals per page) */
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
                    <th className="p-3.5">Asignado A</th>
                    <th className="p-3.5">Booleans (Estado)</th>
                    <th className="p-3.5">Creado Por</th>
                    <th className="p-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedFilteredMaterials.map((mat, mIdx) => (
                    <tr key={`${mat.id}-${mat.signalType || 'sig'}-${mIdx}`} className="hover:bg-slate-800/40 transition-colors">
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
                        {formatDurationHHMMSS(mat.duration)}
                      </td>
                      <td className="p-3.5">
                        {mat.assignedTo ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60 text-[11px]">
                              {mat.assignedTo}
                            </span>
                            {canUserUnassignSignal(currentUser, mat) && (
                              <button
                                onClick={() => onAssignSignal && onAssignSignal(mat.id, null)}
                                className="p-1 rounded bg-slate-800 hover:bg-red-950 text-red-300 hover:text-white border border-slate-700"
                                title="Liberar Tarjeta"
                              >
                                <UserX className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => onAssignSignal && onAssignSignal(mat.id, currentUser.name)}
                            className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[10px] flex items-center gap-1"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Asignármela</span>
                          </button>
                        )}
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
                            onClick={() => {
                              const check = canUserCatalogSignal(currentUser, mat);
                              if (!check.allowed) {
                                alert(check.reason);
                                return;
                              }
                              if (onToggleSignalBoolean) {
                                onToggleSignalBoolean(mat.id, 'isCataloged');
                              }
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              mat.isCataloged ? 'bg-amber-600/30 text-amber-300 border-amber-500' : 'bg-slate-900 text-slate-600 border-slate-800'
                            }`}
                          >
                            CAT
                          </button>
                          <button
                            onClick={() => {
                              const check = canUserFinalizeSignal(currentUser);
                              if (!check.allowed) {
                                alert(check.reason);
                                return;
                              }
                              if (onToggleSignalBoolean) {
                                onToggleSignalBoolean(mat.id, 'isFinalized');
                              }
                            }}
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
                        <div className="text-[10px] font-mono">{getFormattedDateTime(mat.creationDate)}</div>
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
                            onClick={() => {
                              const check = canUserCatalogSignal(currentUser, mat);
                              if (!check.allowed) {
                                alert(check.reason);
                                return;
                              }
                              if (onToggleSignalBoolean) {
                                onToggleSignalBoolean(mat.id, 'isCataloged');
                              }
                            }}
                            className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px]"
                          >
                            {mat.isCataloged ? 'Catalogado' : 'Para Archivar'}
                          </button>
                          <button
                            onClick={() => {
                              const check = canUserFinalizeSignal(currentUser);
                              if (!check.allowed) {
                                alert(check.reason);
                                return;
                              }
                              if (onToggleSignalBoolean) {
                                onToggleSignalBoolean(mat.id, 'isFinalized');
                              }
                            }}
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

      {/* Bottom Pagination Bar */}
      {renderPaginationBar()}
    </div>
  );
};
