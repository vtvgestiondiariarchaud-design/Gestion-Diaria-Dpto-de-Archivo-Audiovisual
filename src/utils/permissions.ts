import { UserProfile, MaterialSignal } from '../types';

/**
 * Verifica si el usuario actual está en modo Invitado / Solo Lectura (Sesión Cerrada).
 */
export const isGuestUser = (user?: UserProfile | null): boolean => {
  if (!user) return true;
  return Boolean(user.isGuest || user.role === 'Invitado (Solo Lectura)' || user.id === 'guest');
};

/**
 * Verifica si el usuario tiene una sesión activa con permisos para realizar acciones y mutaciones en la app.
 */
export const canUserPerformActions = (user?: UserProfile | null): boolean => {
  return !isGuestUser(user);
};

/**
 * Permiso de creación de tarjetas de material y tareas:
 * Permite a todos los usuarios autenticados (Coordinadores, Jefes de División, Gerente de Archivo, Adjunta de Gerencia,
 * Documentalistas e Ingesta). Bloqueado en Modo Consulta / Invitado.
 */
export const canUserCreateMaterial = (user?: UserProfile | null): boolean => {
  if (!user || isGuestUser(user)) return false;
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

/**
 * Verifica si el usuario pertenece al personal documentalista o jefaturas de archivo.
 */
export const isUserDocumentalistaOrManager = (user?: UserProfile | null): boolean => {
  if (!user || isGuestUser(user)) return false;
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
  user?: UserProfile | null,
  signal?: MaterialSignal
): { allowed: boolean; reason?: string } => {
  if (!user || isGuestUser(user)) {
    return { allowed: false, reason: 'Debes iniciar sesión con un usuario para asignarte o gestionar materiales.' };
  }

  if (signal?.assignedTo && signal.assignedTo !== user.name) {
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
export const canUserUnassignSignal = (user?: UserProfile | null, signal?: MaterialSignal): boolean => {
  if (!user || isGuestUser(user) || !signal || !signal.assignedTo) return false;
  if (signal.assignedTo === user.name) return true;
  return (
    user.role === 'Coordinador' ||
    user.role === 'Jefe de División' ||
    user.role === 'Adjunta de Gerencia' ||
    user.role === 'Gerente de Archivo'
  );
};

/**
 * Permiso para marcar material "Para Archivar" / "Archivar" (catalogarlo):
 * Habilitado para TODOS los usuarios comunes autenticados (Documentalistas, Ingestadores, Operadores de Ingesta,
 * Coordinadores, Jefes de División y Gerencia). Bloqueado únicamente en Modo Consulta / Invitado.
 */
export const canUserCatalogSignal = (
  user?: UserProfile | null,
  signal?: MaterialSignal
): { allowed: boolean; reason?: string } => {
  if (!user || isGuestUser(user)) {
    return { allowed: false, reason: 'Debes iniciar sesión con un usuario para archivar o catalogar materiales.' };
  }

  // Si está asignado a otra persona y el usuario no es jefe/coordinador ni el asignado
  if (signal?.assignedTo && signal.assignedTo !== user.name) {
    const isManager =
      user.role === 'Coordinador' ||
      user.role === 'Jefe de División' ||
      user.role === 'Adjunta de Gerencia' ||
      user.role === 'Gerente de Archivo';

    if (!isManager) {
      return {
        allowed: false,
        reason: `Este material está asignado a ${signal.assignedTo}. Solo ${signal.assignedTo} o su jefatura pueden marcarlo como Para Archivar.`,
      };
    }
  }

  return { allowed: true };
};

/**
 * Verifica si el usuario puede marcar el material como "Finalizado".
 * Permitido a Coordinadores, Jefes de División, Gerente de Archivo, Adjunta de Gerencia y Documentalistas.
 */
export const canUserFinalizeSignal = (
  user?: UserProfile | null
): { allowed: boolean; reason?: string } => {
  if (!user || isGuestUser(user)) {
    return { allowed: false, reason: 'Debes iniciar sesión con un usuario para finalizar materiales.' };
  }

  const isAuthorized =
    user.role === 'Gerente de Archivo' ||
    user.role === 'Adjunta de Gerencia' ||
    user.role === 'Jefe de División' ||
    user.role === 'Coordinador' ||
    user.role === 'Documentalista';

  if (!isAuthorized) {
    return {
      allowed: false,
      reason: 'Acceso Restringido: Inicia sesión como Documentalista, Coordinador o Jefe para finalizar tareas.',
    };
  }

  return { allowed: true };
};

/**
 * Permiso para gestionar personal, asignar guardias y días libres:
 * Jefes de División, Coordinadores, Gerente de Archivo, Adjunta de Gerencia y Asistente Administrativa.
 */
export const canUserManagePersonnel = (user?: UserProfile | null): boolean => {
  if (!user || isGuestUser(user)) return false;
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
export const canUserAssignVacations = (user?: UserProfile | null): boolean => {
  if (!user || isGuestUser(user)) return false;
  return (
    user.role === 'Asistente Administrativa' ||
    user.role === 'Gerente de Archivo' ||
    user.role === 'Adjunta de Gerencia'
  );
};

/**
 * Permiso para eliminar material o señales:
 * Permite a Coordinadores, Jefes de División, Gerente de Archivo, Adjunta de Gerencia,
 * Documentalistas y personal de Ingesta (Ingestadores y Operadores).
 */
export const canUserDeleteMaterial = (user?: UserProfile | null): boolean => {
  if (!user || isGuestUser(user)) return false;
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

