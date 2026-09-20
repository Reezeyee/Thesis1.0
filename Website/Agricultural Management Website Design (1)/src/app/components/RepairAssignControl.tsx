import { useState } from 'react';
import { HardHat, PackageMinus } from 'lucide-react';
import type { WorkerRecord } from '../types/appState';
import { maintenanceAssignees, repairJobId, repairStatusText, type Assignee, type RepairJobRecord, type RepairKind } from '../lib/repairJobs';
import { markPartsDeducted, removeRepairJob, saveRepairJob } from '../store/useRepairJobs';
import { useFarmData } from '../store/FarmDataProvider';
import { deductPartsFromSupplies, findSupplyForPart, partsSummary } from '../lib/repairParts';

/**
 * The parts the Maintenance worker used (e.g. 4 screws). Shows which supply each one comes out of, and one button
 * takes them all out of the consumable supplies -- once: the job is stamped so it can't be deducted again.
 */
function RepairPartsPanel({ jobId, job }: { jobId: string; job: RepairJobRecord }) {
  const { state, updateState } = useFarmData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parts = job.partsUsed ?? [];
  if (job.status !== 'fixed' || parts.length === 0) return null;

  if (job.partsDeductedAt) {
    return (
      <div className="space-y-0.5" data-testid={`parts-done-${jobId}`}>
        <p className="text-xs text-muted-foreground">
          <PackageMinus className="inline w-3.5 h-3.5 mr-1" />
          Parts used: {partsSummary(parts)} — taken out of the supplies.
        </p>
        {message && message !== 'Taken out of the supplies.' ? <p className="text-[11px] text-amber-600 dark:text-amber-400">{message}</p> : null}
      </div>
    );
  }

  const deduct = async () => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      let result: ReturnType<typeof deductPartsFromSupplies> | null = null;
      await updateState((prev) => {
        result = deductPartsFromSupplies(prev.consumableSupplies, parts);
        return { ...prev, consumableSupplies: result.supplies };
      });
      // Only after the stock is saved: stamp the job so the same parts are never taken out twice.
      await markPartsDeducted(jobId);
      const r = result as ReturnType<typeof deductPartsFromSupplies> | null;
      const notes: string[] = [];
      if (r?.unmatched.length) notes.push(`Not in your supplies (nothing deducted): ${partsSummary(r.unmatched)}. Add them under Consumable Supplies.`);
      const short = r?.lines.filter((l) => l.shortBy > 0) ?? [];
      if (short.length) notes.push(`Not enough stock for: ${short.map((l) => `${l.part.name} (short by ${l.shortBy})`).join(', ')}.`);
      setMessage(notes.length ? notes.join(' ') : 'Taken out of the supplies.');
    } catch {
      setError('Could not update the supplies. Check the Consumable Supplies list before trying again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-border/70 bg-muted/30 p-2 space-y-1.5" data-testid={`parts-${jobId}`}>
      <p className="text-[11px] font-semibold flex items-center gap-1">
        <PackageMinus className="w-3.5 h-3.5" /> Parts used by {job.assignedToName}
      </p>
      <ul className="text-xs space-y-0.5">
        {parts.map((p, i) => {
          const supply = findSupplyForPart(state.consumableSupplies, p.name);
          return (
            <li key={`${p.name}-${i}`}>
              {p.quantity} × {p.name}
              <span className="text-muted-foreground">
                {supply ? ` → ${supply.name} (${supply.stock} ${supply.unit} in stock)` : ' → not in supplies yet'}
              </span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={busy}
        onClick={() => void deduct()}
        className="h-7 rounded-md bg-[#2d5016] px-2.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {busy ? 'Deducting…' : 'Deduct from supplies'}
      </button>
      {error ? <p className="text-[11px] text-rose-500">{error}</p> : null}
      {message ? <p className="text-[11px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}

/**
 * Sends a report to one Maintenance worker (or takes it back), and shows how the repair is going. The worker
 * sees the job in the Android app; when they mark it fixed, the admin gets a notification and the status text
 * here says so.
 */
export function RepairAssignControl({
  kind,
  reportId,
  workers,
  job,
  closed,
  buildJob,
}: {
  kind: RepairKind;
  reportId: string | undefined;
  workers: WorkerRecord[];
  job: RepairJobRecord | undefined;
  /** The report is already resolved: only the history is shown. */
  closed: boolean;
  buildJob: (to: Assignee) => RepairJobRecord;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const assignees = maintenanceAssignees(workers);

  if (!reportId) return null; // very old reports have no id to attach a job to
  const jobId = repairJobId(kind, reportId);

  const change = async (uid: string) => {
    setError(null);
    setBusy(true);
    try {
      if (!uid) {
        await removeRepairJob(jobId);
      } else {
        const to = assignees.find((a) => a.uid === uid);
        if (to) await saveRepairJob(jobId, buildJob(to));
      }
    } catch {
      setError('Could not update the assignment. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (closed) {
    return job?.fixNote ? (
      <div className="mt-2 space-y-1.5">
        <p className="text-xs text-muted-foreground">
          <HardHat className="inline w-3.5 h-3.5 mr-1" />
          Repaired by {job.assignedToName}: {job.fixNote}
        </p>
        <RepairPartsPanel jobId={jobId} job={job} />
      </div>
    ) : null;
  }

  return (
    <div className="mt-2 space-y-1" data-testid={`repair-control-${jobId}`}>
      <label htmlFor={`assign-${jobId}`} className="text-[11px] font-semibold flex items-center gap-1">
        <HardHat className="w-3.5 h-3.5" /> Send to Maintenance
      </label>
      <select
        id={`assign-${jobId}`}
        value={job?.assignedToUid ?? ''}
        disabled={busy || job?.status === 'fixed'}
        onChange={(e) => void change(e.target.value)}
        className="flex h-8 w-full rounded-md border border-border/80 bg-background/80 px-2 text-xs"
      >
        <option value="">{assignees.length === 0 && !job ? 'No Maintenance workers yet' : job ? 'Take back (unassign)' : 'Assign to…'}</option>
        {assignees.map((a) => (
          <option key={a.uid} value={a.uid}>{a.name}</option>
        ))}
        {job && !assignees.some((a) => a.uid === job.assignedToUid) ? <option value={job.assignedToUid}>{job.assignedToName}</option> : null}
      </select>
      {assignees.length === 0 && !job ? (
        <p className="text-[11px] text-muted-foreground">Add a worker with the role "Maintenance" (with an app login) to assign repairs.</p>
      ) : null}
      {job ? (
        <p className={`text-xs font-semibold ${job.status === 'fixed' ? 'text-emerald-600 dark:text-emerald-400' : job.status === 'in_progress' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
          {repairStatusText(job)}
          {job.status === 'fixed' && job.fixNote ? <span className="block font-normal text-foreground/80">“{job.fixNote}”</span> : null}
        </p>
      ) : null}
      {job ? <RepairPartsPanel jobId={jobId} job={job} /> : null}
      {error ? <p className="text-[11px] text-rose-500">{error}</p> : null}
    </div>
  );
}
