import { useMemo, useState, type MouseEvent } from 'react';
import {
  User,
  UserX,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Phone,
  Calendar,
  Clock,
  BarChart3,
  Droplets,
  TreePine,
  Bug,
  Bell,
  AlertTriangle,
  X,
} from 'lucide-react';
import { SelectWithOther } from './ui/SelectWithOther';
import { CoffeeFieldLandscapeMap } from './CoffeeFieldLandscapeMap';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { BATAAN_PROVINCE } from '../data/bataanAddressCatalog';
import { useFarmData } from '../store/FarmDataProvider';
import { createWorkerAuthAccount, type CreatedWorkerAccount } from '../auth/workerAccount';
import { distinctRoles, hourlyRateForWorkerRole, payrollLineAmount } from '../lib/farmFinance';
import { runSave, showSaveError } from '../lib/saveFeedback';
import {
  isAtLeast18,
  isValidPhone11,
  parseWorkerDetails,
  sanitizePhoneInput,
  uiToWorkerRecord,
  workerRecordToFormInput,
  workerRecordToUi,
  type WorkerUi,
} from '../lib/workerUi';
import {
  WorkerFormDialog,
  composeWorkerAddress,
  type WorkerFormDraft,
} from './WorkerFormDialog';
import {
  emptyCoffeeField,
  emptyIrrigationSystem,
  emptyPestControlLog,
  newFarmEntityId,
} from '../lib/farmOpsDefaults';
import type {
  AppState,
  AttendanceRecord,
  CoffeeFieldRecord,
  HarvestReadinessReportRecord,
  IrrigationDamageReportRecord,
  IrrigationSystemRecord,
  PestControlRecord,
  WorkerRecord,
} from '../types/appState';

const emptyWorkerDraft = (): WorkerFormDraft => ({
  name: '',
  birthday: '',
  sex: '',
  phone: '',
  role: 'Harvester',
  municipality: '',
  barangay: '',
  street: '',
  houseNumber: '',
  province: BATAAN_PROVINCE,
  imageUrl: '',
  status: 'active',
  emergencyName: '',
  emergencyRelationship: '',
  emergencyPhone: '',
});

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-[#4a2c2a]/25 bg-white px-3 py-2 text-sm text-[#3e2723] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

function isHarvestReady(field: CoffeeFieldRecord): boolean {
  const status = field.status.toLowerCase();
  if (status.includes('ready') || status.includes('harvest')) return true;
  if (field.productivity >= 85) return true;
  const parsed = Date.parse(field.nextHarvest);
  return Number.isFinite(parsed) && parsed <= Date.now();
}

function attendanceSortValue(attendance: AttendanceRecord): number {
  const parsed = Date.parse(`${attendance.date || ''}T${attendance.clockIn || '00:00'}`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatClock24h(raw?: string): string {
  const value = raw?.trim();
  if (!value) return '--:--';
  const match = value.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return value;
  const lowered = value.toLowerCase();
  const isPm = lowered.includes('pm');
  const isAm = lowered.includes('am');
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (isPm && hour >= 1 && hour <= 11) hour += 12;
  if (isAm && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return value;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatHoursWorked(attendance: AttendanceRecord): string {
  const hours = Number(attendance.hoursWorked ?? 0);
  return Number.isFinite(hours) && hours > 0 ? hours.toFixed(2) : '0.00';
}



export function FarmManagement() {
  const { state, loading, updateState, saving } = useFarmData();
  const workers = state.workers.map((w, index) => workerRecordToUi(w, index));
  const activeWorkers = workers.filter((worker) => worker.status === 'active');
  const inactiveWorkers = workers.filter((worker) => worker.status === 'inactive');
  const coffeeFields = state.coffeeFields;
  const irrigationSystems = state.irrigationSystems;
  const irrigationDamageReports = state.irrigationDamageReports ?? [];
  const pestControlLogs = state.pestControlLogs;
  const recentAttendance = useMemo(
    () => [...state.attendance].sort((a, b) => attendanceSortValue(b) - attendanceSortValue(a)).slice(0, 12),
    [state.attendance],
  );
  const recentTasks = state.tasks.slice(0, 8);
  const harvestReadinessReports = useMemo(
    () => [...state.harvestReadinessReports].sort((a, b) => Date.parse(b.reportedAt || '') - Date.parse(a.reportedAt || '')),
    [state.harvestReadinessReports],
  );

  const [selectedWorkerIndex, setSelectedWorkerIndex] = useState<number | null>(null);
  const [workerFormOpen, setWorkerFormOpen] = useState(false);
  const [editingWorkerIndex, setEditingWorkerIndex] = useState<number | null>(null);
  const [form, setForm] = useState<WorkerFormDraft>(() => emptyWorkerDraft());
  const [workerFormError, setWorkerFormError] = useState<string | null>(null);
  const [createdWorkerAccount, setCreatedWorkerAccount] = useState<(CreatedWorkerAccount & { phone?: string }) | null>(null);

  const [coffeeDialogOpen, setCoffeeDialogOpen] = useState(false);
  const [coffeeEditIndex, setCoffeeEditIndex] = useState<number | null>(null);
  const [irrigationDialogOpen, setIrrigationDialogOpen] = useState(false);
  const [irrigationEditIndex, setIrrigationEditIndex] = useState<number | null>(null);
  const [sprinklerAddSection, setSprinklerAddSection] = useState('');
  const [sprinklerAddCount, setSprinklerAddCount] = useState(1);
  const [sprinklerAddCoverage, setSprinklerAddCoverage] = useState('100%');
  const [pestDialogOpen, setPestDialogOpen] = useState(false);
  const [pestEditIndex, setPestEditIndex] = useState<number | null>(null);
  const [coffeeForm, setCoffeeForm] = useState<CoffeeFieldRecord | null>(null);
  const [irrigationForm, setIrrigationForm] = useState<IrrigationSystemRecord | null>(null);
  const [pestForm, setPestForm] = useState<PestControlRecord | null>(null);
  const [deleteSprinklerTarget, setDeleteSprinklerTarget] = useState<{
    type: 'single' | 'section';
    index?: number;
    sectionName?: string;
    sprinklerZone?: string;
  } | null>(null);

  const [dismissedReportIds, setDismissedReportIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dismissed_irrigation_report_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [reportDamageDialogOpen, setReportDamageDialogOpen] = useState(false);
  const [reportDamageForm, setReportDamageForm] = useState({
    sprinklerZone: '',
    details: '',
    workerName: 'Juan Dela Cruz (Worker)',
  });

  const latestPendingReport = useMemo(() => {
    const pendingList: Array<{
      id: string;
      type: 'irrigation' | 'equipment' | 'supply' | 'pest' | 'harvest';
      title: string;
      subtitle: string;
      details: string;
      reportedBy: string;
      reportedAt: string;
      timestamp: number;
      rawReportId: string;
    }> = [];

    // 1. Irrigation / Sprinkler damage reports
    (state.irrigationDamageReports ?? []).forEach((r, idx) => {
      const status = (r.status || 'Pending').trim().toLowerCase();
      if (status === 'pending') {
        const id = r.reportId || `irrigation-${idx}-${r.reportedAt}`;
        pendingList.push({
          id,
          type: 'irrigation',
          title: r.sprinklerLabel?.trim() || r.zone?.trim() || 'Sprinkler Problem Reported',
          subtitle: r.zone && r.zone.trim() !== (r.sprinklerLabel || '').trim() ? `Zone: ${r.zone}` : 'Sprinkler System',
          details: r.details || 'Sprinkler damage reported by worker',
          reportedBy: r.reportedBy || 'Worker',
          reportedAt: r.reportedAt || 'Just now',
          timestamp: Date.parse(r.reportedAt || '') || (Date.now() - idx),
          rawReportId: r.reportId || '',
        });
      }
    });

    // 2. Equipment condition reports
    (state.equipmentReports ?? []).forEach((r, idx) => {
      if (!r.reviewed && !r.fixedAt && !r.isFixedReport) {
        const id = r.reportId || `equipment-${idx}-${r.reportedAt}`;
        pendingList.push({
          id,
          type: 'equipment',
          title: `${r.equipmentName || 'Equipment'} Issue`,
          subtitle: r.isWrecked ? 'Condition: Wrecked / Broken' : 'Condition: Needs Maintenance',
          details: r.notes || 'Equipment issue reported by staff',
          reportedBy: r.reportedBy || 'Worker',
          reportedAt: r.reportedAt || 'Just now',
          timestamp: Date.parse(r.reportedAt || '') || (Date.now() - idx),
          rawReportId: r.reportId || '',
        });
      }
    });

    // 3. Consumable supply reports
    (state.consumableReports ?? []).forEach((r, idx) => {
      if (!r.reviewed) {
        const id = r.reportId || `supply-${idx}-${r.reportedAt}`;
        pendingList.push({
          id,
          type: 'supply',
          title: `${r.supplyName || 'Supply'} Report`,
          subtitle: r.isRunOut ? 'Status: Out of Stock' : 'Status: Stock Update',
          details: r.notes || 'Consumable supply report submitted by worker',
          reportedBy: r.reportedBy || 'Worker',
          reportedAt: r.reportedAt || 'Just now',
          timestamp: Date.parse(r.reportedAt || '') || (Date.now() - idx),
          rawReportId: r.reportId || '',
        });
      }
    });

    // 4. Pest & disease logs
    (state.pestControlLogs ?? []).forEach((r, idx) => {
      const status = (r.status || 'Pending').trim().toLowerCase();
      if (status === 'pending') {
        const id = r.pestControlId || `pest-${idx}-${r.date}`;
        pendingList.push({
          id,
          type: 'pest',
          title: `Pest/Disease: ${r.issue || 'Issue Reported'}`,
          subtitle: `Zone: ${r.field || 'General'}${r.treeNumber ? ` · Tree #${r.treeNumber}` : ''}`,
          details: r.treatment ? `Plan: ${r.treatment}` : 'Pest/disease issue reported by worker',
          reportedBy: r.reportedBy || 'Worker',
          reportedAt: r.date || 'Just now',
          timestamp: Date.parse(r.date || '') || (Date.now() - idx),
          rawReportId: r.pestControlId || '',
        });
      }
    });

    // 5. Harvest readiness reports
    (state.harvestReadinessReports ?? []).forEach((r, idx) => {
      const status = (r.status || 'Pending Review').trim().toLowerCase();
      if (status.includes('pending')) {
        const id = r.reportId || `harvest-${idx}-${r.reportedAt}`;
        pendingList.push({
          id,
          type: 'harvest',
          title: `Harvest Readiness: ${r.zone || 'Crop Zone'}`,
          subtitle: `Estimated Yield: ${r.expectedWeight || 'N/A'}`,
          details: r.notes || 'Harvest readiness report submitted by worker',
          reportedBy: r.reportedBy || 'Worker',
          reportedAt: r.reportedAt || 'Just now',
          timestamp: Date.parse(r.reportedAt || '') || (Date.now() - idx),
          rawReportId: r.reportId || '',
        });
      }
    });

    if (pendingList.length === 0) return null;
    return pendingList.sort((a, b) => b.timestamp - a.timestamp)[0];
  }, [
    state.irrigationDamageReports,
    state.equipmentReports,
    state.consumableReports,
    state.pestControlLogs,
    state.harvestReadinessReports,
  ]);

  const dismissNotification = (notificationId: string) => {
    if (!notificationId) return;
    setDismissedReportIds((prev) => {
      if (prev.includes(notificationId)) return prev;
      const next = [...prev, notificationId];
      try {
        localStorage.setItem('dismissed_irrigation_report_ids', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const scrollToReport = (item?: typeof latestPendingReport) => {
    if (!item) return;
    dismissNotification(item.id);

    let sectionId = 'sprinkler-damage-reports-section';
    let targetId = item.rawReportId ? `report-${item.rawReportId}` : '';

    if (item.type === 'pest') {
      sectionId = 'pest-reports-section';
      targetId = item.rawReportId ? `pest-${item.rawReportId}` : '';
    } else if (item.type === 'harvest') {
      sectionId = 'harvest-readiness-reports-section';
    }

    const targetElement = targetId ? document.getElementById(targetId) : null;
    const sectionElement = document.getElementById(sectionId);
    const elem = targetElement || sectionElement;
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elem.classList.add('ring-4', 'ring-[#d4183d]/50', 'transition-all', 'duration-300');
      setTimeout(() => {
        elem.classList.remove('ring-4', 'ring-[#d4183d]/50');
      }, 3000);
    }
  };

  const resolveReportFromNotification = async (item?: typeof latestPendingReport) => {
    if (!item) return;
    dismissNotification(item.id);

    const ok = await runSave('Report Status', () =>
      updateState((prev) => {
        if (item.type === 'irrigation') {
          const next = (prev.irrigationDamageReports ?? []).map((r) =>
            (r.reportId || '') === item.rawReportId || r.sprinklerLabel === item.title ? { ...r, status: 'Resolved' } : r
          );
          return { ...prev, irrigationDamageReports: next };
        } else if (item.type === 'equipment') {
          const next = (prev.equipmentReports ?? []).map((r) =>
            (r.reportId || '') === item.rawReportId ? { ...r, reviewed: true } : r
          );
          return { ...prev, equipmentReports: next };
        } else if (item.type === 'supply') {
          const next = (prev.consumableReports ?? []).map((r) =>
            (r.reportId || '') === item.rawReportId ? { ...r, reviewed: true } : r
          );
          return { ...prev, consumableReports: next };
        } else if (item.type === 'pest') {
          const next = (prev.pestControlLogs ?? []).map((r) =>
            (r.pestControlId || '') === item.rawReportId ? { ...r, status: 'Resolved' } : r
          );
          return { ...prev, pestControlLogs: next };
        } else if (item.type === 'harvest') {
          const next = (prev.harvestReadinessReports ?? []).map((r) =>
            (r.reportId || '') === item.rawReportId ? { ...r, status: 'Approved' } : r
          );
          return { ...prev, harvestReadinessReports: next };
        }
        return prev;
      })
    );

    if (ok) {
      dismissNotification(item.id);
    }
  };

  const submitWorkerDamageReport = async () => {
    if (!reportDamageForm.sprinklerZone || !reportDamageForm.details.trim()) {
      showSaveError('Please select a sprinkler and describe the problem.');
      return;
    }

    const selectedSprinkler = irrigationSystems.find((s) => s.zone === reportDamageForm.sprinklerZone);
    const sectionName = selectedSprinkler?.type || 'General Field';
    const newReportId = newFarmEntityId();
    const timestamp = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const newReport: IrrigationDamageReportRecord = {
      reportId: newReportId,
      irrigationId: selectedSprinkler?.irrigationId,
      zone: sectionName,
      sprinklerLabel: reportDamageForm.sprinklerZone,
      details: reportDamageForm.details.trim(),
      reportedAt: timestamp,
      reportedBy: reportDamageForm.workerName.trim() || 'Worker',
      status: 'Pending',
    };

    const ok = await runSave('Damage Report', () =>
      updateState((prev) => ({
        ...prev,
        irrigationSystems: prev.irrigationSystems.map((s) =>
          s.zone === reportDamageForm.sprinklerZone ? { ...s, status: 'Damaged' } : s
        ),
        irrigationDamageReports: [newReport, ...(prev.irrigationDamageReports ?? [])],
      }))
    );

    if (ok) {
      setReportDamageDialogOpen(false);
      setReportDamageForm({
        sprinklerZone: '',
        details: '',
        workerName: 'Juan Dela Cruz (Worker)',
      });
      setDismissedReportIds((prev) => prev.filter((id) => id !== newReportId));
    }
  };

  const isAddingCoffee = coffeeDialogOpen && coffeeEditIndex === null;
  const isAddingIrrigation = irrigationDialogOpen && irrigationEditIndex === null;
  const isAddingPest = pestDialogOpen && pestEditIndex === null;

  const isEditingWorker = editingWorkerIndex !== null;
  const editingWorkerAddress =
    editingWorkerIndex !== null ? state.workers[editingWorkerIndex]?.address : undefined;

  const selectedWorker =
    selectedWorkerIndex !== null ? workers.find((w) => w.index === selectedWorkerIndex) ?? null : null;

  const pendingTasks = state.tasks.filter(
    (t) => t.status === 'pending' || t.status === 'in-progress',
  ).length;
  const readyFields = coffeeFields.filter(isHarvestReady);
  const sprinklersBySection = useMemo(() => {
    const groups: Record<string, { section: string; systems: (IrrigationSystemRecord & { originalIndex: number })[] }> = {};
    irrigationSystems.forEach((system, idx) => {
      const section = system.type || 'Unassigned';
      if (!groups[section]) groups[section] = { section, systems: [] };
      groups[section].systems.push({ ...system, originalIndex: idx });
    });
    return Object.values(groups);
  }, [irrigationSystems]);


  const openAddDialog = () => {
    setEditingWorkerIndex(null);
    setForm(emptyWorkerDraft());
    setWorkerFormError(null);
    setWorkerFormOpen(true);
  };

  const openEditDialog = (worker: WorkerUi) => {
    const record = state.workers[worker.index];
    if (!record) return;
    setEditingWorkerIndex(worker.index);
    const input = workerRecordToFormInput(record);
    setForm({
      ...input,
      province: BATAAN_PROVINCE,
      phone: sanitizePhoneInput(input.phone),
    });
    setWorkerFormError(null);
    setSelectedWorkerIndex(worker.index);
    setWorkerFormOpen(true);
  };

  const closeWorkerForm = () => {
    setWorkerFormOpen(false);
    setEditingWorkerIndex(null);
    setForm(emptyWorkerDraft());
    setWorkerFormError(null);
  };

  const saveWorker = async () => {
    setWorkerFormError(null);
    const name = form.name.trim();
    const existingWorker =
      editingWorkerIndex !== null ? state.workers[editingWorkerIndex] : undefined;
    const existingMeta = parseWorkerDetails(existingWorker?.details);
    const isEditingExistingWorker = Boolean(existingWorker);
    const birthday = form.birthday.trim() || existingMeta.birthday?.trim() || existingWorker?.birthday?.trim() || '';
    const phone = form.phone.trim() || existingWorker?.phoneNumber?.trim() || '';
    const emergencyPhone = form.emergencyPhone.trim();
    if (!name) {
      setWorkerFormError('Please enter the worker name.');
      return;
    }
    if (isEditingExistingWorker ? form.birthday.trim() && !isAtLeast18(form.birthday) : !isAtLeast18(birthday)) {
      setWorkerFormError('Please enter a birthday showing the employee is at least 18 years old.');
      return;
    }
    if (isEditingExistingWorker ? form.phone.trim() && !isValidPhone11(form.phone) : !isValidPhone11(phone)) {
      setWorkerFormError('Phone number must follow 09XXXXXXXXX or +63XXXXXXXXXX.');
      return;
    }
    if (emergencyPhone && !isValidPhone11(emergencyPhone)) {
      setWorkerFormError('Emergency contact number must follow 09XXXXXXXXX or +63XXXXXXXXXX.');
      return;
    }
    let municipality = form.municipality.trim() || existingMeta.municipality?.trim() || '';
    let barangay = form.barangay.trim() || existingMeta.barangay?.trim() || '';
    const hasAddressDraft = Boolean(
      form.municipality.trim() || form.barangay.trim() || form.street.trim() || form.houseNumber.trim(),
    );
    let addr = hasAddressDraft && municipality && barangay && (form.street.trim() || form.houseNumber.trim())
      ? composeWorkerAddress({ ...form, municipality, barangay })
      : '';
    if (!addr.trim() && isEditingExistingWorker) {
      addr = existingWorker?.address?.trim() || '';
    }
    if (editingWorkerIndex === null) {
      if (!municipality || !barangay) {
        setWorkerFormError('Please enter city/municipality and barangay.');
        return;
      }
      if (!form.street.trim() && !form.houseNumber.trim()) {
        setWorkerFormError('Please enter house number / street.');
        return;
      }
    } else if (!addr.trim()) {
      setWorkerFormError('Please enter house number / street (or keep the existing address).');
      return;
    }
    const existingId =
      editingWorkerIndex !== null ? state.workers[editingWorkerIndex]?.workerId : undefined;
    let record = uiToWorkerRecord(
      {
        name,
        birthday,
        sex: form.sex,
        phone: sanitizePhoneInput(phone),
        role: form.role,
        municipality,
        barangay,
        address: addr,
        status: form.status,
        imageUrl: form.imageUrl,
        emergencyName: form.emergencyName,
        emergencyRelationship: form.emergencyRelationship,
        emergencyPhone: form.emergencyPhone,
      },
      existingId,
    );
    if (editingWorkerIndex !== null && existingWorker) {
      const newMeta = parseWorkerDetails(record.details);
      record = {
        ...record,
        accountEmail: existingWorker.accountEmail,
        accountPassword: existingWorker.accountPassword,
        authUid: existingWorker.authUid,
        details: JSON.stringify({
          ...existingMeta,
          ...newMeta,
          accountEmail: existingWorker.accountEmail,
          accountPassword: existingWorker.accountPassword,
          authUid: existingWorker.authUid,
        }),
      };
    }
    let generatedAccount: CreatedWorkerAccount | null = null;
    if (editingWorkerIndex === null) {
      try {
        generatedAccount = await createWorkerAuthAccount({
          name: record.name,
          workerId: record.workerId || `EMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          role: record.roleRate,
        });
        const meta = parseWorkerDetails(record.details);
        record = {
          ...record,
          accountEmail: generatedAccount.email,
          accountPassword: generatedAccount.password,
          authUid: generatedAccount.uid,
          details: JSON.stringify({
            ...meta,
            accountEmail: generatedAccount.email,
            accountPassword: generatedAccount.password,
            authUid: generatedAccount.uid,
          }),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not create the worker login account.';
        setWorkerFormError(`Could not create worker login. ${message}`);
        return;
      }
    }

    const ok = await runSave('Worker', async () => {
      if (editingWorkerIndex !== null) {
        await updateState((prev) => ({
          ...prev,
          workers: prev.workers.map((w, i) => (i === editingWorkerIndex ? record : w)),
        }));
        setSelectedWorkerIndex(editingWorkerIndex);
      } else {
        await updateState((prev) => ({
          ...prev,
          workers: [...prev.workers, record],
        }));
        setSelectedWorkerIndex(state.workers.length);
      }
    });
    if (ok) {
      setCreatedWorkerAccount(generatedAccount ? {
        ...generatedAccount,
        phone: record.phoneNumber || form.phone,
      } : null);
      closeWorkerForm();
      return;
    }
    setWorkerFormError('Could not save worker. Check the banner at the top for Firebase errors.');
  };

  const removeWorker = async (e: MouseEvent, index: number) => {
    e.stopPropagation();
    const worker = state.workers[index];
    if (!worker) return;
    if (!window.confirm(`Are you sure you want to make ${worker.name} inactive?`)) return;
    await runSave('Employee status', () =>
      updateState((prev) => ({
        ...prev,
        workers: prev.workers.map((record, i) => {
          if (i !== index) return record;
          const meta = parseWorkerDetails(record.details);
          return {
            ...record,
            details: JSON.stringify({
              ...meta,
              status: 'inactive',
            }),
          };
        }),
      })),
    );
    setSelectedWorkerIndex(index);
  };

  const createHarvestReadinessReport = async () => {
    const weight = `${Math.floor(Math.random() * 200 + 150)} kg`;
    const randomZone = coffeeFields[Math.floor(Math.random() * coffeeFields.length)]?.name || 'Block A';
    const newReport: HarvestReadinessReportRecord = {
      reportId: `HR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      zone: randomZone,
      expectedWeight: weight,
      reportedBy: activeWorkers[Math.floor(Math.random() * activeWorkers.length)]?.name || 'Field Worker',
      reportedAt: new Date().toISOString().slice(0, 10),
      status: 'Pending Review',
      notes: 'Submitted from the web simulation button.',
    };
    const ok = await runSave('Harvest readiness report', () =>
      updateState((prev) => ({
        ...prev,
        harvestReadinessReports: [newReport, ...prev.harvestReadinessReports],
      })),
    );
    if (ok) {
      alert(`[Worker Simulation Triggered]\n\nA new harvest readiness report has been submitted to the admin:\n\n- Report ID: ${newReport.reportId}\n- Zone: ${newReport.zone}\n- Expected Yield: ${newReport.expectedWeight}\n- Submitted By: ${newReport.reportedBy}`);
    }
  };

  const reviewHarvestReadinessReport = async (reportId: string, status: 'Approved' | 'Rejected') => {
    await runSave('Harvest readiness review', () =>
      updateState((prev) => ({
        ...prev,
        harvestReadinessReports: prev.harvestReadinessReports.map((report) =>
          report.reportId === reportId
            ? {
                ...report,
                status,
                reviewedAt: new Date().toISOString().slice(0, 10),
                reviewedBy: 'Admin',
              }
            : report,
        ),
      })),
    );
    if (status === 'Approved') {
      const report = state.harvestReadinessReports.find((r) => r.reportId === reportId);
      if (report) {
        alert(`Harvest Report ${report.reportId} Approved!\n\nA harvest schedule task has been automatically scheduled for ${report.zone}.`);
      }
    }
  };

  const closeCoffeeDialog = () => {
    setCoffeeDialogOpen(false);
    setCoffeeEditIndex(null);
    setCoffeeForm(null);
  };

  const openAddCoffee = () => {
    setCoffeeEditIndex(null);
    setCoffeeForm(emptyCoffeeField());
    setCoffeeDialogOpen(true);
  };

  const openEditCoffee = (index: number) => {
    const field = coffeeFields[index];
    if (!field) return;
    setCoffeeEditIndex(index);
    setCoffeeForm({ ...field });
    setCoffeeDialogOpen(true);
  };

  const saveCoffeeField = async () => {
    if (!coffeeForm?.name.trim()) {
      showSaveError('Coffee field name is required.');
      return;
    }
    const record = { ...coffeeForm, name: coffeeForm.name.trim() };
    const ok = await runSave('Coffee field', () =>
      updateState((prev) => ({
        ...prev,
        coffeeFields:
          coffeeEditIndex === null
            ? [...prev.coffeeFields, record]
            : prev.coffeeFields.map((f, i) => (i === coffeeEditIndex ? record : f)),
      })),
    );
    if (ok) closeCoffeeDialog();
  };

  const removeCoffeeField = async (index: number) => {
    if (!window.confirm('Remove this coffee field?')) return;
    await runSave('Coffee field', () =>
      updateState((prev) => ({
        ...prev,
        coffeeFields: prev.coffeeFields.filter((_, i) => i !== index),
      })),
    );
  };

  const closeIrrigationDialog = () => {
    setIrrigationDialogOpen(false);
    setIrrigationEditIndex(null);
    setIrrigationForm(null);
    setSprinklerAddSection('');
    setSprinklerAddCount(1);
    setSprinklerAddCoverage('100%');
  };

  const openAddIrrigation = () => {
    setIrrigationEditIndex(null);
    setIrrigationForm(null);
    setSprinklerAddSection('');
    setSprinklerAddCount(1);
    setSprinklerAddCoverage('100%');
    setIrrigationDialogOpen(true);
  };

  const openEditIrrigation = (index: number) => {
    const system = irrigationSystems[index];
    if (!system) return;
    setIrrigationEditIndex(index);
    setIrrigationForm({ ...system });
    setIrrigationDialogOpen(true);
  };

  const saveIrrigationBatch = async () => {
    if (!sprinklerAddSection.trim()) {
      showSaveError('Please select a section.');
      return;
    }
    if (sprinklerAddCount < 1 || sprinklerAddCount > 100) {
      showSaveError('Enter a number between 1 and 100.');
      return;
    }
    const existingInSection = irrigationSystems.filter((s) => s.type === sprinklerAddSection);
    let maxNum = 0;
    for (const s of existingInSection) {
      const match = s.zone.match(/(\d+)/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    const newSprinklers: IrrigationSystemRecord[] = [];
    for (let i = 1; i <= sprinklerAddCount; i++) {
      newSprinklers.push({
        irrigationId: newFarmEntityId(),
        zone: `Sprinkler ${maxNum + i}`,
        type: sprinklerAddSection,
        status: 'Active',
        coverage: sprinklerAddCoverage,
        efficiency: 0,
        lastMaintenance: new Date().toISOString().slice(0, 10),
      });
    }
    const ok = await runSave('Sprinklers', () =>
      updateState((prev) => ({
        ...prev,
        irrigationSystems: [...prev.irrigationSystems, ...newSprinklers],
      })),
    );
    if (ok) closeIrrigationDialog();
  };

  const saveIrrigationEdit = async () => {
    if (!irrigationForm || irrigationEditIndex === null) return;
    const record = { ...irrigationForm };
    const ok = await runSave('Sprinkler', () =>
      updateState((prev) => ({
        ...prev,
        irrigationSystems: prev.irrigationSystems.map((s, i) => (i === irrigationEditIndex ? record : s)),
      })),
    );
    if (ok) closeIrrigationDialog();
  };

  const requestRemoveIrrigation = (index: number, zone: string) => {
    setDeleteSprinklerTarget({
      type: 'single',
      index,
      sprinklerZone: zone,
    });
  };

  const requestRemoveSectionSprinklers = (sectionName: string) => {
    setDeleteSprinklerTarget({
      type: 'section',
      sectionName,
    });
  };

  const confirmDeleteSprinkler = async () => {
    if (!deleteSprinklerTarget) return;

    if (deleteSprinklerTarget.type === 'single' && deleteSprinklerTarget.index !== undefined) {
      const targetIdx = deleteSprinklerTarget.index;
      const ok = await runSave('Sprinkler', () =>
        updateState((prev) => ({
          ...prev,
          irrigationSystems: prev.irrigationSystems.map((s, i) =>
            i === targetIdx ? { ...s, status: 'Inactive' } : s,
          ),
        })),
      );
      if (ok) setDeleteSprinklerTarget(null);
    } else if (deleteSprinklerTarget.type === 'section' && deleteSprinklerTarget.sectionName) {
      const secName = deleteSprinklerTarget.sectionName;
      const ok = await runSave('Sprinklers', () =>
        updateState((prev) => ({
          ...prev,
          irrigationSystems: prev.irrigationSystems.map((s) =>
            s.type === secName ? { ...s, status: 'Inactive' } : s,
          ),
        })),
      );
      if (ok) setDeleteSprinklerTarget(null);
    }
  };

  const closePestDialog = () => {
    setPestDialogOpen(false);
    setPestEditIndex(null);
    setPestForm(null);
  };

  const handlePestPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (pestForm) {
        setPestForm({ ...pestForm, photoUrl: String(reader.result) });
      }
    };
    reader.readAsDataURL(file);
  };

  const openAddPest = () => {
    setPestEditIndex(null);
    setPestForm(emptyPestControlLog());
    setPestDialogOpen(true);
  };

  const openEditPest = (index: number) => {
    const record = pestControlLogs[index];
    if (!record) return;
    setPestEditIndex(index);
    setPestForm({ ...record });
    setPestDialogOpen(true);
  };

  const savePestLog = async () => {
    if (!pestForm?.issue.trim()) {
      showSaveError('Issue type is required.');
      return;
    }
    if (!pestForm?.field.trim()) {
      showSaveError('Farm zone selection is required.');
      return;
    }
    if (!pestForm?.treeNumber?.trim()) {
      showSaveError('Tree number is required.');
      return;
    }

    // Duplicate validation check: same tree number & same issue type
    const isDuplicate = state.pestControlLogs.some(
      (log, idx) =>
        idx !== pestEditIndex &&
        log.treeNumber?.trim() === pestForm.treeNumber?.trim() &&
        log.issue.trim().toLowerCase() === pestForm.issue.trim().toLowerCase()
    );

    if (isDuplicate) {
      showSaveError('Error: A report for this tree and issue already exists. Duplicate reports are blocked.');
      return;
    }

    const record = {
      ...pestForm,
      issue: pestForm.issue.trim(),
      field: pestForm.field.trim(),
      treeNumber: pestForm.treeNumber?.trim()
    };
    const ok = await runSave('Pest control log', () =>
      updateState((prev) => ({
        ...prev,
        pestControlLogs:
          pestEditIndex === null
            ? [...prev.pestControlLogs, record]
            : prev.pestControlLogs.map((p, i) => (i === pestEditIndex ? record : p)),
      })),
    );
    if (ok) closePestDialog();
  };

  const removePestLog = async (index: number) => {
    if (!window.confirm('Remove this pest control log?')) return;
    await runSave('Pest control log', () =>
      updateState((prev) => ({
        ...prev,
        pestControlLogs: prev.pestControlLogs.filter((_, i) => i !== index),
      })),
    );
  };



  if (loading) {
    return (
      <div className="space-y-6">
        <h1>Farm Management</h1>
        <p className="text-muted-foreground">Loading farm data from Firebase…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Floating Animated Worker Problem Notification Banner */}
      {latestPendingReport && !dismissedReportIds.includes(latestPendingReport.id) && (
        <div className="fixed top-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-top-6 fade-in duration-300 pointer-events-auto">
          <div className="bg-[#fdfbf7]/95 backdrop-blur-md border-2 border-[#d4183d]/40 rounded-2xl p-4 shadow-2xl ring-4 ring-[#d4183d]/15 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-28 h-28 bg-[#d4183d]/15 rounded-full blur-xl pointer-events-none animate-pulse" />

            <div className="flex items-start justify-between gap-3">
              <div
                className="flex items-start gap-3 cursor-pointer group"
                onClick={() => scrollToReport(latestPendingReport)}
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d4183d]/15 text-[#d4183d] shadow-sm group-hover:scale-105 transition-transform">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#d4183d]/30 animate-ping" />
                  <AlertTriangle className="h-5 w-5 relative z-10 text-[#d4183d]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black text-[#3e2723] uppercase tracking-wider group-hover:text-[#d4183d] transition-colors">
                      Worker Problem Reported!
                    </h4>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#d4183d] text-white uppercase animate-pulse">
                      NEW
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                    <strong className="text-[#3e2723] font-bold">{latestPendingReport.title}</strong>
                    {latestPendingReport.subtitle ? ` (${latestPendingReport.subtitle})` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismissNotification(latestPendingReport.id)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition-colors"
                title="Mark as read / Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className="mt-3 bg-[#f5f1ed] rounded-xl p-3 border border-[#4a2c2a]/10 text-xs text-[#3e2723] cursor-pointer hover:bg-[#eae3dc] transition-colors"
              onClick={() => scrollToReport(latestPendingReport)}
            >
              <p className="font-semibold text-[#4a2c2a]/80 mb-1 text-[10px]">
                Reported by: <span className="text-[#3e2723] font-bold">{latestPendingReport.reportedBy || 'Worker'}</span> • {latestPendingReport.reportedAt || 'Just now'}
              </p>
              <p className="text-xs font-medium text-[#2d2520] italic">
                "{latestPendingReport.details || 'No details provided'}"
              </p>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => scrollToReport(latestPendingReport)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#3e2723] text-white hover:bg-[#2b1b18] shadow-sm transition-all active:scale-95 flex items-center gap-1"
              >
                View Report ↓
              </button>
              <button
                type="button"
                onClick={() => dismissNotification(latestPendingReport.id)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#4a2c2a]/20 text-[#4a2c2a] hover:bg-[#4a2c2a]/10 transition-colors"
              >
                Mark as Read
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void resolveReportFromNotification(latestPendingReport)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#2d5016] text-white hover:bg-[#1b3310] shadow-sm transition-all active:scale-95 flex items-center gap-1 disabled:opacity-60"
              >
                ✓ Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1>Farm Management</h1>
        <p className="text-muted-foreground">Register farm workers, assign tasks, track attendance, and inspect locations</p>
      </div>

      <WorkerFormDialog
        open={workerFormOpen}
        onOpenChange={(open) => {
          if (!open) closeWorkerForm();
          else setWorkerFormOpen(true);
        }}
        isEditing={isEditingWorker}
        form={form}
        setForm={setForm}
        onSave={saveWorker}
        saving={saving}
        fallbackAddress={editingWorkerAddress}
        formError={workerFormError}
      />

      <Dialog open={Boolean(createdWorkerAccount)} onOpenChange={(open) => { if (!open) setCreatedWorkerAccount(null); }}>
        <DialogContent className="sm:max-w-md bg-[#fdfbf7] border-[#4a2c2a]/15">
          <DialogHeader>
            <DialogTitle>Worker account created</DialogTitle>
            <DialogDescription>
              Give these login details to the employee. The worker can use this email in the mobile app
              for Time In/Time Out, equipment logs, and coffee cherry scanning.
            </DialogDescription>
          </DialogHeader>
          {createdWorkerAccount ? (
            <div className="space-y-3 py-2">
              <div className="rounded-lg bg-[#f5f1ed] p-3">
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="break-all text-sm font-medium">{createdWorkerAccount.email}</p>
              </div>
              <div className="rounded-lg bg-[#f5f1ed] p-3">
                <p className="text-xs text-muted-foreground mb-1">Temporary password</p>
                <p className="break-all font-mono text-sm font-medium">{createdWorkerAccount.password}</p>
              </div>
              {createdWorkerAccount.phone && (
                <div className="rounded-lg bg-[#f0f7eb] border border-[#2d5016]/20 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-left">
                    <p className="text-xs text-[#2d5016] font-semibold">Associated Mobile Phone</p>
                    <p className="text-sm font-bold text-[#3e2723]">{createdWorkerAccount.phone}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      alert(`SMS Sent Successfully!\n\nTo: ${createdWorkerAccount.phone}\nMessage: "Your Acojido Farm login details:\nEmail: ${createdWorkerAccount.email}\nPassword: ${createdWorkerAccount.password}"`);
                    }}
                    className="bg-[#2d5016] hover:bg-[#234010] text-white text-xs px-3 py-1.5"
                  >
                    Send Details via SMS
                  </Button>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setCreatedWorkerAccount(null)}
              className="bg-[#2d5016] hover:bg-[#234010] text-white w-full sm:w-auto"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={coffeeDialogOpen} onOpenChange={(o) => { if (!o) closeCoffeeDialog(); else setCoffeeDialogOpen(true); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#fdfbf7] border-[#4a2c2a]/15">
          <DialogHeader>
            <DialogTitle>{isAddingCoffee ? 'Add coffee field' : 'Edit coffee field'}</DialogTitle>
            <DialogDescription>
              View the coffee plantation landscape map, pin the field plot location, and enter plot specifications.
            </DialogDescription>
          </DialogHeader>
          {coffeeForm ? (
            <div className="grid gap-4 py-2">
              <CoffeeFieldLandscapeMap
                selectedLat={coffeeForm.lat}
                selectedLng={coffeeForm.lng}
                onSelectLocation={(lat, lng) =>
                  setCoffeeForm({ ...coffeeForm, lat, lng })
                }
                existingFields={coffeeFields}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Field Plot Name *</Label>
                  <Input
                    value={coffeeForm.name}
                    onChange={(e) => setCoffeeForm({ ...coffeeForm, name: e.target.value })}
                    placeholder="e.g. Block A - Mt. Samat High Plot"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Area (Hectares / m²)</Label>
                  <Input
                    value={coffeeForm.area}
                    onChange={(e) => setCoffeeForm({ ...coffeeForm, area: e.target.value })}
                    placeholder="e.g. 2.5 hectares"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trees</Label>
                  <Input
                    type="number"
                    value={coffeeForm.trees}
                    onChange={(e) => setCoffeeForm({ ...coffeeForm, trees: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Variety</Label>
                  <Input
                    value={coffeeForm.variety}
                    onChange={(e) => setCoffeeForm({ ...coffeeForm, variety: e.target.value })}
                    placeholder="e.g. Arabica / Liberica"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age</Label>
                  <Input
                    value={coffeeForm.age}
                    onChange={(e) => setCoffeeForm({ ...coffeeForm, age: e.target.value })}
                    placeholder="e.g. 3 years"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Latitude (°N)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={coffeeForm.lat ?? ''}
                    onChange={(e) =>
                      setCoffeeForm({
                        ...coffeeForm,
                        lat: e.target.value !== '' ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="14.53944"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude (°E)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={coffeeForm.lng ?? ''}
                    onChange={(e) =>
                      setCoffeeForm({
                        ...coffeeForm,
                        lng: e.target.value !== '' ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="120.57637"
                  />
                </div>
                <div className="sm:col-span-2">
                  <SelectWithOther
                    label="Status"
                    value={coffeeForm.status}
                    onChange={(val) => setCoffeeForm({ ...coffeeForm, status: val })}
                    options={['excellent', 'healthy', 'monitoring', 'critical']}
                    selectClassName={SELECT_CLASS}
                    otherPlaceholder="Type custom status..."
                  />
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={closeCoffeeDialog}>Cancel</Button>
            <Button className="bg-[#2d5016] text-white" disabled={saving} onClick={() => void saveCoffeeField()}>
              {saving ? 'Saving…' : isAddingCoffee ? 'Add field' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={irrigationDialogOpen} onOpenChange={(o) => { if (!o) closeIrrigationDialog(); else setIrrigationDialogOpen(true); }}>
        <DialogContent className="sm:max-w-lg bg-[#fdfbf7] border-[#4a2c2a]/15">
          <DialogHeader>
            <DialogTitle>{isAddingIrrigation ? 'Add Sprinklers' : 'Edit Sprinkler'}</DialogTitle>
            <DialogDescription>
              {isAddingIrrigation
                ? 'Select a section and enter how many sprinklers to install. IDs are auto-generated.'
                : 'Update this sprinkler\'s status. Workers can report damaged sprinklers.'}
            </DialogDescription>
          </DialogHeader>
          {isAddingIrrigation ? (
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Section (Coffee Field Block)</Label>
                <select
                  className={SELECT_CLASS}
                  value={sprinklerAddSection}
                  onChange={(e) => setSprinklerAddSection(e.target.value)}
                >
                  <option value="">— Select Section —</option>
                  {coffeeFields.map((f) => (
                    <option key={f.fieldId || f.name} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Number of Sprinklers to Add</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={sprinklerAddCount}
                  onChange={(e) => setSprinklerAddCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
                <p className="text-xs text-muted-foreground">IDs will be auto-generated (Sprinkler 1, Sprinkler 2, …)</p>
              </div>
              <div className="space-y-2">
                <Label>Coverage Percentage</Label>
                <select
                  className={SELECT_CLASS}
                  value={sprinklerAddCoverage}
                  onChange={(e) => setSprinklerAddCoverage(e.target.value)}
                >
                  {[25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].map((v) => (
                    <option key={v} value={`${v}%`}>{v}%</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Coverage area for all sprinklers in this batch</p>
              </div>
              {sprinklerAddSection && (
                <div className="bg-[#2d5016]/5 rounded-lg p-3 border border-[#2d5016]/15">
                  <p className="text-xs font-semibold text-[#2d5016]">
                    Preview: {sprinklerAddCount} sprinkler{sprinklerAddCount !== 1 ? 's' : ''} → "{sprinklerAddSection}"
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(() => {
                      const existing = irrigationSystems.filter((s) => s.type === sprinklerAddSection);
                      let maxNum = 0;
                      for (const s of existing) { const m = s.zone.match(/(\d+)/); if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10)); }
                      const preview = Array.from({ length: Math.min(sprinklerAddCount, 5) }, (_, i) => `Sprinkler ${maxNum + i + 1}`);
                      return preview.join(', ') + (sprinklerAddCount > 5 ? `, … (+${sprinklerAddCount - 5} more)` : '');
                    })()}
                  </p>
                </div>
              )}
            </div>
          ) : irrigationForm ? (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Sprinkler ID</Label>
                  <Input value={irrigationForm.zone} readOnly className="bg-[#e8e2dc] font-bold border-[#4a2c2a]/20" />
                </div>
                <div className="space-y-2">
                  <Label>Section</Label>
                  <Input value={irrigationForm.type || 'Unassigned'} readOnly className="bg-[#e8e2dc] border-[#4a2c2a]/20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Coverage Percentage</Label>
                <select
                  className={SELECT_CLASS}
                  value={irrigationForm.coverage}
                  onChange={(e) => setIrrigationForm({ ...irrigationForm, coverage: e.target.value })}
                >
                  {[25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].map((v) => (
                    <option key={v} value={`${v}%`}>{v}%</option>
                  ))}
                </select>
              </div>
              <SelectWithOther
                label="Status"
                value={irrigationForm.status || 'Active'}
                onChange={(val) => setIrrigationForm({ ...irrigationForm, status: val })}
                options={['Active', 'Inactive', 'Maintenance', 'Damaged']}
                selectClassName={SELECT_CLASS}
                otherPlaceholder="Type custom status..."
              />
              <div className="space-y-2">
                <Label>Last Maintenance Date</Label>
                <Input
                  type="date"
                  value={irrigationForm.lastMaintenance}
                  onChange={(e) => setIrrigationForm({ ...irrigationForm, lastMaintenance: e.target.value })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeIrrigationDialog}>Cancel</Button>
            <Button
              className="bg-[#2d5016] text-white"
              disabled={saving || (isAddingIrrigation && !sprinklerAddSection)}
              onClick={() => void (isAddingIrrigation ? saveIrrigationBatch() : saveIrrigationEdit())}
            >
              {saving ? 'Saving…' : isAddingIrrigation ? `Add ${sprinklerAddCount} Sprinkler${sprinklerAddCount !== 1 ? 's' : ''}` : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Sprinkler Confirmation Dialog */}
      <Dialog
        open={deleteSprinklerTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteSprinklerTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md bg-[#fdfbf7] border-[#4a2c2a]/15 shadow-2xl overflow-hidden p-6 animate-in zoom-in-95 fade-in duration-200">
          <div className="flex flex-col items-center text-center space-y-3 pt-2">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#d4183d]/10 border border-[#d4183d]/20 text-[#d4183d] shadow-sm">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#d4183d]/20 animate-ping" />
              <Trash2 className="h-7 w-7 relative z-10 text-[#d4183d] transition-transform duration-300 hover:scale-110" />
            </div>

            <DialogHeader className="text-center sm:text-center">
              <DialogTitle className="text-center text-xl font-bold text-[#3e2723]">
                {deleteSprinklerTarget?.type === 'section'
                  ? `Delete All Sprinklers in ${deleteSprinklerTarget.sectionName}?`
                  : `Delete ${deleteSprinklerTarget?.sprinklerZone || 'Sprinkler'}?`}
              </DialogTitle>
              <DialogDescription className="text-center text-sm text-[#4a2c2a]/80 mt-1">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-[#3e2723]">
                  {deleteSprinklerTarget?.type === 'section'
                    ? `all sprinklers in ${deleteSprinklerTarget.sectionName}`
                    : deleteSprinklerTarget?.sprinklerZone || 'this sprinkler'}
                </span>
                ?
              </DialogDescription>
            </DialogHeader>

            <div className="bg-[#f5f1ed] border border-[#4a2c2a]/10 rounded-xl p-3.5 text-xs text-muted-foreground flex items-start gap-2.5 text-left w-full mt-2 shadow-inner">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#3e2723]">Sprinkler Will Become Inactive</p>
                <p className="mt-0.5">
                  The sprinkler will not be deleted from records. Its status will be set to{' '}
                  <span className="font-bold text-[#d4183d]">Inactive</span>.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-3 mt-6 sm:flex-none">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl border-[#4a2c2a]/20 hover:bg-[#4a2c2a]/5 text-[#4a2c2a] font-semibold py-2.5 transition-colors"
              onClick={() => setDeleteSprinklerTarget(null)}
            >
              No, Cancel
            </Button>
            <Button
              type="button"
              className="w-full rounded-xl bg-[#d4183d] hover:bg-[#b01230] text-white font-semibold py-2.5 shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5"
              onClick={() => void confirmDeleteSprinkler()}
            >
              <Trash2 className="w-4 h-4" />
              Yes, Mark Inactive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Damage / Problem Modal */}
      <Dialog
        open={reportDamageDialogOpen}
        onOpenChange={(o) => {
          if (!o) setReportDamageDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-lg bg-[#fdfbf7] border-[#4a2c2a]/15 shadow-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#d4183d]/10 text-[#d4183d] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-[#3e2723]">
                  Report Sprinkler Problem
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Submit a new damage or malfunction report (simulating worker mobile app submission).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-4 py-3">
            <div className="space-y-2">
              <Label>Select Affected Sprinkler</Label>
              <select
                className={SELECT_CLASS}
                value={reportDamageForm.sprinklerZone}
                onChange={(e) => setReportDamageForm({ ...reportDamageForm, sprinklerZone: e.target.value })}
              >
                <option value="">— Select Sprinkler —</option>
                {irrigationSystems.map((s) => (
                  <option key={s.irrigationId || s.zone} value={s.zone}>
                    {s.zone} ({s.type || 'Unassigned'}) — Current Status: {s.status || 'Active'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Reporter Name (Worker)</Label>
              <Input
                value={reportDamageForm.workerName}
                onChange={(e) => setReportDamageForm({ ...reportDamageForm, workerName: e.target.value })}
                placeholder="e.g. Juan Dela Cruz (Worker)"
              />
            </div>

            <div className="space-y-2">
              <Label>Problem Details / Description</Label>
              <textarea
                className="w-full min-h-[90px] rounded-xl border border-[#4a2c2a]/20 bg-white p-3 text-sm text-[#3e2723] focus:outline-none focus:ring-2 focus:ring-[#d4183d]/40"
                value={reportDamageForm.details}
                onChange={(e) => setReportDamageForm({ ...reportDamageForm, details: e.target.value })}
                placeholder="Describe the issue (e.g. Sprinkler head leaking, water pressure low, broken nozzle)"
              />
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-3 mt-4 sm:flex-none">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReportDamageDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#d4183d] hover:bg-[#b01230] text-white font-semibold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              disabled={saving || !reportDamageForm.sprinklerZone || !reportDamageForm.details.trim()}
              onClick={() => void submitWorkerDamageReport()}
            >
              <AlertTriangle className="w-4 h-4" />
              {saving ? 'Submitting…' : 'Submit Worker Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pestDialogOpen} onOpenChange={(o) => { if (!o) closePestDialog(); else setPestDialogOpen(true); }}>
        <DialogContent className="sm:max-w-lg bg-[#fdfbf7] border-[#4a2c2a]/15">
          <DialogHeader>
            <DialogTitle>Assign Treatment</DialogTitle>
            <DialogDescription>
              Review the worker's report and assign treatment. Update status as the issue is handled.
            </DialogDescription>
          </DialogHeader>
          {pestForm ? (
            <div className="grid gap-3 py-2">
              <div className="bg-[#f5f1ed] rounded-lg p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Worker Report</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-xs text-muted-foreground">Zone:</span> <span className="font-medium">{pestForm.field || '—'}</span></div>
                  <div><span className="text-xs text-muted-foreground">Tree #:</span> <span className="font-medium">{pestForm.treeNumber || '—'}</span></div>
                  <div><span className="text-xs text-muted-foreground">Issue:</span> <span className="font-medium">{pestForm.issue || '—'}</span></div>
                  <div><span className="text-xs text-muted-foreground">Date:</span> <span className="font-medium">{pestForm.date || '—'}</span></div>
                </div>
                {pestForm.photoUrl && (
                  <div className="mt-2">
                    <img src={pestForm.photoUrl} alt={pestForm.issue} className="w-20 h-20 rounded-lg object-cover border border-[#4a2c2a]/15" />
                  </div>
                )}
              </div>
              <SelectWithOther
                label="Status"
                value={pestForm.status}
                onChange={(val) => setPestForm({ ...pestForm, status: val })}
                options={[
                  { value: 'Pending', label: 'Pending Review' },
                  { value: 'Under Treatment', label: 'Under Treatment' },
                  { value: 'Monitoring', label: 'Monitoring' },
                  { value: 'Resolved', label: 'Resolved' },
                ]}
                selectClassName={SELECT_CLASS}
                otherPlaceholder="Type custom status..."
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closePestDialog}>Cancel</Button>
            <Button className="bg-[#2d5016] text-white" disabled={saving} onClick={() => void savePestLog()}>
              {saving ? 'Saving…' : 'Update Treatment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#2d5016]/20 flex items-center justify-center">
              <User className="w-5 h-5 text-[#2d5016]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Farm employees</p>
              <p className="text-2xl">{activeWorkers.length}</p>
              <p className="text-xs text-muted-foreground">{inactiveWorkers.length} inactive kept on record</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#8b6f47]/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#8b6f47]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tasks Pending</p>
              <p className="text-2xl">{pendingTasks}</p>
              <p className="text-xs text-muted-foreground">Daily work assignments</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#d4a574]/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[#d4a574]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Harvest alerts</p>
              <p className="text-2xl">{readyFields.length}</p>
              <p className="text-xs text-muted-foreground">Green = ready, black = harvestable batch</p>
            </div>
          </div>
        </div>
      </div>


      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2d5016]/15 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#2d5016]" />
            </div>
            <div>
              <h3>Worker Attendance</h3>
              <p className="text-sm text-muted-foreground">Mobile time-in and time-out records synced from worker accounts</p>
            </div>
          </div>
          <span className="rounded-full bg-[#f5f1ed] px-3 py-1 text-xs font-medium text-[#4a2c2a]">
            {state.attendance.length} total record{state.attendance.length === 1 ? '' : 's'}
          </span>
        </div>

        {recentAttendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">No worker attendance has synced yet.</p>
        ) : (
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#8b6f47]/35 scrollbar-track-transparent">
            {recentAttendance.map((attendance, index) => {
              const worker = state.workers.find(
                (w) => w.name.trim().toLowerCase() === attendance.workerName.trim().toLowerCase(),
              );
              const isClockedOut = Boolean(attendance.clockOut?.trim());
              return (
                <div
                  key={attendance.attendanceId || `${attendance.workerName}-${attendance.date}-${attendance.clockIn}-${index}`}
                  className="rounded-lg bg-[#f5f1ed] p-4 border border-[#4a2c2a]/10"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[#3e2723]">{attendance.workerName || 'Unnamed worker'}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs text-[#6b5d56]">
                        {worker?.roleRate || 'No role rate'}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          isClockedOut ? 'bg-[#2d5016] text-white' : 'bg-[#d4a574]/30 text-[#4a2c2a]'
                        }`}
                      >
                        {isClockedOut ? 'Completed' : 'Timed in'}
                      </span>
                      {attendance.isGeofenceVerified !== undefined && attendance.isGeofenceVerified !== null ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            attendance.isGeofenceVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {attendance.isGeofenceVerified ? '📍 In Field Geofence' : '⚠️ Remote / Outside Field'}
                        </span>
                      ) : null}
                      {attendance.faceSnapshotBase64 ? (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                          👤 Face Verified
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {attendance.submittedByStaff ? 'Submitted by worker app' : 'Admin or imported record'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 md:grid-cols-4">
                    <div className="rounded-lg bg-white p-3 border border-[#4a2c2a]/10">
                      <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Date</p>
                      <p className="mt-1 text-sm font-semibold text-[#3e2723]">{attendance.date || 'No date'}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-[#4a2c2a]/10">
                      <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Time in</p>
                      <p className="mt-1 text-lg font-semibold text-[#2d5016]">{formatClock24h(attendance.clockIn)}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-[#4a2c2a]/10">
                      <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Time out</p>
                      <p className="mt-1 text-lg font-semibold text-[#4a2c2a]">{formatClock24h(attendance.clockOut)}</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-[#4a2c2a]/10">
                      <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Hours worked</p>
                      <p className="mt-1 text-lg font-semibold text-[#3e2723]">{formatHoursWorked(attendance)}</p>
                    </div>
                  </div>

                  {attendance.timeInLatitude != null && attendance.timeInLongitude != null ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#6b5d56]">
                      <span className="font-semibold text-[#3e2723]">Time In Location:</span>
                      <span>
                        {attendance.timeInLocationName || `${attendance.timeInLatitude.toFixed(5)}, ${attendance.timeInLongitude.toFixed(5)}`}
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${attendance.timeInLatitude},${attendance.timeInLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-[#2d5016] underline hover:text-[#4a2c2a]"
                      >
                        Map Pin ↗
                      </a>
                    </div>
                  ) : null}

                  {attendance.faceSnapshotBase64 ? (
                    <div className="mt-3 flex items-center gap-3">
                      <img
                        src={attendance.faceSnapshotBase64.startsWith('data:') ? attendance.faceSnapshotBase64 : `data:image/jpeg;base64,${attendance.faceSnapshotBase64}`}
                        alt="Face verification snapshot"
                        className="h-12 w-12 rounded-lg object-cover border border-[#4a2c2a]/20 shadow-xs"
                      />
                      <div>
                        <p className="text-xs font-medium text-[#3e2723]">Biometric Snapshot</p>
                        <p className="text-[11px] text-muted-foreground">Captured on mobile device during time-in</p>
                      </div>
                    </div>
                  ) : null}

                  {attendance.details ? (
                    <p className="mt-3 text-sm text-[#6b5d56]">
                      Notes: <span className="text-[#3e2723]">{attendance.details}</span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#2d5016]/15 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-[#2d5016]" />
                </div>
                <div>
                  <h3>Harvest Readiness Board</h3>
                  <p className="text-xs text-muted-foreground">Workers report crop readiness; admins review and confirm</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void createHarvestReadinessReport()}
                disabled={saving}
                className="text-[10px] font-bold px-2 py-1 rounded bg-[#2d5016]/10 text-[#2d5016] border border-[#2d5016]/25 hover:bg-[#2d5016]/20 transition-colors"
              >
                Simulate Worker Report
              </button>
            </div>

            <div id="harvest-readiness-reports-section" className="space-y-3 mb-4 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {harvestReadinessReports.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No readiness reports logged.</p>
              ) : (
                harvestReadinessReports.map((report) => {
                  const isPending = report.status === 'Pending Review';
                  const isApproved = report.status === 'Approved';

                  return (
                    <div key={report.reportId} id={report.reportId ? `harvest-${report.reportId}` : undefined} className="rounded-xl border border-[#4a2c2a]/10 bg-[#fdfbf7] p-3 text-xs flex items-center justify-between gap-3 shadow-sm hover:border-[#4a2c2a]/30 transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#3e2723]">{report.zone}</span>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase ${
                            isApproved ? 'bg-[#2d5016] text-white' : report.status === 'Rejected' ? 'bg-[#d4183d] text-white' : 'bg-[#8b6f47] text-white'
                          }`}>
                            {report.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Estimated yield: <span className="font-semibold text-[#2d5016]">{report.expectedWeight}</span> · By {report.reportedBy}
                        </p>
                        <p className="text-[9px] text-muted-foreground">Submitted: {report.reportedAt} · ID: {report.reportId}</p>
                        {report.notes ? (
                          <p className="text-[10px] text-[#6b5d56]">{report.notes}</p>
                        ) : null}
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void reviewHarvestReadinessReport(report.reportId, 'Approved')}
                            className="bg-[#2d5016] hover:bg-[#234010] text-white font-semibold px-2.5 py-1 rounded text-[10px] disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void reviewHarvestReadinessReport(report.reportId, 'Rejected')}
                            className="border border-[#d4183d]/45 hover:bg-red-50 text-[#d4183d] font-semibold px-2 py-1 rounded text-[10px] disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl bg-[#2d5016]/5 border border-[#2d5016]/10 p-3 space-y-2">
            <p className="text-[10px] font-semibold text-[#2d5016] uppercase tracking-wider">Ready Crops Quick Indicators</p>
            <div className="flex flex-wrap gap-2">
              {readyFields.map((field) => (
                <span key={field.fieldId || field.name} className="inline-flex items-center gap-1.5 rounded-full bg-[#2d5016]/10 border border-[#2d5016]/20 px-2 py-1 text-[10px] font-medium text-[#2d5016]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2d5016]"></span>
                  {field.name}
                </span>
              ))}
              {readyFields.length === 0 && (
                <span className="text-[10px] text-muted-foreground">No crops marked harvestable after CNN scan confirmation.</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#8b6f47]/15 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#8b6f47]" />
            </div>
            <div>
              <h3>Schedule management</h3>
              <p className="text-sm text-muted-foreground">Daily activities and assignments</p>
            </div>
          </div>
          <div className="space-y-3">
            {state.harvestSchedules.slice(0, 3).map((schedule, index) => (
              <div key={`${schedule.sectionName}-${index}`} className="rounded-lg bg-[#f5f1ed] p-3">
                <p className="text-sm font-medium text-[#3e2723]">{schedule.sectionName}</p>
                <p className="text-xs text-muted-foreground">{schedule.details}</p>
                <span className="mt-2 inline-flex rounded-full bg-[#8b6f47] px-2 py-1 text-xs text-white">
                  {schedule.status}
                </span>
              </div>
            ))}
            {state.harvestSchedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add harvest schedules and task records to answer daily farm operation questions.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="flex h-[560px] flex-col bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3>Coffee Fields</h3>
            <button
              type="button"
              onClick={openAddCoffee}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2d5016] text-white text-sm hover:bg-[#1b3310]"
            >
              <Plus className="w-4 h-4" />
              Add field
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-[#8b6f47]/35 scrollbar-track-transparent">
            {coffeeFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No coffee fields yet. Add one or wait for starter data to sync from Firebase.</p>
            ) : null}
            {coffeeFields.map((field, fieldIdx) => (
              <div
                key={field.fieldId || field.name}
                className="bg-[#f5f1ed] rounded-xl p-4 border border-[#4a2c2a]/10 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#2d5016]/20 flex items-center justify-center">
                      <TreePine className="w-5 h-5 text-[#2d5016]" />
                    </div>
                    <div>
                      <h4 className="mb-1">{field.name}</h4>
                      <p className="text-xs text-muted-foreground">{field.area} • {field.trees} trees</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label={`Edit ${field.name}`}
                      className="w-8 h-8 rounded-lg bg-white border border-[#4a2c2a]/15 hover:bg-[#4a2c2a] hover:text-white flex items-center justify-center"
                      onClick={() => openEditCoffee(fieldIdx)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${field.name}`}
                      className="w-8 h-8 rounded-lg bg-white border border-[#4a2c2a]/15 hover:bg-[#d4183d] hover:text-white flex items-center justify-center"
                      onClick={() => void removeCoffeeField(fieldIdx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span
                      className={`text-xs px-3 py-1 rounded-full ${
                        isHarvestReady(field)
                          ? 'bg-[#2d5016] text-white'
                          : field.status === 'excellent'
                          ? 'bg-[#2d5016] text-white'
                          : field.status === 'healthy'
                          ? 'bg-[#4a2c2a] text-white'
                          : field.status === 'monitoring'
                          ? 'bg-[#d4a574] text-white'
                          : 'bg-[#d4183d] text-white'
                      }`}
                    >
                      {isHarvestReady(field) ? 'Ready for harvest' : field.status}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Variety</p>
                    <p className="text-sm font-medium">{field.variety}</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Age</p>
                    <p className="text-sm font-medium">{field.age}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex h-[420px] flex-col bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3>Irrigation Info</h3>
              <button
                type="button"
                onClick={openAddIrrigation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2d5016] text-white text-sm hover:bg-[#1b3310]"
              >
                <Plus className="w-4 h-4" />
                Add Sprinklers
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-[#8b6f47]/35 scrollbar-track-transparent">
              {sprinklersBySection.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sprinklers registered yet. Add sprinklers to a section to get started.</p>
              ) : (
                sprinklersBySection.map((group) => {
                  const activeCount = group.systems.filter((s) => s.status === 'Active').length;
                  const damagedCount = group.systems.filter((s) => s.status === 'Damaged').length;
                  const inactiveCount = group.systems.filter((s) => s.status === 'Inactive').length;
                  return (
                    <div key={group.section} className="bg-[#f5f1ed] rounded-xl border border-[#4a2c2a]/10 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-[#4a2c2a]/5 border-b border-[#4a2c2a]/10">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                            <Droplets className="w-4 h-4 text-[#4a2c2a]" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#3e2723]">{group.section}</h4>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                              <span>{group.systems.length} sprinkler{group.systems.length !== 1 ? 's' : ''}</span>
                              <span>•</span>
                              <span className="text-[#2d5016] font-semibold">{activeCount} active</span>
                              {damagedCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-[#d4183d] font-semibold">{damagedCount} damaged</span>
                                </>
                              )}
                              {inactiveCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-gray-500 font-semibold">{inactiveCount} inactive</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestRemoveSectionSprinklers(group.section)}
                          className="text-[10px] font-medium text-[#d4183d] hover:underline px-2 py-1 transition-colors hover:text-[#b01230]"
                        >
                          Delete All
                        </button>
                      </div>
                      <div className="divide-y divide-[#4a2c2a]/5">
                        {group.systems.map((system) => {
                          const isInactive = system.status === 'Inactive';
                          return (
                            <div
                              key={system.irrigationId || system.zone}
                              className={`flex items-center justify-between px-4 py-2.5 transition-colors ${
                                isInactive ? 'bg-gray-100/70' : 'hover:bg-white/50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    system.status === 'Active'
                                      ? 'bg-[#2d5016]'
                                      : system.status === 'Damaged'
                                      ? 'bg-[#d4183d] animate-pulse'
                                      : system.status === 'Maintenance'
                                      ? 'bg-[#d4a574]'
                                      : 'bg-gray-400'
                                  }`}
                                />
                                <span
                                  className={`text-sm font-medium ${
                                    isInactive ? 'text-gray-400 line-through' : 'text-[#3e2723]'
                                  }`}
                                >
                                  {system.zone}
                                </span>
                                <span className="text-[10px] font-semibold text-[#4a2c2a]/60 ml-1">
                                  ({system.coverage || '100%'})
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    system.status === 'Active'
                                      ? 'bg-[#2d5016]/10 text-[#2d5016]'
                                      : system.status === 'Damaged'
                                      ? 'bg-[#d4183d]/10 text-[#d4183d]'
                                      : system.status === 'Maintenance'
                                      ? 'bg-[#d4a574]/20 text-[#8b6f47]'
                                      : 'bg-gray-200 text-gray-600 border border-gray-300'
                                  }`}
                                >
                                  {system.status === 'Damaged' ? '⚠ Damaged' : system.status || 'Active'}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Edit ${system.zone}`}
                                  title="Edit sprinkler status or details"
                                  className="w-6 h-6 rounded-md bg-white border border-[#4a2c2a]/10 hover:bg-[#4a2c2a] hover:text-white flex items-center justify-center transition-colors text-[#3e2723]"
                                  onClick={() => openEditIrrigation(system.originalIndex)}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete ${system.zone}`}
                                  title="Delete sprinkler (marks as Inactive)"
                                  className="w-6 h-6 rounded-md bg-white border border-[#4a2c2a]/10 hover:bg-[#d4183d] hover:text-white flex items-center justify-center transition-colors text-[#d4183d]"
                                  onClick={() => requestRemoveIrrigation(system.originalIndex, system.zone)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div id="sprinkler-damage-reports-section" className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm transition-all duration-300">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3>Sprinkler Damage Reports</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Reports are submitted by workers through the mobile app</p>
              </div>
              <button
                type="button"
                onClick={() => setReportDamageDialogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4183d] text-white text-xs font-semibold hover:bg-[#b01230] shadow-sm transition-all active:scale-95 shrink-0"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                + Report Problem
              </button>
            </div>
            <div className="space-y-3">
              {irrigationDamageReports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sprinkler damage reports yet. Workers can submit reports from the Irrigation module in the mobile app.</p>
              ) : null}
              {irrigationDamageReports
                .slice()
                .sort((a, b) => String(b.reportedAt || '').localeCompare(String(a.reportedAt || '')))
                .slice(0, 20)
                .map((report, idx) => {
                  const status = (report.status || 'Pending').trim() || 'Pending';
                  const isResolved = status.toLowerCase() === 'resolved';
                  const statusBadge = isResolved
                    ? 'bg-[#2d5016] text-white'
                    : status.toLowerCase() === 'pending'
                    ? 'bg-[#d4183d] text-white'
                    : 'bg-[#d4a574] text-[#3e2723]';

                  return (
                    <div
                      key={report.reportId || `${report.reportedAt}-${idx}`}
                      id={report.reportId ? `report-${report.reportId}` : `report-idx-${idx}`}
                      className="bg-[#f5f1ed] rounded-xl p-3 border border-[#4a2c2a]/10 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-start gap-2">
                            <h4 className="text-sm font-bold text-[#3e2723] truncate leading-tight">
                              {report.sprinklerLabel?.trim() || report.zone?.trim() || 'Sprinkler'}
                            </h4>
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase shrink-0 ${statusBadge}`}>
                              {status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {report.zone && report.zone.trim() !== (report.sprinklerLabel || '').trim() ? `${report.zone} ` : ''}
                            {report.reportedAt ? `• ${report.reportedAt} ` : ''}
                            {report.reportedBy ? `• Reported by ${report.reportedBy}` : ''}
                          </p>
                          {report.details ? (
                            <p className="text-sm text-[#3e2723] mt-2 whitespace-pre-line">{report.details}</p>
                          ) : null}
                        </div>

                        {!isResolved ? (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void updateState((prev) => {
                                const next = (prev.irrigationDamageReports ?? []).map((r) =>
                                  (r.reportId || '') === (report.reportId || '') ? { ...r, status: 'Resolved' } : r,
                                );
                                return { ...prev, irrigationDamageReports: next };
                              })
                            }
                            className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded bg-[#2d5016] text-white hover:bg-[#1b3310] disabled:opacity-60"
                          >
                            Mark resolved
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div id="pest-reports-section" className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3>Pest and Disease Issues Report</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Reports are submitted by workers through the mobile app</p>
              </div>
            </div>
            <div className="space-y-3">
              {pestControlLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pest or disease reports from workers yet. Workers can submit reports from the mobile app.</p>
              ) : null}
              {pestControlLogs.map((record, idx) => {
                const isPending = record.status === 'Pending';
                const isResolved = record.status === 'Resolved';
                const isTreatment = record.status === 'Under Treatment';

                const statusBadge = isResolved
                  ? 'bg-[#2d5016] text-white'
                  : isPending
                  ? 'bg-[#d4183d] text-white'
                  : isTreatment
                  ? 'bg-[#8b6f47] text-white'
                  : 'bg-[#d4a574] text-[#3e2723]';

                return (
                  <div key={record.pestControlId || `${record.field}-${record.date}-${idx}`} id={record.pestControlId ? `pest-${record.pestControlId}` : undefined} className="bg-[#f5f1ed] rounded-xl p-3 border border-[#4a2c2a]/10">
                    <div className="flex items-start gap-3">
                      {record.photoUrl ? (
                        <div className="w-14 h-14 rounded-lg bg-white border border-[#4a2c2a]/15 overflow-hidden shrink-0">
                          <img src={record.photoUrl} alt={record.issue} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-white border border-[#4a2c2a]/15 flex items-center justify-center shrink-0 text-muted-foreground text-[9px] font-medium leading-none">
                          No Photo
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-[#3e2723] truncate leading-tight">{record.issue || 'Pest / Disease Issue'}</h4>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase shrink-0 ${statusBadge}`}>
                            {record.status}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-[#2d5016]">
                          Zone: {record.field} {record.treeNumber ? `· Tree #${record.treeNumber}` : ''}
                        </p>
                        {record.treatment ? (
                          <p className="text-[11px] text-muted-foreground leading-snug truncate">
                            Plan: {record.treatment}
                          </p>
                        ) : null}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-[#4a2c2a]/5">
                          <span>Reported: {record.date}{record.reportedBy ? ` • ${record.reportedBy}` : ''}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              aria-label="Assign treatment"
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#2d5016]/10 text-[#2d5016] text-[10px] font-semibold hover:bg-[#2d5016]/20 transition-colors"
                              onClick={() => openEditPest(idx)}
                            >
                              <Edit2 className="w-3 h-3" />
                              Assign Treatment
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex h-[620px] flex-col bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3>Employee Directory</h3>
              <button
                type="button"
                onClick={openAddDialog}
                className="flex items-center gap-2 px-4 py-2 bg-[#2d5016] text-white text-sm font-medium rounded-xl hover:bg-[#234010] transition-colors shadow-md shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add employee
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-[#8b6f47]/35 scrollbar-track-transparent md:grid-cols-2">
              {workers.map((worker) => (
                <div
                  key={worker.index}
                  onClick={() => setSelectedWorkerIndex(worker.index)}
                  className={`bg-[#f5f1ed] rounded-xl p-4 border cursor-pointer transition-all hover:shadow-md ${
                    selectedWorkerIndex === worker.index
                      ? 'border-[#2d5016]/50 ring-2 ring-[#2d5016]/20'
                      : 'border-[#4a2c2a]/10 hover:border-[#4a2c2a]/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={worker.image}
                      alt={worker.name}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="mb-1 truncate">{worker.name}</h4>
                      <p className="text-sm text-[#2d5016] mb-2">{worker.role}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{[worker.address, worker.barangay].filter(Boolean).join(', ')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Phone className="w-3 h-3" />
                        <span>{worker.phone}</span>
                      </div>
                      {worker.accountEmail ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">{worker.accountEmail}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] text-[#5d4037]">
                          ID {worker.workerId}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] ${
                            worker.status === 'active'
                              ? 'bg-[#2d5016] text-white'
                              : 'bg-[#b0bec5] text-[#263238]'
                          }`}
                        >
                          {worker.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditDialog(worker); }}
                        aria-label={`Edit ${worker.name}`}
                        className="w-8 h-8 rounded-lg bg-white hover:bg-[#4a2c2a] hover:text-white transition-colors flex items-center justify-center"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Make ${worker.name} inactive`}
                        title="Make inactive"
                        disabled={worker.status === 'inactive'}
                        className="w-8 h-8 rounded-lg bg-white hover:bg-[#8b6f47] hover:text-white transition-colors flex items-center justify-center disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-inherit"
                        onClick={(e) => removeWorker(e, worker.index)}
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selectedWorker ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3>Employee Profile</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#4a2c2a]/30"
                  onClick={() => openEditDialog(selectedWorker)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              </div>
              <div className="text-center mb-4">
                <img
                  src={selectedWorker.image}
                  alt={selectedWorker.name}
                  className="w-24 h-24 rounded-2xl object-cover mx-auto mb-3"
                />
                <h4>{selectedWorker.name}</h4>
                <p className="text-sm text-[#2d5016]">{selectedWorker.role}</p>
              </div>
              <div className="space-y-3">
                <div className="bg-[#f5f1ed] rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Worker ID</p>
                  <p className="text-sm font-medium">{selectedWorker.workerId}</p>
                  <p className="text-xs text-muted-foreground mt-1">Auto-generated and not manually editable.</p>
                </div>
                <div className="bg-[#f5f1ed] rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Login email</p>
                  <p className="text-sm font-medium break-all">{selectedWorker.accountEmail || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Used by the worker to sign in on the mobile app.
                  </p>
                </div>
                <div className="bg-[#f5f1ed] rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Temporary password</p>
                  <p className="font-mono text-sm font-medium break-all">{selectedWorker.accountPassword || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Shown only if this employee was created after password saving was enabled.
                  </p>
                </div>
                <div className="bg-[#f5f1ed] rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Birthday / age</p>
                  <p className="text-sm font-medium">
                    {selectedWorker.birthday || '—'}{' '}
                    {selectedWorker.age != null ? `(${selectedWorker.age} years old)` : ''}
                  </p>
                </div>
                <div className="bg-[#f5f1ed] rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Sex</p>
                  <p className="text-sm font-medium">{selectedWorker.sex}</p>
                </div>
                <div className="bg-[#f5f1ed] rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Address</p>
                  <p className="text-sm font-medium">{selectedWorker.address}</p>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-[#5d4037]">Barangay: </span>
                      {selectedWorker.barangay}
                    </p>
                    <p>
                      <span className="font-medium text-[#5d4037]">City / municipality: </span>
                      {selectedWorker.municipality}
                    </p>
                    <p>
                      <span className="font-medium text-[#5d4037]">Province: </span>
                      {selectedWorker.province}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-[#4a2c2a]/10 flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>
                      {selectedWorker.address}, {selectedWorker.barangay}, {selectedWorker.municipality},{' '}
                      {selectedWorker.province}
                    </span>
                  </p>
                </div>
                <div className="bg-[#f5f1ed] rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Contact</p>
                  <p className="text-sm font-medium">{selectedWorker.phone}</p>
                  <div className="mt-3 border-t border-[#4a2c2a]/10 pt-3">
                    <p className="text-xs text-muted-foreground mb-1">Emergency contact</p>
                    <p className="text-sm font-medium">{selectedWorker.emergencyContactName}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedWorker.emergencyContactRelationship} · {selectedWorker.emergencyContactPhone}
                    </p>
                  </div>
                </div>
                <div className="bg-[#f5f1ed] rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        selectedWorker.status === 'active' ? 'bg-[#2d5016]' : 'bg-[#b0bec5]'
                      }`}
                    />
                    <p className="text-sm font-medium capitalize">{selectedWorker.status}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm text-center">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Select an employee to view profile</p>
            </div>
          )}

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
            <h3 className="mb-4">Recent Tasks</h3>
            <div className="space-y-3">
              {recentTasks.map((task, idx) => (
                <div key={idx} className="bg-[#f5f1ed] rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm">{task.title}</h4>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        task.status === 'completed'
                          ? 'bg-[#2d5016] text-white'
                          : task.status === 'in-progress'
                          ? 'bg-[#d4a574] text-white'
                          : 'bg-[#8b6f47] text-white'
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{task.details}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Calendar className="w-3 h-3" />
                    <span>{task.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
