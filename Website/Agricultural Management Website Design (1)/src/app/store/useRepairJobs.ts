import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import type { RepairJobRecord } from '../lib/repairJobs';
import { cleanPartsUsed } from '../lib/repairParts';

/** Admin only: every repair job, live, keyed by job id (firestore.rules lets only the admin list them). */
export function useRepairJobs(): Record<string, RepairJobRecord> {
  const [jobs, setJobs] = useState<Record<string, RepairJobRecord>>({});
  useEffect(
    () =>
      onSnapshot(
        collection(db, COLLECTIONS.REPAIR_JOBS),
        (snap) => setJobs(Object.fromEntries(snap.docs.map((d) => [d.id, { ...(d.data() as RepairJobRecord), partsUsed: cleanPartsUsed(d.data().partsUsed) }]))),
        () => setJobs({}),
      ),
    [],
  );
  return jobs;
}

export const saveRepairJob = (id: string, job: RepairJobRecord) => setDoc(doc(db, COLLECTIONS.REPAIR_JOBS, id), job);
export const removeRepairJob = (id: string) => deleteDoc(doc(db, COLLECTIONS.REPAIR_JOBS, id));

/** Admin only: remember that the job's parts were taken out of the supplies (never deduct the same job twice). */
export const markPartsDeducted = (id: string) => updateDoc(doc(db, COLLECTIONS.REPAIR_JOBS, id), { partsDeductedAt: new Date().toISOString() });
