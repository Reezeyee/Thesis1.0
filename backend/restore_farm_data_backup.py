"""
Restores a backup JSON file created by wipe_farm_data.py back into Firebase.

Run from your own Mac Terminal, from the project root:

    cd ~/Thesis1.0
    python3 backend/restore_farm_data_backup.py
    # or, to pick a specific backup file instead of the newest one:
    python3 backend/restore_farm_data_backup.py backend/farm_data_backups/app_state_farm_backup_20260101_120000.json

This overwrites app_state/farm and its user_data mirror snapshots with whatever
is in the backup file -- including its "workers" list, so if workers changed
since the backup was made, restoring will roll those back too.
"""

import json
import sys
import time
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

_BACKEND_DIR = Path(__file__).resolve().parent
SA_PATH = _BACKEND_DIR / "serviceAccountKey.json"
BACKUP_DIR = _BACKEND_DIR / "farm_data_backups"

if not SA_PATH.exists():
    print(f"ERROR: could not find {SA_PATH}")
    sys.exit(1)

if len(sys.argv) > 1:
    backup_path = Path(sys.argv[1])
else:
    if not BACKUP_DIR.exists():
        print(f"ERROR: no backups found -- {BACKUP_DIR} does not exist.")
        sys.exit(1)
    candidates = sorted(BACKUP_DIR.glob("app_state_farm_backup_*.json"))
    if not candidates:
        print(f"ERROR: no backup files found in {BACKUP_DIR}")
        sys.exit(1)
    backup_path = candidates[-1]
    print(f"No backup file given -- using the most recent one: {backup_path}")

if not backup_path.exists():
    print(f"ERROR: backup file not found: {backup_path}")
    sys.exit(1)

with open(backup_path, "r", encoding="utf-8") as f:
    restored_state = json.load(f)

# Per-worker private docs (app_state/<authUid>) were backed up separately under "_privateDocs" by
# wipe_farm_data.py -- pull them out before printing/restoring the shared fields so this key
# (a dict of dicts, not a record list) doesn't get treated as a record list below.
private_docs_restore = restored_state.pop("_privateDocs", {})

print("=== Record counts in this backup ===")
for key, items in restored_state.items():
    if isinstance(items, list) and len(items) > 0:
        print(f"  {key}: {len(items)}")
if private_docs_restore:
    print(f"  _privateDocs: {len(private_docs_restore)} worker private doc(s)")

confirm = input(
    f"\nThis will REPLACE whatever is currently in Firebase with the contents of\n{backup_path}\n"
    "Type RESTORE to continue: "
)
if confirm.strip() != "RESTORE":
    print("Aborted -- nothing was changed.")
    sys.exit(0)

cred = credentials.Certificate(str(SA_PATH))
firebase_admin.initialize_app(cred)
db = firestore.client()

# Same mirror mapping as wipe_farm_data.py / the website's collections.ts.
MIRROR_COLLECTIONS = [
    ("workers", "workers"),
    ("attendance", "attendance"),
    ("timesheetCorrections", "timesheet_corrections"),
    ("leaveRequests", "leave_requests"),
    ("tasks", "tasks"),
    ("sections", "farm_sections"),
    ("trees", "trees"),
    ("treeRipenessScans", "tree_ripeness_scans"),
    ("harvestSchedules", "harvest_schedules"),
    ("harvestReadinessReports", "harvest_readiness_reports"),
    ("flowering", "flowering"),
    ("cherryHarvests", "harvest_records"),
    ("batches", "batches"),
    ("cherryGrades", "cnn_classifications"),
    ("equipment", "equipment"),
    ("usageLogs", "equipment_usage"),
    ("maintenanceLogs", "maintenance_logs"),
    ("equipmentReports", "equipment_reports"),
    ("sales", "sales"),
    ("expenses", "expenses"),
    ("payroll", "payroll"),
    ("coffeeFields", "coffee_fields"),
    ("irrigationSystems", "irrigation_systems"),
    ("irrigationDamageReports", "irrigation_damage_reports"),
    ("pestControlLogs", "pest_control_logs"),
    ("consumableSupplies", "consumable_supplies"),
    ("consumableReports", "consumable_reports"),
    ("smsMessages", "sms_messages"),
]

now_millis = int(time.time() * 1000)

main_ref = db.collection("app_state").document("farm")
# `hardReset` tells an already-open website tab this is a deliberate overwrite, not an
# ordinary sync -- see the matching comment in wipe_farm_data.py.
main_ref.set({
    "stateJson": json.dumps(restored_state),
    "updatedAt": now_millis,
    "hardReset": now_millis,
}, merge=True)
print("\nOK: app_state/farm restored.")

mirror_written = 0
for key, name in MIRROR_COLLECTIONS:
    items = restored_state.get(key) or []
    mirror_ref = (
        db.collection("user_data")
        .document("farm")
        .collection(name)
        .document("latest")
    )
    mirror_ref.set({
        "itemsJson": json.dumps(items),
        "itemCount": len(items),
        "updatedAt": now_millis,
    })
    mirror_written += 1

print(f"OK: restored {mirror_written} mirror snapshot documents under user_data/farm/*/latest.")

# Restore each worker's private per-account doc (app_state/<authUid>) from the backup, if present
# -- older backups (made before the per-worker Firestore isolation feature existed) won't have
# "_privateDocs", so there's nothing extra to restore for those and this loop just does nothing.
private_restored = 0
for uid, private_state in private_docs_restore.items():
    db.collection("app_state").document(uid).set({
        "stateJson": json.dumps(private_state),
        "updatedAt": now_millis,
        "hardReset": now_millis,
    }, merge=True)
    private_restored += 1

if private_restored:
    print(f"OK: restored {private_restored} worker private doc(s) (app_state/<authUid>).")
print("Done. Refresh the website / reopen the app to see the restored data.")
