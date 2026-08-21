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
  deduplicateMaterials,
  deduplicatePersonnel,
  deduplicateGuardShifts,
  getFormattedDateTime,
  normalizeDateString,
  getLocalDateISOString,
  createBackupSnapshot,
  smartSyncWithSheet,
  fetchRemoteSheetData,
  pushAllDataToRemoteSheet,
  apiCreateMaterialsBatch,
  apiUpdateMaterial,
  apiBatchUpdateFamily,
  apiDeleteMaterial,
  apiPurgeFinalizedMaterials,
  apiSavePersonnel,
  apiUpdatePersonnel,
  apiDeletePersonnel,
  apiSaveBatchGuardShifts,
  apiDeleteGuardShift,
  apiClearAllGuardShifts,
  apiSaveMonthlyArchive,
  apiClearMonthlyArchives,
  apiCleanAndDeduplicateSheet,
  apiReorganizeAllSheets,
} from './services/apiService';
import { Navbar } from './components/Navbar';
import { canUserFinalizeSignal, canUserDeleteMaterial } from './utils/permissions';
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

  // State reference for background async sync routines
  const stateRef = React.useRef(state);
  const isSyncingRef = React.useRef(false);
  const lastFocusSyncRef = React.useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Synchronize bidirectional state with Google Sheets (Master Cloud DB)
  const handleTriggerSync = async (notify = true) => {
    const currentUrl = stateRef.current.appsScriptUrl;
    if (!currentUrl) {
      if (notify) {
        showToast('Configure primero la URL de Google Apps Script en Ajustes.', 'error');
        setActiveTab('settings');
      }
      return;
    }

    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    setState((prev) => ({ ...prev, isSyncing: true, syncError: undefined }));

    try {
      const result = await fetchRemoteSheetData(currentUrl);
      if (result.success && result.data) {
        const remote = result.data;
        if (remote.materials.length > 0 || remote.personnel.length > 0 || remote.guardShifts.length > 0) {
          saveLocalMaterials(remote.materials);
          saveLocalPersonnel(remote.personnel);
          saveLocalGuardShifts(remote.guardShifts);
          saveLocalMonthlyArchives(remote.monthlyArchives);

          setState((prev) => ({
            ...prev,
            materials: remote.materials,
            personnel: remote.personnel,
            guardShifts: remote.guardShifts,
            monthlyArchives: remote.monthlyArchives,
            isSyncing: false,
            lastSyncTime: getFormattedDateTime(new Date()),
            syncError: undefined,
          }));
          if (notify) {
            showToast(result.message, 'success');
          }
        } else {
          // Si la hoja está vacía pero hay datos locales, hacemos una sincronización inicial
          const syncRes = await smartSyncWithSheet(currentUrl, stateRef.current);
          setState((prev) => ({
            ...prev,
            materials: syncRes.data?.materials || prev.materials,
            personnel: syncRes.data?.personnel || prev.personnel,
            guardShifts: syncRes.data?.guardShifts || prev.guardShifts,
            monthlyArchives: syncRes.data?.monthlyArchives || prev.monthlyArchives,
            isSyncing: false,
            lastSyncTime: getFormattedDateTime(new Date()),
            syncError: undefined,
          }));
          if (notify) {
            showToast(syncRes.message, 'success');
          }
        }
      } else {
        setState((prev) => ({
          ...prev,
          isSyncing: false,
          syncError: notify ? result.message : prev.syncError,
        }));
        if (notify) {
          showToast(result.message, 'error');
        } else {
          console.warn('Sincronización en segundo plano no completada:', result.message);
        }
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Error de conexión';
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        syncError: notify ? errorMsg : prev.syncError,
      }));
      if (notify) {
        showToast(`Error al conectar con Google Sheets: ${errorMsg}`, 'error');
      } else {
        console.warn('Error en sincronización en segundo plano:', err);
      }
    } finally {
      isSyncingRef.current = false;
    }
  };

  // Helper to report successful atomic sync
  const markSyncSuccess = () => {
    setState((prev) => ({
      ...prev,
      lastSyncTime: getFormattedDateTime(new Date()),
      syncError: undefined,
    }));
  };

  // Clean and deduplicate rows in Google Sheets
  const handleCleanDuplicatesInSheet = async () => {
    if (!state.appsScriptUrl) {
      showToast('No hay URL de Google Apps Script configurada.', 'error');
      return;
    }
    showToast('Depurando filas duplicadas y verificando formatos en Google Sheets...', 'success');
    try {
      const res = await apiCleanAndDeduplicateSheet(state.appsScriptUrl);
      if (res.success) {
        showToast(res.message || 'Depuración completada exitosamente en Google Sheets.', 'success');
        await handleTriggerSync(false);
      } else {
        showToast(`Error al depurar en Sheets: ${res.message || 'Acción no completada'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error al conectar con Google Sheets: ${err?.message || err}`, 'error');
    }
  };

  // Reorganize and align all sheets in Google Sheets to canonical structure
  const handleReorganizeAllSheets = async () => {
    if (!state.appsScriptUrl) {
      showToast('No hay URL de Google Apps Script configurada.', 'error');
      return;
    }
    showToast('Reestructurando y alineando todas las columnas en Google Sheets...', 'success');
    try {
      const res = await apiReorganizeAllSheets(state.appsScriptUrl);
      if (res.success) {
        showToast(res.message || 'Reestructuración y alineación completada con éxito en Google Sheets.', 'success');
        await handleTriggerSync(false);
      } else {
        showToast(`Error al reestructurar en Sheets: ${res.message || 'Acción no completada'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error al conectar con Google Sheets: ${err?.message || err}`, 'error');
    }
  };

  // Automatic sync on mount (reads fresh data from Sheets directly)
  useEffect(() => {
    if (state.appsScriptUrl) {
      handleTriggerSync(false);
    }
  }, []);

  // Periodic background sync every 45 seconds + on window focus (debounced)
  useEffect(() => {
    if (!state.appsScriptUrl) return;

    const intervalId = setInterval(() => {
      handleTriggerSync(false);
    }, 45000);

    const onWindowFocus = () => {
      const now = Date.now();
      // Debounce window focus events to at most once every 30 seconds
      if (now - lastFocusSyncRef.current > 30000) {
        lastFocusSyncRef.current = now;
        handleTriggerSync(false);
      }
    };

    window.addEventListener('focus', onWindowFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [state.appsScriptUrl]);

  // Background Cloud Push Helper when restoring backup or doing full export
  const triggerCloudPush = (override?: {
    materials?: MaterialSignal[];
    personnel?: Personnel[];
    guardShifts?: GuardShiftRecord[];
    monthlyArchives?: MonthlyArchiveLog[];
  }) => {
    const currentUrl = stateRef.current.appsScriptUrl;
    if (!currentUrl) return;

    const payload = {
      materials: override?.materials || stateRef.current.materials,
      personnel: override?.personnel || stateRef.current.personnel,
      guardShifts: override?.guardShifts || stateRef.current.guardShifts,
      monthlyArchives: override?.monthlyArchives || stateRef.current.monthlyArchives,
    };

    pushAllDataToRemoteSheet(currentUrl, payload)
      .then((res) => {
        if (res.success) {
          markSyncSuccess();
        }
      })
      .catch((err) => {
        console.warn('Error al propagar cambios a Google Sheets:', err);
      });
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

    triggerCloudPush({
      materials: mats,
      personnel: pers,
      guardShifts: shifts,
      monthlyArchives: archives,
    });
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

    let targetPerson: Personnel | undefined;
    setState((prev) => {
      const updatedPersonnel = prev.personnel.map((p) => {
        if (p.id === userId || p.name === prev.currentUser.name) {
          targetPerson = { ...p, pin: pin || undefined };
          return targetPerson;
        }
        return p;
      });
      saveLocalPersonnel(updatedPersonnel);
      return { ...prev, personnel: updatedPersonnel };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl && targetPerson) {
      apiUpdatePersonnel(currentUrl, (targetPerson as Personnel).id, { pin: pin || '' }, targetPerson)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error syncing PIN to Sheets:', err));
    }

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
    const timestampStr = getFormattedDateTime();
    const isDiscarded = updatedSignal.status === 'Descartado' || updatedSignal.isDiscarded;
    const isFinalized = !isDiscarded && (updatedSignal.status === 'Finalizado' || updatedSignal.isFinalized);
    const isCataloged = !isDiscarded && (updatedSignal.status === 'Por Archivar' || updatedSignal.isCataloged || isFinalized);

    const finalSignal: MaterialSignal = {
      ...updatedSignal,
      isDiscarded,
      isCataloged,
      isFinalized,
      status: isDiscarded ? 'Descartado' : isFinalized ? 'Finalizado' : isCataloged ? 'Por Archivar' : 'Registrado',
    };

    if (isDiscarded) {
      finalSignal.catalogedBy = undefined;
      finalSignal.catalogedAt = undefined;
      finalSignal.finalizedBy = undefined;
      finalSignal.finalizedAt = undefined;
    } else {
      if (isCataloged && (!finalSignal.catalogedBy || finalSignal.catalogedBy === 'N/A')) {
        finalSignal.catalogedBy = state.currentUser.name;
        finalSignal.catalogedAt = timestampStr;
      }
      if (isFinalized && (!finalSignal.finalizedBy || finalSignal.finalizedBy === 'N/A')) {
        finalSignal.finalizedBy = state.currentUser.name;
        finalSignal.finalizedAt = timestampStr;
      }
    }

    setState((prev) => {
      const updatedMaterials = prev.materials.map((m) => {
        if (m.id === finalSignal.id) return finalSignal;
        if (m.familyId && m.familyId === finalSignal.familyId && finalSignal.title) {
          return { ...m, title: finalSignal.title, division: finalSignal.division };
        }
        return m;
      });
      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      if (finalSignal.familyId && finalSignal.title) {
        apiBatchUpdateFamily(currentUrl, finalSignal.familyId, {
          title: finalSignal.title,
          division: finalSignal.division
        }).catch((e) => console.warn('Family title sync error:', e));
      }

      apiUpdateMaterial(currentUrl, finalSignal.id, undefined, finalSignal)
        .then((res) => {
          if (res.success) {
            markSyncSuccess();
            showToast(`Señal ${finalSignal.id} sincronizada en Google Sheets.`, 'success');
          } else {
            showToast(`Aviso de Sheets: ${res.message || 'No se pudo actualizar en la hoja'}`, 'error');
          }
        })
        .catch((err) => {
          console.warn('Error updating material in Sheets:', err);
          showToast(`Error al enviar modificación a Google Sheets: ${err?.message || err}`, 'error');
        });
    }

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

    let updatedTarget: MaterialSignal | undefined;
    setState((prev) => {
      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.id === signalId) {
          const isDiscarded = newStatus === 'Descartado';
          const isCataloged = !isDiscarded && (newStatus === 'Por Archivar' || newStatus === 'Finalizado');
          const isFinalized = !isDiscarded && newStatus === 'Finalizado';

          const updated: MaterialSignal = {
            ...mat,
            status: newStatus,
            isIngested: true,
            isCataloged,
            isFinalized,
            isDiscarded,
          };

          if (isDiscarded || newStatus === 'Registrado') {
            updated.catalogedBy = undefined;
            updated.catalogedAt = undefined;
            updated.finalizedBy = undefined;
            updated.finalizedAt = undefined;
          } else {
            if (isCataloged) {
              updated.catalogedBy = (!updated.catalogedBy || updated.catalogedBy === 'N/A') ? prev.currentUser.name : updated.catalogedBy;
              updated.catalogedAt = (!updated.catalogedAt || updated.catalogedAt === 'N/A') ? timestampStr : updated.catalogedAt;
              if (!updated.assignedTo) {
                updated.assignedTo = prev.currentUser.name;
                updated.assignedToRole = prev.currentUser.role;
                updated.assignedAt = timestampStr;
              }
            }
            if (isFinalized) {
              updated.finalizedBy = prev.currentUser.name;
              updated.finalizedAt = timestampStr;
              if (!updated.catalogedBy || updated.catalogedBy === 'N/A') {
                updated.catalogedBy = prev.currentUser.name;
                updated.catalogedAt = timestampStr;
              }
            }
          }

          updatedTarget = updated;
          return updated;
        }
        return mat;
      });

      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl && updatedTarget) {
      apiUpdateMaterial(currentUrl, signalId, undefined, updatedTarget)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error updating status in Sheets:', err));
    }

    showToast(`Señal ${signalId} actualizada a "${newStatus}".`);
  };

  // Toggle single boolean field independently
  const handleToggleSignalBoolean = (signalId: string, flag: 'isIngested' | 'isCataloged' | 'isFinalized' | 'isDiscarded') => {
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

    let updatedTarget: MaterialSignal | undefined;
    setState((prev) => {
      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.id === signalId) {
          const newVal = !mat[flag];
          const updated: MaterialSignal = { ...mat, [flag]: newVal };

          // Maintain audit metadata
          if (flag === 'isDiscarded') {
            if (newVal) {
              updated.status = 'Descartado';
              updated.isCataloged = false;
              updated.isFinalized = false;
              updated.catalogedBy = undefined;
              updated.catalogedAt = undefined;
              updated.finalizedBy = undefined;
              updated.finalizedAt = undefined;
            } else {
              updated.status = 'Registrado';
            }
          }
          if (flag === 'isCataloged') {
            if (newVal) {
              updated.catalogedBy = prev.currentUser.name;
              updated.catalogedAt = timestampStr;
              updated.isDiscarded = false;
              // Auto assign if not assigned
              if (!updated.assignedTo) {
                updated.assignedTo = prev.currentUser.name;
                updated.assignedToRole = prev.currentUser.role;
                updated.assignedAt = timestampStr;
              }
            } else {
              updated.catalogedBy = undefined;
              updated.catalogedAt = undefined;
              updated.isFinalized = false;
              updated.finalizedBy = undefined;
              updated.finalizedAt = undefined;
            }
          }
          if (flag === 'isFinalized') {
            if (newVal) {
              updated.finalizedBy = prev.currentUser.name;
              updated.finalizedAt = timestampStr;
              updated.isCataloged = true; // Auto mark cataloged if finalized
              updated.isDiscarded = false;
              if (!updated.catalogedBy || updated.catalogedBy === 'N/A') {
                updated.catalogedBy = prev.currentUser.name;
                updated.catalogedAt = timestampStr;
              }
            } else {
              updated.finalizedBy = undefined;
              updated.finalizedAt = undefined;
            }
          }

          // Sync status text for consistency
          if (updated.isDiscarded) updated.status = 'Descartado';
          else if (updated.isFinalized) updated.status = 'Finalizado';
          else if (updated.isCataloged) updated.status = 'Por Archivar';
          else updated.status = 'Registrado';

          updatedTarget = updated;
          return updated;
        }
        return mat;
      });

      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl && updatedTarget) {
      apiUpdateMaterial(currentUrl, signalId, undefined, updatedTarget)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error updating boolean in Sheets:', err));
    }

    showToast(`Señal ${signalId}: ${flag} actualizado.`);
  };

  // Assign or Unassign Signal / ENTIRE FAMILY to Documentalista
  const handleAssignSignal = (signalId: string, assignToUser: string | null) => {
    const timestampStr = getFormattedDateTime();
    const targetMat = state.materials.find((m) => m.id === signalId);
    const targetFamilyId = targetMat?.familyId || signalId;
    let assignedRole: string | undefined;

    setState((prev) => {
      if (assignToUser) {
        const targetUser = prev.personnel.find((u) => u.name === assignToUser) || prev.currentUser;
        assignedRole = targetUser.role;
      }

      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.familyId === targetFamilyId || mat.id === signalId) {
          if (assignToUser) {
            return {
              ...mat,
              assignedTo: assignToUser,
              assignedPersons: [assignToUser],
              assignedToRole: assignedRole,
              assignedAt: timestampStr,
            };
          } else {
            return {
              ...mat,
              assignedTo: undefined,
              assignedPersons: undefined,
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

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiBatchUpdateFamily(currentUrl, targetFamilyId, {
        assignedTo: assignToUser || 'Sin asignar',
        assignedPersons: assignToUser ? [assignToUser] : [],
        assignedToRole: assignedRole || '',
        assignedAt: assignToUser ? timestampStr : '',
      })
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error assigning family in Sheets:', err));
    }

    if (assignToUser) {
      showToast(`Familia completa (${targetMat?.title || targetFamilyId}) asignada a ${assignToUser}.`);
    } else {
      showToast(`Familia completa (${targetMat?.title || targetFamilyId}) liberada.`);
    }
  };

  // Assign Multiple Persons to ENTIRE FAMILY
  const handleAssignMultiplePersons = (signalId: string, assignedPersons: string[]) => {
    const timestampStr = getFormattedDateTime();
    const targetMat = state.materials.find((m) => m.id === signalId);
    const targetFamilyId = targetMat?.familyId || signalId;
    const mainAssignee = assignedPersons.length > 0 ? assignedPersons[0] : undefined;
    let mainRole: string | undefined;

    setState((prev) => {
      if (mainAssignee) {
        const targetUser = prev.personnel.find((u) => u.name === mainAssignee) || prev.currentUser;
        mainRole = targetUser.role;
      }

      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.familyId === targetFamilyId || mat.id === signalId) {
          if (assignedPersons.length > 0) {
            return {
              ...mat,
              assignedPersons: [...assignedPersons],
              assignedTo: assignedPersons.join(', '),
              assignedToRole: mainRole || mat.assignedToRole,
              assignedAt: timestampStr,
            };
          } else {
            return {
              ...mat,
              assignedPersons: undefined,
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

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiBatchUpdateFamily(currentUrl, targetFamilyId, {
        assignedPersons: assignedPersons,
        assignedTo: assignedPersons.length > 0 ? assignedPersons.join(', ') : 'Sin asignar',
        assignedToRole: mainRole || '',
        assignedAt: assignedPersons.length > 0 ? timestampStr : '',
      })
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error assigning team to family in Sheets:', err));
    }

    showToast(`Familia completa (${targetMat?.title || targetFamilyId}) asignada a ${assignedPersons.length > 0 ? `${assignedPersons.length} persona(s)` : 'nadie (liberada)'}.`);
  };

  // Batch Toggle Family Boolean
  const handleBatchToggleFamilyBoolean = (familyId: string, flag: 'isIngested' | 'isCataloged' | 'isFinalized' | 'isDiscarded', value: boolean) => {
    const timestampStr = getFormattedDateTime();

    if (flag === 'isFinalized' && value) {
      const checkFin = canUserFinalizeSignal(state.currentUser);
      if (!checkFin.allowed) {
        showToast(checkFin.reason || 'Solo los Jefes y Coordinadores pueden finalizar tareas.', 'error');
        return;
      }
    }

    const auditUpdates: Partial<MaterialSignal> = { [flag]: value };

    if (flag === 'isDiscarded') {
      auditUpdates.status = value ? 'Descartado' : 'Registrado';
      if (value) {
        auditUpdates.isCataloged = false;
        auditUpdates.isFinalized = false;
        auditUpdates.catalogedBy = 'N/A';
        auditUpdates.catalogedAt = 'N/A';
        auditUpdates.finalizedBy = 'N/A';
        auditUpdates.finalizedAt = 'N/A';
      }
    }
    if (flag === 'isCataloged') {
      if (value) {
        auditUpdates.catalogedBy = state.currentUser.name;
        auditUpdates.catalogedAt = timestampStr;
        auditUpdates.isDiscarded = false;
        auditUpdates.status = 'Por Archivar';
      } else {
        auditUpdates.catalogedBy = 'N/A';
        auditUpdates.catalogedAt = 'N/A';
        auditUpdates.isFinalized = false;
        auditUpdates.finalizedBy = 'N/A';
        auditUpdates.finalizedAt = 'N/A';
        auditUpdates.status = 'Registrado';
      }
    }
    if (flag === 'isFinalized') {
      if (value) {
        auditUpdates.finalizedBy = state.currentUser.name;
        auditUpdates.finalizedAt = timestampStr;
        auditUpdates.isCataloged = true;
        auditUpdates.status = 'Finalizado';
        auditUpdates.isDiscarded = false;
        auditUpdates.catalogedBy = state.currentUser.name;
        auditUpdates.catalogedAt = timestampStr;
      } else {
        auditUpdates.finalizedBy = 'N/A';
        auditUpdates.finalizedAt = 'N/A';
        auditUpdates.isFinalized = false;
        auditUpdates.status = 'Por Archivar';
      }
    }

    setState((prev) => {
      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.familyId === familyId) {
          const updated: MaterialSignal = { ...mat, [flag]: value };

          if (flag === 'isDiscarded') {
            if (value) {
              updated.status = 'Descartado';
              updated.isCataloged = false;
              updated.isFinalized = false;
              updated.catalogedBy = undefined;
              updated.catalogedAt = undefined;
              updated.finalizedBy = undefined;
              updated.finalizedAt = undefined;
            } else {
              updated.status = 'Registrado';
            }
          }
          if (flag === 'isCataloged') {
            if (value) {
              updated.catalogedBy = prev.currentUser.name;
              updated.catalogedAt = timestampStr;
              updated.isDiscarded = false;
            } else {
              updated.catalogedBy = undefined;
              updated.catalogedAt = undefined;
              updated.isFinalized = false;
              updated.finalizedBy = undefined;
              updated.finalizedAt = undefined;
            }
          }
          if (flag === 'isFinalized') {
            if (value) {
              updated.finalizedBy = prev.currentUser.name;
              updated.finalizedAt = timestampStr;
              updated.isCataloged = true;
              updated.isDiscarded = false;
              if (!updated.catalogedBy || updated.catalogedBy === 'N/A') {
                updated.catalogedBy = prev.currentUser.name;
                updated.catalogedAt = timestampStr;
              }
            } else {
              updated.finalizedBy = undefined;
              updated.finalizedAt = undefined;
            }
          }

          if (updated.isDiscarded) updated.status = 'Descartado';
          else if (updated.isFinalized) updated.status = 'Finalizado';
          else if (updated.isCataloged) updated.status = 'Por Archivar';
          else updated.status = 'Registrado';

          return updated;
        }
        return mat;
      });

      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiBatchUpdateFamily(currentUrl, familyId, auditUpdates)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error batch updating family in Sheets:', err));
    }

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

    const isDiscarded = newStatus === 'Descartado';
    const isCataloged = !isDiscarded && (newStatus === 'Por Archivar' || newStatus === 'Finalizado');
    const isFinalized = !isDiscarded && newStatus === 'Finalizado';
    const familyUpdates: Partial<MaterialSignal> = {
      status: newStatus,
      isIngested: true,
      isCataloged,
      isFinalized,
      isDiscarded,
    };

    if (isDiscarded) {
      familyUpdates.catalogedBy = 'N/A';
      familyUpdates.catalogedAt = 'N/A';
      familyUpdates.finalizedBy = 'N/A';
      familyUpdates.finalizedAt = 'N/A';
    } else if (newStatus === 'Registrado') {
      familyUpdates.catalogedBy = 'N/A';
      familyUpdates.catalogedAt = 'N/A';
      familyUpdates.finalizedBy = 'N/A';
      familyUpdates.finalizedAt = 'N/A';
    } else if (newStatus === 'Por Archivar') {
      familyUpdates.catalogedBy = state.currentUser.name;
      familyUpdates.catalogedAt = timestampStr;
      familyUpdates.finalizedBy = 'N/A';
      familyUpdates.finalizedAt = 'N/A';
    } else if (newStatus === 'Finalizado') {
      familyUpdates.finalizedBy = state.currentUser.name;
      familyUpdates.finalizedAt = timestampStr;
      familyUpdates.catalogedBy = state.currentUser.name;
      familyUpdates.catalogedAt = timestampStr;
    }

    setState((prev) => {
      const updatedMaterials = prev.materials.map((mat) => {
        if (mat.familyId === familyId) {
          const updated: MaterialSignal = {
            ...mat,
            status: newStatus,
            isIngested: true,
            isCataloged,
            isFinalized,
            isDiscarded,
          };

          if (isDiscarded || newStatus === 'Registrado') {
            updated.catalogedBy = undefined;
            updated.catalogedAt = undefined;
            updated.finalizedBy = undefined;
            updated.finalizedAt = undefined;
          } else if (newStatus === 'Por Archivar') {
            updated.catalogedBy = prev.currentUser.name;
            updated.catalogedAt = timestampStr;
            updated.finalizedBy = undefined;
            updated.finalizedAt = undefined;
          } else if (newStatus === 'Finalizado') {
            updated.finalizedBy = prev.currentUser.name;
            updated.finalizedAt = timestampStr;
            if (!updated.catalogedBy || updated.catalogedBy === 'N/A') {
              updated.catalogedBy = prev.currentUser.name;
              updated.catalogedAt = timestampStr;
            }
          }

          return updated;
        }
        return mat;
      });

      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiBatchUpdateFamily(currentUrl, familyId, familyUpdates)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error updating family status in Sheets:', err));
    }

    showToast(`Familia ${familyId} actualizada a "${newStatus}".`);
  };

  // Add New Materials
  const handleAddMaterials = (newSignals: MaterialSignal[]) => {
    if (!newSignals || newSignals.length === 0) return;

    setState((prev) => {
      const updatedMaterials = deduplicateMaterials([...newSignals, ...prev.materials]);
      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiCreateMaterialsBatch(currentUrl, newSignals)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error creating materials in Sheets:', err));
    }

    showToast(`Registrado(s) ${newSignals.length} elemento(s) audiovisual(es) con éxito.`);
  };

  // Delete Signal
  const handleDeleteSignal = (signalId: string) => {
    if (!canUserDeleteMaterial(state.currentUser)) {
      showToast('Acceso Restringido: Solo Coordinadores, Jefes de División y Gerencia pueden eliminar material.', 'error');
      return;
    }

    setState((prev) => {
      const updatedMaterials = prev.materials.filter((m) => m.id !== signalId);
      saveLocalMaterials(updatedMaterials);
      return { ...prev, materials: updatedMaterials };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiDeleteMaterial(currentUrl, signalId)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error deleting material in Sheets:', err));
    }

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

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiPurgeFinalizedMaterials(currentUrl, signalIdsToPurge, monthlyLog)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error purging finalized in Sheets:', err));
    }

    showToast(`Depuración completada: ${signalIdsToPurge.length} materiales eliminados y guardados en historial mensual.`, 'success');
  };

  const handleSaveMonthlyLogOnly = (monthlyLog: MonthlyArchiveLog) => {
    setState((prev) => {
      const updatedArchives = [monthlyLog, ...(prev.monthlyArchives || [])];
      saveLocalMonthlyArchives(updatedArchives);
      createBackupSnapshot(prev.materials, prev.personnel, prev.guardShifts, updatedArchives, 'Cierre de Mes');
      return { ...prev, monthlyArchives: updatedArchives };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiSaveMonthlyArchive(currentUrl, monthlyLog)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error saving monthly log in Sheets:', err));
    }

    showToast('Resumen mensual registrado y respaldado exitosamente.', 'success');
  };

  const handleClearMonthlyArchives = () => {
    if (window.confirm('¿Está seguro de eliminar el historial de reportes mensuales de cierres?')) {
      setState((prev) => {
        saveLocalMonthlyArchives([]);
        createBackupSnapshot(prev.materials, prev.personnel, prev.guardShifts, [], 'Limpieza de Cierres');
        return { ...prev, monthlyArchives: [] };
      });

      const currentUrl = stateRef.current.appsScriptUrl;
      if (currentUrl) {
        apiClearMonthlyArchives(currentUrl)
          .then((res) => { if (res.success) markSyncSuccess(); })
          .catch((err) => console.warn('Error clearing monthly archives in Sheets:', err));
      }

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

      const currentUrl = stateRef.current.appsScriptUrl;
      if (currentUrl) {
        apiClearAllGuardShifts(currentUrl)
          .then((res) => { if (res.success) markSyncSuccess(); })
          .catch((err) => console.warn('Error clearing guard shifts in Sheets:', err));
      }

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

    let updatedPersonnelToSync: Personnel[] = [];

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

      updatedPersonnelToSync = updatedPersonnel;

      saveLocalGuardShifts(updatedShifts);
      saveLocalPersonnel(updatedPersonnel);

      return {
        ...prev,
        guardShifts: updatedShifts,
        personnel: updatedPersonnel,
      };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiSaveBatchGuardShifts(currentUrl, newShiftRecords, replaceTargetDate)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error saving shifts to Sheets:', err));

      // Also update the affected personnel records in Sheets
      updatedPersonnelToSync.forEach((p) => {
        if (workedMap.has(p.id) || generatedMap.has(p.id) || takenMap.has(p.id)) {
          apiUpdatePersonnel(currentUrl, p.id, undefined, p)
            .catch((err) => console.warn('Error updating personnel balance in Sheets:', err));
        }
      });
    }

    showToast(`Asignación de turno(s) guardada con éxito (${newShiftsData.length}).`);
  };

  const handleAddGuardShift = (shiftData: Omit<GuardShiftRecord, 'id' | 'createdAt'>) => {
    handleAddBatchGuardShifts([shiftData]);
  };

  // Delete Shift Record
  const handleDeleteGuardShift = (shiftId: string) => {
    let affectedPerson: Personnel | undefined;

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

          affectedPerson = {
            ...per,
            guardDaysWorked: worked,
            daysOffGenerated: generated,
            daysOffTaken: taken,
            balanceDays: balance,
          };
          return affectedPerson;
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

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiDeleteGuardShift(currentUrl, shiftId)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error deleting shift in Sheets:', err));

      if (affectedPerson) {
        apiUpdatePersonnel(currentUrl, (affectedPerson as Personnel).id, undefined, affectedPerson)
          .catch((err) => console.warn('Error updating personnel balance in Sheets:', err));
      }
    }

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

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiSavePersonnel(currentUrl, newPerson)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error saving personnel to Sheets:', err));
    }

    showToast(`Personal registrado: ${newPerson.name}`);
  };

  // Delete Personnel
  const handleDeletePersonnel = (personnelId: string) => {
    setState((prev) => {
      const updatedPersonnel = prev.personnel.filter((p) => p.id !== personnelId);
      saveLocalPersonnel(updatedPersonnel);
      return { ...prev, personnel: updatedPersonnel };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl) {
      apiDeletePersonnel(currentUrl, personnelId)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error deleting personnel from Sheets:', err));
    }

    showToast('Personal eliminado con éxito.');
  };

  // Quick Adjust Days for Personnel
  const handleQuickAdjustDays = (personnelId: string, type: 'guard' | 'dayOff') => {
    let updatedPerson: Personnel | undefined;
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

          updatedPerson = {
            ...per,
            guardDaysWorked: worked,
            daysOffGenerated: generated,
            daysOffTaken: taken,
            balanceDays: balance,
          };
          return updatedPerson;
        }
        return per;
      });

      saveLocalPersonnel(updatedPersonnel);
      return { ...prev, personnel: updatedPersonnel };
    });

    const currentUrl = stateRef.current.appsScriptUrl;
    if (currentUrl && updatedPerson) {
      apiUpdatePersonnel(currentUrl, personnelId, undefined, updatedPerson)
        .then((res) => { if (res.success) markSyncSuccess(); })
        .catch((err) => console.warn('Error updating personnel in Sheets:', err));
    }

    showToast('Balance de personal actualizado.');
  };

  // Save Apps Script URL
  const handleSaveAppsScriptUrl = (url: string) => {
    setState((prev) => ({ ...prev, appsScriptUrl: url }));
    saveLocalAppsScriptUrl(url);
    showToast('URL de Google Apps Script actualizada.');
    if (url && url.startsWith('http')) {
      setTimeout(() => {
        handleTriggerSync(true);
      }, 300);
    }
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
        isSyncing={state.isSyncing}
        lastSyncTime={state.lastSyncTime}
        onTriggerSync={() => handleTriggerSync(true)}
        syncError={state.syncError}
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
            isSyncing={state.isSyncing}
            onTriggerSync={() => handleTriggerSync(true)}
            onCleanDuplicates={handleCleanDuplicatesInSheet}
            onReorganizeSheets={handleReorganizeAllSheets}
            syncError={state.syncError}
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
          onDelete={handleDeleteSignal}
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
