import { UserProfile, MaterialSignal } from '../types';

/**
 * Permiso de creación de tarjetas de material:
 * Coordinadores, Jefes de División, Adjunta de Gerencia, Gerente de Archivo
 * y TODOS los usuarios que pertenecen a la división de Ingesta.
 */
export const canUserCreateMaterial = (user: UserProfile): boolean => {
  if (!user) return false;
  if (
    user.role === 'Gerente de Archivo' ||
    user.role === 'Adjunta de Gerencia' ||
    user.role === 'Jefe de División' ||
    user.role === 'Coordinador' ||
    user.division === 'Ingesta' ||
    user.role === 'Ingestador' ||
    user.role === 'Operador de Ingesta'
  ) {
    return true;
  }
  return false;
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
