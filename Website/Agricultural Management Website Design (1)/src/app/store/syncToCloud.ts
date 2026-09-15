import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  COLLECTIONS,
  ENTITY_SNAPSHOT_DOC_ID,
  MIRROR_COLLECTIONS,
  SHARED_FARM_DOCUMENT_ID,
} from '../firebase/collections';
import {
  emptyAppState,
  normalizeAppState,
  projectSharedFields,
  PRIVATE_FIELD_KEYS,
  type AppState,
  type PrivateFieldKey,
  type WorkerRecord,
} from '../types/appState';
import { mergeStateForCloudUpload } from './mergeFarmState';

const PRIVATE_MIRROR_KEYS: ReadonlySet<string> = new Set(PRIVATE_FIELD_KEYS);

/** Bucket for a private record whose owning worker cannot be determined (legacy data with no
 * owner-uid field and no name match in the current worker list). Keeps the record visible on the
 * admin website instead of silently dropping it, at the cost of it not being writable back to a
 * specific worker's device. */
export const UNASSIGNED_OWNER_ID = '_unassigned';

/**
 * Matches Android [syncFullStateToCloud] — merge with server, then main doc + mirror snapshots.
 *
 * Only writes the SHARED portion of `next` (farm structure) to `app_state/farm`. Private,
 * worker-submitted fields (attendance, leaveRequests, timesheetCorrections, ...) are never
 * written here -- writing them to the shared farm doc would leak one worker's private records
 * to every other worker reading that doc. Those fields are written to each worker's own
 * `app_state/{uid}` doc by [syncPrivateFieldsToCloud] instead.
 *
 * `baseline` should be this browser tab's own state immediately before the edit that produced
 * `next` (i.e. what FarmDataProvider last knew from Firestore) -- it's required for
 * mergeStateForCloudUpload to tell "the admin just deleted this row" apart from "this row was
 * added elsewhere and hasn't reached this tab yet." Omitting it (defaulting to an empty state)
 * falls back to treating every remote-only row as a keeper, which is safe for adds but means
 * deletions of that field silently won't stick -- always pass the real baseline when you have it.
 */
export async function syncToCloud(next: AppState, baseline: AppState = emptyAppState()): Promise<AppState> {
  const now = Date.now();
  const mainRef = doc(db, COLLECTIONS.APP_STATE, SHARED_FARM_DOCUMENT_ID);

  const snap = await getDoc(mainRef);
  let toWrite = normalizeAppState(next);
  if (snap.exists()) {
    const data = snap.data();
    const json = data.stateJson as string | undefined;
    if (json) {
      try {
        const remote = normalizeAppState(JSON.parse(json) as Partial<AppState>);
        toWrite = mergeStateForCloudUpload(toWrite, remote, normalizeAppState(baseline));
      } catch {
        /* keep local write if remote JSON is corrupt */
      }
    }
  }

  const sharedToWrite = projectSharedFields(toWrite);

  await setDoc(
    mainRef,
    {
      stateJson: JSON.stringify(sharedToWrite),
      updatedAt: now,
    },
    { merge: true },
  );

  const batch = writeBatch(db);
  for (const { key, name } of MIRROR_COLLECTIONS) {
    if (PRIVATE_MIRROR_KEYS.has(key)) continue;
    const items = sharedToWrite[key as keyof AppState] as unknown[];
    const mirrorRef = doc(
      db,
      COLLECTIONS.USER_DATA,
      SHARED_FARM_DOCUMENT_ID,
      name,
      ENTITY_SNAPSHOT_DOC_ID,
    );
    batch.set(mirrorRef, {
      itemsJson: JSON.stringify(items),
      itemCount: items.length,
      updatedAt: now,
    });
  }

  await batch.commit();
  // Keep the private fields already present in `toWrite` (merged in-memory from local state) so
  // the caller's optimistic UI update doesn't lose the currently-displayed worker submissions --
  // only the write above was restricted to shared fields.
  return toWrite;
}

function findAuthUidByName(name: string | null | undefined, workers: WorkerRecord[]): string {
  const key = (name ?? '').trim().toLowerCase();
  if (!key) return '';
  const match = workers.find((w) => w.name.trim().toLowerCase() === key);
  return match?.authUid?.trim() ?? '';
}

/**
 * Resolves which worker's `app_state/{uid}` doc a given private record belongs to. Prefers the
 * record's own owner-uid field (stamped by the Android app on submission); falls back to matching
 * the record's free-text worker name against the current worker list for legacy records that
 * predate the owner-uid field.
 */
function ownerUidFor(key: PrivateFieldKey, record: Record<string, unknown>, workers: WorkerRecord[]): string {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  switch (key) {
    case 'attendance':
      return findAuthUidByName(str(record.workerName), workers);
    case 'timesheetCorrections':
      return str(record.submittedByAuthUid) || findAuthUidByName(str(record.workerName), workers);
    case 'leaveRequests':
      return str(record.submittedByAuthUid) || findAuthUidByName(str(record.workerName), workers);
    case 'treeRipenessScans':
      return str(record.scannedByAuthUid);
    case 'cherryGrades':
      return str(record.scannedByAuthUid) || findAuthUidByName(str(record.scannedByWorkerName), workers);
    case 'harvestReadinessReports':
      return (
        str(record.reportedByAuthUid) ||
        findAuthUidByName(str(record.workerName) || str(record.reportedBy), workers)
      );
    case 'irrigationDamageReports':
      return str(record.reportedByAuthUid) || findAuthUidByName(str(record.reportedBy), workers);
    case 'equipmentReports':
      return str(record.reportedByAuthUid) || findAuthUidByName(str(record.reportedBy), workers);
    case 'pestControlLogs':
      return str(record.reportedByAuthUid) || findAuthUidByName(str(record.reportedBy), workers);
    case 'consumableReports':
      return str(record.reportedByAuthUid) || findAuthUidByName(str(record.reportedBy), workers);
    default:
      return '';
  }
}

/**
 * Splits every private, worker-submitted field in `next` (attendance, leaveRequests,
 * timesheetCorrections, ...) by owning worker, returning one full private-only [AppState] per
 * owner uid (see [UNASSIGNED_OWNER_ID] for records whose owner cannot be determined).
 */
export function groupPrivateFieldsByOwner(next: AppState): Record<string, AppState> {
  const groups: Record<string, Record<PrivateFieldKey, unknown[]>> = {};
  const bucketFor = (uid: string): Record<PrivateFieldKey, unknown[]> => {
    const owner = uid || UNASSIGNED_OWNER_ID;
    if (!groups[owner]) {
      groups[owner] = Object.fromEntries(PRIVATE_FIELD_KEYS.map((k) => [k, []])) as unknown as Record<
        PrivateFieldKey,
        unknown[]
      >;
    }
    return groups[owner];
  };

  // Seed every known worker so a field that just went from non-empty to empty for them still
  // gets written (otherwise that worker's doc would keep serving the stale, now-removed record).
  for (const w of next.workers) {
    if (w.authUid?.trim()) bucketFor(w.authUid.trim());
  }

  for (const key of PRIVATE_FIELD_KEYS) {
    const items = (next[key] as unknown as Record<string, unknown>[]) ?? [];
    for (const item of items) {
      const uid = ownerUidFor(key, item, next.workers);
      bucketFor(uid)[key].push(item);
    }
  }

  return Object.fromEntries(
    Object.entries(groups).map(([uid, fields]) => [uid, { ...emptyAppState(), ...fields } as AppState]),
  );
}

/**
 * Splits every private, worker-submitted field in `next` by owning worker and writes each
 * worker's slice to their own `app_state/{uid}` doc -- never the shared `app_state/farm` doc,
 * never another worker's doc.
 *
 * This is what makes admin review/approve/resolve actions (which operate on `next`, the
 * aggregate view combining every worker's private records) actually persist: `syncToCloud` only
 * ever writes the shared portion of `next`, so without this, an edit to e.g.
 * `next.leaveRequests` would appear to save in the UI but vanish on the next Firestore snapshot.
 */
export async function syncPrivateFieldsToCloud(next: AppState): Promise<void> {
  const groups = groupPrivateFieldsByOwner(next);
  const now = Date.now();
  await Promise.all(
    Object.entries(groups).map(([uid, privateState]) =>
      setDoc(
        doc(db, COLLECTIONS.APP_STATE, uid),
        { stateJson: JSON.stringify(privateState), updatedAt: now },
        { merge: true },
      ),
    ),
  );
}
