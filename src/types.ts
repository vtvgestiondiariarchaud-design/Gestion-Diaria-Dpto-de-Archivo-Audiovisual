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
