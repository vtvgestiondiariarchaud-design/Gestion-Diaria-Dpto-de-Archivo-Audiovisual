import { createClient } from '@supabase/supabase-js';
import { Division, Worker, ShiftAssignment, ShiftChangeRequest, ShiftType, TaskBoard, TaskCard, TaskNotification } from './types';

// Read values from env if available
// @ts-ignore
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
// @ts-ignore
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export let supabaseConnectionStatus: 'connected' | 'error' | 'not_configured' = isSupabaseConfigured ? 'connected' : 'not_configured';
export let lastSupabaseError: string | null = null;

export function setSupabaseConnectionStatus(status: 'connected' | 'error' | 'not_configured', errorMsg: string | null = null) {
  supabaseConnectionStatus = status;
  lastSupabaseError = errorMsg;
}

// Real client (will be initialized if configured, can be re-assigned dynamically)
export let supabase = isSupabaseConfigured 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

export function initSupabaseClient(url: string, key: string) {
  if (url && key) {
    supabase = createClient(url, key);
    setSupabaseConnectionStatus('connected');
  } else {
    supabase = null;
    setSupabaseConnectionStatus('not_configured');
  }
}

// Default initial divisions that should always exist for registration
export const DEFAULT_DIVISIONS: Division[] = [
  {
    id: 'div_archivo_prensa',
    name: 'Archivo de Prensa',
    description: 'Gestión, clasificación y resguardo del material audiovisual y notas informativas del área de prensa y noticias.',
    coordinatorId: null,
    coordinatorName: null
  },
  {
    id: 'div_archivo_programacion',
    name: 'Archivo de Programacion',
    description: 'Catalogación, digitalización e inventario de programas, documentales y transmisiones especiales de la planta televisiva.',
    coordinatorId: null,
    coordinatorName: null
  },
  {
    id: 'div_ingesta',
    name: 'Ingesta',
    description: 'Recepción, control de calidad, transferencia y almacenamiento primario de contenidos y aportes de corresponsalías.',
    coordinatorId: null,
    coordinatorName: null
  }
];

// Helper to generate a clean SQL Script for the user to run in Supabase SQL Editor
export const getSupabaseSQLScript = (): string => {
  return `-- SQL SCRIPT COMPLETO Y ULTRA-ROBUSTO PARA SUPABASE (VTV)
-- Copia y ejecuta todo este script en el SQL Editor de Supabase (https://app.supabase.com -> SQL Editor).
-- Habilita tablas para Turnos, Comedor, Tareas/Procesos, Columnas de Duración y Permisos Totales.

-- 1. Crear tabla de divisiones
create table if not exists divisions (
  id text primary key,
  name text not null,
  description text,
  coordinator_id text,
  coordinator_name text
);

alter table divisions add column if not exists description text;
alter table divisions add column if not exists coordinator_id text;
alter table divisions add column if not exists coordinator_name text;

-- 2. Crear tabla de trabajadores (workers)
create table if not exists workers (
  id text primary key,
  name text not null,
  email text not null unique,
  cargo text not null,
  division_id text,
  role text not null default 'worker',
  cedula text,
  password text,
  meals_preference text,
  must_change_password boolean default false,
  fixed_shift text default 'pool',
  vacation_start text,
  vacation_end text,
  manual_free_days_adjustment integer default 0
);

alter table workers add column if not exists role text not null default 'worker';
alter table workers add column if not exists cedula text;
alter table workers add column if not exists password text;
alter table workers add column if not exists meals_preference text;
alter table workers add column if not exists division_id text;
alter table workers add column if not exists must_change_password boolean default false;
alter table workers add column if not exists fixed_shift text default 'pool';
alter table workers add column if not exists vacation_start text;
alter table workers add column if not exists vacation_end text;
alter table workers add column if not exists manual_free_days_adjustment integer default 0;

-- 3. Crear tabla de asignaciones de turnos (shift_assignments)
create table if not exists shift_assignments (
  id text primary key,
  worker_id text,
  division_id text,
  date date not null,
  shift_type text not null
);

alter table shift_assignments add column if not exists shift_type text;
alter table shift_assignments add column if not exists worker_id text;
alter table shift_assignments add column if not exists division_id text;

-- 4. Crear tabla de solicitudes de cambio de guardia (shift_change_requests)
create table if not exists shift_change_requests (
  id text primary key,
  requester_id text,
  requester_name text not null,
  target_worker_id text,
  target_worker_name text not null,
  division_id text,
  date date not null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table shift_change_requests add column if not exists status text not null default 'pending';
alter table shift_change_requests add column if not exists created_at timestamp with time zone default timezone('utc'::text, now());

-- 5. Crear tablas para el Gestor de Tareas y Procesos Audiovisuales (Task Boards, Cards, History & Notifications)
create table if not exists task_boards (
  id text primary key,
  name text not null,
  description text,
  color text,
  division_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table task_boards add column if not exists description text;
alter table task_boards add column if not exists color text;
alter table task_boards add column if not exists division_id text;

create table if not exists task_cards (
  id text primary key,
  board_id text,
  division_id text,
  title text not null,
  description text,
  status text not null default 'Pendiente', -- Estados: Pendiente, Ingestado, Editado, Archivando, Evaluacion Pendiente, Finalizado
  start_date text,
  due_date text,
  assigned_worker_ids text, -- JSON string
  checklist text, -- JSON string
  priority text default 'media',
  is_gerencia_only boolean default false,
  duration text default '00:00:00',
  created_by_worker_id text,
  created_by_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table task_cards add column if not exists board_id text;
alter table task_cards add column if not exists division_id text;
alter table task_cards add column if not exists title text;
alter table task_cards add column if not exists description text;
alter table task_cards add column if not exists status text default 'Pendiente';
alter table task_cards add column if not exists start_date text;
alter table task_cards add column if not exists due_date text;
alter table task_cards add column if not exists assigned_worker_ids text;
alter table task_cards add column if not exists checklist text;
alter table task_cards add column if not exists priority text default 'media';
alter table task_cards add column if not exists is_gerencia_only boolean default false;
alter table task_cards add column if not exists duration text default '00:00:00';
alter table task_cards add column if not exists created_by_worker_id text;
alter table task_cards add column if not exists created_by_name text;

create table if not exists task_history (
  id text primary key,
  task_id text,
  from_status text,
  to_status text not null,
  changed_by_worker_id text,
  changed_by_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists task_notifications (
  id text primary key,
  worker_id text,
  task_id text,
  task_title text,
  board_name text,
  message text not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Insertar divisiones por defecto de VTV (Evita duplicados)
insert into divisions (id, name, description) values
('div_archivo_prensa', 'Archivo de Prensa', 'Gestión, clasificación y resguardo del material audiovisual y notas informativas del área de prensa y noticias.'),
('div_archivo_programacion', 'Archivo de Programacion', 'Catalogación, digitalización e inventario de programas, documentales y transmisiones especiales de la planta televisiva.'),
('div_ingesta', 'Ingesta', 'Recepción, control de calidad, transferencia y almacenamiento primario de contenidos y aportes de corresponsalías.')
on conflict (id) do update set 
  name = excluded.name,
  description = excluded.description;

-- 7. DESACTIVAR DE MANERA ABSOLUTA EL ROW-LEVEL SECURITY (RLS)
alter table divisions disable row level security;
alter table workers disable row level security;
alter table shift_assignments disable row level security;
alter table shift_change_requests disable row level security;
alter table task_boards disable row level security;
alter table task_cards disable row level security;
alter table task_history disable row level security;
alter table task_notifications disable row level security;

-- 8. CONCEDER PERMISOS TOTALES DE LECTURA Y ESCRITURA AL ROL PÚBLICO (ANON) Y AUTENTICADO
grant all privileges on table divisions to anon, authenticated, postgres;
grant all privileges on table workers to anon, authenticated, postgres;
grant all privileges on table shift_assignments to anon, authenticated, postgres;
grant all privileges on table shift_change_requests to anon, authenticated, postgres;
grant all privileges on table task_boards to anon, authenticated, postgres;
grant all privileges on table task_cards to anon, authenticated, postgres;
grant all privileges on table task_history to anon, authenticated, postgres;
grant all privileges on table task_notifications to anon, authenticated, postgres;
`;
};

// Local storage keys for the local mock database (representing the clean start)
const LOCAL_DIVISIONS_KEY = 'vtv_real_divisions';
const LOCAL_WORKERS_KEY = 'vtv_real_workers';
const LOCAL_ASSIGNMENTS_KEY = 'vtv_real_assignments';
const LOCAL_REQUESTS_KEY = 'vtv_real_requests';

// Initial local sync loaders
export const getLocalDb = {
  getDivisions: (): Division[] => {
    const data = localStorage.getItem(LOCAL_DIVISIONS_KEY);
    if (data) return JSON.parse(data);
    localStorage.setItem(LOCAL_DIVISIONS_KEY, JSON.stringify(DEFAULT_DIVISIONS));
    return DEFAULT_DIVISIONS;
  },
  saveDivisions: (divs: Division[]) => {
    localStorage.setItem(LOCAL_DIVISIONS_KEY, JSON.stringify(divs));
  },
  getWorkers: (): Worker[] => {
    const data = localStorage.getItem(LOCAL_WORKERS_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveWorkers: (workers: Worker[]) => {
    localStorage.setItem(LOCAL_WORKERS_KEY, JSON.stringify(workers));
  },
  getAssignments: (): ShiftAssignment[] => {
    const data = localStorage.getItem(LOCAL_ASSIGNMENTS_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveAssignments: (asg: ShiftAssignment[]) => {
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(asg));
  },
  getRequests: (): ShiftChangeRequest[] => {
    const data = localStorage.getItem(LOCAL_REQUESTS_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveRequests: (req: ShiftChangeRequest[]) => {
    localStorage.setItem(LOCAL_REQUESTS_KEY, JSON.stringify(req));
  }
};

  // Database interface to operate strictly with Supabase Cloud
export const db = {
  // Divisions
  async fetchDivisions(): Promise<Division[]> {
    if (!supabase) {
      throw new Error('Supabase no está configurado. Por favor, define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tus variables de entorno.');
    }
    const { data, error } = await supabase.from('divisions').select('*');
    if (error) {
      console.error('Error fetching divisions from Supabase:', error);
      setSupabaseConnectionStatus('error', error.message);
      throw error;
    }
    if (data && data.length === 0) {
      console.log('Seeding default divisions to Supabase...');
      const payload = DEFAULT_DIVISIONS.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        coordinator_id: d.coordinatorId,
        coordinator_name: d.coordinatorName
      }));
      const { error: seedError } = await supabase.from('divisions').insert(payload);
      if (seedError) {
        console.warn('Error seeding divisions to Supabase:', seedError);
        setSupabaseConnectionStatus('error', seedError.message);
        const errStr = JSON.stringify(seedError).toLowerCase();
        const isColumnError = seedError.code === '42703' || errStr.includes('coordinator_') || errStr.includes('column');
        if (isColumnError) {
          console.warn('Retrying divisions seed without coordinator columns...');
          const fallbackPayload = DEFAULT_DIVISIONS.map(d => ({
            id: d.id,
            name: d.name,
            description: d.description
          }));
          const { error: retrySeedError } = await supabase.from('divisions').insert(fallbackPayload);
          if (retrySeedError) {
            console.error('Error seeding divisions fallback:', retrySeedError);
            throw retrySeedError;
          } else {
            setSupabaseConnectionStatus('connected');
            return DEFAULT_DIVISIONS;
          }
        } else {
          throw seedError;
        }
      }
    }
    setSupabaseConnectionStatus('connected');
    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      coordinatorId: item.coordinator_id || null,
      coordinatorName: item.coordinator_name || null
    }));
  },

  async createDivision(division: Division): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const payload: any = {
      id: division.id,
      name: division.name,
      description: division.description,
      coordinator_id: division.coordinatorId,
      coordinator_name: division.coordinatorName
    };
    const { error } = await supabase.from('divisions').insert([payload]);
    if (error) {
      console.error('Error creating division in Supabase:', error);
      const errStr = JSON.stringify(error).toLowerCase();
      const isColumnError = error.code === '42703' || errStr.includes('coordinator_') || errStr.includes('column');
      if (isColumnError) {
        console.warn('Retrying createDivision without coordinator columns...');
        delete payload.coordinator_id;
        delete payload.coordinator_name;
        const { error: retryErr } = await supabase.from('divisions').insert([payload]);
        if (retryErr) {
          console.error('Error during retry createDivision:', retryErr);
          throw new Error(`Fallo al crear división: ${retryErr.message}`);
        }
      } else {
        throw new Error(`Fallo al crear división: ${error.message}`);
      }
    }
  },

  async updateDivision(division: Division): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const payload: any = {
      name: division.name,
      description: division.description,
      coordinator_id: division.coordinatorId,
      coordinator_name: division.coordinatorName
    };
    const { error } = await supabase
      .from('divisions')
      .update(payload)
      .eq('id', division.id);
    if (error) {
      console.error('Error updating division in Supabase:', error);
      const errStr = JSON.stringify(error).toLowerCase();
      const isColumnError = error.code === '42703' || errStr.includes('coordinator_') || errStr.includes('column');
      if (isColumnError) {
        console.warn('Retrying updateDivision without coordinator columns...');
        delete payload.coordinator_id;
        delete payload.coordinator_name;
        const { error: retryErr } = await supabase
          .from('divisions')
          .update(payload)
          .eq('id', division.id);
        if (retryErr) {
          console.error('Error during retry updateDivision:', retryErr);
          throw new Error(`Fallo al actualizar división: ${retryErr.message}`);
        }
      } else {
        throw new Error(`Fallo al actualizar división: ${error.message}`);
      }
    }
  },

  async deleteDivision(divisionId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    // 1. Explicitly nullify division_id for workers in this division
    const { error: wError } = await supabase
      .from('workers')
      .update({ division_id: null })
      .eq('division_id', divisionId);
    if (wError) {
      console.error('Error dissociating workers on division delete:', wError);
      throw new Error(`No se pudo desvincular a los trabajadores de la división: ${wError.message}`);
    }

    // 2. Explicitly delete shift assignments in this division
    const { error: aError } = await supabase
      .from('shift_assignments')
      .delete()
      .eq('division_id', divisionId);
    if (aError) {
      console.error('Error deleting assignments on division delete:', aError);
      throw new Error(`No se pudo eliminar las asignaciones de guardia: ${aError.message}`);
    }

    // 3. Explicitly delete change requests for this division
    const { error: rError } = await supabase
      .from('shift_change_requests')
      .delete()
      .eq('division_id', divisionId);
    if (rError) {
      console.error('Error deleting requests on division delete:', rError);
      throw new Error(`No se pudo eliminar las solicitudes de cambio: ${rError.message}`);
    }

    // 4. Finally delete the division
    const { error } = await supabase.from('divisions').delete().eq('id', divisionId);
    if (error) {
      console.error('Error deleting division from Supabase:', error);
      throw new Error(`No se pudo eliminar la división de la tabla divisions: ${error.message}`);
    }
  },

  async updateDivisionCoordinator(divisionId: string, coordId: string | null, coordName: string | null): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { error } = await supabase
      .from('divisions')
      .update({ coordinator_id: coordId, coordinator_name: coordName })
      .eq('id', divisionId);
    if (error) {
      console.error('Error updating coordinator in Supabase:', error);
      throw error;
    }
  },

  // Workers
  async fetchWorkers(): Promise<Worker[]> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { data, error } = await supabase.from('workers').select('*');
    if (error) {
      console.error('Error fetching workers from Supabase:', error);
      setSupabaseConnectionStatus('error', error.message);
      throw error;
    }
    return (data || []).map(w => {
      let mealsPreferenceObj = undefined;
      if (w.meals_preference) {
        try {
          mealsPreferenceObj = JSON.parse(w.meals_preference);
        } catch (e) {
          console.warn('Error parsing meals_preference JSON:', e);
        }
      }
      return {
        id: w.id,
        name: w.name,
        email: w.email,
        cargo: w.cargo,
        divisionId: w.division_id,
        role: w.role as any,
        cedula: w.cedula,
        password: w.password || '',
        mustChangePassword: w.must_change_password === true || w.must_change_password === 'true',
        fixedShift: (w.fixed_shift || 'pool') as any,
        vacationStart: w.vacation_start || undefined,
        vacationEnd: w.vacation_end || undefined,
        manualFreeDaysAdjustment: Number(w.manual_free_days_adjustment) || 0,
        mealsPreference: mealsPreferenceObj
      };
    });
  },

  async registerWorker(worker: Worker): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const payload: any = {
      id: worker.id,
      name: worker.name,
      email: worker.email,
      cargo: worker.cargo,
      division_id: worker.divisionId,
      role: worker.role,
      cedula: worker.cedula,
      password: worker.password,
      meals_preference: worker.mealsPreference ? JSON.stringify(worker.mealsPreference) : null,
      must_change_password: worker.mustChangePassword || false,
      fixed_shift: worker.fixedShift || 'pool',
      vacation_start: worker.vacationStart || null,
      vacation_end: worker.vacationEnd || null,
      manual_free_days_adjustment: worker.manualFreeDaysAdjustment || 0
    };

    const executeInsert = async (currentPayload: any): Promise<void> => {
      const { error } = await supabase.from('workers').insert([currentPayload]);
      if (error) {
        console.warn('Error registering worker in Supabase, checking columns...', error);
        const errStr = JSON.stringify(error).toLowerCase();
        const isColumnError = error.code === '42703' || errStr.includes('column') || errStr.includes('schema cache');
        if (isColumnError) {
          let modified = false;
          if (errStr.includes('manual_free_days_adjustment') && 'manual_free_days_adjustment' in currentPayload) {
            console.warn('Pruning missing "manual_free_days_adjustment" column and retrying...');
            delete currentPayload.manual_free_days_adjustment;
            modified = true;
          }
          if (errStr.includes('vacation_start') && 'vacation_start' in currentPayload) {
            console.warn('Pruning missing "vacation_start" column and retrying...');
            delete currentPayload.vacation_start;
            modified = true;
          }
          if (errStr.includes('vacation_end') && 'vacation_end' in currentPayload) {
            console.warn('Pruning missing "vacation_end" column and retrying...');
            delete currentPayload.vacation_end;
            modified = true;
          }
          if (errStr.includes('fixed_shift') && 'fixed_shift' in currentPayload) {
            console.warn('Pruning missing "fixed_shift" column and retrying...');
            delete currentPayload.fixed_shift;
            modified = true;
          }
          if (errStr.includes('must_change_password') && 'must_change_password' in currentPayload) {
            console.warn('Pruning missing "must_change_password" column and retrying...');
            delete currentPayload.must_change_password;
            modified = true;
          }
          if (errStr.includes('cedula') && 'cedula' in currentPayload) {
            console.warn('Pruning missing "cedula" column and retrying...');
            delete currentPayload.cedula;
            modified = true;
          }
          if (errStr.includes('meals_preference') && 'meals_preference' in currentPayload) {
            console.warn('Pruning missing "meals_preference" column and retrying...');
            delete currentPayload.meals_preference;
            modified = true;
          }
          if (errStr.includes('password') && 'password' in currentPayload) {
            console.warn('Pruning missing "password" column and retrying...');
            delete currentPayload.password;
            modified = true;
          }
          if (errStr.includes('role') && 'role' in currentPayload) {
            console.warn('Pruning missing "role" column and retrying...');
            delete currentPayload.role;
            modified = true;
          }

          if (!modified) {
            // Forced progressive pruning fallback if error is generic
            if ('must_change_password' in currentPayload) {
              delete currentPayload.must_change_password;
              modified = true;
            } else if ('meals_preference' in currentPayload) {
              delete currentPayload.meals_preference;
              modified = true;
            } else if ('cedula' in currentPayload) {
              delete currentPayload.cedula;
              modified = true;
            } else if ('password' in currentPayload) {
              delete currentPayload.password;
              modified = true;
            } else if ('role' in currentPayload) {
              delete currentPayload.role;
              modified = true;
            }
          }

          if (modified) {
            return executeInsert(currentPayload);
          }
        }
        throw error;
      }
    };

    try {
      await executeInsert(payload);
    } catch (err: any) {
      console.error('Fatal error registering worker:', err);
      throw new Error(`Fallo al registrar en Supabase: ${err.message || String(err)}. Verifica la estructura de la tabla 'workers' o que coincidan las columnas.`);
    }
  },

  async updateWorker(worker: Worker): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const payload: any = {
      name: worker.name,
      email: worker.email,
      cargo: worker.cargo,
      division_id: worker.divisionId,
      role: worker.role,
      cedula: worker.cedula,
      password: worker.password,
      meals_preference: worker.mealsPreference ? JSON.stringify(worker.mealsPreference) : null,
      must_change_password: worker.mustChangePassword !== undefined ? worker.mustChangePassword : false,
      fixed_shift: worker.fixedShift || 'pool',
      vacation_start: worker.vacationStart || null,
      vacation_end: worker.vacationEnd || null,
      manual_free_days_adjustment: worker.manualFreeDaysAdjustment !== undefined ? worker.manualFreeDaysAdjustment : 0
    };

    const executeUpdate = async (currentPayload: any): Promise<void> => {
      const { error } = await supabase
        .from('workers')
        .update(currentPayload)
        .eq('id', worker.id);
      if (error) {
        console.warn('Error updating worker in Supabase, checking columns...', error);
        const errStr = JSON.stringify(error).toLowerCase();
        const isColumnError = error.code === '42703' || errStr.includes('column') || errStr.includes('schema cache');
        if (isColumnError) {
          let modified = false;
          if (errStr.includes('manual_free_days_adjustment') && 'manual_free_days_adjustment' in currentPayload) {
            console.warn('Pruning missing "manual_free_days_adjustment" column and retrying...');
            delete currentPayload.manual_free_days_adjustment;
            modified = true;
          }
          if (errStr.includes('vacation_start') && 'vacation_start' in currentPayload) {
            console.warn('Pruning missing "vacation_start" column and retrying...');
            delete currentPayload.vacation_start;
            modified = true;
          }
          if (errStr.includes('vacation_end') && 'vacation_end' in currentPayload) {
            console.warn('Pruning missing "vacation_end" column and retrying...');
            delete currentPayload.vacation_end;
            modified = true;
          }
          if (errStr.includes('fixed_shift') && 'fixed_shift' in currentPayload) {
            console.warn('Pruning missing "fixed_shift" column and retrying...');
            delete currentPayload.fixed_shift;
            modified = true;
          }
          if (errStr.includes('must_change_password') && 'must_change_password' in currentPayload) {
            console.warn('Pruning missing "must_change_password" column and retrying...');
            delete currentPayload.must_change_password;
            modified = true;
          }
          if (errStr.includes('cedula') && 'cedula' in currentPayload) {
            console.warn('Pruning missing "cedula" column and retrying...');
            delete currentPayload.cedula;
            modified = true;
          }
          if (errStr.includes('meals_preference') && 'meals_preference' in currentPayload) {
            console.warn('Pruning missing "meals_preference" column and retrying...');
            delete currentPayload.meals_preference;
            modified = true;
          }
          if (errStr.includes('password') && 'password' in currentPayload) {
            console.warn('Pruning missing "password" column and retrying...');
            delete currentPayload.password;
            modified = true;
          }
          if (errStr.includes('role') && 'role' in currentPayload) {
            console.warn('Pruning missing "role" column and retrying...');
            delete currentPayload.role;
            modified = true;
          }

          if (!modified) {
            // Forced progressive pruning fallback if error is generic
            if ('fixed_shift' in currentPayload) {
              delete currentPayload.fixed_shift;
              modified = true;
            } else if ('must_change_password' in currentPayload) {
              delete currentPayload.must_change_password;
              modified = true;
            } else if ('meals_preference' in currentPayload) {
              delete currentPayload.meals_preference;
              modified = true;
            } else if ('cedula' in currentPayload) {
              delete currentPayload.cedula;
              modified = true;
            } else if ('password' in currentPayload) {
              delete currentPayload.password;
              modified = true;
            } else if ('role' in currentPayload) {
              delete currentPayload.role;
              modified = true;
            }
          }

          if (modified) {
            return executeUpdate(currentPayload);
          }
        }
        throw error;
      }
    };

    try {
      await executeUpdate(payload);
    } catch (err: any) {
      console.error('Fatal error updating worker:', err);
      throw new Error(`Fallo al actualizar en Supabase: ${err.message || String(err)}`);
    }
  },

  async updateWorkerRole(workerId: string, role: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { error } = await supabase.from('workers').update({ role }).eq('id', workerId);
    if (error) {
      console.error('Error updating worker role in Supabase:', error);
      throw error;
    }
  },

  // Shift Assignments
  async fetchAssignments(): Promise<ShiftAssignment[]> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { data, error } = await supabase.from('shift_assignments').select('*');
    if (error) {
      console.error('Error fetching shift assignments from Supabase:', error);
      setSupabaseConnectionStatus('error', error.message);
      throw error;
    }
    return (data || []).map(a => ({
      id: a.id,
      workerId: a.worker_id,
      divisionId: a.division_id,
      date: a.date,
      shiftType: a.shift_type as any
    }));
  },

  async upsertAssignment(assignment: ShiftAssignment): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { error } = await supabase.from('shift_assignments').upsert({
      id: assignment.id,
      worker_id: assignment.workerId,
      division_id: assignment.divisionId,
      date: assignment.date,
      shift_type: assignment.shiftType
    });
    if (error) {
      console.error('Error upserting assignment in Supabase:', error);
      throw error;
    }
  },

  async deleteAssignmentsForDivisionAndDate(divisionId: string, date: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { error } = await supabase
      .from('shift_assignments')
      .delete()
      .eq('division_id', divisionId)
      .eq('date', date);
    if (error) {
      console.error('Error deleting assignments in Supabase:', error);
      throw error;
    }
  },

  // Shift Change Requests
  async fetchRequests(): Promise<ShiftChangeRequest[]> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { data, error } = await supabase.from('shift_change_requests').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching shift requests from Supabase:', error);
      setSupabaseConnectionStatus('error', error.message);
      throw error;
    }
    return (data || []).map(r => ({
      id: r.id,
      requesterId: r.requester_id,
      requesterName: r.requester_name,
      targetWorkerId: r.target_worker_id,
      targetWorkerName: r.target_worker_name,
      divisionId: r.division_id,
      date: r.date,
      reason: r.reason,
      status: r.status as any,
      createdAt: r.created_at
    }));
  },

  async createRequest(req: ShiftChangeRequest): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { error } = await supabase.from('shift_change_requests').insert([{
      id: req.id,
      requester_id: req.requesterId,
      requester_name: req.requesterName,
      target_worker_id: req.targetWorkerId,
      target_worker_name: req.targetWorkerName,
      division_id: req.divisionId,
      date: req.date,
      reason: req.reason,
      status: req.status,
      created_at: req.createdAt
    }]);
    if (error) {
      console.error('Error creating request in Supabase:', error);
      throw error;
    }
  },

  async updateRequestStatus(id: string, status: 'pending' | 'approved' | 'rejected'): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase no está configurado.');
    }
    const { error } = await supabase.from('shift_change_requests').update({ status }).eq('id', id);
    if (error) {
      console.error('Error updating request status in Supabase:', error);
      throw error;
    }
  },

  // Task System Methods
  async fetchTaskBoards(): Promise<TaskBoard[]> {
    let supabaseBoards: TaskBoard[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase.from('task_boards').select('*').order('created_at', { ascending: true });
        if (!error && data) {
          supabaseBoards = data.map(b => ({
            id: b.id,
            name: b.name,
            description: b.description || '',
            color: b.color || 'cyan',
            divisionId: b.division_id,
            createdAt: b.created_at
          }));
        }
      } catch (err) {
        console.warn('Supabase task_boards query failed, using localStorage fallback', err);
      }
    }
    const saved = localStorage.getItem('vtv_task_boards');
    const localBoards: TaskBoard[] = saved ? JSON.parse(saved) : [];

    if (supabaseBoards.length > 0) {
      const sbMap = new Map(supabaseBoards.map(b => [b.id, b]));
      localBoards.forEach(lb => {
        if (!sbMap.has(lb.id)) {
          supabaseBoards.push(lb);
        }
      });
      localStorage.setItem('vtv_task_boards', JSON.stringify(supabaseBoards));
      return supabaseBoards;
    }

    return localBoards;
  },

  async createTaskBoard(board: TaskBoard): Promise<void> {
    try {
      const saved = localStorage.getItem('vtv_task_boards');
      let boards: TaskBoard[] = saved ? JSON.parse(saved) : [];
      const idx = boards.findIndex(b => b.id === board.id);
      if (idx >= 0) {
        boards[idx] = board;
      } else {
        boards.push(board);
      }
      localStorage.setItem('vtv_task_boards', JSON.stringify(boards));
    } catch (e) {
      console.error('Error saving task board to localStorage:', e);
    }

    if (supabase) {
      try {
        const { error } = await supabase.from('task_boards').upsert([{
          id: board.id,
          name: board.name,
          description: board.description || '',
          color: board.color || 'cyan',
          division_id: board.divisionId || null,
          created_at: board.createdAt || new Date().toISOString()
        }]);
        if (error) {
          console.error('Error upserting task_board to Supabase:', error);
        }
      } catch (err) {
        console.warn('Error saving task_board to Supabase:', err);
      }
    }
  },

  async deleteTaskBoard(boardId: string): Promise<void> {
    try {
      const saved = localStorage.getItem('vtv_task_boards');
      if (saved) {
        let boards: TaskBoard[] = JSON.parse(saved);
        boards = boards.filter(b => b.id !== boardId);
        localStorage.setItem('vtv_task_boards', JSON.stringify(boards));
      }
    } catch (e) {
      console.error(e);
    }

    if (supabase) {
      try {
        await supabase.from('task_boards').delete().eq('id', boardId);
      } catch (err) {
        console.warn('Error deleting task_board from Supabase:', err);
      }
    }
  },

  async fetchTaskCards(): Promise<TaskCard[]> {
    let supabaseCards: TaskCard[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase.from('task_cards').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          supabaseCards = data.map(c => ({
            id: c.id,
            boardId: c.board_id,
            divisionId: c.division_id,
            title: c.title,
            description: c.description || '',
            status: c.status as any,
            startDate: c.start_date,
            dueDate: c.due_date,
            assignedWorkerIds: c.assigned_worker_ids ? JSON.parse(c.assigned_worker_ids) : [],
            checklist: c.checklist ? JSON.parse(c.checklist) : [],
            createdAt: c.created_at,
            createdByWorkerId: c.created_by_worker_id,
            createdByName: c.created_by_name,
            priority: c.priority as any || 'media',
            isGerenciaOnly: Boolean(c.is_gerencia_only),
            duration: c.duration || '00:00:00'
          }));
        } else if (error) {
          console.warn('Error fetching task_cards from Supabase:', error);
        }
      } catch (err) {
        console.warn('Supabase task_cards query failed, using localStorage fallback', err);
      }
    }

    const saved = localStorage.getItem('vtv_task_cards');
    const localCards: TaskCard[] = saved ? JSON.parse(saved) : [];

    if (supabaseCards.length > 0) {
      // Merge local cards that might not be in Supabase yet due to network/schema sync latency
      const supabaseMap = new Map(supabaseCards.map(c => [c.id, c]));
      localCards.forEach(lc => {
        if (!supabaseMap.has(lc.id)) {
          supabaseCards.push(lc);
        }
      });
      localStorage.setItem('vtv_task_cards', JSON.stringify(supabaseCards));
      return supabaseCards;
    }

    return localCards;
  },

  async upsertTaskCard(card: TaskCard): Promise<void> {
    // 1. Immediate sync to localStorage
    try {
      const saved = localStorage.getItem('vtv_task_cards');
      let cards: TaskCard[] = saved ? JSON.parse(saved) : [];
      const idx = cards.findIndex(c => c.id === card.id);
      if (idx >= 0) {
        cards[idx] = card;
      } else {
        cards.unshift(card);
      }
      localStorage.setItem('vtv_task_cards', JSON.stringify(cards));
    } catch (e) {
      console.error('Error saving task_card to localStorage:', e);
    }

    // 2. Sync to Supabase Cloud
    if (supabase) {
      try {
        const payload = {
          id: card.id,
          board_id: card.boardId || null,
          division_id: card.divisionId || null,
          title: card.title,
          description: card.description || '',
          status: card.status,
          start_date: card.startDate || null,
          due_date: card.dueDate || null,
          assigned_worker_ids: JSON.stringify(card.assignedWorkerIds || []),
          checklist: JSON.stringify(card.checklist || []),
          priority: card.priority || 'media',
          is_gerencia_only: Boolean(card.isGerenciaOnly),
          duration: card.duration || '00:00:00',
          created_by_worker_id: card.createdByWorkerId || null,
          created_by_name: card.createdByName || 'Sistema',
          created_at: card.createdAt || new Date().toISOString()
        };
        const { error } = await supabase.from('task_cards').upsert([payload]);
        if (error) {
          console.error('Error upserting task_card to Supabase:', error);
        }
      } catch (err) {
        console.warn('Error upserting task_card to Supabase:', err);
      }
    }
  },

  async deleteTaskCard(cardId: string): Promise<void> {
    try {
      const saved = localStorage.getItem('vtv_task_cards');
      if (saved) {
        let cards: TaskCard[] = JSON.parse(saved);
        cards = cards.filter(c => c.id !== cardId);
        localStorage.setItem('vtv_task_cards', JSON.stringify(cards));
      }
    } catch (e) {
      console.error('Error deleting task_card from localStorage:', e);
    }

    if (supabase) {
      try {
        await supabase.from('task_cards').delete().eq('id', cardId);
      } catch (err) {
        console.warn('Error deleting task_card from Supabase:', err);
      }
    }
  },

  async fetchTaskNotifications(workerId?: string): Promise<TaskNotification[]> {
    if (supabase) {
      try {
        let query = supabase.from('task_notifications').select('*').order('created_at', { ascending: false });
        if (workerId) {
          query = query.eq('worker_id', workerId);
        }
        const { data, error } = await query;
        if (!error && data) {
          return data.map(n => ({
            id: n.id,
            workerId: n.worker_id,
            taskId: n.task_id,
            taskTitle: n.task_title,
            boardName: n.board_name,
            message: n.message,
            createdAt: n.created_at,
            read: n.read
          }));
        }
      } catch (err) {
        console.warn('Supabase task_notifications query failed, using localStorage fallback', err);
      }
    }
    const saved = localStorage.getItem('vtv_task_notifications');
    const all: TaskNotification[] = saved ? JSON.parse(saved) : [];
    if (workerId) {
      return all.filter(n => n.workerId === workerId);
    }
    return all;
  },

  async createTaskNotification(notif: TaskNotification): Promise<void> {
    try {
      const saved = localStorage.getItem('vtv_task_notifications');
      let all: TaskNotification[] = saved ? JSON.parse(saved) : [];
      all.unshift(notif);
      localStorage.setItem('vtv_task_notifications', JSON.stringify(all));
    } catch (e) {
      console.error(e);
    }

    if (supabase) {
      try {
        await supabase.from('task_notifications').insert([{
          id: notif.id,
          worker_id: notif.workerId || null,
          task_id: notif.taskId || null,
          task_title: notif.taskTitle || '',
          board_name: notif.boardName || '',
          message: notif.message,
          read: Boolean(notif.read),
          created_at: notif.createdAt || new Date().toISOString()
        }]);
      } catch (err) {
        console.warn('Error saving task_notification to Supabase:', err);
      }
    }
  },

  async markTaskNotificationRead(id: string): Promise<void> {
    try {
      const saved = localStorage.getItem('vtv_task_notifications');
      if (saved) {
        let all: TaskNotification[] = JSON.parse(saved);
        all = all.map(n => n.id === id ? { ...n, read: true } : n);
        localStorage.setItem('vtv_task_notifications', JSON.stringify(all));
      }
    } catch (e) {
      console.error(e);
    }

    if (supabase) {
      try {
        await supabase.from('task_notifications').update({ read: true }).eq('id', id);
      } catch (err) {
        console.warn('Error marking task notification read in Supabase:', err);
      }
    }
  }
};
