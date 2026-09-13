# Coffee Farm Management (Android)

Firebase-first Android dashboard project for Coffee Farm Management.

## Included

- Kotlin + Jetpack Compose admin interface
- Sidebar (drawer) module navigation
- Homepage dashboard with:
  - Workers, Trees, Harvest Today, Profit cards
  - Recent activity feed
  - Quick actions
  - Farm status snapshot
- Module screens:
  - Farm Operations Management
  - Coffee Cherry Management (CNN workflow UI placeholder)
  - Equipment Management
  - Profit Management
- Firebase-ready structure:
  - Auth
  - Firestore
  - Storage

## Firebase setup

1. Create a Firebase project.
2. Add Android app with package:
   - `com.melodypenero.coffeefarm`
3. **Fix `Configuration_not_found` on sign-in** — Firebase must know your app’s signing key, then you **re-download** `google-services.json` (it should include non-empty `oauth_client` entries after this):
   - Open [Firebase Console](https://console.firebase.google.com/) → your project → **Project settings** (gear) → **Your apps** → select the Android app `com.melodypenero.coffeefarm`.
   - Under **App fingerprints**, add **SHA-1** and **SHA-256** (copy from `scripts/FIREBASE_FINGERPRINTS.txt`, or run `bash scripts/print-debug-sha.sh` on the machine you build with).
     - This repo’s last captured **debug** prints: **SHA-1** `10:13:4E:65:87:FE:49:9E:DD:F2:7C:DD:9A:BD:F5:35:66:10:8F:7C` — **SHA-256** `29:29:5A:DB:F5:F1:B1:A3:8B:B3:1B:5B:0B:EB:4F:AD:2F:6E:5F:C4:67:E0:8C:7C:16:4F:69:18:12:90:B7:76`
   - Click **Save**, then use **Download google-services.json** on the same page and replace:
     - `app/google-services.json`
   - **Build → Clean Project**, then run the app again.
4. If you use a **release** keystore, add its SHA-1/SHA-256 the same way (get them with `keytool -list -v` on that keystore).
5. Enable **Authentication** → **Sign-in method** → **Email/Password** (turn it **on** and **Save**). If you skip this, login fails with *operation not allowed / provider disabled*.

6. Enable **Firestore** and **Storage** in the Firebase console as needed.

If sign-in still shows **Configuration_not_found**, your `google-services.json` likely has empty `oauth_client`. Follow **`scripts/CONFIG_NOT_FOUND_FIX.txt`** (enable Google sign-in and re-download, or copy **`scripts/firebase_secrets.xml.example`** to `app/src/main/res/values/firebase_secrets.xml` with your Web client id from Google Cloud).

## Training images (CNN)

The folder `Cnn Training/Data/` is **not** in Git (several GB of photos). After cloning, add your dataset locally and optionally link it:

`ln -s "../Data" "Cnn Training/ImageClassification/data"`

Training scripts live under `Cnn Training/ImageClassification/`.

## Ripeness classification model (Roboflow)

Coffee cherry ripeness is classified by a Roboflow-hosted object detection model — there is no on-device fallback for ripeness (see `RoboflowApiClient.kt`).

- **Workspace:** `fates-workspace`
- **Project:** `coffee-tmlrm-1fnkh`
- **Version:** `3` (architecture: YOLOv26n)
- **Classes:** `Unripe`, `Ripening`, `Ripe`, `Overripe`, `Dry_Damaged`
- **Accuracy (mAP / precision / recall):** TODO — copy from the version page at `https://app.roboflow.com/fates-workspace/coffee-tmlrm-1fnkh` and fill in here for the thesis writeup.

Config lives in `app/src/main/java/com/melodypenero/coffeefarm/ml/RoboflowApiClient.kt`. To point the app at a newer trained version, update `MODEL_ID` and `VERSION` there.

## Notes

- This MVP uses demo repository data to render the dashboard quickly.
- Replace demo repository calls with Firestore-backed repositories next.
- CNN screen currently has UI + simulated prediction output.
