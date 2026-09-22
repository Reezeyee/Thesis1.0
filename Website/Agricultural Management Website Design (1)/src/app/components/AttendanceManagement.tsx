import { useMemo, useState, type MouseEvent } from 'react';
import {
  Clock,
  ClipboardCheck,
  CheckCircle2,
  FileClock,
  CalendarDays,
  History,
  Eye,
  Check,
  XCircle,
  FileText,
  Camera,
  Search,
  X,
  User,
  UserX,
  Plus,
  Edit2,
  MapPin,
  Phone,
} from 'lucide-react';
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
import { useFarmData } from '../store/FarmDataProvider';
import { useAuth } from '../auth/AuthProvider';
import { createWorkerAuthAccount, type CreatedWorkerAccount } from '../auth/workerAccount';
import { formatCurrency } from '../lib/currencyFormat';
import { runSave, showSaveError } from '../lib/saveFeedback';
import { logStateApiActivity, logUiAction } from '../lib/apiRouteLogger';
import {
  hourlyRateForWorkerRole,
  payrollLineAmount,
  responsibilitiesForWorkerRole,
  splitRegularAndOvertimeHours,
  formatHoursBreakdown,
  formatHoursBreakdownFromTotal,
  WORKER_ROLES,
} from '../lib/farmFinance';
import {
  isAtLeast18,
  isValidPhone11,
  parseWorkerDetails,
  workerRecordToUi,
  workerRecordToDraft,
  draftToWorkerRecord,
  emptyWorkerDraft,
  type WorkerUi,
  type WorkerFormDraft,
} from '../lib/workerUi';
import { WorkerFormDialog } from './WorkerFormDialog';
import type {
  AppState,
  ApprovalStatus,
  AttendanceRecord,
  LeaveRequestRecord,
  PayrollRecord,
  TimesheetCorrectionRequest,
  WorkerRecord,
} from '../types/appState';

function attendanceSortValue(attendance: AttendanceRecord): number {
  if (attendance.timestampMillis && attendance.timestampMillis > 0) {
    return attendance.timestampMillis;
  }
  const dateStr = attendance.date?.trim() || '';
  const clockInStr = attendance.clockIn?.trim() || '';
  let direct = Date.parse(`${dateStr} ${clockInStr}`);
  if (Number.isFinite(direct) && direct > 0) return direct;
  direct = Date.parse(dateStr);
  if (Number.isFinite(direct) && direct > 0) {
    const timeMatch = clockInStr.match(/(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const isPm = timeMatch[3]?.toUpperCase() === 'PM';
      const isAm = timeMatch[3]?.toUpperCase() === 'AM';
      if (isPm && h < 12) h += 12;
      if (isAm && h === 12) h = 0;
      return direct + (h * 3600 + m * 60) * 1000;
    }
    return direct;
  }
  return 0;
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

function statusBadgeClass(status: ApprovalStatus | string): string {
  if (status === 'Approved') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (status === 'Rejected') return 'bg-rose-500/15 text-rose-500 border-rose-500/30';
  return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
}

function attendanceRecordForCorrection(request: TimesheetCorrectionRequest): AttendanceRecord {
  return {
    workerName: request.workerName,
    date: request.date,
    clockIn: request.requestedClockIn || request.originalClockIn || undefined,
    clockOut: request.requestedClockOut || request.originalClockOut || undefined,
    details: `Created from approved timesheet correction ${request.correctionId}`,
    attendanceId: request.attendanceId || `ATT-${Date.now().toString().slice(-6)}`,
    submittedByStaff: true,
    awaitingPayrollLine: true,
    timestampMillis: Date.now(),
  };
}

function workerForAttendance(workers: WorkerRecord[], attendance: AttendanceRecord): WorkerRecord | undefined {
  const name = attendance.workerName.trim().toLowerCase();
  return workers.find((worker) => worker.name.trim().toLowerCase() === name);
}

function attendancePeriodLabel(attendance: AttendanceRecord): string {
  if (!attendance.date) return 'Attendance';
  const parsed = Date.parse(attendance.date);
  if (!Number.isFinite(parsed)) return attendance.date;
  return new Date(parsed).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function payrollFromAttendance(attendance: AttendanceRecord, worker?: WorkerRecord): PayrollRecord {
  const hourlyRate = hourlyRateForWorkerRole(worker?.roleRate ?? '');
  const hoursWorked = attendance.hoursWorked ?? 0;
  // Carry the attendance record's own regular/overtime split when it has one; older attendance
  // rows saved before this field existed derive it from their total hours instead.
  const split =
    attendance.regularHours != null || attendance.overtimeHours != null
      ? { regularHours: attendance.regularHours ?? 0, overtimeHours: attendance.overtimeHours ?? 0 }
      : splitRegularAndOvertimeHours(hoursWorked);
  const record: PayrollRecord = {
    workerName: attendance.workerName,
    period: attendancePeriodLabel(attendance),
    amount: hourlyRate > 0 && hoursWorked > 0 ? Math.round(hourlyRate * hoursWorked) : 0,
    paid: false,
    date: attendance.date ?? new Date().toISOString().slice(0, 10),
    workerId: worker?.workerId ?? '',
    hourlyRate,
    hoursWorked,
    daysWorked: 0,
    dailyRate: 0,
    linkedAttendanceId: attendance.attendanceId ?? '',
    paymentMethod: null,
    regularHours: split?.regularHours,
    overtimeHours: split?.overtimeHours,
  };
  return { ...record, amount: payrollLineAmount(record) };
}

function getWorkerActivitiesForDate(state: AppState, workerName: string, date: string): string[] {
  const activities: string[] = [];
  const nameLower = workerName.trim().toLowerCase();

  // 1. Cherry harvests (pickerWorkerName matches workerName, and date matches)
  const harvests = state.cherryHarvests.filter((h) => {
    const hName = (h.pickerWorkerName || '').trim().toLowerCase();
    const hDate = h.date || '';
    return hName === nameLower && hDate.includes(date);
  });
  if (harvests.length > 0) {
    harvests.forEach((h) => {
      activities.push(`Harvested cherry batch ${h.batchId} (${h.weightText || 'unknown weight'})`);
    });
  }

  // 2. Cherry grades scanned (scannedByWorkerName matches workerName, date from savedAtMillis matches)
  const grades = state.cherryGrades.filter((g) => {
    const gName = (g.scannedByWorkerName || '').trim().toLowerCase();
    if (gName !== nameLower || !g.savedAtMillis) return false;
    const gDate = new Date(g.savedAtMillis).toISOString().slice(0, 10);
    return gDate === date;
  });
  if (grades.length > 0) {
    activities.push(`Scanned and graded ${grades.length} cherry batch${grades.length > 1 ? 'es' : ''}`);
  }

  // 3. Equipment reports reported by matches workerName, and date matches
  const eqReports = state.equipmentReports.filter((r) => {
    const rName = (r.reportedBy || '').trim().toLowerCase();
    const rDate = r.reportedAt || '';
    return rName === nameLower && rDate === date;
  });
  if (eqReports.length > 0) {
    eqReports.forEach((r) => {
      const condition = r.isFixedReport ? 'fixed' : (r.isWrecked ? 'wrecked' : 'OK');
      activities.push(`Reported equipment ${r.equipmentName} condition as ${condition} (${r.notes || 'no notes'})`);
    });
  }

  return activities;
}

export function AttendanceManagement() {
  const { state, loading, updateState, saving } = useFarmData();
  const { session } = useAuth();
  const managerName = session?.displayName || 'Farm Manager';

  // Employee accounts (create/edit/deactivate) -- moved here from Farm Management so account
  // creation and management live in this module, per the consultation feedback that
  // Users Management should own employee accounts.
  const workers = state.workers.map((w, index) => workerRecordToUi(w, index));
  const [selectedWorkerIndex, setSelectedWorkerIndex] = useState<number | null>(null);
  const [workerFormOpen, setWorkerFormOpen] = useState(false);
  const [editingWorkerIndex, setEditingWorkerIndex] = useState<number | null>(null);
  const [workerForm, setWorkerForm] = useState<WorkerFormDraft>(() => emptyWorkerDraft());
  const [workerFormError, setWorkerFormError] = useState<string | null>(null);
  const [createdWorkerAccount, setCreatedWorkerAccount] = useState<(CreatedWorkerAccount & { phone?: string }) | null>(null);
  const [workerSearchQuery, setWorkerSearchQuery] = useState('');
  const [workerRoleFilter, setWorkerRoleFilter] = useState('All');
  const [workerStatusFilter, setWorkerStatusFilter] = useState('All');
  const [workerSortOrder, setWorkerSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');

  const filteredWorkers = useMemo(() => {
    let list = [...workers];
    if (workerSearchQuery.trim()) {
      const q = workerSearchQuery.toLowerCase();
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.role.toLowerCase().includes(q) ||
          w.barangay.toLowerCase().includes(q) ||
          w.municipality.toLowerCase().includes(q) ||
          w.phone.includes(q) ||
          w.workerId.toLowerCase().includes(q),
      );
    }
    if (workerRoleFilter !== 'All') {
      list = list.filter((w) => w.role.toLowerCase() === workerRoleFilter.toLowerCase());
    }
    if (workerStatusFilter !== 'All') {
      list = list.filter((w) => w.status === workerStatusFilter.toLowerCase());
    }
    if (workerSortOrder === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (workerSortOrder === 'oldest') {
      list.sort((a, b) => a.index - b.index);
    } else {
      list.sort((a, b) => b.index - a.index);
    }
    return list;
  }, [workers, workerSearchQuery, workerRoleFilter, workerStatusFilter, workerSortOrder]);

  const selectedWorker =
    selectedWorkerIndex !== null ? workers.find((w) => w.index === selectedWorkerIndex) ?? null : null;
  const isEditingWorker = editingWorkerIndex !== null;

  const openAddWorkerDialog = () => {
    setEditingWorkerIndex(null);
    setWorkerForm(emptyWorkerDraft());
    setWorkerFormError(null);
    setWorkerFormOpen(true);
  };

  const openEditWorkerDialog = (worker: WorkerUi) => {
    const record = state.workers[worker.index];
    if (!record) return;
    setEditingWorkerIndex(worker.index);
    setWorkerForm(workerRecordToDraft(record));
    setWorkerFormError(null);
    setSelectedWorkerIndex(worker.index);
    setWorkerFormOpen(true);
  };

  const closeWorkerForm = () => {
    setWorkerFormOpen(false);
    setEditingWorkerIndex(null);
    setWorkerForm(emptyWorkerDraft());
    setWorkerFormError(null);
  };

  const saveWorker = async () => {
    setWorkerFormError(null);
    const existingWorker =
      editingWorkerIndex !== null ? state.workers[editingWorkerIndex] : undefined;
    const existingId = existingWorker?.workerId;

    if (!workerForm.firstName.trim() || !workerForm.lastName.trim()) {
      setWorkerFormError('Please enter both first name and last name.');
      return;
    }
    if (!isAtLeast18(workerForm.birthday)) {
      setWorkerFormError('Please enter a birthday showing the employee is at least 18 years old.');
      return;
    }
    if (!isValidPhone11(workerForm.phone)) {
      setWorkerFormError('Phone number must be strictly 11 digits starting with 09 (Sample: 09171234567).');
      return;
    }
    if (!isValidPhone11(workerForm.emergencyPhone)) {
      setWorkerFormError('Emergency phone number must be strictly 11 digits starting with 09 (Sample: 09181234567).');
      return;
    }
    if (!workerForm.municipality.trim() || !workerForm.barangay.trim()) {
      setWorkerFormError('Please select both city/municipality and barangay.');
      return;
    }
    if (!workerForm.addressLine1.trim()) {
      setWorkerFormError('Please enter Address Line 1.');
      return;
    }
    if (editingWorkerIndex === null && !workerForm.imageUrl.trim()) {
      setWorkerFormError('A profile photo is required to complete employee registration.');
      return;
    }

    let record = draftToWorkerRecord(workerForm, existingId, existingWorker?.authUid);
    if (editingWorkerIndex !== null && existingWorker) {
      const existingMeta = parseWorkerDetails(existingWorker.details);
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
      setCreatedWorkerAccount(
        generatedAccount
          ? {
              ...generatedAccount,
              phone: record.phoneNumber || workerForm.phone,
            }
          : null,
      );
      closeWorkerForm();
      return;
    }
    setWorkerFormError('Could not save worker. Check the banner at the top for Firebase errors.');
  };

  const deactivateWorker = async (e: MouseEvent, index: number) => {
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
            details: JSON.stringify({ ...meta, status: 'inactive' }),
          };
        }),
      })),
    );
    setSelectedWorkerIndex(index);
  };

  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [attendanceSortOrder, setAttendanceSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedAttendanceProof, setSelectedAttendanceProof] = useState<AttendanceRecord | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState<Record<string, string>>({});

  const filteredAttendance = useMemo(() => {
    let list = [...state.attendance];
    if (attendanceSearchQuery.trim()) {
      const q = attendanceSearchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.workerName?.toLowerCase().includes(q) ||
          a.date?.toLowerCase().includes(q) ||
          a.timeInLocationName?.toLowerCase().includes(q) ||
          a.details?.toLowerCase().includes(q),
      );
    }
    if (attendanceSortOrder === 'oldest') {
      list.sort((a, b) => attendanceSortValue(a) - attendanceSortValue(b));
    } else {
      list.sort((a, b) => attendanceSortValue(b) - attendanceSortValue(a));
    }
    return list;
  }, [state.attendance, attendanceSearchQuery, attendanceSortOrder]);

  const timesheetCorrections = useMemo(
    () => [...(state.timesheetCorrections || [])].sort((a, b) => Date.parse(b.submittedAt || '') - Date.parse(a.submittedAt || '')),
    [state.timesheetCorrections],
  );
  const leaveRequests = useMemo(
    () => [...(state.leaveRequests || [])].sort((a, b) => Date.parse(b.submittedAt || '') - Date.parse(a.submittedAt || '')),
    [state.leaveRequests],
  );
  const pendingTimesheetCorrections = timesheetCorrections.filter((request) => request.status === 'Pending');
  const pendingLeaveRequests = leaveRequests.filter((request) => request.status === 'Pending');

  const [approvalsStatusFilter, setApprovalsStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [approvalsTypeFilter, setApprovalsTypeFilter] = useState<'all' | 'timesheets' | 'leaves'>('all');
  const [approvalsSearchQuery, setApprovalsSearchQuery] = useState('');
  const [selectedAuditCorrection, setSelectedAuditCorrection] = useState<TimesheetCorrectionRequest | null>(null);

  const filteredTimesheetCorrections = useMemo(() => {
    let list = [...timesheetCorrections];
    if (approvalsStatusFilter !== 'All') {
      list = list.filter((r) => r.status === approvalsStatusFilter);
    }
    if (approvalsSearchQuery.trim()) {
      const q = approvalsSearchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.workerName.toLowerCase().includes(q) ||
          r.date.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          r.correctionId.toLowerCase().includes(q),
      );
    }
    return list;
  }, [timesheetCorrections, approvalsStatusFilter, approvalsSearchQuery]);

  const filteredLeaveRequests = useMemo(() => {
    let list = [...leaveRequests];
    if (approvalsStatusFilter !== 'All') {
      list = list.filter((r) => r.status === approvalsStatusFilter);
    }
    if (approvalsSearchQuery.trim()) {
      const q = approvalsSearchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.workerName.toLowerCase().includes(q) ||
          r.leaveType.toLowerCase().includes(q) ||
          r.startDate.toLowerCase().includes(q) ||
          r.endDate.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          r.leaveId.toLowerCase().includes(q),
      );
    }
    return list;
  }, [leaveRequests, approvalsStatusFilter, approvalsSearchQuery]);

  // Payroll from attendance / work hours
  const linkedAttendanceIds = useMemo(
    () =>
      new Set(
        state.payroll
          .map((payroll) => payroll.linkedAttendanceId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    [state.payroll],
  );
  const recentAttendance = useMemo(
    () => [...state.attendance].sort((a, b) => attendanceSortValue(b) - attendanceSortValue(a)).slice(0, 8),
    [state.attendance],
  );
  const pendingAttendance = state.attendance.filter(
    (attendance) =>
      attendance.awaitingPayrollLine &&
      Boolean(attendance.attendanceId?.trim()) &&
      !linkedAttendanceIds.has(attendance.attendanceId!.trim()),
  );

  const reviewTimesheetCorrection = async (request: TimesheetCorrectionRequest, status: ApprovalStatus) => {
    logUiAction(`Clicked "${status === 'Approved' ? 'Approve Timesheet' : 'Reject Timesheet'}"`);
    const remarks = approvalRemarks[request.correctionId]?.trim() || '';
    const reviewedAt = new Date().toLocaleString('en-US');
    const payload = { correctionId: request.correctionId, status, remarks };

    const ok = await runSave('Timesheet correction', () =>
      logStateApiActivity(
        'POST',
        `/api/timesheets/correction/${request.correctionId}/review`,
        payload,
        () => updateState((prev) => {
          const attendance = [...prev.attendance];
          if (status === 'Approved') {
            const existingIndex = attendance.findIndex(
              (record) =>
                (request.attendanceId && record.attendanceId === request.attendanceId) ||
                (record.workerName.trim().toLowerCase() === request.workerName.trim().toLowerCase() && record.date === request.date),
            );
            if (existingIndex >= 0) {
              attendance[existingIndex] = {
                ...attendance[existingIndex],
                clockIn: request.requestedClockIn || attendance[existingIndex].clockIn,
                clockOut: request.requestedClockOut || attendance[existingIndex].clockOut,
                details: `${attendance[existingIndex].details || 'Attendance record'} | Approved correction ${request.correctionId}: original ${request.originalClockIn || '--'}/${request.originalClockOut || '--'}`,
              };
            } else {
              attendance.unshift(attendanceRecordForCorrection(request));
            }
          }

          return {
            ...prev,
            attendance,
            timesheetCorrections: prev.timesheetCorrections.map((item) =>
              item.correctionId === request.correctionId
                ? {
                    ...item,
                    status,
                    reviewedAt,
                    reviewedBy: managerName,
                    managerRemarks: remarks,
                    auditTrail: [
                      ...(item.auditTrail || []),
                      {
                        actorName: managerName,
                        action: `${status} timesheet correction`,
                        remarks,
                        timestamp: reviewedAt,
                      },
                    ],
                  }
                : item,
            ),
          };
        }),
      ),
    );
    if (ok) setApprovalRemarks((prev) => ({ ...prev, [request.correctionId]: '' }));
  };

  const reviewLeaveRequest = async (request: LeaveRequestRecord, status: ApprovalStatus) => {
    logUiAction(`Clicked "${status === 'Approved' ? 'Approve Leave' : 'Reject Leave'}"`);
    const remarks = approvalRemarks[request.leaveId]?.trim() || '';
    const reviewedAt = new Date().toLocaleString('en-US');
    const payload = { leaveId: request.leaveId, status, remarks };

    const ok = await runSave('Leave request', () =>
      logStateApiActivity(
        'POST',
        `/api/leaves/${request.leaveId}/review`,
        payload,
        () => updateState((prev) => ({
          ...prev,
          leaveRequests: prev.leaveRequests.map((item) =>
            item.leaveId === request.leaveId
              ? {
                  ...item,
                  status,
                  reviewedAt,
                  reviewedBy: managerName,
                  managerRemarks: remarks,
                }
              : item,
          ),
        })),
      ),
    );
    if (ok) setApprovalRemarks((prev) => ({ ...prev, [request.leaveId]: '' }));
  };

  const createPayrollFromAttendance = async (attendance: AttendanceRecord) => {
    const attendanceId = attendance.attendanceId?.trim();
    if (!attendanceId || linkedAttendanceIds.has(attendanceId)) return;
    const worker = workerForAttendance(state.workers, attendance);
    if (!worker) {
      showSaveError('No worker on the roster matches this attendance record\'s name — fix the worker name first.');
      return;
    }
    const payroll = payrollFromAttendance(attendance, worker);
    if (payroll.amount <= 0) {
      showSaveError('Could not work out a pay amount for this worker\'s role — payroll line was not created.');
      return;
    }
    const ok = await runSave('Attendance payroll', () =>
      updateState((prev) => {
        // Re-check inside the updater: guards against a double-click race creating two payroll
        // lines for the same attendance record before the button has a chance to disable.
        if (prev.payroll.some((p) => p.linkedAttendanceId?.trim() === attendanceId)) return prev;
        return {
          ...prev,
          attendance: prev.attendance.map((row) =>
            row.attendanceId?.trim() === attendanceId
              ? { ...row, awaitingPayrollLine: false }
              : row
          ),
          payroll: [...prev.payroll, payroll],
        };
      })
    );
    if (!ok) showSaveError('Attendance payroll');
  };

  const clearAttendanceHistory = async () => {
    if (state.attendance.length === 0) return;
    if (pendingAttendance.length > 0) {
      showSaveError(
        `${pendingAttendance.length} attendance record${pendingAttendance.length === 1 ? '' : 's'} still ` +
          'awaiting a payroll line. Add payroll for those first — clearing history now would erase them ' +
          'without ever paying that time.',
      );
      return;
    }
    const confirmed = window.confirm(
      `This permanently deletes all ${state.attendance.length} attendance record(s). This cannot be undone. Continue?`,
    );
    if (!confirmed) return;
    await runSave('Attendance history', () =>
      updateState((prev) => ({
        ...prev,
        attendance: [],
      }))
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1>Attendance</h1>
        <p className="text-muted-foreground">Loading attendance data from Firebase…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap gap-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-foreground">
              Users Management
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live System
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Create employee accounts, manage worker records, approve timesheet corrections and leave filings, review time-in/time-out logs, and compute payroll from attendance.
          </p>
        </div>
      </div>

      <WorkerFormDialog
        open={workerFormOpen}
        onOpenChange={(open) => {
          if (!open) closeWorkerForm();
          else setWorkerFormOpen(true);
        }}
        isEditing={isEditingWorker}
        form={workerForm}
        setForm={setWorkerForm}
        onSave={saveWorker}
        saving={saving}
        formError={workerFormError}
      />

      <Dialog open={Boolean(createdWorkerAccount)} onOpenChange={(open) => { if (!open) setCreatedWorkerAccount(null); }}>
        <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border/80">
          <DialogHeader>
            <DialogTitle>Worker account created</DialogTitle>
            <DialogDescription>
              Give these login details to the employee. The worker can use this email in the mobile app
              for Time In/Time Out, equipment logs, and coffee cherry scanning.
            </DialogDescription>
          </DialogHeader>
          {createdWorkerAccount ? (
            <div className="space-y-3 py-2">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="break-all text-sm font-medium">{createdWorkerAccount.email}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground mb-1">Temporary password</p>
                <p className="break-all font-mono text-sm font-medium">{createdWorkerAccount.password}</p>
              </div>
              {createdWorkerAccount.phone && (
                <div className="rounded-lg bg-emerald-500/10 border border-[#2d5016]/20 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-left">
                    <p className="text-xs text-[#2d5016] font-semibold">Associated Mobile Phone</p>
                    <p className="text-sm font-bold text-foreground">{createdWorkerAccount.phone}</p>
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

      {/* Employee Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex h-[660px] flex-col bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-base font-heading text-foreground">Employee Directory</h3>
                <p className="text-xs text-muted-foreground">
                  Showing {filteredWorkers.length} of {workers.length} registered personnel
                </p>
              </div>
              <button
                type="button"
                onClick={openAddWorkerDialog}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground text-xs font-bold rounded-xl hover:bg-accent/90 transition-all shadow-2xs shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add employee
              </button>
            </div>

            {/* Search and Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-4">
              <div className="sm:col-span-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search name, role, barangay, phone..."
                  value={workerSearchQuery}
                  onChange={(e) => setWorkerSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs bg-background/80"
                />
              </div>
              <div className="sm:col-span-3">
                <select
                  value={workerRoleFilter}
                  onChange={(e) => setWorkerRoleFilter(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground"
                >
                  <option value="All">All Roles</option>
                  {WORKER_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <select
                  value={workerSortOrder}
                  onChange={(e) => setWorkerSortOrder(e.target.value as 'newest' | 'oldest' | 'name')}
                  className="w-full h-9 px-2.5 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name">Name (A–Z)</option>
                </select>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent md:grid-cols-2">
              {filteredWorkers.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-xs text-muted-foreground font-mono">
                    {workerSearchQuery || workerRoleFilter !== 'All'
                      ? 'No employees match the specified filters.'
                      : 'No employees registered yet. Click "Add employee" to begin.'}
                  </p>
                </div>
              ) : (
                filteredWorkers.map((worker) => (
                  <div
                    key={worker.index}
                    onClick={() => setSelectedWorkerIndex(worker.index)}
                    className={`bg-muted/40 rounded-xl p-4 border cursor-pointer transition-all hover:border-accent/40 ${
                      selectedWorkerIndex === worker.index
                        ? 'border-[#2d5016]/50 ring-2 ring-[#2d5016]/20'
                        : 'border-border/60 hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={worker.image}
                        alt={worker.name}
                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border border-border shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="mb-1 truncate font-bold text-foreground">{worker.name}</h4>
                        <p className="text-sm text-[#2d5016] font-semibold mb-0.5">{worker.role}</p>
                        <p className="text-xs font-mono font-semibold text-muted-foreground mb-2">
                          {hourlyRateForWorkerRole(worker.role) > 0
                            ? `${formatCurrency(hourlyRateForWorkerRole(worker.role))}/hr`
                            : 'No fixed rate'}
                        </p>
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
                          <span className="max-w-full truncate rounded-full bg-background/80 px-2 py-1 text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                            ID {worker.workerId}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                              worker.status === 'active'
                                ? 'bg-[#2d5016] text-white'
                                : 'bg-[#b0bec5] text-[#263238]'
                            }`}
                          >
                            {worker.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditWorkerDialog(worker); }}
                          aria-label={`Edit ${worker.name}`}
                          className="w-8 h-8 rounded-lg bg-background/80 hover:bg-[#4a2c2a] hover:text-white transition-colors flex items-center justify-center cursor-pointer shadow-xs"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Make ${worker.name} inactive`}
                          title="Make inactive"
                          disabled={worker.status === 'inactive'}
                          className="w-8 h-8 rounded-lg bg-background/80 hover:bg-[#8b6f47] hover:text-white transition-colors flex items-center justify-center disabled:opacity-40 disabled:hover:bg-background/80 disabled:hover:text-inherit cursor-pointer shadow-xs"
                          onClick={(e) => deactivateWorker(e, worker.index)}
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selectedWorker ? (
            <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap gap-y-2">
                <h3 className="font-bold text-base font-heading text-foreground">Employee Profile</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border/80 hover:bg-accent/10"
                  onClick={() => openEditWorkerDialog(selectedWorker)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              </div>
              <div className="text-center mb-4">
                <img
                  src={selectedWorker.image}
                  alt={selectedWorker.name}
                  className="w-20 h-20 rounded-xl object-cover mx-auto mb-2 border border-border/60"
                />
                <h4 className="font-bold text-base font-heading text-foreground">{selectedWorker.name}</h4>
                <p className="text-xs font-mono font-bold text-emerald-500">{selectedWorker.role}</p>
              </div>
              <div className="space-y-2.5">
                <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Role & pay rate</p>
                  <p className="text-xs font-bold text-foreground">{selectedWorker.role}</p>
                  <p className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {hourlyRateForWorkerRole(selectedWorker.role) > 0
                      ? `${formatCurrency(hourlyRateForWorkerRole(selectedWorker.role))} / hour`
                      : 'No fixed hourly rate for this role'}
                  </p>
                  {responsibilitiesForWorkerRole(selectedWorker.role).length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground list-disc pl-4">
                      {responsibilitiesForWorkerRole(selectedWorker.role).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Worker ID</p>
                  <p className="text-xs font-bold font-mono text-foreground">{selectedWorker.workerId}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Auto-generated system identifier.</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Login email</p>
                  <p className="text-xs font-bold text-foreground break-all">{selectedWorker.accountEmail || '—'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Used by worker to sign in on mobile app.</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Temporary password</p>
                  <p className="font-mono text-xs font-bold text-foreground break-all">{selectedWorker.accountPassword || '—'}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Birthday / age</p>
                  <p className="text-xs font-bold text-foreground">
                    {selectedWorker.birthday || '—'}{' '}
                    {selectedWorker.age != null ? `(${selectedWorker.age} years old)` : ''}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Sex</p>
                  <p className="text-xs font-bold text-foreground">{selectedWorker.sex}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Address</p>
                  <p className="text-xs font-bold text-foreground">{selectedWorker.address}</p>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground font-mono">
                    <p>Barangay: <span className="text-foreground font-bold">{selectedWorker.barangay}</span></p>
                    <p>City / Town: <span className="text-foreground font-bold">{selectedWorker.municipality}</span></p>
                    <p>Province: <span className="text-foreground font-bold">{selectedWorker.province}</span></p>
                  </div>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Contact & Emergency</p>
                  <p className="text-xs font-bold text-foreground">{selectedWorker.phone}</p>
                  <div className="mt-2 pt-2 border-t border-border/40 text-xs">
                    <p className="text-[10px] text-muted-foreground font-mono">Emergency: {selectedWorker.emergencyContactName}</p>
                    <p className="text-xs font-semibold text-foreground">
                      {selectedWorker.emergencyContactRelationship} · {selectedWorker.emergencyContactPhone}
                    </p>
                  </div>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 border border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono font-semibold">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        selectedWorker.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
                      }`}
                    />
                    <p className="text-xs font-bold font-mono text-foreground capitalize">{selectedWorker.status}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm text-center">
              <User className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground font-mono">Select an employee to view profile</p>
            </div>
          )}
        </div>
      </div>

      {/* Manager Approvals Hub */}
      <div className="bg-card/95 border border-border/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg font-heading text-foreground">
                Manager Approvals Hub
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review timesheet correction requests and employee leave filings with original vs requested data diffs, reasons, and remarks.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs shrink-0">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2">
              <p className="text-lg font-black text-foreground">
                {pendingTimesheetCorrections.length + pendingLeaveRequests.length}
              </p>
              <p className="font-semibold text-muted-foreground text-[10px] uppercase">Pending Total</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2">
              <p className="text-lg font-black text-amber-600 dark:text-amber-400">
                {pendingTimesheetCorrections.length}
              </p>
              <p className="font-semibold text-muted-foreground text-[10px] uppercase">Timesheets</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 col-span-2 sm:col-span-1">
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {pendingLeaveRequests.length}
              </p>
              <p className="font-semibold text-muted-foreground text-[10px] uppercase">Leaves</p>
            </div>
          </div>
        </div>

        {/* Approval Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-3 border-t border-border/60">
          <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/70 text-xs">
            {(['Pending', 'Approved', 'Rejected', 'All'] as const).map((status) => {
              const count =
                status === 'Pending'
                  ? pendingTimesheetCorrections.length + pendingLeaveRequests.length
                  : status === 'Approved'
                  ? timesheetCorrections.filter((r) => r.status === 'Approved').length +
                    leaveRequests.filter((r) => r.status === 'Approved').length
                  : status === 'Rejected'
                  ? timesheetCorrections.filter((r) => r.status === 'Rejected').length +
                    leaveRequests.filter((r) => r.status === 'Rejected').length
                  : timesheetCorrections.length + leaveRequests.length;
              const isActive = approvalsStatusFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    logUiAction(`Filtered Approvals by status: "${status}"`);
                    setApprovalsStatusFilter(status);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                    isActive
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{status}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      status === 'Pending' && count > 0
                        ? 'bg-amber-500 text-black font-extrabold'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/70 text-xs">
              <button
                type="button"
                onClick={() => {
                  logUiAction('Filtered Approvals type: "All"');
                  setApprovalsTypeFilter('all');
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                  approvalsTypeFilter === 'all'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  logUiAction('Filtered Approvals type: "Timesheets"');
                  setApprovalsTypeFilter('timesheets');
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                  approvalsTypeFilter === 'timesheets'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Timesheets
              </button>
              <button
                type="button"
                onClick={() => {
                  logUiAction('Filtered Approvals type: "Leaves"');
                  setApprovalsTypeFilter('leaves');
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                  approvalsTypeFilter === 'leaves'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Leaves
              </button>
            </div>

            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search requests..."
                value={approvalsSearchQuery}
                onChange={(e) => setApprovalsSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/80"
              />
            </div>
          </div>
        </div>

        {/* Requests Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Timesheet Corrections Column / Card */}
          {(approvalsTypeFilter === 'all' || approvalsTypeFilter === 'timesheets') && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-y-2 gap-x-3">
                <div className="flex items-center gap-2">
                  <FileClock className="w-4 h-4 text-amber-500" />
                  <h4 className="text-sm font-bold text-foreground font-heading">
                    Timesheet Corrections
                  </h4>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {filteredTimesheetCorrections.length} request{filteredTimesheetCorrections.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredTimesheetCorrections.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/70 rounded-xl">
                    No timesheet correction requests found for this filter.
                  </div>
                ) : (
                  filteredTimesheetCorrections.map((request) => (
                    <div
                      key={request.correctionId}
                      className="rounded-xl bg-card border border-border/70 p-3.5 text-xs space-y-3 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm text-foreground">{request.workerName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Target Date: <span className="font-semibold text-foreground">{request.date}</span> · {request.correctionId}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(
                            request.status
                          )}`}
                        >
                          {request.status}
                        </span>
                      </div>

                      {/* Side-by-side Diff */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted/40 border border-border/50 p-2">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Original Recorded</p>
                          <p className="font-mono font-bold text-foreground mt-0.5">
                            {request.originalClockIn || '--'} / {request.originalClockOut || '--'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
                          <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Requested Correction</p>
                          <p className="font-mono font-bold text-foreground mt-0.5">
                            {request.requestedClockIn || '--'} / {request.requestedClockOut || '--'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted/30 p-2 border border-border/50">
                        <p className="text-muted-foreground">
                          Reason: <span className="text-foreground font-medium">{request.reason}</span>
                        </p>
                      </div>

                      {(request.faceSnapshotBase64 || request.locationName) && (
                        <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2 border border-border/50">
                          {request.faceSnapshotBase64 && (
                            <img
                              src={request.faceSnapshotBase64}
                              alt={`${request.workerName} verification photo`}
                              className="h-9 w-9 rounded-full object-cover border border-border/70 shrink-0"
                            />
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {request.locationName ? (
                              <>
                                📍 {request.isGeofenceVerified ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Verified on-site</span>
                                ) : (
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold">Outside farm geofence</span>
                                )}{' '}
                                ({request.locationName})
                              </>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">⚠️ Location not verified</span>
                            )}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Submitted {request.submittedAt}</span>
                        <button
                          type="button"
                          onClick={() => {
                            logUiAction(`Viewed audit trail for correction ${request.correctionId}`);
                            setSelectedAuditCorrection(request);
                          }}
                          className="font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <History className="w-3 h-3" />
                          Audit Log ({request.auditTrail?.length || 1})
                        </button>
                      </div>

                      {request.status === 'Pending' ? (
                        <div className="pt-2 border-t border-border/50 space-y-2">
                          <textarea
                            value={approvalRemarks[request.correctionId] || ''}
                            onChange={(event) =>
                              setApprovalRemarks((prev) => ({
                                ...prev,
                                [request.correctionId]: event.target.value,
                              }))
                            }
                            placeholder="Manager remarks (optional)"
                            className="min-h-14 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={saving}
                              onClick={() => void reviewTimesheetCorrection(request, 'Approved')}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Approve Correction
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={saving}
                              onClick={() => void reviewTimesheetCorrection(request, 'Rejected')}
                              className="rounded-lg border-rose-500/40 text-rose-500 hover:bg-rose-500/10 font-bold text-xs"
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-0.5">
                          <p>
                            Reviewed by <span className="font-semibold text-foreground">{request.reviewedBy || 'Manager'}</span> on {request.reviewedAt}
                          </p>
                          {request.managerRemarks && (
                            <p className="text-foreground italic">
                              Remarks: "{request.managerRemarks}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Leave Requests Column / Card */}
          {(approvalsTypeFilter === 'all' || approvalsTypeFilter === 'leaves') && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-y-2 gap-x-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-sm font-bold text-foreground font-heading">
                    Employee Leave Requests
                  </h4>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {filteredLeaveRequests.length} request{filteredLeaveRequests.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredLeaveRequests.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/70 rounded-xl">
                    No leave requests found for this filter.
                  </div>
                ) : (
                  filteredLeaveRequests.map((request) => (
                    <div
                      key={request.leaveId}
                      className="rounded-xl bg-card border border-border/70 p-3.5 text-xs space-y-3 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-sm text-foreground">{request.workerName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {request.leaveType} · {request.leaveId}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(
                            request.status
                          )}`}
                        >
                          {request.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted/40 border border-border/50 p-2">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Schedule</p>
                          <p className="font-semibold text-foreground mt-0.5">
                            {request.startDate} to {request.endDate}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/40 border border-border/50 p-2">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Duration</p>
                          <p className="font-bold text-foreground mt-0.5">
                            {request.leaveDays} {request.leaveDays === 1 ? 'day' : 'days'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted/30 p-2 border border-border/50">
                        <p className="text-muted-foreground">
                          Reason: <span className="text-foreground font-medium">{request.reason}</span>
                        </p>
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        Submitted {request.submittedAt}
                      </p>

                      {request.status === 'Pending' ? (
                        <div className="pt-2 border-t border-border/50 space-y-2">
                          <textarea
                            value={approvalRemarks[request.leaveId] || ''}
                            onChange={(event) =>
                              setApprovalRemarks((prev) => ({
                                ...prev,
                                [request.leaveId]: event.target.value,
                              }))
                            }
                            placeholder="Manager remarks (optional)"
                            className="min-h-14 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={saving}
                              onClick={() => void reviewLeaveRequest(request, 'Approved')}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Approve Leave
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={saving}
                              onClick={() => void reviewLeaveRequest(request, 'Rejected')}
                              className="rounded-lg border-rose-500/40 text-rose-500 hover:bg-rose-500/10 font-bold text-xs"
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-0.5">
                          <p>
                            Reviewed by <span className="font-semibold text-foreground">{request.reviewedBy || 'Manager'}</span> on {request.reviewedAt}
                          </p>
                          {request.managerRemarks && (
                            <p className="text-foreground italic">
                              Remarks: "{request.managerRemarks}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Worker Attendance */}
      <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <Clock className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-bold text-base font-heading text-foreground">Worker Attendance</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Mobile time-in and time-out records synced from worker accounts</p>
            </div>
          </div>
          <span className="rounded-full bg-muted border border-border/60 px-3 py-1 text-xs font-mono font-medium text-foreground whitespace-nowrap">
            {filteredAttendance.length} of {state.attendance.length} record{state.attendance.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by worker name, date, location..."
              value={attendanceSearchQuery}
              onChange={(e) => setAttendanceSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-background/80"
            />
          </div>
          <select
            value={attendanceSortOrder}
            onChange={(e) => setAttendanceSortOrder(e.target.value as 'newest' | 'oldest')}
            className="h-9 px-3 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground"
          >
            <option value="newest">Sort: Most Recent First</option>
            <option value="oldest">Sort: Oldest First</option>
          </select>
        </div>

        {filteredAttendance.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono py-4 text-center">
            {attendanceSearchQuery ? 'No attendance records match your search query.' : 'No worker attendance has synced yet.'}
          </p>
        ) : (
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
            {filteredAttendance.map((attendance, index) => {
              const worker = state.workers.find(
                (w) => w.name.trim().toLowerCase() === attendance.workerName?.trim().toLowerCase(),
              );
              const isClockedOut = Boolean(attendance.clockOut?.trim());
              return (
                <div
                  key={attendance.attendanceId || `${attendance.workerName}-${attendance.date}-${attendance.clockIn}-${index}`}
                  className="rounded-xl bg-muted/40 p-4 border border-border/60"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-sm text-foreground font-heading">{attendance.workerName || 'Unnamed worker'}</p>
                      <span className="max-w-full truncate rounded-full bg-background/80 border border-border/40 px-2.5 py-0.5 text-xs text-muted-foreground font-medium whitespace-nowrap">
                        {worker?.roleRate || 'No role rate'}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold font-mono ${
                          isClockedOut ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                        }`}
                      >
                        {isClockedOut ? 'Completed' : 'Timed in'}
                      </span>
                      {attendance.isGeofenceVerified !== undefined && attendance.isGeofenceVerified !== null ? (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            attendance.isGeofenceVerified ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25' : 'bg-amber-500/15 text-amber-500 border border-amber-500/25'
                          }`}
                        >
                          {attendance.isGeofenceVerified ? '📍 In Field Geofence' : '⚠️ Remote / Outside Field'}
                        </span>
                      ) : null}
                      {attendance.faceSnapshotBase64 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedAttendanceProof(attendance)}
                          className="rounded-full bg-blue-500/15 hover:bg-blue-500/25 text-blue-500 border border-blue-500/25 px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors"
                          title="Click to view full photo proof"
                        >
                          👤 Time In Verified (View Photo ↗)
                        </button>
                      ) : null}
                      {isClockedOut && attendance.isTimeOutGeofenceVerified !== undefined && attendance.isTimeOutGeofenceVerified !== null ? (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            attendance.isTimeOutGeofenceVerified ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25' : 'bg-amber-500/15 text-amber-500 border border-amber-500/25'
                          }`}
                        >
                          {attendance.isTimeOutGeofenceVerified ? '📍 Time Out In Geofence' : '⚠️ Time Out Remote / Outside Field'}
                        </span>
                      ) : null}
                      {attendance.timeOutFaceSnapshotBase64 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedAttendanceProof(attendance)}
                          className="rounded-full bg-blue-500/15 hover:bg-blue-500/25 text-blue-500 border border-blue-500/25 px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors"
                          title="Click to view full photo proof"
                        >
                          👤 Time Out Verified (View Photo ↗)
                        </button>
                      ) : null}
                      {attendance.details?.includes('Approved correction') ? (
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          ✏️ Approved Timesheet Correction
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {attendance.submittedByStaff ? 'Submitted by worker app' : 'Admin or imported record'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 md:grid-cols-4">
                    <div className="rounded-lg bg-background/80 p-3 border border-border/50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Date</p>
                      <p className="mt-1 text-sm font-bold font-mono text-foreground">{attendance.date || 'No date'}</p>
                    </div>
                    <div className="rounded-lg bg-background/80 p-3 border border-border/50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Time in</p>
                      <p className="mt-1 text-lg font-extrabold font-mono text-emerald-500">{formatClock24h(attendance.clockIn)}</p>
                    </div>
                    <div className="rounded-lg bg-background/80 p-3 border border-border/50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Time out</p>
                      <p className="mt-1 text-lg font-extrabold font-mono text-amber-500">{formatClock24h(attendance.clockOut)}</p>
                    </div>
                    <div className="rounded-lg bg-background/80 p-3 border border-border/50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Hours worked</p>
                      <p className="mt-1 text-lg font-extrabold font-mono text-foreground">{formatHoursWorked(attendance)}</p>
                    </div>
                  </div>

                  {(() => {
                    const breakdown =
                      formatHoursBreakdown(attendance.regularHours, attendance.overtimeHours) ??
                      formatHoursBreakdownFromTotal(attendance.hoursWorked);
                    return breakdown ? (
                      <p className="mt-2 text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {breakdown}
                      </p>
                    ) : null;
                  })()}

                  {attendance.timeInLatitude != null && attendance.timeInLongitude != null ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#6b5d56]">
                      <span className="font-semibold text-foreground">Time In Location:</span>
                      <span>
                        {attendance.timeInLocationName || `${attendance.timeInLatitude.toFixed(5)}, ${attendance.timeInLongitude.toFixed(5)}`}
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${attendance.timeInLatitude},${attendance.timeInLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-[#2d5016] underline hover:text-foreground"
                      >
                        Map Pin ↗
                      </a>
                    </div>
                  ) : null}

                  {attendance.timeOutLatitude != null && attendance.timeOutLongitude != null ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6b5d56]">
                      <span className="font-semibold text-foreground">Time Out Location:</span>
                      <span>
                        {attendance.timeOutLocationName || `${attendance.timeOutLatitude.toFixed(5)}, ${attendance.timeOutLongitude.toFixed(5)}`}
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${attendance.timeOutLatitude},${attendance.timeOutLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-[#2d5016] underline hover:text-foreground"
                      >
                        Map Pin ↗
                      </a>
                    </div>
                  ) : null}

                  {attendance.faceSnapshotBase64 ? (
                    <div
                      onClick={() => setSelectedAttendanceProof(attendance)}
                      className="mt-3 flex items-center gap-3 cursor-pointer p-2 rounded-lg bg-background/60 hover:bg-background/90 border border-border/50 transition-colors"
                    >
                      <img
                        src={attendance.faceSnapshotBase64.startsWith('data:') ? attendance.faceSnapshotBase64 : `data:image/jpeg;base64,${attendance.faceSnapshotBase64}`}
                        alt="Time In face verification snapshot"
                        className="h-12 w-12 rounded-lg object-cover border border-border/80 shadow-xs shrink-0"
                      />
                      <div>
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                          Time In Biometric Photo Proof <span className="text-[10px] text-accent">(Click to enlarge)</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">Captured on device camera during shift check-in</p>
                      </div>
                    </div>
                  ) : null}

                  {attendance.timeOutFaceSnapshotBase64 ? (
                    <div
                      onClick={() => setSelectedAttendanceProof(attendance)}
                      className="mt-2 flex items-center gap-3 cursor-pointer p-2 rounded-lg bg-background/60 hover:bg-background/90 border border-border/50 transition-colors"
                    >
                      <img
                        src={attendance.timeOutFaceSnapshotBase64.startsWith('data:') ? attendance.timeOutFaceSnapshotBase64 : `data:image/jpeg;base64,${attendance.timeOutFaceSnapshotBase64}`}
                        alt="Time Out face verification snapshot"
                        className="h-12 w-12 rounded-lg object-cover border border-border/80 shadow-xs shrink-0"
                      />
                      <div>
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                          Time Out Biometric Photo Proof <span className="text-[10px] text-accent">(Click to enlarge)</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">Captured on device camera during shift check-out</p>
                      </div>
                    </div>
                  ) : null}

                  {attendance.details ? (
                    <p className="mt-3 text-sm text-[#6b5d56]">
                      Notes: <span className="text-foreground">{attendance.details}</span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payroll & Work Hours */}
      <div className="flex h-[620px] flex-col bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2d5016]/15 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#2d5016]" />
            </div>
            <div>
              <h3>Payroll & Work Hours</h3>
              <p className="text-sm text-muted-foreground">
                Clock-in records from the mobile app. Create payroll lines from pending attendance.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted/40 px-3 py-1 text-xs font-medium text-foreground whitespace-nowrap">
              {pendingAttendance.length} pending payroll
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={saving || state.attendance.length === 0}
              onClick={() => void clearAttendanceHistory()}
            >
              Clear history
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-[#8b6f47]/35 scrollbar-track-transparent">
          {recentAttendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No worker attendance has synced yet.</p>
          ) : (
            <div className="space-y-3">
            {recentAttendance.map((attendance, index) => {
              const worker = workerForAttendance(state.workers, attendance);
              const isInactive = worker ? parseWorkerDetails(worker.details).status === 'inactive' : false;
              const attendanceId = attendance.attendanceId?.trim();
              const hasPayroll = Boolean(attendanceId && linkedAttendanceIds.has(attendanceId));
              const previewPayroll = payrollFromAttendance(attendance, worker);
              const canCreatePayroll = Boolean(
                attendance.awaitingPayrollLine &&
                  attendanceId &&
                  !hasPayroll &&
                  (attendance.hoursWorked ?? 0) > 0 &&
                  previewPayroll.amount > 0,
              );
              const noMatchingWorker =
                attendance.awaitingPayrollLine && attendanceId && !hasPayroll && previewPayroll.amount <= 0;
              return (
                <div
                  key={attendanceId || `${attendance.workerName}-${attendance.date}-${attendance.clockIn}-${index}`}
                  className="rounded-lg bg-muted/40 p-4 border border-border/60"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{attendance.workerName || 'Unnamed worker'}</p>
                        <span className="max-w-full truncate rounded-full bg-background/80 px-2.5 py-1 text-xs text-[#6b5d56] whitespace-nowrap">
                          {worker?.roleRate || 'No role rate'}
                        </span>
                        {isInactive ? (
                          <span className="rounded-full bg-[#b0bec5] px-2.5 py-1 text-xs font-medium text-[#263238] whitespace-nowrap">
                            Inactive
                          </span>
                        ) : null}
                        {hasPayroll ? (
                          <span className="rounded-full bg-[#2d5016] px-2.5 py-1 text-xs font-medium text-white whitespace-nowrap">
                            Payroll line added
                          </span>
                        ) : attendance.awaitingPayrollLine ? (
                          <span className="rounded-full bg-[#d4a574]/30 px-2.5 py-1 text-xs font-medium text-foreground whitespace-nowrap">
                            Awaiting payroll
                          </span>
                        ) : (
                          <span className="rounded-full bg-background/80 px-2.5 py-1 text-xs text-[#6b5d56] whitespace-nowrap">
                            Recorded
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                        {noMatchingWorker ? (
                          <span className="text-sm font-medium text-red-600">
                            No matching worker/role rate — can't add payroll
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-[#2d5016]">
                            Payroll: {formatCurrency(previewPayroll.amount)}
                          </span>
                        )}
                        <Button
                          size="sm"
                          className="bg-[#2d5016] text-white"
                          disabled={saving || !canCreatePayroll}
                          onClick={() => void createPayrollFromAttendance(attendance)}
                        >
                          Add payroll line
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-lg bg-background/80 p-3 border border-border/60">
                        <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Date</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{attendance.date || 'No date'}</p>
                      </div>
                      <div className="rounded-lg bg-background/80 p-3 border border-border/60">
                        <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Time in</p>
                        <p className="mt-1 text-lg font-semibold text-[#2d5016]">{formatClock24h(attendance.clockIn)}</p>
                      </div>
                      <div className="rounded-lg bg-background/80 p-3 border border-border/60">
                        <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Time out</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{formatClock24h(attendance.clockOut)}</p>
                      </div>
                      <div className="rounded-lg bg-background/80 p-3 border border-border/60">
                        <p className="text-xs font-medium uppercase tracking-wide text-[#6b5d56]">Hours</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {(attendance.hoursWorked ?? 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const breakdown = formatHoursBreakdown(previewPayroll.regularHours, previewPayroll.overtimeHours);
                      return breakdown ? (
                        <p className="text-xs font-mono font-semibold text-[#2d5016]">{breakdown}</p>
                      ) : null;
                    })()}
                    {(() => {
                      const dateStr = attendance.date || '';
                      const activities = getWorkerActivitiesForDate(state, attendance.workerName, dateStr);
                      return (
                        <div className="space-y-1.5 mt-1 border-t border-border/60 pt-2.5">
                          {attendance.details ? (
                            <p className="text-sm font-medium text-foreground">
                              Notes: <span className="font-normal text-[#6b5d56]">{attendance.details}</span>
                            </p>
                          ) : null}
                          {activities.length > 0 ? (
                            <div className="text-xs space-y-1">
                              <p className="font-semibold text-muted-foreground">Activities / Tasks logged on this day:</p>
                              <ul className="list-disc list-inside text-[#6b5d56] space-y-0.5">
                                {activities.map((act, i) => (
                                  <li key={i}>{act}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p className="text-xs italic text-[#8b6f47]">No specific scans or equipment reports recorded for this day.</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      </div>

      {/* Attendance Biometric Photo Proof Preview Dialog */}
      <Dialog
        open={Boolean(selectedAttendanceProof)}
        onOpenChange={(open) => {
          if (!open) setSelectedAttendanceProof(null);
        }}
      >
        <DialogContent className="max-w-md bg-card text-card-foreground border-border/80 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-heading text-foreground">
              Attendance Photo Proof & Verification
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Mobile GPS and live facial verification snapshots, captured independently at check-in and check-out.
            </DialogDescription>
          </DialogHeader>

          {selectedAttendanceProof && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-muted/40 p-3.5 border border-border/60 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employee:</span>
                  <span className="font-bold text-foreground">{selectedAttendanceProof.workerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-mono font-semibold text-foreground">{selectedAttendanceProof.date}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-emerald-500">Time In · {selectedAttendanceProof.clockIn || '—'}</p>
                <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-accent/40 aspect-4/3 flex items-center justify-center">
                  {selectedAttendanceProof.faceSnapshotBase64 ? (
                    <img
                      src={
                        selectedAttendanceProof.faceSnapshotBase64.startsWith('data:')
                          ? selectedAttendanceProof.faceSnapshotBase64
                          : `data:image/jpeg;base64,${selectedAttendanceProof.faceSnapshotBase64}`
                      }
                      alt="Time In biometric snapshot"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">No snapshot recorded</p>
                  )}
                </div>
                <div className="rounded-xl bg-muted/40 p-3.5 border border-border/60 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-semibold text-foreground text-right">
                      {selectedAttendanceProof.timeInLocationName || 'Field Site'}
                    </span>
                  </div>
                  {selectedAttendanceProof.timeInLatitude != null && selectedAttendanceProof.timeInLongitude != null && (
                    <div className="flex justify-between pt-1 border-t border-border/40">
                      <span className="text-muted-foreground">GPS Coordinates:</span>
                      <a
                        href={`https://www.google.com/maps?q=${selectedAttendanceProof.timeInLatitude},${selectedAttendanceProof.timeInLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-accent hover:underline flex items-center gap-1"
                      >
                        {selectedAttendanceProof.timeInLatitude.toFixed(5)}, {selectedAttendanceProof.timeInLongitude.toFixed(5)} ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {selectedAttendanceProof.clockOut ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-amber-500">Time Out · {selectedAttendanceProof.clockOut}</p>
                  <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-accent/40 aspect-4/3 flex items-center justify-center">
                    {selectedAttendanceProof.timeOutFaceSnapshotBase64 ? (
                      <img
                        src={
                          selectedAttendanceProof.timeOutFaceSnapshotBase64.startsWith('data:')
                            ? selectedAttendanceProof.timeOutFaceSnapshotBase64
                            : `data:image/jpeg;base64,${selectedAttendanceProof.timeOutFaceSnapshotBase64}`
                        }
                        alt="Time Out biometric snapshot"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">No snapshot recorded</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3.5 border border-border/60 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-semibold text-foreground text-right">
                        {selectedAttendanceProof.timeOutLocationName || 'Field Site'}
                      </span>
                    </div>
                    {selectedAttendanceProof.timeOutLatitude != null && selectedAttendanceProof.timeOutLongitude != null && (
                      <div className="flex justify-between pt-1 border-t border-border/40">
                        <span className="text-muted-foreground">GPS Coordinates:</span>
                        <a
                          href={`https://www.google.com/maps?q=${selectedAttendanceProof.timeOutLatitude},${selectedAttendanceProof.timeOutLongitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono font-bold text-accent hover:underline flex items-center gap-1"
                        >
                          {selectedAttendanceProof.timeOutLatitude.toFixed(5)}, {selectedAttendanceProof.timeOutLongitude.toFixed(5)} ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedAttendanceProof(null)}
              className="w-full text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timesheet Audit Trail Dialog for Manager */}
      <Dialog
        open={Boolean(selectedAuditCorrection)}
        onOpenChange={(open) => {
          if (!open) setSelectedAuditCorrection(null);
        }}
      >
        <DialogContent className="max-w-md bg-card text-card-foreground border-border/80 rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-heading text-foreground">
              Timesheet Audit Trail: {selectedAuditCorrection?.correctionId}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Chronological log of submissions, reviews, modifications, and actor timestamps.
            </DialogDescription>
          </DialogHeader>

          {selectedAuditCorrection && (
            <div className="space-y-3 py-2 text-xs max-h-80 overflow-y-auto pr-1">
              <div className="rounded-xl bg-muted/40 p-3 border border-border/60 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="font-bold text-foreground">{selectedAuditCorrection.workerName}</span>
                  <span className="text-muted-foreground font-mono">{selectedAuditCorrection.date}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-muted-foreground">Original: </span>
                    <span className="font-mono font-bold text-foreground">
                      {selectedAuditCorrection.originalClockIn || '--'} / {selectedAuditCorrection.originalClockOut || '--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-amber-600 dark:text-amber-400">Requested: </span>
                    <span className="font-mono font-bold text-foreground">
                      {selectedAuditCorrection.requestedClockIn || '--'} / {selectedAuditCorrection.requestedClockOut || '--'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Audit History</p>
                {selectedAuditCorrection.auditTrail && selectedAuditCorrection.auditTrail.length > 0 ? (
                  selectedAuditCorrection.auditTrail.map((entry, index) => (
                    <div key={index} className="p-3 rounded-xl bg-muted/25 border border-border/60 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                        <span className="font-bold text-foreground">{entry.actorName}</span>
                        <span>{entry.timestamp}</span>
                      </div>
                      <p className="font-semibold text-foreground text-xs">{entry.action}</p>
                      {entry.remarks && (
                        <p className="text-muted-foreground italic">Remarks: "{entry.remarks}"</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-2 text-center">No additional audit entries recorded.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedAuditCorrection(null)}
              className="w-full text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
