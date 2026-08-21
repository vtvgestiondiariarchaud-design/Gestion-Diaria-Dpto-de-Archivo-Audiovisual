export type DivisionType = 'Prensa' | 'Programación' | 'Ingesta' | 'Gerencia';

export type SignalType = 'Limpio' | 'Insert' | 'Master' | string;

export type MaterialStatus = 'Registrado' | 'Por Archivar' | 'Finalizado' | 'Descartado';

export type RoleType = 
  | 'Gerente de Archivo'
  | 'Adjunta de Gerencia'
  | 'Asistente Administrativa'
  | 'Jefe de División'
  | 'Coordinador'
  | 'Documentalista'
  | 'Ingestador'
  | 'Operador de Ingesta';

export interface UserProfile {
  id: string;
  name: string;
  role: RoleType;
  division?: DivisionType;
  avatar?: string;
}

export interface MaterialSignal {
  id: string; // e.g., MAT-2026-001
  familyId: string; // e.g., FAM-2026-101
  signalType: SignalType;
  title: string;
  division: DivisionType;
  duration: string; // HH:MM:SS format
  creationDate: string; // YYYY-MM-DD
  createdBy: string;
  createdByRole?: string;
  creatorRole?: string;
  status: MaterialStatus;

  // Assignment fields
  assignedTo?: string;       // User Name assigned to document the material
  assignedToRole?: string;   // Role of assigned user
  assignedAt?: string;       // Date/Time when assigned
  assignedPersons?: string[]; // Array of multiple assigned user names

  // Category & Requests
  isRequestTask?: boolean;   // True if item belongs to "Solicitudes y otras tareas"

  // Independent Booleans
  isIngested: boolean;   // Ingestado (sigue sumando horas ingestadas aunque esté descartado)
  ingestedBy?: string;   // Operador de Ingesta
  ingestedAt?: string;   // Fecha y hora de Ingesta
  isCataloged: boolean;  // Para Archivar / Catalogado
  isFinalized: boolean;  // Finalizado
  isDiscarded?: boolean; // Descartado (no cuenta como tarea para archivar pero sí suma horas ingestadas)

  notes?: string;
  
  // Cataloging Audit
  catalogedBy?: string;
  catalogedAt?: string; // ISO string or timestamp
  
  // Finalized Audit
  finalizedBy?: string;
  finalizedAt?: string; // ISO string or timestamp
}

export interface MaterialFamilyGroup {
  familyId: string;
  title: string;
  division: DivisionType;
  creationDate: string;
  createdBy: string;
  signals: MaterialSignal[];
  totalDurationSeconds: number;
  overallStatus: MaterialStatus;
  
  // Aggregated Booleans
  hasIngested: boolean;
  hasCataloged: boolean;
  isAllFinalized: boolean;
  hasFinalizedSignal: boolean;
  isAllDiscarded?: boolean;
}

export type ShiftType = 'Guardia (Fin de semana/Feriado)' | 'Día Libre' | 'Vacaciones';

export interface GuardShiftRecord {
  id: string;
  personnelId: string;
  personnelName: string;
  division: DivisionType;
  date: string; // YYYY-MM-DD (Start date or single date)
  endDate?: string; // YYYY-MM-DD (End date for vacation range)
  shiftType: ShiftType;
  assignedBy: string;
  isLead?: boolean; // True if designated as Encargado/Lead of the shift
  notes?: string;
  createdAt: string;
}

export interface Personnel {
  id: string;
  name: string;
  role: RoleType;
  division: DivisionType;
  guardDaysWorked: number;
  daysOffGenerated: number;
  daysOffTaken: number;
  balanceDays: number;
  pin?: string;
}

export interface MonthlyArchiveLog {
  id: string; // e.g. MAR-2026-08-001
  monthPeriod: string; // e.g. "Agosto 2026"
  exportDate: string; // ISO or YYYY-MM-DD HH:mm
  exportedBy: string; // User Name
  exporterRole: string; // User Role
  materialsCount: number;
  totalDurationSeconds: number;
  formattedDuration: string;
  divisionBreakdown: Record<string, { count: number; seconds: number }>;
  exportedItems: {
    id: string;
    familyId: string;
    title: string;
    division: string;
    signalType: string;
    duration: string;
  }[];
}

export interface BackupSnapshot {
  id: string;
  timestamp: string;
  note: string;
  materialsCount: number;
  personnelCount: number;
  shiftsCount: number;
  materials: MaterialSignal[];
  personnel: Personnel[];
  guardShifts: GuardShiftRecord[];
  monthlyArchives?: MonthlyArchiveLog[];
}

export interface AppState {
  currentUser: UserProfile;
  materials: MaterialSignal[];
  personnel: Personnel[];
  guardShifts: GuardShiftRecord[];
  monthlyArchives?: MonthlyArchiveLog[];
  appsScriptUrl: string;
  isSyncing: boolean;
  lastSyncTime?: string;
  syncError?: string;
}
