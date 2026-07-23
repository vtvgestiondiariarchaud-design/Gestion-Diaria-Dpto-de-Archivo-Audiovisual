export type UserRole = 'superadmin' | 'coordinator' | 'worker' | 'deputy';

export interface Division {
  id: string;
  name: string;
  description: string;
  coordinatorId: string | null;
  coordinatorName: string | null;
}

export interface Worker {
  id: string;
  name: string;
  email: string;
  cargo: string;
  divisionId: string;
  role: UserRole;
  cedula?: string;
  password?: string;
  mustChangePassword?: boolean;
  fixedShift?: ShiftType;
  vacationStart?: string; // YYYY-MM-DD
  vacationEnd?: string; // YYYY-MM-DD
  manualFreeDaysAdjustment?: number;
  mealsPreference?: {
    desayuno: boolean;
    almuerzo: boolean;
    cena: boolean;
  };
}

export type ShiftType = 'pool' | 'manana' | 'tarde' | 'noche' | 'libre';

export interface ShiftAssignment {
  id: string;
  workerId: string;
  divisionId: string;
  date: string; // YYYY-MM-DD
  shiftType: ShiftType;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  divisionId: string;
  // Map of workerId to their shift type
  assignments: Record<string, ShiftType>;
}

export interface ShiftChangeRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  targetWorkerId: string;
  targetWorkerName: string;
  divisionId: string;
  date: string; // YYYY-MM-DD
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface ComedorCount {
  desayuno: number;
  almuerzo: number;
  cena: number;
}

export interface DivisionComedorDetails extends ComedorCount {
  divisionName: string;
  workers: Array<{
    name: string;
    cargo: string;
    currentShift: ShiftType;
    previousShift: ShiftType;
    meals: {
      desayuno: boolean;
      almuerzo: boolean;
      cena: boolean;
    };
  }>;
}

// Task System Types
export type TaskStatus = 'Ingestado' | 'Editado' | 'Archivando' | 'Evaluacion Pendiente' | 'Pendiente' | 'Finalizado';

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TaskHistoryItem {
  id: string;
  fromStatus?: TaskStatus;
  toStatus: TaskStatus;
  changedByWorkerId?: string;
  changedByName?: string;
  timestamp: string;
}

export interface TaskCard {
  id: string;
  boardId: string;
  divisionId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  startDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  assignedWorkerIds: string[];
  checklist: TaskChecklistItem[];
  createdAt: string;
  createdByWorkerId?: string;
  createdByName?: string;
  priority?: 'baja' | 'media' | 'alta' | 'urgente';
  isGerenciaOnly?: boolean;
  duration?: string; // Duración del material en formato HH:MM:SS
  history?: TaskHistoryItem[];
}

export interface TaskBoard {
  id: string;
  name: string;
  description?: string;
  color?: string;
  divisionId?: string;
  createdAt: string;
}

export interface TaskNotification {
  id: string;
  workerId: string; // Recipient worker ID
  taskId: string;
  taskTitle: string;
  boardName: string;
  message: string;
  createdAt: string;
  read: boolean;
}

