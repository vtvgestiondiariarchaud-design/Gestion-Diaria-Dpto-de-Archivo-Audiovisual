import { createClient } from '@supabase/supabase-js';
import { Division, Worker, ShiftAssignment, ShiftChangeRequest, ShiftType } from './types';

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

// Real client (will be initialized if configured)
export const supabase = isSupabaseConfigured 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

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
  return `-- SQL SCRIPT PARA CONFIGURAR TU BASE DE DATOS EN SUPABASE
-- Ejecuta este script en el SQL Editor de tu proyecto de Supabase

-- 1. Crear tabla de divisiones
create table if not exists divisions (
  id text primary key,
  name text not null,
  description text,
  coordinator_id text,
  coordinator_name text
);

-- 2. Crear tabla de trabajadores (workers)
create table if not exists workers (
  id text primary key,
  name text not null,
  email text not null unique,
  cargo text not null,
  division_id text references divisions(id) on delete set null,
  role text not null default 'worker',
  cedula text,
  password text,
  meals_preference text
);

-- 3. Crear tabla de asignaciones de turnos
create table if not exists shift_assignments (
  id text primary key,
  worker_id text references workers(id) on delete cascade,
  division_id text references divisions(id) on delete cascade,
  date date not null,
  shift_type text not null
);

-- 4. Crear tabla de solicitudes de intercambio de guardia
create table if not exists shift_change_requests (
  id text primary key,
  requester_id text references workers(id) on delete cascade,
  requester_name text not null,
  target_worker_id text references workers(id) on delete cascade,
  target_worker_name text not null,
  division_id text references divisions(id) on delete cascade,
  date date not null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Insertar divisiones por defecto de VTV
insert into divisions (id, name, description) values
('div_archivo_prensa', 'Archivo de Prensa', 'Gestión, clasificación y resguardo del material audiovisual y notas informativas del área de prensa y noticias.'),
('div_archivo_programacion', 'Archivo de Programacion', 'Catalogación, digitalización e inventario de programas, documentales y transmisiones especiales de la planta televisiva.'),
('div_ingesta', 'Ingesta', 'Recepción, control de calidad, transferencia y almacenamiento primario de contenidos y aportes de corresponsalías.')
on conflict (id) do nothing;

-- 6. DESACTIVAR RLS (Row-Level Security) para permitir lectura/escritura directa
-- NOTA: Supabase habilita RLS por defecto si creas tablas desde su interfaz visual.
-- Ejecutar estas líneas garantiza que la aplicación web pueda sincronizar los datos de inmediato:
alter table divisions disable row level security;
alter table workers disable row level security;
alter table shift_assignments disable row level security;
alter table shift_change_requests disable row level security;

-- O bien, si prefieres mantener RLS activo, puedes crear políticas permisivas de acceso público:
-- create policy "Permitir todo divisions" on divisions for all using (true) with check (true);
-- create policy "Permitir todo workers" on workers for all using (true) with check (true);
-- create policy "Permitir todo shift_assignments" on shift_assignments for all using (true) with check (true);
-- create policy "Permitir todo shift_change_requests" on shift_change_requests for all using (true) with check (true);
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

  // Database interface to unify both real Supabase and local DB fallback
export const db = {
  // Divisions
  async fetchDivisions(): Promise<Division[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('divisions').select('*');
        if (error) {
          console.warn('Error fetching divisions from Supabase (graceful fallback to local):', error);
          setSupabaseConnectionStatus('error', error.message);
          return getLocalDb.getDivisions();
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
            console.warn('Warning/Info seeding divisions to Supabase (graceful fallback to local):', seedError);
            setSupabaseConnectionStatus('error', seedError.message);
            const errStr = JSON.stringify(seedError).toLowerCase();
            const isColumnError = seedError.code === '42703' || errStr.includes('coordinator_') || errStr.includes('column');
            if (isColumnError) {
              console.warn('Retrying divisions seed without coordinator_id/coordinator_name columns...');
              const fallbackPayload = DEFAULT_DIVISIONS.map(d => ({
                id: d.id,
                name: d.name,
                description: d.description
              }));
              const { error: retrySeedError } = await supabase.from('divisions').insert(fallbackPayload);
              if (retrySeedError) {
                console.warn('Warning/Info seeding divisions fallback:', retrySeedError);
                return getLocalDb.getDivisions();
              } else {
                setSupabaseConnectionStatus('connected');
                return DEFAULT_DIVISIONS;
              }
            } else {
              console.warn('Fallo al sembrar divisiones debido a políticas de seguridad (RLS) u otra restricción de base de datos. Usando almacenamiento local.');
              return getLocalDb.getDivisions();
            }
          }
        }
        setSupabaseConnectionStatus('connected');
        return data.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          coordinatorId: item.coordinator_id || null,
          coordinatorName: item.coordinator_name || null
        }));
      } catch (err: any) {
        console.warn('Exception inside fetchDivisions:', err);
        setSupabaseConnectionStatus('error', err.message || String(err));
        return getLocalDb.getDivisions();
      }
    }
    return getLocalDb.getDivisions();
  },

  async createDivision(division: Division): Promise<void> {
    if (supabase) {
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
    } else {
      const divs = getLocalDb.getDivisions();
      divs.push(division);
      getLocalDb.saveDivisions(divs);
    }
  },

  async updateDivision(division: Division): Promise<void> {
    if (supabase) {
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
    } else {
      const divs = getLocalDb.getDivisions();
      const updated = divs.map(d => d.id === division.id ? division : d);
      getLocalDb.saveDivisions(updated);
    }
  },

  async deleteDivision(divisionId: string): Promise<void> {
    if (supabase) {
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
    } else {
      // 1. Dissociate workers
      const workers = getLocalDb.getWorkers();
      const updatedWorkers = workers.map(w => w.divisionId === divisionId ? { ...w, divisionId: undefined } : w);
      getLocalDb.saveWorkers(updatedWorkers);

      // 2. Delete assignments
      const asgs = getLocalDb.getAssignments();
      const updatedAsgs = asgs.filter(a => a.divisionId !== divisionId);
      getLocalDb.saveAssignments(updatedAsgs);

      // 3. Delete change requests
      const reqs = getLocalDb.getRequests();
      const updatedReqs = reqs.filter(r => r.divisionId !== divisionId);
      getLocalDb.saveRequests(updatedReqs);

      // 4. Delete division
      const divs = getLocalDb.getDivisions();
      const filtered = divs.filter(d => d.id !== divisionId);
      getLocalDb.saveDivisions(filtered);
    }
  },

  async updateDivisionCoordinator(divisionId: string, coordId: string | null, coordName: string | null): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('divisions')
        .update({ coordinator_id: coordId, coordinator_name: coordName })
        .eq('id', divisionId);
      if (error) console.error('Error updating coordinator in Supabase:', error);
    } else {
      const divs = getLocalDb.getDivisions();
      const updated = divs.map(d => d.id === divisionId ? { ...d, coordinatorId: coordId, coordinatorName: coordName } : d);
      getLocalDb.saveDivisions(updated);
    }
  },

  // Workers
  async fetchWorkers(): Promise<Worker[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('workers').select('*');
        if (error) {
          console.warn('Error fetching workers from Supabase:', error);
          setSupabaseConnectionStatus('error', error.message);
          return getLocalDb.getWorkers();
        }
        return data.map(w => {
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
            mealsPreference: mealsPreferenceObj
          };
        });
      } catch (err: any) {
        console.warn('Exception inside fetchWorkers:', err);
        setSupabaseConnectionStatus('error', err.message || String(err));
        return getLocalDb.getWorkers();
      }
    }
    return getLocalDb.getWorkers();
  },

  async registerWorker(worker: Worker): Promise<void> {
    if (supabase) {
      const payload: any = {
        id: worker.id,
        name: worker.name,
        email: worker.email,
        cargo: worker.cargo,
        division_id: worker.divisionId,
        role: worker.role,
        cedula: worker.cedula,
        password: worker.password,
        meals_preference: worker.mealsPreference ? JSON.stringify(worker.mealsPreference) : null
      };

      const executeInsert = async (currentPayload: any): Promise<void> => {
        const { error } = await supabase.from('workers').insert([currentPayload]);
        if (error) {
          console.warn('Error registering worker in Supabase, checking columns...', error);
          const errStr = JSON.stringify(error).toLowerCase();
          const isColumnError = error.code === '42703' || errStr.includes('column') || errStr.includes('schema cache');
          if (isColumnError) {
            let modified = false;
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
              if ('meals_preference' in currentPayload) {
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
    } else {
      const workers = getLocalDb.getWorkers();
      // Avoid duplicates
      if (!workers.find(w => w.email.toLowerCase() === worker.email.toLowerCase())) {
        workers.push(worker);
        getLocalDb.saveWorkers(workers);
      }
    }
  },

  async updateWorker(worker: Worker): Promise<void> {
    if (supabase) {
      const payload: any = {
        name: worker.name,
        email: worker.email,
        cargo: worker.cargo,
        division_id: worker.divisionId,
        role: worker.role,
        cedula: worker.cedula,
        password: worker.password,
        meals_preference: worker.mealsPreference ? JSON.stringify(worker.mealsPreference) : null
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
              if ('meals_preference' in currentPayload) {
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
    } else {
      const workers = getLocalDb.getWorkers();
      const updated = workers.map(w => w.id === worker.id ? worker : w);
      getLocalDb.saveWorkers(updated);
    }
  },

  async updateWorkerRole(workerId: string, role: string): Promise<void> {
    if (supabase) {
      try {
        const { error } = await supabase.from('workers').update({ role }).eq('id', workerId);
        if (error) {
          console.warn('Error updating worker role in Supabase (graceful fallback):', error);
          const workers = getLocalDb.getWorkers();
          const updated = workers.map(w => w.id === workerId ? { ...w, role: role as any } : w);
          getLocalDb.saveWorkers(updated);
        }
      } catch (e) {
        console.warn('Exception updating worker role in Supabase (graceful fallback):', e);
        const workers = getLocalDb.getWorkers();
        const updated = workers.map(w => w.id === workerId ? { ...w, role: role as any } : w);
        getLocalDb.saveWorkers(updated);
      }
    } else {
      const workers = getLocalDb.getWorkers();
      const updated = workers.map(w => w.id === workerId ? { ...w, role: role as any } : w);
      getLocalDb.saveWorkers(updated);
    }
  },

  // Shift Assignments
  async fetchAssignments(): Promise<ShiftAssignment[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('shift_assignments').select('*');
        if (error) {
          console.warn('Error fetching shift assignments from Supabase:', error);
          setSupabaseConnectionStatus('error', error.message);
          return getLocalDb.getAssignments();
        }
        return data.map(a => ({
          id: a.id,
          workerId: a.worker_id,
          divisionId: a.division_id,
          date: a.date,
          shiftType: a.shift_type as any
        }));
      } catch (err: any) {
        console.warn('Exception inside fetchAssignments:', err);
        setSupabaseConnectionStatus('error', err.message || String(err));
        return getLocalDb.getAssignments();
      }
    }
    return getLocalDb.getAssignments();
  },

  async upsertAssignment(assignment: ShiftAssignment): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('shift_assignments').upsert({
        id: assignment.id,
        worker_id: assignment.workerId,
        division_id: assignment.divisionId,
        date: assignment.date,
        shift_type: assignment.shiftType
      });
      if (error) console.error('Error upserting assignment in Supabase:', error);
    } else {
      const asgs = getLocalDb.getAssignments();
      const idx = asgs.findIndex(a => a.id === assignment.id || (a.workerId === assignment.workerId && a.date === assignment.date));
      if (idx > -1) {
        asgs[idx] = assignment;
      } else {
        asgs.push(assignment);
      }
      getLocalDb.saveAssignments(asgs);
    }
  },

  async deleteAssignmentsForDivisionAndDate(divisionId: string, date: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('shift_assignments')
        .delete()
        .eq('division_id', divisionId)
        .eq('date', date);
      if (error) console.error('Error deleting assignments in Supabase:', error);
    } else {
      const asgs = getLocalDb.getAssignments();
      const filtered = asgs.filter(a => !(a.divisionId === divisionId && a.date === date));
      getLocalDb.saveAssignments(filtered);
    }
  },

  // Shift Change Requests
  async fetchRequests(): Promise<ShiftChangeRequest[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('shift_change_requests').select('*').order('created_at', { ascending: false });
        if (error) {
          console.warn('Error fetching shift requests from Supabase:', error);
          setSupabaseConnectionStatus('error', error.message);
          return getLocalDb.getRequests();
        }
        return data.map(r => ({
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
      } catch (err: any) {
        console.warn('Exception inside fetchRequests:', err);
        setSupabaseConnectionStatus('error', err.message || String(err));
        return getLocalDb.getRequests();
      }
    }
    return getLocalDb.getRequests();
  },

  async createRequest(req: ShiftChangeRequest): Promise<void> {
    if (supabase) {
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
      if (error) console.error('Error creating request in Supabase:', error);
    } else {
      const reqs = getLocalDb.getRequests();
      reqs.unshift(req);
      getLocalDb.saveRequests(reqs);
    }
  },

  async updateRequestStatus(id: string, status: 'pending' | 'approved' | 'rejected'): Promise<void> {
    if (supabase) {
      const { error } = await supabase.from('shift_change_requests').update({ status }).eq('id', id);
      if (error) console.error('Error updating request status in Supabase:', error);
    } else {
      const reqs = getLocalDb.getRequests();
      const updated = reqs.map(r => r.id === id ? { ...r, status } : r);
      getLocalDb.saveRequests(updated);
    }
  }
};
