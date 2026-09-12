package com.melodypenero.coffeefarm.auth

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.melodypenero.coffeefarm.data.firebase.FirebaseCollections
import kotlinx.coroutines.tasks.await

enum class UserRole {
    ADMINISTRATOR,
    FARM_STAFF
}

data class AuthSession(
    val userId: String,
    val email: String,
    val displayName: String,
    val role: UserRole,
    val mustChangePassword: Boolean = false
)

data class PasswordResetRequestResult(
    val requestId: String,
    val email: String,
    val adminNotified: Boolean
)

object AuthManager {
    private const val AuthPrefs = "coffee_farm_auth"
    private const val SessionUserIdKey = "session_user_id"
    private const val SessionEmailKey = "session_email"
    private const val SessionDisplayNameKey = "session_display_name"
    private const val SessionRoleKey = "session_role"
    private const val SessionMustChangePassKey = "session_must_change_pass"

    private const val AdminEmail = "farmacojido@gmail.com"
    private const val AdminPassword = "Farm012345"
    /** Legacy demo staff (local-style email). */
    private const val StaffEmail = "acojidostaff@coffeefarm.local"
    private const val StaffPassword = "acojid012345"
    /** Field worker account (Gmail): same app as admin; role is always [UserRole.FARM_STAFF]. */
    private const val WorkerStaffEmail = "workerstaffacojido@gmail.com"
    private const val WorkerStaffPassword = "Parm012345"
    private const val AdminDisplayName = "AcojidoAdmin"
    private const val StaffDisplayName = "AcojidoStaff"
    private const val WorkerDisplayName = "Worker"

    /**
     * Maps the username field to the Firebase **email** used for [FirebaseAuth].
     * Admin: `admin` / full admin Gmail. Worker: `worker` / worker Gmail. Legacy: AcojidoStaff email.
     */
    fun usernameToEmail(username: String): String? {
        val t = username.trim()
        if (t.contains("@")) {
            val e = t.trim().lowercase()
            return when (e) {
                AdminEmail.lowercase() -> AdminEmail
                StaffEmail.lowercase() -> StaffEmail
                WorkerStaffEmail.lowercase() -> WorkerStaffEmail
                // Any other email: sign in with whatever exists in Firebase (workers added in console).
                else -> e
            }
        }
        val key = t.lowercase()
        return when {
            key == "acojidoadmin" || key == "admin" -> AdminEmail
            key == "acojidostaff" || key == "staff" -> StaffEmail
            key == "worker" || key == "workerstaff" -> WorkerStaffEmail
            else -> null
        }
    }

    private fun roleForEmail(email: String): UserRole = when (email.lowercase()) {
        AdminEmail.lowercase() -> UserRole.ADMINISTRATOR
        else -> UserRole.FARM_STAFF
    }

    /**
     * Known login emails always get a fixed role so a mis-set Firestore `role` cannot grant
     * Sales/Operations to the field worker account.
     */
    private fun roleForKnownEmailOrElse(email: String, fromFirestore: UserRole?, inferred: UserRole): UserRole =
        when (email.trim().lowercase()) {
            AdminEmail.lowercase() -> UserRole.ADMINISTRATOR
            StaffEmail.lowercase(),
            WorkerStaffEmail.lowercase() -> UserRole.FARM_STAFF
            else -> fromFirestore ?: inferred
        }

    private fun displayNameForEmail(email: String): String = when (email.lowercase()) {
        AdminEmail.lowercase() -> AdminDisplayName
        StaffEmail.lowercase() -> StaffDisplayName
        WorkerStaffEmail.lowercase() -> WorkerDisplayName
        else -> run {
            val local = email.substringBefore("@", email).ifBlank { "User" }
            local.replaceFirstChar { c -> c.titlecase() }
        }
    }

    private fun isBootstrapAccount(email: String, password: String): Boolean = when (email.lowercase()) {
        AdminEmail.lowercase() -> password == AdminPassword
        StaffEmail.lowercase() -> password == StaffPassword
        WorkerStaffEmail.lowercase() -> password == WorkerStaffPassword
        else -> false
    }

    /** Remove cached role prefs when Firebase has no signed-in user (stale after reinstall). */
    fun clearStaleSessionIfSignedOut(context: Context) {
        if (FirebaseApp.getApps(context).isEmpty()) return
        if (FirebaseAuth.getInstance().currentUser != null) return
        if (loadSession(context) == null) return
        context.getSharedPreferences(AuthPrefs, Context.MODE_PRIVATE).edit().clear().apply()
    }

    /**
     * Restores a session if Firebase Auth has a current user. Uses cached prefs when uid matches;
     * otherwise loads role from Firestore profile.
     */
    suspend fun refreshSessionFromFirebase(context: Context): AuthSession? {
        if (FirebaseApp.getApps(context).isEmpty()) return null
        val user = FirebaseAuth.getInstance().currentUser ?: return null
        return buildSessionForUid(context, user.uid, user.email.orEmpty(), loadRoleFromCache(context, user.uid))
    }

    private fun loadRoleFromCache(context: Context, uid: String): UserRole? {
        val p = context.getSharedPreferences(AuthPrefs, Context.MODE_PRIVATE)
        if (p.getString(SessionUserIdKey, null) != uid) return null
        val r = p.getString(SessionRoleKey, null) ?: return null
        return runCatching { UserRole.valueOf(r) }.getOrNull()
    }

    /**
     * Resolves the email address dynamically from Firestore or username formatting.
     * Supports typing: full email, username, workerId, or predefined shortcuts.
     */
    suspend fun resolveEmail(username: String): String? {
        val t = username.trim()
        if (t.isEmpty()) return null
        if (t.contains("@")) return t.lowercase()

        val staticEmail = usernameToEmail(t)
        if (staticEmail != null) return staticEmail

        return runCatching {
            val db = FirebaseFirestore.getInstance()
            // 1. Try finding by workerId
            val snapById = db.collection(FirebaseCollections.USERS)
                .whereEqualTo("workerId", t)
                .limit(1)
                .get()
                .await()
            val emailById = snapById.documents.firstOrNull()?.getString("email")
            if (!emailById.isNullOrBlank()) return@runCatching emailById

            // 2. Try finding by displayName
            val snapByName = db.collection(FirebaseCollections.USERS)
                .whereEqualTo("displayName", t)
                .limit(1)
                .get()
                .await()
            val emailByName = snapByName.documents.firstOrNull()?.getString("email")
            if (!emailByName.isNullOrBlank()) return@runCatching emailByName

            null
        }.getOrNull()
    }

    private suspend fun buildSessionForUid(
        context: Context,
        uid: String,
        email: String,
        cachedRole: UserRole?
    ): AuthSession? {
        val p = context.getSharedPreferences(AuthPrefs, Context.MODE_PRIVATE)
        val fromPrefsEmail = p.getString(SessionEmailKey, null).orEmpty()
        val fromPrefsName = p.getString(SessionDisplayNameKey, null).orEmpty()
        val emailForRole = if (fromPrefsEmail.isNotBlank()) fromPrefsEmail else email

        val userDoc = runCatching {
            FirebaseFirestore.getInstance()
                .collection(FirebaseCollections.USERS)
                .document(uid)
                .get()
                .await()
        }.getOrNull()

        val firestoreRole = userDoc?.getString("role")?.let { r ->
            runCatching { UserRole.valueOf(r) }.getOrNull()
        }
        val firestoreName = userDoc?.getString("displayName")

        val inferred = inferRoleFromEmail(emailForRole)
        val role = roleForKnownEmailOrElse(emailForRole, firestoreRole ?: cachedRole, inferred)
        val display = when {
            !firestoreName.isNullOrBlank() -> firestoreName
            fromPrefsName.isNotBlank() -> fromPrefsName
            else -> displayNameForEmail(emailForRole)
        }
        val mustChange = checkMustChangePassword(uid)
        val session = AuthSession(
            userId = uid,
            email = if (fromPrefsEmail.isNotBlank()) fromPrefsEmail else email,
            displayName = display,
            role = role,
            mustChangePassword = mustChange
        )
        saveSession(context, session)
        return session
    }

    private suspend fun loadUserRoleFromFirestore(context: Context, uid: String): UserRole? {
        if (FirebaseApp.getApps(context).isEmpty()) return null
        return runCatching {
            val snap = FirebaseFirestore.getInstance()
                .collection(FirebaseCollections.USERS)
                .document(uid)
                .get()
                .await()
            val name = snap.getString("role") ?: return@runCatching null
            UserRole.valueOf(name)
        }.getOrNull()
    }

    suspend fun checkMustChangePassword(uid: String): Boolean {
        return runCatching {
            val snap = FirebaseFirestore.getInstance()
                .collection(FirebaseCollections.USERS)
                .document(uid)
                .get()
                .await()
            snap.getBoolean("mustChangePassword") == true || snap.getBoolean("isTemporaryPassword") == true
        }.getOrDefault(false)
    }

    private fun inferRoleFromEmail(email: String): UserRole = roleForEmail(email)

    /**
     * Email/password sign-in. Dynamically resolves worker emails from Firestore and updates profile.
     */
    suspend fun signInWithEmailPassword(context: Context, username: String, password: String): Result<AuthSession> {
        if (FirebaseApp.getApps(context).isEmpty()) {
            return Result.failure(IllegalStateException("Firebase is not configured (add google-services.json)."))
        }
        val pass = password.trim()
        if (pass.isEmpty()) return Result.failure(IllegalArgumentException("Password required"))
        val email = resolveEmail(username)
            ?: return Result.failure(
                IllegalArgumentException("Account not found for \"$username\". Enter your registered email or username.")
            )
        val auth = FirebaseAuth.getInstance()
        val role = roleForEmail(email)
        val display = displayNameForEmail(email)
        return try {
            val result = auth.signInWithEmailAndPassword(email, pass).await()
            val u = result.user!!
            afterSuccessfulAuthWriteProfileAndHistory(u.uid, email, display, role)
            val session = buildSessionForUid(context, u.uid, email, role)
                ?: AuthSession(u.uid, email, display, role, mustChangePassword = false)
            saveSession(context, session)
            Result.success(session)
        } catch (e: FirebaseAuthInvalidUserException) {
            tryBootstrapRegister(context, auth, email, pass, display, role)
        } catch (e: FirebaseAuthException) {
            if (e.errorCode == "ERROR_USER_NOT_FOUND" && isBootstrapAccount(email, pass)) {
                tryBootstrapRegister(context, auth, email, pass, display, role)
            } else {
                Result.failure(e)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateUserPassword(context: Context, newPassword: String): Result<Unit> {
        val authUser = FirebaseAuth.getInstance().currentUser
            ?: return Result.failure(IllegalStateException("No active signed-in user."))
        val uid = authUser.uid
        return runCatching {
            authUser.updatePassword(newPassword).await()
            FirebaseFirestore.getInstance()
                .collection(FirebaseCollections.USERS)
                .document(uid)
                .set(
                    mapOf(
                        "mustChangePassword" to false,
                        "isTemporaryPassword" to false,
                        "passwordUpdatedAt" to FieldValue.serverTimestamp()
                    ),
                    SetOptions.merge()
                )
                .await()
            val currentSession = loadSession(context)
            if (currentSession != null) {
                saveSession(context, currentSession.copy(mustChangePassword = false))
            }
            Unit
        }
    }

    /**
     * Files a password reset request for the Website admin to review (visible there as a
     * notification + a chat message from the worker). Once the admin approves it, the website
     * calls a backend endpoint (Firebase Admin SDK) that sets a brand-new temporary password on
     * this account directly -- no email required, so this also works for accounts that don't
     * have a real, reachable email address. The admin then sends that temporary password to the
     * worker by text message; the worker simply logs in with it and the app's existing
     * "set a new password" screen takes over from there.
     */
    suspend fun requestPasswordReset(context: Context, username: String): Result<PasswordResetRequestResult> {
        if (FirebaseApp.getApps(context).isEmpty()) {
            return Result.failure(IllegalStateException("Firebase is not configured (add google-services.json)."))
        }
        val trimmed = username.trim()
        if (trimmed.isEmpty()) {
            return Result.failure(IllegalArgumentException("Enter your username or email first."))
        }

        val email = resolveEmail(trimmed) ?: if (trimmed.contains("@")) trimmed.lowercase() else null
        val targetEmail = email ?: trimmed
        val displayName = if (email != null) displayNameForEmail(email) else trimmed

        // Store the reset request in Firestore so the Website admin gets a real-time notification
        // and a chat message. Only the admin's approval unlocks the actual password change.
        // Must match the fields allowed by the deployed Firestore rule for this collection exactly
        // (email, displayName, role, requestedAt, source, status, message -- no more, no less).
        val requestMessage = "$displayName requested a password reset from the Android app.".take(240)
        val createdRequestId = runCatching {
            FirebaseFirestore.getInstance()
                .collection(FirebaseCollections.PASSWORD_RESET_REQUESTS)
                .add(
                    mapOf(
                        "email" to targetEmail,
                        "displayName" to displayName,
                        "role" to roleForEmail(targetEmail).name,
                        "requestedAt" to FieldValue.serverTimestamp(),
                        "source" to "android",
                        "status" to "pending",
                        "message" to requestMessage
                    )
                )
                .await()
                .id
        }.getOrNull()

        return if (createdRequestId != null) {
            Result.success(
                PasswordResetRequestResult(
                    requestId = createdRequestId,
                    email = targetEmail,
                    adminNotified = true
                )
            )
        } else {
            Result.failure(IllegalStateException("Unable to send your request right now. Please check your connection and try again."))
        }
    }

    /**
     * Polls the status of a previously-filed reset request. Returns the lowercase status string
     * (`"pending"`, `"approved"`, `"resolved"`, `"denied"`, ...); defaults to `"pending"` if the
     * status field is missing.
     */
    suspend fun checkPasswordResetStatus(requestId: String): Result<String> = runCatching {
        val snap = FirebaseFirestore.getInstance()
            .collection(FirebaseCollections.PASSWORD_RESET_REQUESTS)
            .document(requestId)
            .get()
            .await()
        (snap.getString("status") ?: "pending").lowercase()
    }

    private suspend fun tryBootstrapRegister(
        context: Context,
        auth: FirebaseAuth,
        email: String,
        pass: String,
        display: String,
        role: UserRole
    ): Result<AuthSession> {
        if (!isBootstrapAccount(email, pass)) return Result.failure(
            IllegalArgumentException(
                "This account is not in Firebase yet, or the password is wrong. " +
                    "For admin: $AdminEmail. For field worker: $WorkerStaffEmail (user `worker` / `workerstaff`). " +
                    "Add the user in Firebase Console → Authentication, or use the app bootstrap password for those accounts."
            )
        )
        return runCatching {
            val created = auth.createUserWithEmailAndPassword(email, pass).await().user!!
            val initial = mapOf(
                "email" to email,
                "displayName" to display,
                "role" to role.name,
                "createdAt" to FieldValue.serverTimestamp()
            )
            FirebaseFirestore.getInstance()
                .collection(FirebaseCollections.USERS)
                .document(created.uid)
                .set(initial, SetOptions.merge())
                .await()
            afterSuccessfulAuthWriteProfileAndHistory(created.uid, email, display, role)
            val mustChange = checkMustChangePassword(created.uid)
            val session = AuthSession(created.uid, email, display, role, mustChangePassword = mustChange)
            saveSession(context, session)
            session
        }.fold(
            onSuccess = { Result.success(it) },
            onFailure = { err -> Result.failure(err) }
        )
    }

    private suspend fun afterSuccessfulAuthWriteProfileAndHistory(
        uid: String,
        email: String,
        display: String,
        role: UserRole
    ) {
        val db = FirebaseFirestore.getInstance()
        val userRef = db.collection(FirebaseCollections.USERS).document(uid)
        userRef.set(
            mapOf(
                "email" to email,
                "displayName" to display,
                "role" to role.name,
                "lastSignInAt" to FieldValue.serverTimestamp()
            ),
            SetOptions.merge()
        ).await()
        userRef.collection(FirebaseCollections.LOGIN_HISTORY).add(
            mapOf(
                "email" to email,
                "displayName" to display,
                "role" to role.name,
                "at" to FieldValue.serverTimestamp(),
                "source" to "android"
            )
        ).await()
    }

    fun saveSession(context: Context, session: AuthSession) {
        context.getSharedPreferences(AuthPrefs, Context.MODE_PRIVATE)
            .edit()
            .putString(SessionUserIdKey, session.userId)
            .putString(SessionEmailKey, session.email)
            .putString(SessionDisplayNameKey, session.displayName)
            .putString(SessionRoleKey, session.role.name)
            .putBoolean(SessionMustChangePassKey, session.mustChangePassword)
            .apply()
    }

    fun loadSession(context: Context): AuthSession? {
        val p = context.getSharedPreferences(AuthPrefs, Context.MODE_PRIVATE)
        val userId = p.getString(SessionUserIdKey, null) ?: return null
        val email = p.getString(SessionEmailKey, null) ?: return null
        val displayName = p.getString(SessionDisplayNameKey, null) ?: return null
        val roleName = p.getString(SessionRoleKey, null) ?: return null
        val role = runCatching { UserRole.valueOf(roleName) }.getOrNull() ?: return null
        val mustChange = p.getBoolean(SessionMustChangePassKey, false)
        return AuthSession(
            userId = userId,
            email = email,
            displayName = displayName,
            role = role,
            mustChangePassword = mustChange
        )
    }

    fun clearSession(context: Context) {
        runCatching { FirebaseAuth.getInstance().signOut() }
        context.getSharedPreferences(AuthPrefs, Context.MODE_PRIVATE)
            .edit()
            .remove(SessionUserIdKey)
            .remove(SessionEmailKey)
            .remove(SessionDisplayNameKey)
            .remove(SessionRoleKey)
            .remove(SessionMustChangePassKey)
            .apply()
    }
}
