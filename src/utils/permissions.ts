import { UserProfile, MaterialSignal } from '../types';

/**
 * Permiso de creación de tarjetas de material y tareas:
 * Permite a TODOS los Coordinadores, Jefes de División, Gerente de Archivo, Adjunta de Gerencia
 * y a todo el personal de la división de Ingesta (Ingestadores y Operadores de Ingesta)
 * crear tarjetas tanto en "Ingesta y Trabajo Activo" como en "Solicitudes y Otras Tareas".
 */
export const canUserCreateMaterial = (user: UserProfile): boolean => {
  if (!user) return false;
  const role = (user.role || '').trim().toLowerCase();
  const division = (user.division || '').trim().toLowerCase();

  return (
    role.includes('gerente') ||
    role.includes('adjunt') ||
    role.includes('jefe') ||
    role.includes('coordinador') ||
    role.includes('ingestad') ||
    role.includes('operador') ||
    division === 'ingesta'
  );
};

/**
 * Verifica si el usuario pertenece al personal documentalista o jefaturas de archivo.
 */
export const isUserDocumentalistaOrManager = (user: UserProfile): boolean => {
  if (!user) return false;
  return (
    user.role === 'Documentalista' ||
    user.role === 'Coordinador' ||
    user.role === 'Jefe de División' ||
    user.role === 'Gerente de Archivo' ||
    user.role === 'Adjunta de Gerencia' ||
    user.division === 'Prensa' ||
    user.division === 'Programación' ||
    user.division === 'Gerencia'
  );
};

/**
 * Verifica si el usuario puede tomar/asignarse una tarjeta de material.
 * Si ya está asignada a otra persona, solo esa persona o sus jefes/coordinadores pueden cambiarla.
 */
export const canUserAssignSignal = (
  user: UserProfile,
  signal: MaterialSignal
): { allowed: boolean; reason?: string } => {
  if (!user) return { allowed: false, reason: 'Usuario no autenticado.' };

  if (signal.assignedTo && signal.assignedTo !== user.name) {
    const isManager =
      user.role === 'Coordinador' ||
      user.role === 'Jefe de División' ||
      user.role === 'Adjunta de Gerencia' ||
      user.role === 'Gerente de Archivo';

    if (!isManager) {
      return {
        allowed: false,
        reason: `Esta tarjeta está asignada a ${signal.assignedTo}. Solo esta persona o su Coordinador/Jefe puede desasignarla.`,
      };
    }
  }

  return { allowed: true };
};

/**
 * Verifica si el usuario puede desasignar/liberar una tarjeta.
 * Solo el propio usuario asignado o sus coordinadores y jefes pueden hacerlo.
 */
export const canUserUnassignSignal = (user: UserProfile, signal: MaterialSignal): boolean => {
  if (!user || !signal.assignedTo) return false;
  if (signal.assignedTo === user.name) return true;
  return (
    user.role === 'Coordinador' ||
    user.role === 'Jefe de División' ||
    user.role === 'Adjunta de Gerencia' ||
    user.role === 'Gerente de Archivo'
  );
};

/**
 * Verifica si el usuario puede marcar el material "Para Archivar" (catalogarlo).
 * Una vez asignado, solo el usuario asignado (o jefes/coordinadores) puede marcarlo Para Archivar.
 */
export const canUserCatalogSignal = (
  user: UserProfile,
  signal: MaterialSignal
): { allowed: boolean; reason?: string } => {
  if (!user) return { allowed: false, reason: 'Usuario no autenticado.' };

  // Si está asignado a otra persona y el usuario actual no es un jefe/coordinador
  if (signal.assignedTo && signal.assignedTo !== user.name) {
    const isManager =
      user.role === 'Coordinador' ||
      user.role === 'Jefe de División' ||
      user.role === 'Adjunta de Gerencia' ||
      user.role === 'Gerente de Archivo';

    if (!isManager) {
      return {
        allowed: false,
        reason: `Este material está asignado a ${signal.assignedTo}. Solo ${signal.assignedTo} puede documentarlo y marcarlo Para Archivar.`,
      };
    }
  }

  return { allowed: true };
};

/**
 * Verifica si el usuario puede marcar el material como "Finalizado".
 * Únicamente los Jefes de División, Coordinadores, Gerente de Archivo y Adjunta de Gerencia pueden hacerlo.
 */
export const canUserFinalizeSignal = (
  user: UserProfile
): { allowed: boolean; reason?: string } => {
  if (!user) return { allowed: false, reason: 'Usuario no autenticado.' };

  const isManagerOrCoordinator =
    user.role === 'Gerente de Archivo' ||
    user.role === 'Adjunta de Gerencia' ||
    user.role === 'Jefe de División' ||
    user.role === 'Coordinador';

  if (!isManagerOrCoordinator) {
    return {
      allowed: false,
      reason: 'Acceso Restringido: Solo los Coordinadores, Jefes de División y Gerencia pueden marcar tareas como Finalizadas.',
    };
  }

  return { allowed: true };
};

/**
 * Permiso para gestionar personal, asignar guardias y días libres:
 * Jefes de División, Coordinadores, Gerente de Archivo, Adjunta de Gerencia y Asistente Administrativa.
 */
export const canUserManagePersonnel = (user: UserProfile): boolean => {
  if (!user) return false;
  return (
    user.role === 'Asistente Administrativa' ||
    user.role === 'Gerente de Archivo' ||
    user.role === 'Adjunta de Gerencia' ||
    user.role === 'Jefe de División' ||
    user.role === 'Coordinador'
  );
};

/**
 * Permiso exclusivo para asignar vacaciones:
 * Únicamente Asistente Administrativa, Gerente de Archivo y Adjunta de Gerencia.
 */
export const canUserAssignVacations = (user: UserProfile): boolean => {
  if (!user) return false;
  return (
    user.role === 'Asistente Administrativa' ||
    user.role === 'Gerente de Archivo' ||
    user.role === 'Adjunta de Gerencia'
  );
};

/**
 * Permiso para eliminar material o señales:
 * Permite a Coordinadores, Jefes de División, Gerente de Archivo, Adjunta de Gerencia,
 * Documentalistas y personal de Ingesta (Ingestadores y Operadores) eliminar materiales.
 */
export const canUserDeleteMaterial = (user: UserProfile): boolean => {
  if (!user) return false;
  const role = (user.role || '').trim().toLowerCase();
  const division = (user.division || '').trim().toLowerCase();
  return (
    role.includes('gerente') ||
    role.includes('adjunt') ||
    role.includes('jefe') ||
    role.includes('coordinador') ||
    role.includes('ingestad') ||
    role.includes('operador') ||
    role.includes('documental') ||
    role.includes('asistent') ||
    division === 'ingesta' ||
    division === 'prensa' ||
    division === 'programación' ||
    division === 'programacion' ||
    division === 'gerencia'
  );
};

