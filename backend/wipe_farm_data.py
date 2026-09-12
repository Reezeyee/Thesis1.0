"""
One-time admin script: clears all farm data (sales, expenses, payroll history,
equipment, maintenance logs, coffee fields, trees, harvest records, attendance,
SMS messages, etc.) while leaving worker accounts completely untouched.

Run this from your own Mac Terminal (NOT inside any sandboxed shell), from the
project root:

    cd ~/Thesis1.0
    python3 backend/wipe_farm_data.py

It uses backend/serviceAccountKey.json (already set up for the password-reset
feature) to talk to Firebase directly with admin privileges, bypassing the
website entirely. Before touching anything, it saves a full backup of the
current data to backend/farm_data_backups/ -- if you ever need the old data
back, that JSON file has everything (see restore_farm_data_backup.py).
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

_BACKEND_DIR = Path(__file__).resolve().parent
SA_PATH = _BACKEND_DIR / "serviceAccountKey.json"

if not SA_PATH.exists():
    print(f"ERROR: could not find {SA_PATH}")
    print("Make sure you're running this from the project, and that")
    print("backend/serviceAccountKey.json exists (same file used for password resets).")
    sys.exit(1)

cred = credentials.Certificate(str(SA_PATH))
firebase_admin.initialize_app(cred)
db = firestore.client()

# Mirrors website's src/app/firebase/collections.ts MIRROR_COLLECTIONS exactly.
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

EMPTY_KEYS = [k for k, _ in MIRROR_COLLECTIONS]

main_ref = db.collection("app_state").document("farm")
snap = main_ref.get()

if not snap.exists:
    print("ERROR: app_state/farm document does not exist -- nothing to wipe.")
    sys.exit(1)

data = snap.to_dict()
raw_json = data.get("stateJson")
if not raw_json:
    print("ERROR: app_state/farm has no stateJson field -- nothing to wipe.")
    sys.exit(1)

current = json.loads(raw_json)

print("=== Current record counts (before wipe) ===")
before_counts = {}
for key in EMPTY_KEYS:
    items = current.get(key) or []
    before_counts[key] = len(items) if isinstance(items, list) else 0
    if before_counts[key] > 0:
        print(f"  {key}: {before_counts[key]}")

worker_count = before_counts.get("workers", 0)

# Always back up the full current state before changing anything, so this is recoverable
# even though the wipe itself is irreversible in Firestore.
backup_dir = _BACKEND_DIR / "farm_data_backups"
backup_dir.mkdir(exist_ok=True)
backup_timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
backup_path = backup_dir / f"app_state_farm_backup_{backup_timestamp}.json"
with open(backup_path, "w", encoding="utf-8") as f:
    json.dump(current, f, indent=2)
print(f"\nBacked up current data to {backup_path}")
print("(keep this file if you might want the old data back later)")

confirm = input(
    f"\nThis will PERMANENTLY erase all the counts above except '{worker_count}' worker "
    "account(s), which will be kept, from Firebase. A local backup was just saved above.\n"
    "Type WIPE to continue: "
)
if confirm.strip() != "WIPE":
    print("Aborted -- nothing was changed in Firebase (the backup file above is still there).")
    sys.exit(0)

# Build the wiped state: every field empty except workers.
new_state = {key: [] for key in EMPTY_KEYS}
new_state["workers"] = current.get("workers", [])

now_millis = int(time.time() * 1000)

# 1. Overwrite the main shared doc (this is the one both the website and the Android app
#    treat as the single source of truth -- see FarmDataProvider.tsx / syncToCloud.ts).
main_ref.set({
    "stateJson": json.dumps(new_state),
    "updatedAt": now_millis,
}, merge=True)
print("\nOK: app_state/farm rewritten with all data cleared (workers kept).")

# 2. Overwrite each mirror snapshot doc (user_data/farm/<name>/latest) to match, except workers'.
mirror_written = 0
for key, name in MIRROR_COLLECTIONS:
    if key == "workers":
        continue
    mirror_ref = (
        db.collection("user_data")
        .document("farm")
        .collection(name)
        .document("latest")
    )
    mirror_ref.set({
        "itemsJson": "[]",
        "itemCount": 0,
        "updatedAt": now_millis,
    })
    mirror_written += 1

print(f"OK: cleared {mirror_written} mirror snapshot documents under user_data/farm/*/latest.")
print(f"\nKept {worker_count} worker account(s) untouched.")
print("Done. Refresh the website / reopen the app to see the clean slate.")
