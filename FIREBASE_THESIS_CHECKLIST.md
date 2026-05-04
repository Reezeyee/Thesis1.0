# Firebase Thesis Checklist

## 1) Required project files
- Confirm `app/google-services.json` exists.
- Confirm Google services plugin is enabled in:
  - `build.gradle.kts` (project)
  - `app/build.gradle.kts` (app)

## 2) Firestore rules
Use the `firestore.rules` file in this project.

Quick console method:
1. Firebase Console -> Firestore Database -> Rules
2. Paste contents of `firestore.rules`
3. Publish

## 3) What this app syncs now
- Firestore document: `app_state/main`
- Field: `stateJson` (full serialized app state)
- Field: `updatedAt` (timestamp in millis)

## 4) Live read/write demo (one-screen proof)
1. Open Dashboard in the app.
2. Check `Firebase Sync` status card:
   - `Connected` means cloud is active.
   - `Syncing...` appears while writing.
3. Go to any module, add/edit/delete one record.
4. Return to Dashboard and confirm status updates.
5. In Firebase Console -> Firestore -> `app_state/main`, verify `updatedAt` changes.

## 5) Two-device proof (strong for defense)
1. Install app on Device A and Device B (same Firebase project).
2. On Device A, edit a task/record.
3. On Device B, stay on Dashboard and wait a few seconds.
4. Confirm changed data appears automatically and status remains `Connected`.
