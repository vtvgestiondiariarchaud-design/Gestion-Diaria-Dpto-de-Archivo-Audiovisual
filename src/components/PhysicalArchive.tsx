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
  AlertTriangle,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  FileText
} from 'lucide-react';
import { 
  PhysicalFormat, 
  PhysicalProgram, 
  PhysicalLocation, 
  PhysicalAudiovisualMaterial, 
  UserRole 
} from '../types';
import { 
  db, 
  isSupabaseConfigured, 
  supabaseConnectionStatus, 
  lastSupabaseError 
} from '../supabaseClient';
import DatabaseSchema from './DatabaseSchema';

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
  // Navigation Sub-Tabs
  const [activeSubTab, setActiveSubTab] = useState<'materials' | 'programs' | 'formats' | 'locations'>('materials');

  // Database-backed States
  const [formats, setFormats] = useState<PhysicalFormat[]>(DEFAULT_FORMATS);
  const [locations, setLocations] = useState<PhysicalLocation[]>(DEFAULT_LOCATIONS);
  const [programs, setPrograms] = useState<PhysicalProgram[]>(DEFAULT_PROGRAMS);
  const [materials, setMaterials] = useState<PhysicalAudiovisualMaterial[]>(DEFAULT_MATERIALS);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(true);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);

  const refreshFromDb = async () => {
    try {
      setIsLoadingDb(true);
      const [fRes, lRes, pRes, mRes] = await Promise.all([
        db.fetchPhysicalFormats(DEFAULT_FORMATS),
        db.fetchPhysicalLocations(DEFAULT_LOCATIONS),
        db.fetchPhysicalPrograms(DEFAULT_PROGRAMS),
        db.fetchPhysicalMaterials(DEFAULT_MATERIALS)
      ]);
      setFormats(fRes);
      setLocations(lRes);
      setPrograms(pRes);
      setMaterials(mRes);
      onAddNotification?.('Sincronización con Supabase completada.', 'success');
    } catch (err: any) {
      console.error('Error al actualizar desde Supabase:', err);
      onAddNotification?.(`Error al consultar Supabase: ${err?.message || err}`, 'warning');
    } finally {
      setIsLoadingDb(false);
    }
  };

  // Synchronize strictly with backend database on mount
  useEffect(() => {
    let isMounted = true;
    async function loadDatabase() {
      try {
        setIsLoadingDb(true);
        const [fRes, lRes, pRes, mRes] = await Promise.all([
          db.fetchPhysicalFormats(DEFAULT_FORMATS),
          db.fetchPhysicalLocations(DEFAULT_LOCATIONS),
          db.fetchPhysicalPrograms(DEFAULT_PROGRAMS),
          db.fetchPhysicalMaterials(DEFAULT_MATERIALS)
        ]);
        if (isMounted) {
          setFormats(fRes);
          setLocations(lRes);
          setPrograms(pRes);
          setMaterials(mRes);
        }
      } catch (err) {
        console.error('Error fetching physical archive from DB:', err);
      } finally {
        if (isMounted) setIsLoadingDb(false);
      }
    }
    loadDatabase();
    return () => { isMounted = false; };
  }, []);

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

  // CSV Import Modal State
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvFileName, setCsvFileName] = useState('');
  const [parsedCsvItems, setParsedCsvItems] = useState<PhysicalAudiovisualMaterial[]>([]);
  const [csvNewFormats, setCsvNewFormats] = useState<PhysicalFormat[]>([]);
  const [csvNewLocations, setCsvNewLocations] = useState<PhysicalLocation[]>([]);
  const [csvNewPrograms, setCsvNewPrograms] = useState<PhysicalProgram[]>([]);
  const [csvErrorMsg, setCsvErrorMsg] = useState<string | null>(null);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);

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

  // Save Material (Database synchronized)
  const handleSaveMaterial = async (e: React.FormEvent) => {
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
      const updatedMat: PhysicalAudiovisualMaterial = {
        ...editingMaterial,
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

      setMaterials(materials.map(m => m.id === editingMaterial.id ? updatedMat : m));
      await db.savePhysicalMaterial(updatedMat);
      onAddNotification?.(`Material código AA-${String(matCodeInput).padStart(6, '0')} actualizado en la base de datos.`, 'success');
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
      await db.savePhysicalMaterial(newMat);
      onAddNotification?.(`Nuevo material audiovisual AA-${String(finalCode).padStart(6, '0')} registrado y guardado en la base de datos.`, 'success');
    }

    setShowMaterialModal(false);
  };

  // Open Custom Delete Confirmation
  const promptDeleteMaterial = (m: PhysicalAudiovisualMaterial) => {
    setItemToDelete({
      type: 'material',
      id: m.id,
      nameOrCode: `AA-${String(m.code).padStart(6, '0')}`,
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

  // Execute Deletion in Database
  const confirmExecuteDelete = async () => {
    if (!itemToDelete) return;

    const { type, id, nameOrCode } = itemToDelete;

    if (type === 'material') {
      setMaterials(prev => prev.filter(m => m.id !== id));
      if (selectedDetailMaterial?.id === id) setSelectedDetailMaterial(null);
      await db.deletePhysicalMaterial(id);
      onAddNotification?.(`Material ${nameOrCode} eliminado de la base de datos.`, 'info');
    } else if (type === 'format') {
      setFormats(prev => prev.filter(f => f.id !== id));
      await db.deletePhysicalFormat(id);
      onAddNotification?.(`Formato "${nameOrCode}" eliminado.`, 'info');
    } else if (type === 'program') {
      setPrograms(prev => prev.filter(p => p.id !== id));
      await db.deletePhysicalProgram(id);
      onAddNotification?.(`Programa "${nameOrCode}" eliminado.`, 'info');
    } else if (type === 'location') {
      setLocations(prev => prev.filter(l => l.id !== id));
      await db.deletePhysicalLocation(id);
      onAddNotification?.(`Localización "${nameOrCode}" eliminada.`, 'info');
    }

    setItemToDelete(null);
  };

  // FORMATS HANDLERS
  const handleSaveFormat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formatNameInput.trim()) return;

    if (editingFormat) {
      const updatedFmt = { ...editingFormat, name: formatNameInput.trim() };
      setFormats(formats.map(f => f.id === editingFormat.id ? updatedFmt : f));
      await db.savePhysicalFormat(updatedFmt);
      onAddNotification?.(`Formato "${formatNameInput}" actualizado en la base de datos.`, 'success');
    } else {
      const newFmt: PhysicalFormat = {
        id: `fmt_${Date.now()}`,
        name: formatNameInput.trim()
      };
      setFormats([...formats, newFmt]);
      await db.savePhysicalFormat(newFmt);
      onAddNotification?.(`Nuevo formato "${formatNameInput}" añadido a la base de datos.`, 'success');
    }
    setShowFormatModal(false);
  };

  // PROGRAM HANDLERS
  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programNameInput.trim()) return;

    if (editingProgram) {
      const updatedPrg = {
        ...editingProgram,
        name: programNameInput.trim(),
        releaseDate: programReleaseDateInput || undefined
      };
      setPrograms(programs.map(p => p.id === editingProgram.id ? updatedPrg : p));
      await db.savePhysicalProgram(updatedPrg);
      onAddNotification?.(`Programa "${programNameInput}" actualizado.`, 'success');
    } else {
      const newPrg: PhysicalProgram = {
        id: `prg_${Date.now()}`,
        name: programNameInput.trim(),
        releaseDate: programReleaseDateInput || undefined
      };
      setPrograms([...programs, newPrg]);
      await db.savePhysicalProgram(newPrg);
      onAddNotification?.(`Programa "${programNameInput}" agregado a la base de datos.`, 'success');
    }
    setShowProgramModal(false);
  };

  // LOCATION HANDLERS
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageLocations) {
      alert('Acceso restringido: Solo Jefes, Coordinadores y Superadministradores tienen jerarquía para agregar o modificar localizaciones físicas.');
      return;
    }
    if (!locationNameInput.trim()) return;

    if (editingLocation) {
      const updatedLoc = { ...editingLocation, name: locationNameInput.trim() };
      setLocations(locations.map(l => l.id === editingLocation.id ? updatedLoc : l));
      await db.savePhysicalLocation(updatedLoc);
      onAddNotification?.(`Ubicación "${locationNameInput}" modificada.`, 'success');
    } else {
      const newLoc: PhysicalLocation = {
        id: `loc_${Date.now()}`,
        name: locationNameInput.trim()
      };
      setLocations([...locations, newLoc]);
      await db.savePhysicalLocation(newLoc);
      onAddNotification?.(`Nueva ubicación física "${locationNameInput}" registrada en la base de datos.`, 'success');
    }
    setShowLocationModal(false);
  };

  // CSV TEMPLATE DOWNLOAD GENERATOR
  const downloadCSVTemplate = () => {
    const headers = [
      'Codigo',
      'Titulo',
      'Formato',
      'Programa',
      'Localizacion',
      'FechaGrabacion',
      'FechaAire',
      'NumeroSegmento',
      'Duracion',
      'Sinopsis',
      'Observaciones'
    ];

    const sampleRows = [
      [
        '1004',
        'Discurso de Aniversario VTV - Acto Central',
        'Betacam',
        'Reportajes Especiales de Patria',
        'Archivo Histórico',
        '2005-08-01',
        '2005-08-02',
        '1',
        '00:45:00',
        'Resguardo de cinta máster transmisión original',
        'Cinta en óptimo estado físico'
      ],
      [
        '1005',
        'Noticiero Edición Mediodía - Transmisión en Vivo',
        'DVCPRO 66L',
        'Noticiero VTV - Edición Central',
        'Archivo de Programación',
        '2024-01-15',
        '2024-01-15',
        '2',
        '01:10:00',
        'Emisión completa de noticias del mediodía',
        'Procesada e ingestada'
      ]
    ];

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...sampleRows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_archivo_audiovisual_vtv.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onAddNotification?.('Plantilla CSV descargada con éxito. Rellena los datos y vuelve a subirla.', 'success');
  };

  // CSV FILE PARSER LOGIC
  const handleCsvFileUpload = (file: File) => {
    setCsvErrorMsg(null);
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setCsvErrorMsg('El archivo seleccionado está vacío.');
        return;
      }
      parseCsvContent(text);
    };
    reader.onerror = () => {
      setCsvErrorMsg('Error al leer el archivo en el navegador.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const parseCsvContent = (text: string) => {
    try {
      const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        setCsvErrorMsg('El archivo CSV no contiene filas de datos para importar.');
        return;
      }

      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') ? ';' : ',';

      const tokenize = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === delimiter && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const rawHeaders = tokenize(lines[0]).map(h => 
        h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      );

      const getIndex = (keys: string[]) => {
        return rawHeaders.findIndex(h => keys.some(k => h.includes(k)));
      };

      const codeIdx = getIndex(['codigo', 'code', 'id']);
      const titleIdx = getIndex(['titulo', 'title', 'nombre', 'material']);
      const formatIdx = getIndex(['formato', 'format', 'soporte']);
      const programIdx = getIndex(['programa', 'program', 'serie']);
      const locationIdx = getIndex(['localizacion', 'location', 'ubicacion', 'estante', 'archivo']);
      const recDateIdx = getIndex(['fechagrabacion', 'grabacion', 'recording', 'fecha_grabacion']);
      const airDateIdx = getIndex(['fechaaire', 'aire', 'air', 'emision', 'fecha_aire']);
      const segIdx = getIndex(['segmento', 'segment', 'numero']);
      const durationIdx = getIndex(['duracion', 'time', 'tiempo', 'totaltime']);
      const synopsisIdx = getIndex(['sinopsis', 'synopsis', 'resumen', 'descripcion']);
      const obsIdx = getIndex(['observacion', 'observation', 'nota', 'comentario']);

      if (titleIdx === -1) {
        setCsvErrorMsg('No se encontró la columna de "Titulo" en el archivo CSV. Asegúrate de usar la plantilla.');
        return;
      }

      const newMaterials: PhysicalAudiovisualMaterial[] = [];
      const newFmtsMap = new Map<string, PhysicalFormat>();
      const newLocsMap = new Map<string, PhysicalLocation>();
      const newPrgsMap = new Map<string, PhysicalProgram>();

      let currentFmts = [...formats];
      let currentLocs = [...locations];
      let currentPrgs = [...programs];

      let maxCode = Math.max(1000, ...materials.map(m => m.code || 0));

      for (let i = 1; i < lines.length; i++) {
        const row = tokenize(lines[i]);
        if (row.length === 0 || row.every(cell => cell === '')) continue;

        const rawTitle = titleIdx !== -1 && row[titleIdx] ? row[titleIdx] : '';
        if (!rawTitle.trim()) continue;

        // Parse Code
        let parsedCode = 0;
        if (codeIdx !== -1 && row[codeIdx]) {
          const digitsOnly = row[codeIdx].replace(/[^0-9]/g, '');
          if (digitsOnly) parsedCode = parseInt(digitsOnly, 10);
        }
        if (!parsedCode || parsedCode <= 0) {
          maxCode++;
          parsedCode = maxCode;
        } else {
          if (parsedCode > maxCode) maxCode = parsedCode;
        }

        // Format
        const rawFmtName = formatIdx !== -1 && row[formatIdx] ? row[formatIdx].trim() : 'DVCPRO 66L';
        let matchedFmt = currentFmts.find(f => f.name.toLowerCase() === rawFmtName.toLowerCase());
        if (!matchedFmt) {
          const fmtId = `fmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          matchedFmt = { id: fmtId, name: rawFmtName };
          currentFmts.push(matchedFmt);
          newFmtsMap.set(fmtId, matchedFmt);
        }

        // Location
        const rawLocName = locationIdx !== -1 && row[locationIdx] ? row[locationIdx].trim() : 'Archivo de Programación';
        let matchedLoc = currentLocs.find(l => l.name.toLowerCase() === rawLocName.toLowerCase());
        if (!matchedLoc) {
          const locId = `loc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          matchedLoc = { id: locId, name: rawLocName };
          currentLocs.push(matchedLoc);
          newLocsMap.set(locId, matchedLoc);
        }

        // Program
        let matchedPrgId: string | undefined = undefined;
        if (programIdx !== -1 && row[programIdx] && row[programIdx].trim()) {
          const rawPrgName = row[programIdx].trim();
          let matchedPrg = currentPrgs.find(p => p.name.toLowerCase() === rawPrgName.toLowerCase());
          if (!matchedPrg) {
            const prgId = `prg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            matchedPrg = { id: prgId, name: rawPrgName };
            currentPrgs.push(matchedPrg);
            newPrgsMap.set(prgId, matchedPrg);
          }
          matchedPrgId = matchedPrg.id;
        }

        // Segment & Duration
        const rawSeg = segIdx !== -1 && row[segIdx] ? parseInt(row[segIdx].replace(/[^0-9]/g, ''), 10) : 1;
        const rawDur = durationIdx !== -1 && row[durationIdx] ? row[durationIdx].trim() : '00:30:00';

        const item: PhysicalAudiovisualMaterial = {
          id: `mat_csv_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
          code: parsedCode,
          title: rawTitle.trim(),
          formatId: matchedFmt.id,
          locationId: matchedLoc.id,
          programId: matchedPrgId,
          recordingDate: recDateIdx !== -1 && row[recDateIdx] ? row[recDateIdx].trim() : undefined,
          airDate: airDateIdx !== -1 && row[airDateIdx] ? row[airDateIdx].trim() : undefined,
          segmentNumber: isNaN(rawSeg) || rawSeg <= 0 ? 1 : rawSeg,
          totalTime: rawDur || '00:30:00',
          synopsis: synopsisIdx !== -1 && row[synopsisIdx] ? row[synopsisIdx].trim() : undefined,
          observations: obsIdx !== -1 && row[obsIdx] ? row[obsIdx].trim() : undefined,
          createdAt: new Date().toISOString(),
          createdByWorkerId: currentUserId
        };

        newMaterials.push(item);
      }

      if (newMaterials.length === 0) {
        setCsvErrorMsg('No se encontraron registros de materiales válidos para importar.');
        return;
      }

      setParsedCsvItems(newMaterials);
      setCsvNewFormats(Array.from(newFmtsMap.values()));
      setCsvNewLocations(Array.from(newLocsMap.values()));
      setCsvNewPrograms(Array.from(newPrgsMap.values()));

    } catch (err: any) {
      console.error('Error parsing CSV:', err);
      setCsvErrorMsg(`Error al procesar la estructura CSV: ${err?.message || 'Formato no reconocido'}`);
    }
  };

  // Save imported CSV batch to database
  const handleConfirmCsvImport = async () => {
    if (parsedCsvItems.length === 0) return;
    setIsProcessingCsv(true);

    try {
      // Save created formats, locations, programs
      for (const fmt of csvNewFormats) {
        await db.savePhysicalFormat(fmt);
      }
      for (const loc of csvNewLocations) {
        await db.savePhysicalLocation(loc);
      }
      for (const prg of csvNewPrograms) {
        await db.savePhysicalProgram(prg);
      }

      // Bulk save materials directly to Supabase Cloud DB
      await db.bulkSavePhysicalMaterials(parsedCsvItems);

      // Update local state
      if (csvNewFormats.length > 0) setFormats(prev => [...prev, ...csvNewFormats]);
      if (csvNewLocations.length > 0) setLocations(prev => [...prev, ...csvNewLocations]);
      if (csvNewPrograms.length > 0) setPrograms(prev => [...prev, ...csvNewPrograms]);

      setMaterials(prev => {
        const map = new Map<number, PhysicalAudiovisualMaterial>();
        [...parsedCsvItems, ...prev].forEach(m => {
          if (!map.has(m.code)) map.set(m.code, m);
        });
        return Array.from(map.values()).sort((a, b) => a.code - b.code);
      });

      onAddNotification?.(`¡Importación exitosa! Se registraron ${parsedCsvItems.length} materiales audiovisuales en la base de datos.`, 'success');

      // Reset
      setShowCsvImportModal(false);
      setParsedCsvItems([]);
      setCsvNewFormats([]);
      setCsvNewLocations([]);
      setCsvNewPrograms([]);
      setCsvFileName('');
    } catch (err: any) {
      console.error('Error confirming CSV import:', err);
      alert(`Error al guardar en la base de datos: ${err?.message || err}`);
    } finally {
      setIsProcessingCsv(false);
    }
  };

  // Filtered Materials
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const codeStr = String(m.code);
      const codeFormatted = `AA-${codeStr.padStart(6, '0')}`;
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
                  Base de Datos Cloud
                </span>
                {isLoadingDb && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 animate-pulse">
                    <RefreshCw size={10} className="animate-spin" /> Sincronizando BD...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Control, catalogación e inventario persistente de cintas y soportes audiovisuales.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={refreshFromDb}
              disabled={isLoadingDb}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              title="Recargar datos directamente desde Supabase Cloud"
            >
              <RefreshCw size={14} className={isLoadingDb ? 'animate-spin' : ''} />
              <span>Sincronizar</span>
            </button>

            <button
              onClick={downloadCSVTemplate}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-amber-300 hover:bg-slate-800 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Descargar plantilla CSV compatible con el sistema"
            >
              <Download size={15} />
              <span>Plantilla CSV</span>
            </button>

            <button
              onClick={() => {
                setShowCsvImportModal(true);
                setCsvErrorMsg(null);
                setParsedCsvItems([]);
                setCsvFileName('');
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-cyan-300 hover:bg-slate-800 border border-cyan-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Importar catálogo masivo en formato CSV"
            >
              <FileSpreadsheet size={15} />
              <span>Importar CSV</span>
            </button>

            <button
              onClick={handleOpenAddMaterial}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer"
            >
              <Plus size={16} />
              <span>Registrar Material</span>
            </button>
          </div>
        </div>

        {/* Database Connection / Table Alert Banner */}
        {(!isSupabaseConfigured || supabaseConnectionStatus === 'error' || lastSupabaseError) && (
          <div className="mt-4 p-3.5 bg-amber-950/60 border border-amber-500/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">
                  {!isSupabaseConfigured 
                    ? 'Atención: Credenciales de Supabase no configuradas'
                    : 'Aviso de Sincronización con Base de Datos Supabase'}
                </p>
                <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">
                  {!isSupabaseConfigured
                    ? 'La aplicación no posee la URL/KEY de Supabase para consultar la base de datos cloud.'
                    : (lastSupabaseError || 'Si las tablas no existen en Supabase, ejecuta el Script SQL para habilitar physical_formats, physical_locations, physical_programs y physical_materials.')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                onClick={refreshFromDb}
                className="px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-amber-300 hover:text-white font-bold text-[11px] flex items-center gap-1"
              >
                <RefreshCw size={11} className={isLoadingDb ? 'animate-spin' : ''} />
                <span>Reintentar</span>
              </button>
              <button
                onClick={() => setShowSqlModal(true)}
                className="px-3 py-1.5 bg-amber-500 text-slate-950 rounded-lg font-black text-[11px] hover:bg-amber-400 transition-all"
              >
                Ver Script SQL
              </button>
            </div>
          </div>
        )}

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
                        No se encontraron registros de material audiovisual en la base de datos con los criterios especificados.
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map(m => {
                      const fmt = formats.find(f => f.id === m.formatId);
                      const prg = programs.find(p => p.id === m.programId);
                      const loc = locations.find(l => l.id === m.locationId);
                      const codeFormatted = `AA-${String(m.code).padStart(6, '0')}`;

                      return (
                        <tr key={m.id} className="hover:bg-white/[0.02] transition-all">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              {codeFormatted}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white max-w-xs truncate" title={m.title}>
                              {m.title}
                            </div>
                            {m.synopsis && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                {m.synopsis}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 font-semibold border border-white/5 text-[11px]">
                              {fmt?.name || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                            {prg ? (
                              <span className="text-indigo-300 font-medium">{prg.name}</span>
                            ) : (
                              <span className="text-slate-500 italic">Sin Programa</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              <MapPin size={12} />
                              <span>{loc?.name || 'N/A'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                            <div className="flex flex-col text-[11px]">
                              {m.recordingDate && <span>Grab: {m.recordingDate}</span>}
                              {m.airDate && <span className="text-slate-500">Aire: {m.airDate}</span>}
                              {!m.recordingDate && !m.airDate && <span>s/f</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-center font-mono text-xs font-medium text-slate-300">
                            {m.totalTime || '00:00:00'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedDetailMaterial(m)}
                                className="p-1.5 rounded-lg bg-slate-800 text-amber-300 hover:bg-slate-700 transition-all cursor-pointer"
                                title="Ver Ficha Técnica Completa"
                              >
                                <Info size={14} />
                              </button>

                              <button
                                onClick={() => handleOpenEditMaterial(m)}
                                className="p-1.5 rounded-lg bg-slate-800 text-cyan-300 hover:bg-slate-700 transition-all cursor-pointer"
                                title="Editar Registro"
                              >
                                <Edit2 size={14} />
                              </button>

                              <button
                                onClick={() => promptDeleteMaterial(m)}
                                className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
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

      {/* SUBTAB 2: PROGRAMAS (SERIES / EMISIONES) */}
      {activeSubTab === 'programs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Catálogo de Programas y Producciones</h2>
              <p className="text-xs text-slate-400">Programas de televisión vinculables a los soportes magnéticos del archivo.</p>
            </div>
            <button
              onClick={() => {
                setEditingProgram(null);
                setProgramNameInput('');
                setProgramReleaseDateInput('');
                setShowProgramModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus size={15} />
              <span>Agregar Programa</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {programs.map(p => {
              const count = materials.filter(m => m.programId === p.id).length;
              return (
                <div key={p.id} className="p-4 bg-slate-900/90 border border-white/10 rounded-2xl flex items-center justify-between gap-3 hover:border-amber-500/30 transition-all">
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <Tv size={16} className="text-indigo-400 shrink-0" />
                      <h3 className="font-bold text-white text-xs truncate" title={p.name}>{p.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      {p.releaseDate && <span>Estreno: {p.releaseDate}</span>}
                      <span className="text-amber-400/90 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px]">
                        {count} {count === 1 ? 'material' : 'materiales'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingProgram(p);
                        setProgramNameInput(p.name);
                        setProgramReleaseDateInput(p.releaseDate || '');
                        setShowProgramModal(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => promptDeleteProgram(p)}
                      className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
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

      {/* SUBTAB 3: FORMATOS AUDIOVISUALES */}
      {activeSubTab === 'formats' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Soportes y Formatos Físicos</h2>
              <p className="text-xs text-slate-400">Listado técnico de cintas magnéticas, cartuchos, LTO y soportes ópticos/fílmicos.</p>
            </div>
            <button
              onClick={() => {
                setEditingFormat(null);
                setFormatNameInput('');
                setShowFormatModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus size={15} />
              <span>Agregar Formato</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {formats.map(f => {
              const count = materials.filter(m => m.formatId === f.id).length;
              return (
                <div key={f.id} className="p-3.5 bg-slate-900/90 border border-white/10 rounded-2xl flex items-center justify-between gap-2 hover:border-amber-500/30 transition-all">
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Disc size={14} className="text-amber-400 shrink-0" />
                      <span className="truncate" title={f.name}>{f.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                      {count} reg.
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingFormat(f);
                        setFormatNameInput(f.name);
                        setShowFormatModal(true);
                      }}
                      className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => promptDeleteFormat(f)}
                      className="p-1 rounded bg-slate-800 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
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

      {/* SUBTAB 4: LOCALIZACIONES FÍSICAS */}
      {activeSubTab === 'locations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Ubicaciones y Bóvedas del Archivo</h2>
              <p className="text-xs text-slate-400">Espacios físicos, estantes, depósitos y librerías automatizadas.</p>
            </div>
            {canManageLocations ? (
              <button
                onClick={() => {
                  setEditingLocation(null);
                  setLocationNameInput('');
                  setShowLocationModal(true);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus size={15} />
                <span>Agregar Ubicación</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                <Lock size={13} />
                <span>Modificación restringida a Jefatura</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {locations.map(l => {
              const count = materials.filter(m => m.locationId === l.id).length;
              return (
                <div key={l.id} className="p-4 bg-slate-900/90 border border-white/10 rounded-2xl flex items-center justify-between gap-3 hover:border-amber-500/30 transition-all">
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <MapPin size={16} className="shrink-0" />
                      <h3 className="truncate" title={l.name}>{l.name}</h3>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono block">
                      {count} {count === 1 ? 'material resguardado' : 'materiales resguardados'}
                    </span>
                  </div>

                  {canManageLocations && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingLocation(l);
                          setLocationNameInput(l.name);
                          setShowLocationModal(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => promptDeleteLocation(l)}
                        className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
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

      {/* MODAL 1: REGISTER / EDIT AUDIOVISUAL MATERIAL */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-thin">
            <button
              onClick={() => setShowMaterialModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <FolderArchive size={20} />
              </div>
              <div>
                <h3 className="font-black text-white text-base">
                  {editingMaterial ? 'Editar Material Audiovisual' : 'Nuevo Registro de Archivo Físico'}
                </h3>
                <p className="text-xs text-slate-400">Catálogo de patrimonio audiovisual e inventario físico de la planta.</p>
              </div>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Código Físico Progresivo
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-mono font-bold text-amber-400">AA-</span>
                    <input
                      type="number"
                      required
                      min={1000}
                      value={matCodeInput}
                      onChange={(e) => setMatCodeInput(parseInt(e.target.value) || 1001)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Título / Nombre del Material *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Discurso de Transmisión Especial..."
                    value={matTitleInput}
                    onChange={(e) => setMatTitleInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Formato / Soporte *
                  </label>
                  <select
                    value={matFormatIdInput}
                    onChange={(e) => setMatFormatIdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {formats.map(f => (
                      <option key={f.id} value={f.id} className="bg-slate-900">{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Localización Física *
                  </label>
                  <select
                    value={matLocationIdInput}
                    onChange={(e) => setMatLocationIdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {locations.map(l => (
                      <option key={l.id} value={l.id} className="bg-slate-900">{l.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Programa Vinculado
                  </label>
                  <select
                    value={matProgramIdInput}
                    onChange={(e) => setMatProgramIdInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900">-- Ninguno (Sin programa) --</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Fecha Grabación
                  </label>
                  <input
                    type="date"
                    value={matRecordingDateInput}
                    onChange={(e) => setMatRecordingDateInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Fecha Emisión / Aire
                  </label>
                  <input
                    type="date"
                    value={matAirDateInput}
                    onChange={(e) => setMatAirDateInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    N° Segmento
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={matSegmentInput}
                    onChange={(e) => setMatSegmentInput(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Duración (HH:MM:SS)
                  </label>
                  <input
                    type="text"
                    placeholder="00:45:00"
                    value={matTotalTimeInput}
                    onChange={(e) => setMatTotalTimeInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Sinopsis / Contenido Informativo
                </label>
                <textarea
                  rows={2}
                  placeholder="Resumen del contenido grabado en el soporte..."
                  value={matSynopsisInput}
                  onChange={(e) => setMatSynopsisInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Observaciones Técnicas / Estado de Conservación
                </label>
                <textarea
                  rows={2}
                  placeholder="Estado físico del soporte, código de caja o anotaciones de cinta..."
                  value={matObservationsInput}
                  onChange={(e) => setMatObservationsInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
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
                  {editingMaterial ? 'Guardar Cambios' : 'Registrar en BD Cloud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CSV IMPORT & TEMPLATE DOWNLOAD SYSTEM */}
      {showCsvImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-3xl w-full space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-thin">
            <button
              onClick={() => setShowCsvImportModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h3 className="font-black text-white text-base">Importación Masiva de Archivo CSV</h3>
                <p className="text-xs text-slate-400">Carga inventarios completos de cintas y soportes sincronizados a la base de datos.</p>
              </div>
            </div>

            {/* Template Download Prompt */}
            <div className="p-3.5 bg-slate-950/90 rounded-xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <FileText className="text-amber-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <span className="font-bold text-white block">¿No tienes el formato correcto?</span>
                  <span className="text-slate-400 text-[11px]">
                    Descarga la plantilla CSV oficial estructurada con todas las columnas necesarias.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={downloadCSVTemplate}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 font-bold transition-all text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Download size={14} />
                <span>Descargar Plantilla CSV</span>
              </button>
            </div>

            {/* Upload File Zone */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-200">
                Selecciona o arrastra tu archivo .CSV
              </label>
              <div className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/60 rounded-2xl p-6 bg-slate-950/50 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCsvFileUpload(file);
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload size={32} className="text-cyan-400 mb-2" />
                <span className="text-xs font-bold text-white">Haz clic aquí para seleccionar tu archivo CSV</span>
                <span className="text-[11px] text-slate-400 mt-1">Soporta codificación UTF-8 y delimitadores por coma (,) o punto y coma (;)</span>
              </div>
            </div>

            {/* Error Display */}
            {csvErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{csvErrorMsg}</span>
              </div>
            )}

            {/* Parsed Preview Table */}
            {parsedCsvItems.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      Vista previa de datos extraídos ({parsedCsvItems.length} materiales listos)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {csvFileName}
                  </span>
                </div>

                {(csvNewFormats.length > 0 || csvNewLocations.length > 0 || csvNewPrograms.length > 0) && (
                  <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/30 text-xs text-indigo-200 space-y-1">
                    <span className="font-bold block text-indigo-300">Nuevos registros detectados que se crearán automáticamente:</span>
                    <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5">
                      {csvNewFormats.length > 0 && <li>Formatos: {csvNewFormats.map(f => f.name).join(', ')}</li>}
                      {csvNewLocations.length > 0 && <li>Ubicaciones: {csvNewLocations.map(l => l.name).join(', ')}</li>}
                      {csvNewPrograms.length > 0 && <li>Programas: {csvNewPrograms.map(p => p.name).join(', ')}</li>}
                    </ul>
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto border border-white/10 rounded-xl bg-slate-950/80">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 font-bold border-b border-white/10 sticky top-0">
                        <th className="py-2 px-3">Código</th>
                        <th className="py-2 px-3">Título</th>
                        <th className="py-2 px-3">Formato</th>
                        <th className="py-2 px-3">Ubicación</th>
                        <th className="py-2 px-3">Duración</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {parsedCsvItems.slice(0, 15).map((item, idx) => {
                        const fmtName = formats.find(f => f.id === item.formatId)?.name || csvNewFormats.find(f => f.id === item.formatId)?.name || 'N/A';
                        const locName = locations.find(l => l.id === item.locationId)?.name || csvNewLocations.find(l => l.id === item.locationId)?.name || 'N/A';
                        return (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="py-1.5 px-3 font-mono font-bold text-amber-300">
                              AA-{String(item.code).padStart(6, '0')}
                            </td>
                            <td className="py-1.5 px-3 font-bold text-white max-w-xs truncate">{item.title}</td>
                            <td className="py-1.5 px-3">{fmtName}</td>
                            <td className="py-1.5 px-3 text-emerald-400">{locName}</td>
                            <td className="py-1.5 px-3 font-mono">{item.totalTime}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {parsedCsvItems.length > 15 && (
                    <div className="p-2 text-center text-[10px] text-slate-500 italic bg-slate-900/50">
                      Y {parsedCsvItems.length - 15} materiales adicionales...
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowCsvImportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={parsedCsvItems.length === 0 || isProcessingCsv}
                onClick={handleConfirmCsvImport}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                  parsedCsvItems.length === 0 || isProcessingCsv
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-extrabold'
                }`}
              >
                {isProcessingCsv && <RefreshCw size={14} className="animate-spin" />}
                <span>
                  {isProcessingCsv ? 'Guardando en Base de Datos...' : `Confirmar e Importar ${parsedCsvItems.length} Registros`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD/EDIT FORMAT */}
      {showFormatModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowFormatModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <Disc size={22} className="text-amber-400" />
              <div>
                <h3 className="font-black text-white text-base">
                  {editingFormat ? 'Editar Formato' : 'Nuevo Formato Audiovisual'}
                </h3>
                <p className="text-xs text-slate-400">Tipo de cinta o soporte físico magnético/digital.</p>
              </div>
            </div>

            <form onSubmit={handleSaveFormat} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Nombre del Formato *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. DVCPRO 126L, LTO 9, Betacam SP..."
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

      {/* MODAL 4: ADD/EDIT PROGRAM */}
      {showProgramModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowProgramModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <Tv size={22} className="text-amber-400" />
              <div>
                <h3 className="font-black text-white text-base">
                  {editingProgram ? 'Editar Programa' : 'Nuevo Programa de Televisión'}
                </h3>
                <p className="text-xs text-slate-400">Producción asociada a los contenidos del archivo.</p>
              </div>
            </div>

            <form onSubmit={handleSaveProgram} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Nombre del Programa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Noticiero VTV - Edición Central..."
                  value={programNameInput}
                  onChange={(e) => setProgramNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Fecha de Primera Emisión / Estreno
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

      {/* MODAL 5: ADD/EDIT LOCATION */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowLocationModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <MapPin size={22} className="text-amber-400" />
              <div>
                <h3 className="font-black text-white text-base">
                  {editingLocation ? 'Editar Ubicación' : 'Nueva Localización Física'}
                </h3>
                <p className="text-xs text-slate-400">Bóveda o depósito físico de resguardo.</p>
              </div>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Nombre de la Ubicación / Bóveda *
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

      {/* MODAL 6: DETAILED TECH SPEC SHEET (FICHA TÉCNICA) */}
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
                AA-{String(selectedDetailMaterial.code).padStart(6, '0')}
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

      {/* MODAL 7: CUSTOM DELETION CONFIRMATION DIALOG */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-scaleIn">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-black text-white text-base">Confirmar Eliminación</h3>
                <p className="text-xs text-slate-400">Esta acción removerá el registro de la base de datos.</p>
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

      {/* SQL SCHEMA & SETUP MODAL */}
      {showSqlModal && (
        <DatabaseSchema onClose={() => setShowSqlModal(false)} />
      )}
    </div>
  );
};

export default PhysicalArchive;
