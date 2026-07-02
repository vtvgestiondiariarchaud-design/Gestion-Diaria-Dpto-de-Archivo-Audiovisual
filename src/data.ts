import { Division, Worker, ShiftAssignment, ShiftChangeRequest, ShiftType } from './types';

export const INITIAL_DIVISIONS: Division[] = [
  {
    id: 'div_archivo',
    name: 'Archivo Audiovisual',
    description: 'Gestión, digitalización y catalogación del patrimonio de video histórico de la planta televisiva.',
    coordinatorId: 'coord_marcos',
    coordinatorName: 'Marcos Peña'
  },
  {
    id: 'div_edicion',
    name: 'Edición de Video',
    description: 'Montaje, postproducción de guardia y procesamiento de notas de prensa y programas especiales.',
    coordinatorId: 'coord_elena',
    coordinatorName: 'Elena Rostova'
  },
  {
    id: 'div_resguardo',
    name: 'Resguardo de Video',
    description: 'Custodia física, backup de cintas LTO, servidores de almacenamiento masivo SAN/NAS y copias de seguridad de transmisiones.',
    coordinatorId: 'coord_gabriel',
    coordinatorName: 'Gabriel Sanoja'
  },
  {
    id: 'div_noticias',
    name: 'Operaciones de Noticias',
    description: 'Soporte técnico inmediato a las transmisiones en vivo y edición veloz para avances informativos.',
    coordinatorId: 'coord_ricardo',
    coordinatorName: 'Ricardo Méndez'
  }
];

export const INITIAL_WORKERS: Worker[] = [
  // Archivo Audiovisual
  { id: 'work_1', name: 'Carlos Mendoza', email: 'carlos.m@vtv.gob.ve', cargo: 'Archivista de cintas LTO', divisionId: 'div_archivo', role: 'worker' },
  { id: 'work_2', name: 'Adriana Silva', email: 'adriana.s@vtv.gob.ve', cargo: 'Digitalizadora Betacam/U-matic', divisionId: 'div_archivo', role: 'worker' },
  { id: 'work_3', name: 'Jesús Rondón', email: 'jesus.r@vtv.gob.ve', cargo: 'Catalogador de Metadatos', divisionId: 'div_archivo', role: 'worker' },
  { id: 'work_4', name: 'Milagros Vegas', email: 'milagros.v@vtv.gob.ve', cargo: 'Restauradora de Video Analógico', divisionId: 'div_archivo', role: 'worker' },
  { id: 'work_5', name: 'Luis Altuve', email: 'luis.a@vtv.gob.ve', cargo: 'Técnico de Ingesta Audiovisual', divisionId: 'div_archivo', role: 'worker' },

  // Edición
  { id: 'work_6', name: 'Yusmeri Blanco', email: 'yusmeri.b@vtv.gob.ve', cargo: 'Editora de Guardia Principal', divisionId: 'div_edicion', role: 'worker' },
  { id: 'work_7', name: 'Alejandro Colina', email: 'alejandro.c@vtv.gob.ve', cargo: 'Postproductor de Noticias', divisionId: 'div_edicion', role: 'worker' },
  { id: 'work_8', name: 'Sofía Martínez', email: 'sofia.m@vtv.gob.ve', cargo: 'Editora de Programas Especiales', divisionId: 'div_edicion', role: 'worker' },
  { id: 'work_9', name: 'José Gregorio Rivas', email: 'jose.r@vtv.gob.ve', cargo: 'Montajista de Archivo Crítico', divisionId: 'div_edicion', role: 'worker' },
  { id: 'work_10', name: 'Katiuska Díaz', email: 'katiuska.d@vtv.gob.ve', cargo: 'Editora Colorista', divisionId: 'div_edicion', role: 'worker' },

  // Resguardo
  { id: 'work_11', name: 'Nelson Pineda', email: 'nelson.p@vtv.gob.ve', cargo: 'Administrador de Almacenamiento NAS/SAN', divisionId: 'div_resguardo', role: 'worker' },
  { id: 'work_12', name: 'Beatriz Ochoa', email: 'beatriz.o@vtv.gob.ve', cargo: 'Operadora de Servidores de Resguardo', divisionId: 'div_resguardo', role: 'worker' },
  { id: 'work_13', name: 'Frank Zambrano', email: 'frank.z@vtv.gob.ve', cargo: 'Especialista en Backups LTO-9', divisionId: 'div_resguardo', role: 'worker' },
  { id: 'work_14', name: 'Gabriela Toro', email: 'gabriela.t@vtv.gob.ve', cargo: 'Ingeniera de Redes Audiovisuales', divisionId: 'div_resguardo', role: 'worker' },

  // Noticias
  { id: 'work_15', name: 'Héctor Guerra', email: 'hector.g@vtv.gob.ve', cargo: 'Editor de Avances Informativos', divisionId: 'div_noticias', role: 'worker' },
  { id: 'work_16', name: 'Patricia Laya', email: 'patricia.l@vtv.gob.ve', cargo: 'Operadora de Ingesta de Corresponsalías', divisionId: 'div_noticias', role: 'worker' }
];

// Default Coordinators
export const COORDINATORS = [
  { id: 'coord_marcos', name: 'Marcos Peña', email: 'marcos.p@vtv.gob.ve', divisionId: 'div_archivo', role: 'coordinator' },
  { id: 'coord_elena', name: 'Elena Rostova', email: 'elena.r@vtv.gob.ve', divisionId: 'div_edicion', role: 'coordinator' },
  { id: 'coord_gabriel', name: 'Gabriel Sanoja', email: 'gabriel.s@vtv.gob.ve', divisionId: 'div_resguardo', role: 'coordinator' },
  { id: 'coord_ricardo', name: 'Ricardo Méndez', email: 'ricardo.m@vtv.gob.ve', divisionId: 'div_noticias', role: 'coordinator' }
];

// Predefined yesterday assignments (needed for Comedor calculations of salientes de noche anterior)
// To keep things simple, we provide a deterministic way to look up what yesterday's shifts were.
export const getYesterdayShift = (workerId: string): ShiftType => {
  // Let's seed a few workers with Night Shifts yesterday, so they qualify for today's Breakfast
  const nightWorkersYesterday = ['work_2', 'work_7', 'work_12', 'work_15'];
  const morningWorkersYesterday = ['work_3', 'work_8', 'work_11'];
  
  if (nightWorkersYesterday.includes(workerId)) return 'noche';
  if (morningWorkersYesterday.includes(workerId)) return 'manana';
  return 'libre';
};

// Seed initial today's assignments
export const getInitialAssignments = (dateStr: string): ShiftAssignment[] => {
  const assignments: ShiftAssignment[] = [];
  
  // Archivo Audiovisual
  assignments.push({ id: `as_1_${dateStr}`, workerId: 'work_1', divisionId: 'div_archivo', date: dateStr, shiftType: 'manana' });
  assignments.push({ id: `as_2_${dateStr}`, workerId: 'work_2', divisionId: 'div_archivo', date: dateStr, shiftType: 'manana' });
  assignments.push({ id: `as_3_${dateStr}`, workerId: 'work_3', divisionId: 'div_archivo', date: dateStr, shiftType: 'tarde' });
  assignments.push({ id: `as_4_${dateStr}`, workerId: 'work_4', divisionId: 'div_archivo', date: dateStr, shiftType: 'noche' });
  assignments.push({ id: `as_5_${dateStr}`, workerId: 'work_5', divisionId: 'div_archivo', date: dateStr, shiftType: 'libre' });

  // Edición de Video
  assignments.push({ id: `as_6_${dateStr}`, workerId: 'work_6', divisionId: 'div_edicion', date: dateStr, shiftType: 'manana' });
  assignments.push({ id: `as_7_${dateStr}`, workerId: 'work_7', divisionId: 'div_edicion', date: dateStr, shiftType: 'tarde' });
  assignments.push({ id: `as_8_${dateStr}`, workerId: 'work_8', divisionId: 'div_edicion', date: dateStr, shiftType: 'noche' });
  assignments.push({ id: `as_9_${dateStr}`, workerId: 'work_9', divisionId: 'div_edicion', date: dateStr, shiftType: 'libre' });
  assignments.push({ id: `as_10_${dateStr}`, workerId: 'work_10', divisionId: 'div_edicion', date: dateStr, shiftType: 'pool' });

  // Resguardo
  assignments.push({ id: `as_11_${dateStr}`, workerId: 'work_11', divisionId: 'div_resguardo', date: dateStr, shiftType: 'manana' });
  assignments.push({ id: `as_12_${dateStr}`, workerId: 'work_12', divisionId: 'div_resguardo', date: dateStr, shiftType: 'tarde' });
  assignments.push({ id: `as_13_${dateStr}`, workerId: 'work_13', divisionId: 'div_resguardo', date: dateStr, shiftType: 'noche' });
  assignments.push({ id: `as_14_${dateStr}`, workerId: 'work_14', divisionId: 'div_resguardo', date: dateStr, shiftType: 'libre' });

  // Noticias
  assignments.push({ id: `as_15_${dateStr}`, workerId: 'work_15', divisionId: 'div_noticias', date: dateStr, shiftType: 'manana' });
  assignments.push({ id: `as_16_${dateStr}`, workerId: 'work_16', divisionId: 'div_noticias', date: dateStr, shiftType: 'tarde' });

  return assignments;
};

// Seed initial Shift Change Requests
export const getInitialShiftRequests = (dateStr: string): ShiftChangeRequest[] => {
  return [
    {
      id: 'req_1',
      requesterId: 'work_5',
      requesterName: 'Luis Altuve',
      targetWorkerId: 'work_1',
      targetWorkerName: 'Carlos Mendoza',
      divisionId: 'div_archivo',
      date: dateStr,
      reason: 'Asunto médico familiar en la mañana. Solicito cambiar mi día libre por el Turno Mañana de Carlos.',
      status: 'pending',
      createdAt: new Date().toISOString()
    },
    {
      id: 'req_2',
      requesterId: 'work_10',
      requesterName: 'Katiuska Díaz',
      targetWorkerId: 'work_6',
      targetWorkerName: 'Yusmeri Blanco',
      divisionId: 'div_edicion',
      date: dateStr,
      reason: 'Guardia de fin de semana pendiente por compensar. Prefiero asumir la mañana.',
      status: 'approved',
      createdAt: new Date().toISOString()
    }
  ];
};

// LocalStorage helpers
export const loadState = <T>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved) as T;
    }
  } catch (e) {
    console.error('Error reading from localStorage', e);
  }
  return defaultValue;
};

export const saveState = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error writing to localStorage', e);
  }
};
