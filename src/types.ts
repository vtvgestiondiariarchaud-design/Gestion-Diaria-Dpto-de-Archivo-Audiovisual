export type DivisionType = 'Prensa' | 'Programación' | 'Ingesta' | 'Gerencia';

export type SignalType = 'Limpio' | 'Insert' | 'Master';

export type MaterialStatus = 'Registrado' | 'Por Archivar' | 'Finalizado';

export type RoleType = 
  | 'Gerente de Archivo'
  | 'Adjunta de Gerencia'
  | 'Asistente Administrativa'
  | 'Jefe de División'
  | 'Coordinador';

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
  creatorRole: string;
  status: MaterialStatus;

  // Independent Booleans
  isIngested: boolean;   // Ingestado
  isCataloged: boolean;  // Para Archivar / Catalogado
  isFinalized: boolean;  // Finalizado

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

export interface AppState {
  currentUser: UserProfile;
  materials: MaterialSignal[];
  personnel: Personnel[];
  guardShifts: GuardShiftRecord[];
  appsScriptUrl: string;
  isSyncing: boolean;
  lastSyncTime?: string;
}
