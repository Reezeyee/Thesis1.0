import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  COLLECTIONS,
  ENTITY_SNAPSHOT_DOC_ID,
  MIRROR_COLLECTIONS,
  SHARED_FARM_DOCUMENT_ID,
} from '../firebase/collections';
import { normalizeAppState, type AppState } from '../types/appState';
import { mergeStateForCloudUpload } from './mergeFarmState';

/** Matches Android [syncFullStateToCloud] — merge with server, then main doc + mirror snapshots. */
export async function syncToCloud(next: AppState): Promise<AppState> {
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
        toWrite = mergeStateForCloudUpload(toWrite, remote);
      } catch {
        /* keep local write if remote JSON is corrupt */
      }
    }
  }

  await setDoc(
    mainRef,
    {
      stateJson: JSON.stringify(toWrite),
      updatedAt: now,
    },
    { merge: true },
  );

  const batch = writeBatch(db);
  for (const { key, name } of MIRROR_COLLECTIONS) {
    const items = toWrite[key as keyof AppState] as unknown[];
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
  return toWrite;
}
