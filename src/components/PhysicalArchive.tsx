import React, { useState, useEffect, useMemo } from 'react';
import { 
  FolderArchive, 
  Disc, 
  Tv, 
  MapPin, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Lock, 
  Calendar, 
  Filter, 
  Info, 
  X, 
  AlertTriangle
} from 'lucide-react';
import { 
  PhysicalFormat, 
  PhysicalProgram, 
  PhysicalLocation, 
  PhysicalAudiovisualMaterial, 
  UserRole 
} from '../types';

interface PhysicalArchiveProps {
  userRole: UserRole;
  userDivisionId?: string;
  currentUserId?: string;
  onAddNotification?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
}

// Initial Default Seed Data
const DEFAULT_FORMATS: PhysicalFormat[] = [
  { id: 'fmt_1', name: 'DVCPRO 9m' },
  { id: 'fmt_2', name: 'DVCPRO 12m' },
  { id: 'fmt_3', name: 'DVCPRO 24m' },
  { id: 'fmt_4', name: 'DVCPRO 33m' },
  { id: 'fmt_5', name: 'DVCPRO 46m' },
  { id: 'fmt_6', name: 'DVCPRO 66m' },
  { id: 'fmt_7', name: 'DVCPRO 34L' },
  { id: 'fmt_8', name: 'DVCPRO 66L' },
  { id: 'fmt_9', name: 'DVCPRO 94L' },
  { id: 'fmt_10', name: 'DVCPRO 126L' },
  { id: 'fmt_11', name: 'Betacam' },
  { id: 'fmt_12', name: 'U-matic' },
  { id: 'fmt_13', name: 'VHS' },
  { id: 'fmt_14', name: 'MiniDV' },
  { id: 'fmt_15', name: 'Rollo 1"' },
  { id: 'fmt_16', name: 'Rollo 2"' },
  { id: 'fmt_17', name: '16mm' },
  { id: 'fmt_18', name: '35mm' },
  { id: 'fmt_19', name: 'MII' },
  { id: 'fmt_20', name: 'DVD' },
  { id: 'fmt_21', name: 'Super VHS' },
  { id: 'fmt_22', name: 'LTO 4' },
  { id: 'fmt_23', name: 'LTO 9' },
];

const DEFAULT_LOCATIONS: PhysicalLocation[] = [
  { id: 'loc_1', name: 'Archivo de Programación' },
  { id: 'loc_2', name: 'Archivo Histórico' },
  { id: 'loc_3', name: 'Archivo muerto' },
  { id: 'loc_4', name: 'Archivo Fílmico' },
  { id: 'loc_5', name: 'Librería Robótica' },
];

const DEFAULT_PROGRAMS: PhysicalProgram[] = [
  { id: 'prg_1', name: 'Noticiero VTV - Edición Central', releaseDate: '1999-01-01' },
  { id: 'prg_2', name: 'Al Trote', releaseDate: '2018-05-15' },
  { id: 'prg_3', name: 'Con El Mazo Dando', releaseDate: '2014-02-10' },
  { id: 'prg_4', name: 'La Hojilla', releaseDate: '2004-08-01' },
  { id: 'prg_5', name: 'Reportajes Especiales de Patria', releaseDate: '2010-03-20' },
];

const DEFAULT_MATERIALS: PhysicalAudiovisualMaterial[] = [
  {
    id: 'mat_1',
    code: 1001,
    formatId: 'fmt_11', // Betacam
    programId: 'prg_5',
    title: 'Discurso Inaugural de Estudio 1 - Transmisión Histórica',
    recordingDate: '1992-04-11',
    airDate: '1992-04-12',
    segmentNumber: 1,
    totalTime: '00:45:30',
    locationId: 'loc_2', // Archivo Histórico
    synopsis: 'Cinta original en formato Betacam SP con preservación de máster de audio. Cobertura completa de la reinauguración técnica.',
    observations: 'Cinta re-empaquetada en caja antihumedad. Revisión de cinta física correcta.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'mat_2',
    code: 1002,
    formatId: 'fmt_8', // DVCPRO 66L
    programId: 'prg_1',
    title: 'Edición Especial Noticiero VTV - Cobertura Bicentenario',
    recordingDate: '2011-07-05',
    airDate: '2011-07-05',
    segmentNumber: 2,
    totalTime: '01:15:00',
    locationId: 'loc_1', // Archivo de Programación
    synopsis: 'Segmentos de noticias de calle y pases en directo desde el Paseo Los Próceres.',
    observations: 'Sin fallas de tracking. Listo para consulta pública.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'mat_3',
    code: 1003,
    formatId: 'fmt_23', // LTO 9
    programId: 'prg_3',
    title: 'Master Digital LTO9 - Resguardo Temporada Anual',
    recordingDate: '2023-11-20',
    airDate: '2023-11-22',
    segmentNumber: 1,
    totalTime: '02:30:00',
    locationId: 'loc_5', // Librería Robótica
    synopsis: 'Cinta LTO-9 de almacenamiento robótico masivo con índice XML y redundancia verificada.',
    observations: 'Ubicada en slot R-42 de la Librería Robótica.',
    createdAt: new Date().toISOString()
  }
];

export const PhysicalArchive: React.FC<PhysicalArchiveProps> = ({
  userRole,
  userDivisionId,
  currentUserId,
  onAddNotification
}) => {
  // Navigation Sub-Tabs (Materials, Programs, Formats, Locations) - SQL removed
  const [activeSubTab, setActiveSubTab] = useState<'materials' | 'programs' | 'formats' | 'locations'>('materials');

  // Storage States
  const [formats, setFormats] = useState<PhysicalFormat[]>(() => {
    const saved = localStorage.getItem('vtv_physical_formats');
    return saved ? JSON.parse(saved) : DEFAULT_FORMATS;
  });

  const [locations, setLocations] = useState<PhysicalLocation[]>(() => {
    const saved = localStorage.getItem('vtv_physical_locations');
    return saved ? JSON.parse(saved) : DEFAULT_LOCATIONS;
  });

  const [programs, setPrograms] = useState<PhysicalProgram[]>(() => {
    const saved = localStorage.getItem('vtv_physical_programs');
    return saved ? JSON.parse(saved) : DEFAULT_PROGRAMS;
  });

  const [materials, setMaterials] = useState<PhysicalAudiovisualMaterial[]>(() => {
    const saved = localStorage.getItem('vtv_physical_materials');
    return saved ? JSON.parse(saved) : DEFAULT_MATERIALS;
  });

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem('vtv_physical_formats', JSON.stringify(formats));
  }, [formats]);

  useEffect(() => {
    localStorage.setItem('vtv_physical_locations', JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    localStorage.setItem('vtv_physical_programs', JSON.stringify(programs));
  }, [programs]);

  useEffect(() => {
    localStorage.setItem('vtv_physical_materials', JSON.stringify(materials));
  }, [materials]);

  // Hierarchical Permission Check for Location Modifications:
  // Jefes, Coordinadores and SuperAdmin can add or modify locations
  const canManageLocations = useMemo(() => {
    return userRole === 'coordinator' || userRole === 'deputy' || userRole === 'superadmin';
  }, [userRole]);

  // Filters & Search States for Materials
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFormat, setFilterFormat] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterProgram, setFilterProgram] = useState<string>('all');

  // Modals
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<PhysicalAudiovisualMaterial | null>(null);

  const [showFormatModal, setShowFormatModal] = useState(false);
  const [editingFormat, setEditingFormat] = useState<PhysicalFormat | null>(null);
  const [formatNameInput, setFormatNameInput] = useState('');

  const [showProgramModal, setShowProgramModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<PhysicalProgram | null>(null);
  const [programNameInput, setProgramNameInput] = useState('');
  const [programReleaseDateInput, setProgramReleaseDateInput] = useState('');

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<PhysicalLocation | null>(null);
  const [locationNameInput, setLocationNameInput] = useState('');

  const [selectedDetailMaterial, setSelectedDetailMaterial] = useState<PhysicalAudiovisualMaterial | null>(null);

  // Custom Deletion Confirmation Modal State
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'material' | 'format' | 'program' | 'location';
    id: string;
    nameOrCode: string;
    title?: string;
  } | null>(null);

  // Form states for Material
  const [matCodeInput, setMatCodeInput] = useState<number>(1001);
  const [matTitleInput, setMatTitleInput] = useState('');
  const [matFormatIdInput, setMatFormatIdInput] = useState('');
  const [matProgramIdInput, setMatProgramIdInput] = useState('');
  const [matRecordingDateInput, setMatRecordingDateInput] = useState('');
  const [matAirDateInput, setMatAirDateInput] = useState('');
  const [matSegmentInput, setMatSegmentInput] = useState<number>(1);
  const [matTotalTimeInput, setMatTotalTimeInput] = useState('00:00:00');
  const [matLocationIdInput, setMatLocationIdInput] = useState('');
  const [matSynopsisInput, setMatSynopsisInput] = useState('');
  const [matObservationsInput, setMatObservationsInput] = useState('');

  // Calculate Next Progressive Code
  const getNextCode = () => {
    if (materials.length === 0) return 1001;
    const maxCode = Math.max(...materials.map(m => m.code || 0));
    return maxCode >= 1000 ? maxCode + 1 : 1001;
  };

  // Open Add Material Modal
  const handleOpenAddMaterial = () => {
    const nextCode = getNextCode();
    setEditingMaterial(null);
    setMatCodeInput(nextCode);
    setMatTitleInput('');
    setMatFormatIdInput(formats[0]?.id || '');
    setMatProgramIdInput('');
    setMatRecordingDateInput(new Date().toISOString().split('T')[0]);
    setMatAirDateInput('');
    setMatSegmentInput(1);
    setMatTotalTimeInput('00:30:00');
    setMatLocationIdInput(locations[0]?.id || '');
    setMatSynopsisInput('');
    setMatObservationsInput('');
    setShowMaterialModal(true);
  };

  // Open Edit Material Modal
  const handleOpenEditMaterial = (m: PhysicalAudiovisualMaterial) => {
    setEditingMaterial(m);
    setMatCodeInput(m.code);
    setMatTitleInput(m.title);
    setMatFormatIdInput(m.formatId);
    setMatProgramIdInput(m.programId || '');
    setMatRecordingDateInput(m.recordingDate || '');
    setMatAirDateInput(m.airDate || '');
    setMatSegmentInput(m.segmentNumber || 1);
    setMatTotalTimeInput(m.totalTime || '00:00:00');
    setMatLocationIdInput(m.locationId);
    setMatSynopsisInput(m.synopsis || '');
    setMatObservationsInput(m.observations || '');
    setShowMaterialModal(true);
  };

  // Save Material
  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matTitleInput.trim()) {
      alert('Por favor ingrese el nombre del material.');
      return;
    }
    if (!matFormatIdInput) {
      alert('Por favor seleccione un formato válido.');
      return;
    }
    if (!matLocationIdInput) {
      alert('Por favor seleccione una localización física.');
      return;
    }

    if (editingMaterial) {
      // Update
      const updated = materials.map(m => {
        if (m.id === editingMaterial.id) {
          return {
            ...m,
            code: Number(matCodeInput),
            title: matTitleInput.trim(),
            formatId: matFormatIdInput,
            programId: matProgramIdInput || undefined,
            recordingDate: matRecordingDateInput || undefined,
            airDate: matAirDateInput || undefined,
            segmentNumber: Number(matSegmentInput) || 1,
            totalTime: matTotalTimeInput.trim() || '00:00:00',
            locationId: matLocationIdInput,
            synopsis: matSynopsisInput.trim() || undefined,
            observations: matObservationsInput.trim() || undefined
          };
        }
        return m;
      });
      setMaterials(updated);
      onAddNotification?.(`Material código AA-${String(matCodeInput).padStart(5, '0')} actualizado con éxito.`, 'success');
    } else {
      // Check for code conflict
      const codeExists = materials.some(m => m.code === Number(matCodeInput));
      const finalCode = codeExists ? getNextCode() : Number(matCodeInput);

      const newMat: PhysicalAudiovisualMaterial = {
        id: `mat_${Date.now()}`,
        code: finalCode,
        title: matTitleInput.trim(),
        formatId: matFormatIdInput,
        programId: matProgramIdInput || undefined,
        recordingDate: matRecordingDateInput || undefined,
        airDate: matAirDateInput || undefined,
        segmentNumber: Number(matSegmentInput) || 1,
        totalTime: matTotalTimeInput.trim() || '00:00:00',
        locationId: matLocationIdInput,
        synopsis: matSynopsisInput.trim() || undefined,
        observations: matObservationsInput.trim() || undefined,
        createdAt: new Date().toISOString(),
        createdByWorkerId: currentUserId
      };
      setMaterials([newMat, ...materials]);
      onAddNotification?.(`Nuevo material audiovisual AA-${String(finalCode).padStart(5, '0')} registrado en Archivo Físico.`, 'success');
    }

    setShowMaterialModal(false);
  };

  // Open Custom Delete Confirmation
  const promptDeleteMaterial = (m: PhysicalAudiovisualMaterial) => {
    setItemToDelete({
      type: 'material',
      id: m.id,
      nameOrCode: `AA-${String(m.code).padStart(5, '0')}`,
      title: m.title
    });
  };

  const promptDeleteFormat = (f: PhysicalFormat) => {
    const isUsed = materials.some(m => m.formatId === f.id);
    if (isUsed) {
      alert(`No se puede eliminar el formato "${f.name}" porque hay materiales audiovisuales registrados que lo utilizan.`);
      return;
    }
    setItemToDelete({
      type: 'format',
      id: f.id,
      nameOrCode: f.name
    });
  };

  const promptDeleteProgram = (p: PhysicalProgram) => {
    const isUsed = materials.some(m => m.programId === p.id);
    if (isUsed) {
      alert(`No se puede eliminar el programa "${p.name}" porque existen cintas asociadas a él.`);
      return;
    }
    setItemToDelete({
      type: 'program',
      id: p.id,
      nameOrCode: p.name
    });
  };

  const promptDeleteLocation = (l: PhysicalLocation) => {
    if (!canManageLocations) {
      alert('Acceso restringido: No posee jerarquía para eliminar localizaciones.');
      return;
    }
    const isUsed = materials.some(m => m.locationId === l.id);
    if (isUsed) {
      alert(`No se puede eliminar la localización "${l.name}" porque contiene cintas o cajas asignadas.`);
      return;
    }
    setItemToDelete({
      type: 'location',
      id: l.id,
      nameOrCode: l.name
    });
  };

  // Execute Deletion
  const confirmExecuteDelete = () => {
    if (!itemToDelete) return;

    const { type, id, nameOrCode } = itemToDelete;

    if (type === 'material') {
      setMaterials(prev => prev.filter(m => m.id !== id));
      if (selectedDetailMaterial?.id === id) setSelectedDetailMaterial(null);
      onAddNotification?.(`Material ${nameOrCode} eliminado del catálogo.`, 'info');
    } else if (type === 'format') {
      setFormats(prev => prev.filter(f => f.id !== id));
      onAddNotification?.(`Formato "${nameOrCode}" eliminado.`, 'info');
    } else if (type === 'program') {
      setPrograms(prev => prev.filter(p => p.id !== id));
      onAddNotification?.(`Programa "${nameOrCode}" eliminado.`, 'info');
    } else if (type === 'location') {
      setLocations(prev => prev.filter(l => l.id !== id));
      onAddNotification?.(`Localización "${nameOrCode}" eliminada.`, 'info');
    }

    setItemToDelete(null);
  };

  // FORMATS HANDLERS
  const handleSaveFormat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formatNameInput.trim()) return;

    if (editingFormat) {
      setFormats(formats.map(f => f.id === editingFormat.id ? { ...f, name: formatNameInput.trim() } : f));
      onAddNotification?.(`Formato "${formatNameInput}" actualizado.`, 'success');
    } else {
      const newFmt: PhysicalFormat = {
        id: `fmt_${Date.now()}`,
        name: formatNameInput.trim()
      };
      setFormats([...formats, newFmt]);
      onAddNotification?.(`Nuevo formato "${formatNameInput}" añadido al sistema.`, 'success');
    }
    setShowFormatModal(false);
  };

  // PROGRAM HANDLERS
  const handleSaveProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!programNameInput.trim()) return;

    if (editingProgram) {
      setPrograms(programs.map(p => p.id === editingProgram.id ? {
        ...p,
        name: programNameInput.trim(),
        releaseDate: programReleaseDateInput || undefined
      } : p));
      onAddNotification?.(`Programa "${programNameInput}" actualizado.`, 'success');
    } else {
      const newPrg: PhysicalProgram = {
        id: `prg_${Date.now()}`,
        name: programNameInput.trim(),
        releaseDate: programReleaseDateInput || undefined
      };
      setPrograms([...programs, newPrg]);
      onAddNotification?.(`Programa "${programNameInput}" agregado a la lista.`, 'success');
    }
    setShowProgramModal(false);
  };

  // LOCATION HANDLERS
  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageLocations) {
      alert('Acceso restringido: Solo Jefes, Coordinadores y Superadministradores tienen jerarquía para agregar o modificar localizaciones físicas.');
      return;
    }
    if (!locationNameInput.trim()) return;

    if (editingLocation) {
      setLocations(locations.map(l => l.id === editingLocation.id ? { ...l, name: locationNameInput.trim() } : l));
      onAddNotification?.(`Ubicación "${locationNameInput}" modificada.`, 'success');
    } else {
      const newLoc: PhysicalLocation = {
        id: `loc_${Date.now()}`,
        name: locationNameInput.trim()
      };
      setLocations([...locations, newLoc]);
      onAddNotification?.(`Nueva ubicación física "${locationNameInput}" registrada.`, 'success');
    }
    setShowLocationModal(false);
  };

  // Filtered Materials
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      // Search term
      const codeStr = String(m.code);
      const codeFormatted = `AA-${codeStr.padStart(5, '0')}`;
      const q = searchTerm.toLowerCase().trim();
      
      const formatName = (formats.find(f => f.id === m.formatId)?.name || '').toLowerCase();
      const programName = (programs.find(p => p.id === m.programId)?.name || '').toLowerCase();
      const locationName = (locations.find(l => l.id === m.locationId)?.name || '').toLowerCase();

      const matchesSearch = !q || (
        codeStr.includes(q) ||
        codeFormatted.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        formatName.includes(q) ||
        programName.includes(q) ||
        locationName.includes(q) ||
        (m.synopsis || '').toLowerCase().includes(q) ||
        (m.observations || '').toLowerCase().includes(q)
      );

      const matchesFormat = filterFormat === 'all' || m.formatId === filterFormat;
      const matchesLocation = filterLocation === 'all' || m.locationId === filterLocation;
      const matchesProgram = filterProgram === 'all' || m.programId === filterProgram;

      return matchesSearch && matchesFormat && matchesLocation && matchesProgram;
    }).sort((a, b) => a.code - b.code);
  }, [materials, searchTerm, filterFormat, filterLocation, filterProgram, formats, programs, locations]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/20 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-amber-500/5 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <FolderArchive size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-wide">Archivo Físico Audiovisual</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Patrimonio
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Control, catalogación y ubicación de cintas, soportes magnéticos y película fílmica.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAddMaterial}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer"
            >
              <Plus size={16} />
              <span>Registrar Material Físico</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Bar */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/10 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveSubTab('materials')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'materials'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-white/5 border border-white/5'
            }`}
          >
            <FolderArchive size={14} />
            <span>Material Audiovisual ({materials.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('programs')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'programs'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-white/5 border border-white/5'
            }`}
          >
            <Tv size={14} />
            <span>Programas ({programs.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('formats')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'formats'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-white/5 border border-white/5'
            }`}
          >
            <Disc size={14} />
            <span>Formatos ({formats.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('locations')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'locations'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md'
                : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-white/5 border border-white/5'
            }`}
          >
            <MapPin size={14} />
            <span>Localizaciones ({locations.length})</span>
            {!canManageLocations && (
              <Lock size={12} className="text-amber-400/80 ml-0.5" title="Solo lectura para personal sin jerarquía" />
            )}
          </button>
        </div>
      </div>

      {/* SUBTAB 1: MATERIAL AUDIOVISUAL INVENTORY */}
      {activeSubTab === 'materials' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="p-4 bg-slate-900/80 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por código (ej. 1001), título, formato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <div className="flex items-center gap-1 bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5">
                <Filter size={12} className="text-amber-400" />
                <span className="text-[11px] text-slate-400 font-medium">Formato:</span>
                <select
                  value={filterFormat}
                  onChange={(e) => setFilterFormat(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">Todos</option>
                  {formats.map(f => (
                    <option key={f.id} value={f.id} className="bg-slate-900">{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5">
                <MapPin size={12} className="text-amber-400" />
                <span className="text-[11px] text-slate-400 font-medium">Ubicación:</span>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">Todas</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id} className="bg-slate-900">{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5">
                <Tv size={12} className="text-amber-400" />
                <span className="text-[11px] text-slate-400 font-medium">Programa:</span>
                <select
                  value={filterProgram}
                  onChange={(e) => setFilterProgram(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">Todos</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table / Grid */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/10">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Nombre / Título</th>
                    <th className="py-3 px-4">Formato</th>
                    <th className="py-3 px-4">Programa</th>
                    <th className="py-3 px-4">Ubicación Física</th>
                    <th className="py-3 px-4">Fecha Grabación / Aire</th>
                    <th className="py-3 px-4 text-center">Duración</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-200">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500 italic">
                        No se encontraron registros de material audiovisual con los criterios especificados.
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map(m => {
                      const fmt = formats.find(f => f.id === m.formatId);
                      const prg = programs.find(p => p.id === m.programId);
                      const loc = locations.find(l => l.id === m.locationId);
                      const codeFormatted = `AA-${String(m.code).padStart(5, '0')}`;

                      return (
                        <tr key={m.id} className="hover:bg-white/[0.02] transition-all">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              {codeFormatted}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-bold text-white text-xs truncate" title={m.title}>
                              {m.title}
                            </div>
                            {m.synopsis && (
                              <div className="text-[10px] text-slate-400 line-clamp-1 italic mt-0.5">
                                {m.synopsis}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 border border-cyan-500/20">
                              <Disc size={10} />
                              {fmt?.name || 'Desconocido'}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                            {prg ? (
                              <span className="flex items-center gap-1 text-xs">
                                <Tv size={11} className="text-indigo-400" />
                                {prg.name}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">N/A</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              <MapPin size={10} />
                              {loc?.name || 'Sin ubicación'}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-400">
                            <div>Grab: <span className="text-slate-200">{m.recordingDate || 'S/F'}</span></div>
                            {m.airDate && <div className="text-[10px] text-slate-500">Aire: {m.airDate}</div>}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-center font-mono text-xs font-medium text-slate-300">
                            {m.totalTime || '00:00:00'}
                            {m.segmentNumber ? <span className="text-[10px] text-slate-500 block">Seg. {m.segmentNumber}</span> : null}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedDetailMaterial(m)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                                title="Ver Ficha Técnica"
                              >
                                <Info size={14} />
                              </button>
                              <button
                                onClick={() => handleOpenEditMaterial(m)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 transition-all cursor-pointer"
                                title="Editar Material"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => promptDeleteMaterial(m)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                                title="Eliminar Registro"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PROGRAMAS CATALOG */}
      {activeSubTab === 'programs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Tv size={16} className="text-indigo-400" />
              <span>Catálogo de Programas de la Planta</span>
            </h2>
            <button
              onClick={() => {
                setEditingProgram(null);
                setProgramNameInput('');
                setProgramReleaseDateInput('');
                setShowProgramModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>Nuevo Programa</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {programs.map(p => {
              const countAssigned = materials.filter(m => m.programId === p.id).length;
              return (
                <div key={p.id} className="p-4 bg-slate-900 border border-white/10 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white text-sm">{p.name}</h3>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-amber-400" />
                        Estreno: {p.releaseDate || 'No registrada'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-amber-300 font-bold">
                        {countAssigned} cintas
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingProgram(p);
                        setProgramNameInput(p.name);
                        setProgramReleaseDateInput(p.releaseDate || '');
                        setShowProgramModal(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 transition-all cursor-pointer"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => promptDeleteProgram(p)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 3: FORMATS CATALOG */}
      {activeSubTab === 'formats' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Disc size={16} className="text-amber-400" />
              <span>Formatos Físicos Registrados</span>
            </h2>
            <button
              onClick={() => {
                setEditingFormat(null);
                setFormatNameInput('');
                setShowFormatModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>Agregar Formato</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {formats.map(f => {
              const countAssigned = materials.filter(m => m.formatId === f.id).length;
              return (
                <div key={f.id} className="p-3 bg-slate-900 border border-white/10 rounded-xl flex items-center justify-between gap-2 group hover:border-amber-500/30 transition-all">
                  <div>
                    <div className="font-bold text-white text-xs">{f.name}</div>
                    <div className="text-[10px] text-slate-400">{countAssigned} registros</div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => {
                        setEditingFormat(f);
                        setFormatNameInput(f.name);
                        setShowFormatModal(true);
                      }}
                      className="p-1 text-slate-400 hover:text-amber-300 cursor-pointer"
                      title="Editar formato"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => promptDeleteFormat(f)}
                      className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                      title="Borrar formato"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 4: LOCATIONS CATALOG (Permission Restricted) */}
      {activeSubTab === 'locations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <MapPin size={16} className="text-emerald-400" />
                <span>Localizaciones Física y Bóvedas</span>
              </h2>
              <p className="text-xs text-slate-400">
                Ubicaciones de depósito (Archivo de Programación, Histórico, Muerto, Fílmico, Librería Robótica).
              </p>
            </div>

            {canManageLocations ? (
              <button
                onClick={() => {
                  setEditingLocation(null);
                  setLocationNameInput('');
                  setShowLocationModal(true);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} />
                <span>Nueva Localización</span>
              </button>
            ) : (
              <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1.5">
                <Lock size={12} />
                <span>Permisos de Alta/Modificación restringidos a Jefes y Coordinadores</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {locations.map(l => {
              const countAssigned = materials.filter(m => m.locationId === l.id).length;
              return (
                <div key={l.id} className="p-4 bg-slate-900 border border-white/10 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">{l.name}</h3>
                      <div className="text-xs text-slate-400">{countAssigned} soportes resguardados</div>
                    </div>
                  </div>

                  {canManageLocations && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingLocation(l);
                          setLocationNameInput(l.name);
                          setShowLocationModal(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 transition-all cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => promptDeleteLocation(l)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD/EDIT MATERIAL */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <FolderArchive size={18} className="text-amber-400" />
                <span>{editingMaterial ? 'Editar Material Audiovisual' : 'Registrar Nuevo Material Físico'}</span>
              </h3>
              <button onClick={() => setShowMaterialModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block mb-1">
                    Código Físico (Entero):
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2.5 font-mono text-xs text-amber-400 font-bold">AA-</span>
                    <input
                      type="number"
                      required
                      value={matCodeInput}
                      onChange={(e) => setMatCodeInput(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Código incremental único</span>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Nombre / Título del Material *:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Entrevista Especial Noticiero Guardia Nocturna"
                    value={matTitleInput}
                    onChange={(e) => setMatTitleInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Formato *:
                  </label>
                  <select
                    value={matFormatIdInput}
                    onChange={(e) => setMatFormatIdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {formats.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Programa Asociado:
                  </label>
                  <select
                    value={matProgramIdInput}
                    onChange={(e) => setMatProgramIdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="">Sin Programa Específico</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Localización Física *:
                  </label>
                  <select
                    value={matLocationIdInput}
                    onChange={(e) => setMatLocationIdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Fecha de Grabación:
                  </label>
                  <input
                    type="date"
                    value={matRecordingDateInput}
                    onChange={(e) => setMatRecordingDateInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Fecha al Aire:
                  </label>
                  <input
                    type="date"
                    value={matAirDateInput}
                    onChange={(e) => setMatAirDateInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    NRO de Segmento:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={matSegmentInput}
                    onChange={(e) => setMatSegmentInput(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Tiempo Total (HH:MM:SS):
                  </label>
                  <input
                    type="text"
                    placeholder="00:30:00"
                    value={matTotalTimeInput}
                    onChange={(e) => setMatTotalTimeInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Sinopsis / Contenido del Material:
                </label>
                <textarea
                  rows={2}
                  placeholder="Resumen del contenido audiovisual registrado..."
                  value={matSynopsisInput}
                  onChange={(e) => setMatSynopsisInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Observaciones Técnicas / Estado de la Cinta:
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles físicos, conservación, número de rack, etc."
                  value={matObservationsInput}
                  onChange={(e) => setMatObservationsInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all cursor-pointer shadow-lg"
                >
                  {editingMaterial ? 'Guardar Cambios' : 'Registrar Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD/EDIT FORMAT */}
      {showFormatModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Disc size={16} className="text-amber-400" />
                <span>{editingFormat ? 'Editar Formato' : 'Agregar Nuevo Formato'}</span>
              </h3>
              <button onClick={() => setShowFormatModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveFormat} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Nombre del Formato Físico *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Betacam SX, LTO 10, HDCAM..."
                  value={formatNameInput}
                  onChange={(e) => setFormatNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowFormatModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all cursor-pointer"
                >
                  Guardar Formato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD/EDIT PROGRAM */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tv size={16} className="text-amber-400" />
                <span>{editingProgram ? 'Editar Programa' : 'Nuevo Programa'}</span>
              </h3>
              <button onClick={() => setShowProgramModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProgram} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Nombre del Programa *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Noticiero VTV, Al Trote..."
                  value={programNameInput}
                  onChange={(e) => setProgramNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Fecha de Estreno:
                </label>
                <input
                  type="date"
                  value={programReleaseDateInput}
                  onChange={(e) => setProgramReleaseDateInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowProgramModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all cursor-pointer"
                >
                  Guardar Programa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD/EDIT LOCATION */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin size={16} className="text-emerald-400" />
                <span>{editingLocation ? 'Editar Localización' : 'Nueva Localización Física'}</span>
              </h3>
              <button onClick={() => setShowLocationModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Nombre de la Localización *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Bóveda 3 - Estante B"
                  value={locationNameInput}
                  onChange={(e) => setLocationNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all cursor-pointer"
                >
                  Guardar Ubicación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: DETAILED TECH SPEC SHEET (FICHA TÉCNICA) */}
      {selectedDetailMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedDetailMaterial(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-mono font-black text-sm shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                AA-{String(selectedDetailMaterial.code).padStart(5, '0')}
              </div>
              <div>
                <h3 className="font-black text-white text-base leading-tight">{selectedDetailMaterial.title}</h3>
                <span className="text-xs text-amber-400/90 font-medium">Ficha de Identificación Audiovisual VTV</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-4 rounded-xl border border-white/5">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Formato:</span>
                <span className="text-white font-semibold">
                  {formats.find(f => f.id === selectedDetailMaterial.formatId)?.name || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Localización Física:</span>
                <span className="text-emerald-300 font-semibold">
                  {locations.find(l => l.id === selectedDetailMaterial.locationId)?.name || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Programa:</span>
                <span className="text-indigo-300 font-semibold">
                  {programs.find(p => p.id === selectedDetailMaterial.programId)?.name || 'Sin Programa'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Duración Total:</span>
                <span className="text-slate-200 font-mono font-bold">
                  {selectedDetailMaterial.totalTime || '00:00:00'} (Seg. {selectedDetailMaterial.segmentNumber || 1})
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Fecha de Grabación:</span>
                <span className="text-slate-300">{selectedDetailMaterial.recordingDate || 'No especificada'}</span>
              </div>

              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Fecha al Aire:</span>
                <span className="text-slate-300">{selectedDetailMaterial.airDate || 'No especificada'}</span>
              </div>
            </div>

            {selectedDetailMaterial.synopsis && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">Sinopsis:</span>
                <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-white/5 leading-relaxed">
                  {selectedDetailMaterial.synopsis}
                </p>
              </div>
            )}

            {selectedDetailMaterial.observations && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Observaciones Técnicas:</span>
                <p className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-white/5 leading-relaxed">
                  {selectedDetailMaterial.observations}
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end">
              <button
                onClick={() => setSelectedDetailMaterial(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CUSTOM DELETION CONFIRMATION DIALOG */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scaleIn">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-black text-white text-base">Confirmar Eliminación</h3>
                <p className="text-xs text-slate-400">Esta acción removerá el registro del sistema.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-white/5 text-xs text-slate-300 space-y-1">
              <p>
                <span className="text-slate-400 font-bold">Elemento: </span>
                <span className="text-amber-300 font-bold">{itemToDelete.nameOrCode}</span>
              </p>
              {itemToDelete.title && (
                <p className="text-slate-200 italic font-medium truncate">
                  "{itemToDelete.title}"
                </p>
              )}
            </div>

            <p className="text-xs text-slate-400">
              ¿Está seguro de que desea eliminar este {itemToDelete.type === 'material' ? 'material audiovisual' : itemToDelete.type === 'format' ? 'formato' : itemToDelete.type === 'program' ? 'programa' : 'ubicación física'}?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmExecuteDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Eliminar Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhysicalArchive;
