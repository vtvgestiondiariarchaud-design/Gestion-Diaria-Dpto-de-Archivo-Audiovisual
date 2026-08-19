import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, Lock, CheckCircle2 } from 'lucide-react';
import { 
  UserProfile, 
  MaterialSignal, 
  Personnel, 
  GuardShiftRecord, 
  MaterialStatus, 
  DivisionType,
  MonthlyArchiveLog
} from './types';
import { 
  loadInitialState, 
  saveLocalMaterials, 
  saveLocalPersonnel, 
  saveLocalGuardShifts, 
  saveLocalAppsScriptUrl, 
  saveLocalActiveUser,
  saveLocalMonthlyArchives,
  loadLocalUserPins,
  saveLocalUserPins,
  deduplicatePersonnel,
  deduplicateGuardShifts,
  getFormattedDateTime,
  normalizeDateString,
  getLocalDateISOString,
  createBackupSnapshot
} from './services/apiService';
import { Navbar } from './components/Navbar';
import { canUserFinalizeSignal } from './utils/permissions';
import { UserRoleSelectorModal } from './components/UserRoleSelectorModal';
import { MaterialListModule } from './components/MaterialListModule';
import { MaterialModal } from './components/MaterialModal';
import { EditMaterialModal } from './components/EditMaterialModal';
import { UserSecurityPinModal } from './components/UserSecurityPinModal';
import { PinVerificationModal } from './components/PinVerificationModal';
import { AdminPersonnelModule } from './components/AdminPersonnelModule';
import { DashboardModule } from './components/DashboardModule';
import { GoogleAppsScriptModal } from './components/GoogleAppsScriptModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';

export default function App() {
  const [state, setState] = useState(() => loadInitialState());
  const [activeTab, setActiveTab] = useState<'materials' | 'personnel' | 'dashboard' | 'settings'>('materials');

  // Modals state
  const [isUserSelectorOpen, setIsUserSelectorOpen] = useState(() => {
    try {
      const activeUserSaved = localStorage.getItem('vtv_archivo_active_user_v1');
      return !activeUserSaved;
    } catch (e) {
      return true;
    }
  });
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  
  // Edit Material Modal State
  const [editingSignal, setEditingSignal] = useState<MaterialSignal | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Security PIN State
  const [userPins, setUserPins] = useState<Record<string, string>>(() => loadLocalUserPins());
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isPinVerificationOpen, setIsPinVerificationOpen] = useState(false);
  const [pendingUserForSwitch, setPendingUserForSwitch] = useState<UserProfile | null>(null);

  // Material Modal presets (when adding a signal to an existing family)
  const [presetFamilyId, setPresetFamilyId] = useState<string | undefined>();
  const [presetTitle, setPresetTitle] = useState<string | undefined>();
  const [presetDivision, setPresetDivision] = useState<DivisionType | undefined>();
  const [presetIsRequestTask, setPresetIsRequestTask] = useState<boolean | undefined>();

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Handle Restore State from Backup
  const handleRestoreState = (restored: {
    materials: MaterialSignal[];
    personnel: Personnel[];
    guardShifts: GuardShiftRecord[];
    monthlyArchives?: MonthlyArchiveLog[];
  }) => {
    const mats = restored.materials || [];
    const pers = deduplicatePersonnel(restored.personnel || []);
    const shifts = deduplicateGuardShifts(restored.guardShifts || []);
    const archives = restored.monthlyArchives || [];

    saveLocalMaterials(mats);
    saveLocalPersonnel(pers);
    saveLocalGuardShifts(shifts);
    saveLocalMonthlyArchives(archives);

    setState((prev) => ({
      ...prev,
      materials: mats,
      personnel: pers,
      guardShifts: shifts,
      monthlyArchives: archives,
    }));
  };

  // Dynamically link user profiles to personnel list
  const userProfiles: UserProfile[] = React.useMemo(() => {
    if (!state.personnel || state.personnel.length === 0) return [];
    const deduped = deduplicatePersonnel(state.personnel);
    return deduped.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      division: p.division,
    }));
  }, [state.personnel]);

  // Combine local PIN dictionary with PINs stored in personnel records
  const effectiveUserPins = React.useMemo(() => {
    const map: Record<string, string> = { ...userPins };
    state.personnel.forEach((p) => {
      if (p.pin) {
        map[p.id] = p.pin;
        if (p.name) map[p.name] = p.pin;
      }
    });
    return map;
  }, [state.personnel, userPins]);

  const currentUserHasPin = Boolean(
    effectiveUserPins[state.currentUser.id] ||
    effectiveUserPins[state.currentUser.name] ||
    state.personnel.find(p => p.id === state.currentUser.id || p.name === state.currentUser.name)?.pin
  );

  // Switch Active User (with PIN check)
  const handleSelectUser = (user: UserProfile) => {
    setState((prev) => ({ ...prev, currentUser: user }));
    saveLocalActiveUser(user);
    showToast(`Perfil cambiado a: ${user.name} (${user.role})`);
  };

  const handleRequestUserSwitch = (targetUser: UserProfile) => {
    const targetPin =
      effectiveUserPins[targetUser.id] ||
      effectiveUserPins[targetUser.name] ||
      state.personnel.find((p) => p.id === targetUser.id || p.name === targetUser.name)?.pin;

    if (targetPin) {
      setPendingUserForSwitch(targetUser);
      setIsPinVerificationOpen(true);
    } else {
      handleSelectUser(targetUser);
    }
  };

  const handleSaveUserPin = (userId: string, pin: string | null) => {
    setUserPins((prev) => {
      const updated = { ...prev };
      if (pin) {
        updated[userId] = pin;
        if (state.currentUser?.name) updated[state.currentUser.name] = pin;
      } else {
        delete updated[userId];
        if (state.currentUser?.name) delete updated[state.currentUser.name];
      }
      saveLocalUserPins(updated);
      return updated;
    });

    // Save PIN inside Personnel record
    setState((prev) => {
      const updatedPersonnel = prev.personnel.map((p) => {
        if (p.id === userId || p.name === prev.currentUser.name) {
          return { ...p, pin: pin || undefined };
        }
        return p;
      });
      saveLocalPersonnel(updatedPersonnel);
      return { ...prev, personnel: updatedPersonnel };
    });

    if (pin) {
      showToast('PIN de seguridad guardado en el personal.');
    } else {
      showToast('PIN de seguridad eliminado.');
    }
  };

  // Handle Edit Material Signal
  const handleOpenEditSignal = (signal: MaterialSignal) => {
    setEditingSignal(signal);
    setIsEditModalOpen(true);
  };

  const handleSaveEditSignal = (updatedSignal: MaterialSignal) => {
    setState((prev) => {
      const updatedMaterials = prev.materials.map((m) =>
        m.id === updatedSignal.id ? updatedSignal : m
      );
      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });
    showToast(`Material ${updatedSignal.id} modificado exitosamente.`);
  };

  // Update Material Signal Status
  const handleUpdateSignalStatus = (signalId: string, newStatus: MaterialStatus) => {
    const timestampStr = getFormattedDateTime();

    const checkFin = canUserFinalizeSignal(state.currentUser);
    if (newStatus === 'Finalizado' && !checkFin.allowed) {
      showToast(checkFin.reason || 'Solo los Jefes y Coordinadores pueden marcar como Finalizado.', 'error');
      return;
    }

    setState((prev) => {
      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.id === signalId) {
          const isCataloged = newStatus === 'Por Archivar' || newStatus === 'Finalizado';
          const isFinalized = newStatus === 'Finalizado';

          const updated = {
            ...mat,
            status: newStatus,
            isIngested: true,
            isCataloged,
            isFinalized,
          };

          if (isCataloged) {
            updated.catalogedBy = updated.catalogedBy || prev.currentUser.name;
            updated.catalogedAt = updated.catalogedAt || timestampStr;
          }
          if (isFinalized) {
            updated.finalizedBy = updated.finalizedBy || prev.currentUser.name;
            updated.finalizedAt = updated.finalizedAt || timestampStr;
          }

          return updated;
        }
        return mat;
      });

      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    showToast(`Señal ${signalId} actualizada a "${newStatus}".`);
  };

  // Toggle single boolean field independently
  const handleToggleSignalBoolean = (signalId: string, flag: 'isIngested' | 'isCataloged' | 'isFinalized') => {
    const timestampStr = getFormattedDateTime();

    const matTarget = state.materials.find((m) => m.id === signalId);
    const willBeFinalized = flag === 'isFinalized' && (!matTarget || !matTarget.isFinalized);
    if (willBeFinalized) {
      const checkFin = canUserFinalizeSignal(state.currentUser);
      if (!checkFin.allowed) {
        showToast(checkFin.reason || 'Solo los Jefes y Coordinadores pueden finalizar tareas.', 'error');
        return;
      }
    }

    setState((prev) => {
      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.id === signalId) {
          const newVal = !mat[flag];
          const updated = { ...mat, [flag]: newVal };

          // Maintain audit metadata
          if (flag === 'isCataloged' && newVal) {
            updated.catalogedBy = prev.currentUser.name;
            updated.catalogedAt = timestampStr;
            // Auto assign if not assigned
            if (!updated.assignedTo) {
              updated.assignedTo = prev.currentUser.name;
              updated.assignedToRole = prev.currentUser.role;
              updated.assignedAt = timestampStr;
            }
          }
          if (flag === 'isFinalized' && newVal) {
            updated.finalizedBy = prev.currentUser.name;
            updated.finalizedAt = timestampStr;
            updated.isCataloged = true; // Auto mark cataloged if finalized
            if (!updated.catalogedBy) {
              updated.catalogedBy = prev.currentUser.name;
              updated.catalogedAt = timestampStr;
            }
          }

          // Sync status text for consistency
          if (updated.isFinalized) updated.status = 'Finalizado';
          else if (updated.isCataloged) updated.status = 'Por Archivar';
          else updated.status = 'Registrado';

          return updated;
        }
        return mat;
      });

      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    showToast(`Señal ${signalId}: ${flag} actualizado.`);
  };

  // Assign or Unassign Signal to Documentalista
  const handleAssignSignal = (signalId: string, assignToUser: string | null) => {
    const timestampStr = getFormattedDateTime();

    setState((prev) => {
      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.id === signalId) {
          if (assignToUser) {
            const targetUser = prev.personnel.find((u) => u.name === assignToUser) || prev.currentUser;
            return {
              ...mat,
              assignedTo: assignToUser,
              assignedToRole: targetUser.role,
              assignedAt: timestampStr,
            };
          } else {
            return {
              ...mat,
              assignedTo: undefined,
              assignedToRole: undefined,
              assignedAt: undefined,
            };
          }
        }
        return mat;
      });

      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    if (assignToUser) {
      showToast(`Señal ${signalId} asignada a ${assignToUser}.`);
    } else {
      showToast(`Señal ${signalId} liberada (sin asignación).`);
    }
  };

  // Assign Multiple Persons to Signal or Task
  const handleAssignMultiplePersons = (signalId: string, assignedPersons: string[]) => {
    const timestampStr = getFormattedDateTime();

    setState((prev) => {
      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.id === signalId) {
          const mainAssignee = assignedPersons.length > 0 ? assignedPersons[0] : undefined;
          return {
            ...mat,
            assignedPersons,
            assignedTo: mainAssignee || mat.assignedTo,
            assignedAt: timestampStr,
          };
        }
        return mat;
      });

      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    showToast(`Asignación de equipo actualizada (${assignedPersons.length} persona(s)).`);
  };

  // Batch Toggle Family Boolean
  const handleBatchToggleFamilyBoolean = (familyId: string, flag: 'isIngested' | 'isCataloged' | 'isFinalized', value: boolean) => {
    const timestampStr = getFormattedDateTime();

    if (flag === 'isFinalized' && value) {
      const checkFin = canUserFinalizeSignal(state.currentUser);
      if (!checkFin.allowed) {
        showToast(checkFin.reason || 'Solo los Jefes y Coordinadores pueden finalizar tareas.', 'error');
        return;
      }
    }

    setState((prev) => {
      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.familyId === familyId) {
          const updated = { ...mat, [flag]: value };

          if (flag === 'isCataloged' && value) {
            updated.catalogedBy = updated.catalogedBy || prev.currentUser.name;
            updated.catalogedAt = updated.catalogedAt || timestampStr;
          }
          if (flag === 'isFinalized' && value) {
            updated.finalizedBy = updated.finalizedBy || prev.currentUser.name;
            updated.finalizedAt = updated.finalizedAt || timestampStr;
            updated.isCataloged = true;
          }

          if (updated.isFinalized) updated.status = 'Finalizado';
          else if (updated.isCataloged) updated.status = 'Por Archivar';
          else updated.status = 'Registrado';

          return updated;
        }
        return mat;
      });

      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    showToast(`Familia ${familyId}: ${flag} = ${value ? 'Activado' : 'Desactivado'}.`);
  };

  // Batch Update Family Status
  const handleBatchUpdateFamilyStatus = (familyId: string, newStatus: MaterialStatus) => {
    const timestampStr = getFormattedDateTime();

    if (newStatus === 'Finalizado') {
      const checkFin = canUserFinalizeSignal(state.currentUser);
      if (!checkFin.allowed) {
        showToast(checkFin.reason || 'Solo los Jefes y Coordinadores pueden marcar como Finalizado.', 'error');
        return;
      }
    }

    setState((prev) => {
      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.familyId === familyId) {
          const isCataloged = newStatus === 'Por Archivar' || newStatus === 'Finalizado';
          const isFinalized = newStatus === 'Finalizado';

          const updated = {
            ...mat,
            status: newStatus,
            isIngested: true,
            isCataloged,
            isFinalized,
          };

          if (isCataloged) {
            updated.catalogedBy = updated.catalogedBy || prev.currentUser.name;
            updated.catalogedAt = updated.catalogedAt || timestampStr;
          }
          if (isFinalized) {
            updated.finalizedBy = updated.finalizedBy || prev.currentUser.name;
            updated.finalizedAt = updated.finalizedAt || timestampStr;
          }

          return updated;
        }
        return mat;
      });

      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    showToast(`Familia ${familyId} actualizada a "${newStatus}".`);
  };

  // Add New Materials
  const handleAddMaterials = (newSignals: MaterialSignal[]) => {
    setState((prev) => {
      const updatedMaterials = [...newSignals, ...prev.materials];
      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    showToast(`Registrado(s) ${newSignals.length} elemento(s) audiovisual(es) con éxito.`);
  };

  // Delete Signal
  const handleDeleteSignal = (signalId: string) => {
    setState((prev) => {
      const updatedMaterials = prev.materials.filter((m) => m.id !== signalId);
      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    showToast(`Señal ${signalId} eliminada.`);
  };

  // Purge Finalized Materials after Export & Save Monthly Log
  const handlePurgeFinalizedMaterials = (signalIdsToPurge: string[], monthlyLog: MonthlyArchiveLog) => {
    setState((prev) => {
      const updatedMaterials = prev.materials.filter((m) => !signalIdsToPurge.includes(m.id));
      const updatedArchives = [monthlyLog, ...(prev.monthlyArchives || [])];

      saveLocalMaterials(updatedMaterials);
      saveLocalMonthlyArchives(updatedArchives);
      createBackupSnapshot(updatedMaterials, prev.personnel, prev.guardShifts, updatedArchives, 'Cierre y Depuración Mensual');

      return {
        ...prev,
        materials: updatedMaterials,
        monthlyArchives: updatedArchives,
      };
    });

    showToast(`Depuración completada: ${signalIdsToPurge.length} materiales eliminados y guardados en historial mensual.`, 'success');
  };

  const handleSaveMonthlyLogOnly = (monthlyLog: MonthlyArchiveLog) => {
    setState((prev) => {
      const updatedArchives = [monthlyLog, ...(prev.monthlyArchives || [])];
      saveLocalMonthlyArchives(updatedArchives);
      createBackupSnapshot(prev.materials, prev.personnel, prev.guardShifts, updatedArchives, 'Cierre de Mes');
      return { ...prev, monthlyArchives: updatedArchives };
    });
    showToast('Resumen mensual registrado y respaldado exitosamente.', 'success');
  };

  const handleClearMonthlyArchives = () => {
    if (window.confirm('¿Está seguro de eliminar el historial de reportes mensuales de cierres?')) {
      setState((prev) => {
        saveLocalMonthlyArchives([]);
        createBackupSnapshot(prev.materials, prev.personnel, prev.guardShifts, [], 'Limpieza de Cierres');
        return { ...prev, monthlyArchives: [] };
      });
      showToast('Historial de cierres mensuales limpiado.');
    }
  };

  // Clear All Guard Shifts
  const handleClearAllGuardShifts = () => {
    if (window.confirm('¿Está seguro de que desea eliminar TODAS las guardias del calendario? Esta acción no se puede deshacer.')) {
      setState((prev) => {
        saveLocalGuardShifts([]);
        createBackupSnapshot(prev.materials, prev.personnel, [], prev.monthlyArchives || [], 'Limpieza de Guardias');
        return { ...prev, guardShifts: [] };
      });
      showToast('Se han eliminado todas las guardias del calendario.');
    }
  };

  // Add Guard Shift & Update Personnel Balance (single or batch with optional date overwrite)
  const handleAddBatchGuardShifts = (
    newShiftsData: Omit<GuardShiftRecord, 'id' | 'createdAt'>[],
    replaceTargetDate?: string
  ) => {
    const createdTimestamp = getLocalDateISOString();
    const newShiftRecords: GuardShiftRecord[] = newShiftsData.map((s, idx) => ({
      ...s,
      date: normalizeDateString(s.date),
      endDate: s.endDate ? normalizeDateString(s.endDate) : undefined,
      id: `sh-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: createdTimestamp,
    }));

    setState((prev) => {
      let baseShifts = prev.guardShifts;

      // If replacing a specific date's guard roster, clear old guard shifts for that date first
      if (replaceTargetDate) {
        const normTarget = normalizeDateString(replaceTargetDate);
        baseShifts = baseShifts.filter((s) => {
          const sDate = s.date ? normalizeDateString(s.date) : '';
          return !(sDate === normTarget && s.shiftType === 'Guardia (Fin de semana/Feriado)');
        });
      }

      const updatedShifts = deduplicateGuardShifts([...newShiftRecords, ...baseShifts]);

      // Build map of balance adjustments per personnelId
      const workedMap = new Map<string, number>();
      const generatedMap = new Map<string, number>();
      const takenMap = new Map<string, number>();

      newShiftsData.forEach((s) => {
        const pid = s.personnelId;
        if (s.shiftType === 'Guardia (Fin de semana/Feriado)') {
          workedMap.set(pid, (workedMap.get(pid) || 0) + 1);
          generatedMap.set(pid, (generatedMap.get(pid) || 0) + 1);
        } else if (s.shiftType === 'Día Libre') {
          takenMap.set(pid, (takenMap.get(pid) || 0) + 1);
        } else if (s.shiftType === 'Vacaciones') {
          let days = 1;
          if (s.endDate) {
            const start = new Date(s.date);
            const end = new Date(s.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
          }
          takenMap.set(pid, (takenMap.get(pid) || 0) + days);
        }
      });

      const updatedPersonnel = prev.personnel.map((per) => {
        const addWorked = workedMap.get(per.id) || 0;
        const addGenerated = generatedMap.get(per.id) || 0;
        const addTaken = takenMap.get(per.id) || 0;

        if (addWorked === 0 && addGenerated === 0 && addTaken === 0) {
          return per;
        }

        const worked = per.guardDaysWorked + addWorked;
        const generated = per.daysOffGenerated + addGenerated;
        const taken = per.daysOffTaken + addTaken;
        const balance = generated - taken;

        return {
          ...per,
          guardDaysWorked: worked,
          daysOffGenerated: generated,
          daysOffTaken: taken,
          balanceDays: balance,
        };
      });

      saveLocalGuardShifts(updatedShifts);
      saveLocalPersonnel(updatedPersonnel);

      return {
        ...prev,
        guardShifts: updatedShifts,
        personnel: updatedPersonnel,
      };
    });

    showToast(`Asignación de turno(s) guardada con éxito (${newShiftsData.length}).`);
  };

  const handleAddGuardShift = (shiftData: Omit<GuardShiftRecord, 'id' | 'createdAt'>) => {
    handleAddBatchGuardShifts([shiftData]);
  };

  // Delete Shift Record
  const handleDeleteGuardShift = (shiftId: string) => {
    setState((prev) => {
      const targetShift = prev.guardShifts.find((s) => s.id === shiftId);
      if (!targetShift) return prev;

      const updatedShifts = prev.guardShifts.filter((s) => s.id !== shiftId);

      const updatedPersonnel = prev.personnel.map((per) => {
        if (per.id === targetShift.personnelId) {
          let worked = per.guardDaysWorked;
          let generated = per.daysOffGenerated;
          let taken = per.daysOffTaken;

          if (targetShift.shiftType === 'Guardia (Fin de semana/Feriado)') {
            worked = Math.max(0, worked - 1);
            generated = Math.max(0, generated - 1);
          } else if (targetShift.shiftType === 'Día Libre') {
            taken = Math.max(0, taken - 1);
          } else if (targetShift.shiftType === 'Vacaciones') {
            let days = 1;
            if (targetShift.endDate) {
              const start = new Date(targetShift.date);
              const end = new Date(targetShift.endDate);
              const diffTime = Math.abs(end.getTime() - start.getTime());
              days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
            }
            taken = Math.max(0, taken - days);
          }

          const balance = generated - taken;

          return {
            ...per,
            guardDaysWorked: worked,
            daysOffGenerated: generated,
            daysOffTaken: taken,
            balanceDays: balance,
          };
        }
        return per;
      });

      saveLocalGuardShifts(updatedShifts);
      saveLocalPersonnel(updatedPersonnel);

      return {
        ...prev,
        guardShifts: updatedShifts,
        personnel: updatedPersonnel,
      };
    });

    showToast('Asignación eliminada.');
  };

  // Add New Personnel
  const handleAddPersonnel = (
    personData: Omit<Personnel, 'id' | 'guardDaysWorked' | 'daysOffGenerated' | 'daysOffTaken' | 'balanceDays'>
  ) => {
    const newPerson: Personnel = {
      ...personData,
      id: `per-${Date.now()}`,
      guardDaysWorked: 0,
      daysOffGenerated: 0,
      daysOffTaken: 0,
      balanceDays: 0,
    };

    setState((prev) => {
      const updatedPersonnel = [...prev.personnel, newPerson];
      saveLocalPersonnel(updatedPersonnel);
      return { ...prev, personnel: updatedPersonnel };
    });

    showToast(`Personal registrado: ${newPerson.name}`);
  };

  // Delete Personnel
  const handleDeletePersonnel = (personnelId: string) => {
    setState((prev) => {
      const updatedPersonnel = prev.personnel.filter((p) => p.id !== personnelId);
      saveLocalPersonnel(updatedPersonnel);
      return { ...prev, personnel: updatedPersonnel };
    });

    showToast('Personal eliminado con éxito.');
  };

  // Quick Adjust Days for Personnel
  const handleQuickAdjustDays = (personnelId: string, type: 'guard' | 'dayOff') => {
    setState((prev) => {
      const updatedPersonnel = prev.personnel.map((per) => {
        if (per.id === personnelId) {
          let worked = per.guardDaysWorked;
          let generated = per.daysOffGenerated;
          let taken = per.daysOffTaken;

          if (type === 'guard') {
            worked += 1;
            generated += 1;
          } else {
            taken += 1;
          }

          const balance = generated - taken;

          return {
            ...per,
            guardDaysWorked: worked,
            daysOffGenerated: generated,
            daysOffTaken: taken,
            balanceDays: balance,
          };
        }
        return per;
      });

      saveLocalPersonnel(updatedPersonnel);
      return { ...prev, personnel: updatedPersonnel };
    });

    showToast('Balance de personal actualizado.');
  };

  // Save Apps Script URL
  const handleSaveAppsScriptUrl = (url: string) => {
    setState((prev) => ({ ...prev, appsScriptUrl: url }));
    saveLocalAppsScriptUrl(url);
    showToast('URL de Google Apps Script actualizada.');
  };

  // Open Material Modal with presets
  const handleOpenMaterialModal = (
    familyId?: string,
    title?: string,
    division?: DivisionType,
    isRequestTask?: boolean
  ) => {
    setPresetFamilyId(familyId);
    setPresetTitle(title);
    setPresetDivision(division);
    setPresetIsRequestTask(isRequestTask);
    setIsMaterialModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-2 animate-bounce ${
            notification.type === 'success'
              ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
              : 'bg-red-950 border-red-500 text-red-200'
          }`}
        >
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={state.currentUser}
        onOpenUserSelector={() => setIsUserSelectorOpen(true)}
        onOpenPinModal={() => setIsPinModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        userHasPin={currentUserHasPin}
        appsScriptUrl={state.appsScriptUrl}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Solicitation Banner for Users without a Security PIN */}
        {!currentUserHasPin && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/60 border border-amber-500/50 text-amber-200 text-xs shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-amber-100 text-sm flex items-center gap-2">
                  <span>Seguridad de Perfil: Crea tu PIN Personal</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/30 text-amber-300 text-[10px] uppercase font-mono">
                    RECOMENDADO
                  </span>
                </h4>
                <p className="text-slate-300 mt-0.5">
                  Hola <strong className="text-white">{state.currentUser.name}</strong>, asigna un PIN numérico para proteger el acceso a tu perfil y prevenir cambios no autorizados.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsPinModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow-md flex items-center gap-2 shrink-0 hover:scale-105"
            >
              <KeyRound className="w-4 h-4" />
              <span>Crear mi PIN Ahora</span>
            </button>
          </div>
        )}

        {activeTab === 'materials' && (
          <MaterialListModule
            materials={state.materials}
            currentUser={state.currentUser}
            personnel={state.personnel}
            monthlyArchives={state.monthlyArchives}
            onUpdateSignalStatus={handleUpdateSignalStatus}
            onBatchUpdateFamilyStatus={handleBatchUpdateFamilyStatus}
            onToggleSignalBoolean={handleToggleSignalBoolean}
            onBatchToggleFamilyBoolean={handleBatchToggleFamilyBoolean}
            onAssignSignal={handleAssignSignal}
            onAssignMultiplePersons={handleAssignMultiplePersons}
            onOpenNewMaterialModal={handleOpenMaterialModal}
            onDeleteSignal={handleDeleteSignal}
            onEditSignal={handleOpenEditSignal}
            onPurgeFinalizedMaterials={handlePurgeFinalizedMaterials}
            onSaveMonthlyLogOnly={handleSaveMonthlyLogOnly}
            onClearMonthlyArchives={handleClearMonthlyArchives}
          />
        )}

        {activeTab === 'personnel' && (
          <AdminPersonnelModule
            personnel={state.personnel}
            guardShifts={state.guardShifts}
            currentUser={state.currentUser}
            onAddGuardShift={handleAddGuardShift}
            onAddBatchGuardShifts={handleAddBatchGuardShifts}
            onDeleteGuardShift={handleDeleteGuardShift}
            onClearAllGuardShifts={handleClearAllGuardShifts}
            onAddPersonnel={handleAddPersonnel}
            onDeletePersonnel={handleDeletePersonnel}
            onQuickAdjustDays={handleQuickAdjustDays}
            onOpenPinModal={() => setIsPinModalOpen(true)}
            userHasPin={currentUserHasPin}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardModule materials={state.materials} />
        )}

        {activeTab === 'settings' && (
          <GoogleAppsScriptModal
            appsScriptUrl={state.appsScriptUrl}
            onSaveUrl={handleSaveAppsScriptUrl}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
            lastSyncTime={state.lastSyncTime}
          />
        )}
      </main>

      {/* Modals */}
      <UserRoleSelectorModal
        isOpen={isUserSelectorOpen}
        onClose={() => setIsUserSelectorOpen(false)}
        currentUser={state.currentUser}
        users={userProfiles}
        userPins={effectiveUserPins}
        onSelectUser={handleRequestUserSwitch}
        onOpenPinConfig={() => setIsPinModalOpen(true)}
      />

      <MaterialModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        currentUser={state.currentUser}
        onSave={handleAddMaterials}
        presetFamilyId={presetFamilyId}
        presetTitle={presetTitle}
        presetDivision={presetDivision}
        presetIsRequestTask={presetIsRequestTask}
      />

      {editingSignal && (
        <EditMaterialModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingSignal(null);
          }}
          signal={editingSignal}
          onSave={handleSaveEditSignal}
        />
      )}

      <UserSecurityPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        currentUser={state.currentUser}
        userPins={effectiveUserPins}
        onSavePin={(userId, pin) => handleSaveUserPin(userId, pin)}
      />

      {pendingUserForSwitch && (
        <PinVerificationModal
          isOpen={isPinVerificationOpen}
          onClose={() => {
            setIsPinVerificationOpen(false);
            setPendingUserForSwitch(null);
          }}
          targetUser={pendingUserForSwitch}
          correctPin={
            effectiveUserPins[pendingUserForSwitch.id] ||
            effectiveUserPins[pendingUserForSwitch.name] ||
            ''
          }
          onSuccess={() => {
            const userToSwitch = pendingUserForSwitch;
            setIsPinVerificationOpen(false);
            setPendingUserForSwitch(null);
            handleSelectUser(userToSwitch);
          }}
        />
      )}

      <BackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        state={state}
        onRestoreState={handleRestoreState}
        onToast={showToast}
      />

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © 2026 <strong>Venezolana de Televisión (VTV)</strong> • Departamento de Archivo Audiovisual
          </span>
          <span className="text-[11px] text-slate-600">
            Prensa • Programación • Ingesta
          </span>
        </div>
      </footer>
    </div>
  );
}
