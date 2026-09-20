import type { EquipmentConditionReport, IrrigationDamageReportRecord, WorkerRecord } from '../types/appState';
import { isMaintenanceRole } from './farmFinance';
import { isWorkerActive } from './workerUi';
import type { PartUsed } from './repairParts';

/**
 * A repair job: the admin sends a broken-equipment or sprinkler-damage report to ONE Maintenance worker.
 * Workers' reports live in each worker's private document, which other workers can't read, so the job
 * carries a copy of what Maintenance needs to see (see the `repair_jobs` rules in firestore.rules).
 * Kinds are open-ended: adding another report type later only needs another builder here.
 */
export type RepairKind = 'equipment' | 'sprinkler';
export type RepairStatus = 'assigned' | 'in_progress' | 'fixed';

export interface RepairJobRecord {
  kind: RepairKind;
  reportId: string;
  /** What Maintenance sees: the equipment name or the sprinkler label, plus a short context line. */
  title: string;
  subtitle: string;
  details: string;
  reportedBy: string;
  reportedAt: string;
  assignedToUid: string;
  assignedToName: string;
  assignedToWorkerId?: string;
  assignedAt: string;
  status: RepairStatus;
  /** Written by the Maintenance worker's app. */
  startedAt?: string | null;
  fixedAt?: string | null;
  /** What was done, required when marking the job fixed. */
  fixNote?: string | null;
  /** Parts / materials the worker used (written with fixNote); the admin deducts them from the supplies. */
  partsUsed?: PartUsed[] | null;
  /** Set by the admin once partsUsed were taken out of the supplies, so it can only happen once. */
  partsDeductedAt?: string | null;
}

export interface Assignee {
  uid: string;
  name: string;
  workerId: string;
}

export const repairJobId = (kind: RepairKind, reportId: string) => `${kind}-${reportId}`;

/** Active Maintenance workers who can actually sign in to the app (a job is matched to them by login uid). */
export function maintenanceAssignees(workers: WorkerRecord[]): Assignee[] {
  return workers
    .filter((w) => isMaintenanceRole(w.roleRate) && isWorkerActive(w) && Boolean(w.authUid?.trim()))
    .map((w) => ({ uid: w.authUid!.trim(), name: w.name, workerId: w.workerId?.trim() ?? '' }));
}

export function equipmentRepairJob(report: EquipmentConditionReport, to: Assignee, now = new Date().toISOString()): RepairJobRecord {
  return {
    kind: 'equipment',
    reportId: report.reportId,
    title: report.equipmentName || 'Equipment',
    subtitle: report.isWrecked ? 'Broken / wrecked' : 'Needs maintenance',
    details: report.notes?.trim() || 'No details were given.',
    reportedBy: report.reportedBy?.trim() || 'Worker',
    reportedAt: report.reportedAt,
    assignedToUid: to.uid,
    assignedToName: to.name,
    assignedToWorkerId: to.workerId,
    assignedAt: now,
    status: 'assigned',
    startedAt: null,
    fixedAt: null,
    fixNote: null,
  };
}

export function sprinklerRepairJob(report: IrrigationDamageReportRecord, to: Assignee, now = new Date().toISOString()): RepairJobRecord {
  const label = report.sprinklerLabel?.trim() || report.zone?.trim() || 'Sprinkler';
  return {
    kind: 'sprinkler',
    reportId: report.reportId ?? '',
    title: label,
    subtitle: report.zone?.trim() && report.zone.trim() !== label ? `Zone: ${report.zone.trim()}` : 'Sprinkler damage',
    details: report.details?.trim() || 'No details were given.',
    reportedBy: report.reportedBy?.trim() || 'Worker',
    reportedAt: report.reportedAt,
    assignedToUid: to.uid,
    assignedToName: to.name,
    assignedToWorkerId: to.workerId,
    assignedAt: now,
    status: 'assigned',
    startedAt: null,
    fixedAt: null,
    fixNote: null,
  };
}

/** One line for the admin's report card. */
export function repairStatusText(job: Pick<RepairJobRecord, 'status' | 'assignedToName'>): string {
  switch (job.status) {
    case 'in_progress':
      return `${job.assignedToName} is repairing it now`;
    case 'fixed':
      return `Fixed by ${job.assignedToName} -- please confirm`;
    default:
      return `Assigned to ${job.assignedToName} -- waiting to start`;
  }
}

/** A "fixed" job the admin still has to confirm (the underlying report isn't closed yet) triggers a notification. */
export function repairAwaitsAdmin(
  job: Pick<RepairJobRecord, 'status' | 'kind' | 'reportId'>,
  reports: { equipment: EquipmentConditionReport[]; sprinkler: IrrigationDamageReportRecord[] },
): boolean {
  if (job.status !== 'fixed') return false;
  if (job.kind === 'equipment') {
    const r = reports.equipment.find((x) => x.reportId === job.reportId);
    return Boolean(r) && !(r!.reviewed || r!.fixedAt);
  }
  const r = reports.sprinkler.find((x) => x.reportId === job.reportId);
  return Boolean(r) && (r!.status ?? 'Pending').trim().toLowerCase() !== 'resolved';
}
