package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.auth.AuthManager
import com.melodypenero.coffeefarm.auth.AuthSession
import com.melodypenero.coffeefarm.ui.components.FarmPrimaryButton
import com.melodypenero.coffeefarm.ui.components.farmPalette
import com.melodypenero.coffeefarm.ui.components.farmTextFieldColors
import com.melodypenero.coffeefarm.ui.theme.ErrorSoft
import com.melodypenero.coffeefarm.ui.theme.ErrorText
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    onAuthSuccess: (AuthSession) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val palette = farmPalette()
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var errorText by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var isResetLoading by remember { mutableStateOf(false) }
    var rememberMe by remember { mutableStateOf(false) }
    var showPassword by remember { mutableStateOf(false) }
    val canSubmit = username.trim().isNotEmpty() && password.trim().isNotEmpty() && !isLoading && !isResetLoading

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.pageGradient),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .padding(horizontal = 20.dp),
            colors = CardDefaults.cardColors(containerColor = palette.surface),
            shape = RoundedCornerShape(20.dp),
            border = BorderStroke(1.dp, palette.border),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Acojido Farm",
                    style = MaterialTheme.typography.labelLarge,
                    color = palette.accent,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Sign in",
                    style = MaterialTheme.typography.headlineSmall,
                    color = palette.textPrimary,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Field tools for cherry scanning and daily logs",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.textSecondary,
                    modifier = Modifier.padding(top = 6.dp, bottom = 20.dp)
                )

                OutlinedTextField(
                    value = username,
                    onValueChange = {
                        username = it
                        errorText = null
                    },
                    label = { Text("Username or email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = farmTextFieldColors()
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = {
                        password = it
                        errorText = null
                    },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = if (showPassword) {
                        VisualTransformation.None
                    } else {
                        PasswordVisualTransformation()
                    },
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                imageVector = if (showPassword) {
                                    Icons.Default.VisibilityOff
                                } else {
                                    Icons.Default.Visibility
                                },
                                contentDescription = if (showPassword) "Hide password" else "Show password",
                                tint = palette.textSecondary
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = farmTextFieldColors()
                )

                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = rememberMe,
                            onCheckedChange = { rememberMe = it },
                            colors = CheckboxDefaults.colors(
                                checkedColor = palette.accent,
                                uncheckedColor = palette.textSecondary,
                                checkmarkColor = palette.onAccent
                            )
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = "Remember me",
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.textSecondary
                        )
                    }
                    Text(
                        text = if (isResetLoading) "Sending…" else "Forgot password?",
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.accent,
                        modifier = Modifier.clickable(enabled = !isResetLoading && !isLoading) {
                            errorText = null
                            scope.launch {
                                isResetLoading = true
                                val result = AuthManager.requestPasswordReset(context, username)
                                isResetLoading = false
                                errorText = result.fold(
                                    onSuccess = { reset ->
                                        if (reset.adminNotified) {
                                            "Password reset email sent. The admin has been notified."
                                        } else {
                                            "Password reset email sent. Admin notification needs updated Firestore rules."
                                        }
                                    },
                                    onFailure = { err ->
                                        formatPasswordResetError(err.message.orEmpty())
                                    }
                                )
                            }
                        }
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))
                errorText?.let { message ->
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (palette.textPrimary.luminance() < 0.5f) ErrorText else ErrorSoft
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                FarmPrimaryButton(
                    text = if (isLoading) "Signing in…" else "Log in",
                    onClick = {
                        errorText = null
                        scope.launch {
                            isLoading = true
                            val result = AuthManager.signInWithEmailPassword(
                                context,
                                username,
                                password
                            )
                            isLoading = false
                            val session = result.getOrNull()
                            if (session != null) {
                                onAuthSuccess(session)
                            } else {
                                val raw = result.exceptionOrNull()?.message.orEmpty()
                                errorText = formatSignInError(raw)
                            }
                        }
                    },
                    enabled = canSubmit
                )
            }
        }
    }
}

private fun formatPasswordResetError(raw: String): String {
    val lower = raw.lowercase()
    if (lower.contains("enter your username") || lower.contains("unknown")) {
        return "Enter your username or email first, then tap Forgot password."
    }
    if (lower.contains("user") && lower.contains("not") && lower.contains("found")) {
        return "No Firebase account was found for that username or email. Ask the admin to create the account first."
    }
    if (lower.contains("invalid") && lower.contains("email")) {
        return "Enter a valid username or email before requesting a password reset."
    }
    if (lower.contains("operation") && lower.contains("allowed")) {
        return "Password reset is not enabled in Firebase Authentication. Ask the admin to enable Email/Password sign-in."
    }
    if (raw.isNotBlank()) return raw
    return "Could not send password reset. Check your internet connection and try again."
}

private fun formatSignInError(raw: String): String {
    val lower = raw.lowercase()
    if (
        lower.contains("configuration_not_found") ||
        lower.contains("configuration not found") ||
        lower.contains("internal error") && lower.contains("configuration")
    ) {
        return buildString {
            append("Firebase Auth is missing OAuth configuration. Do this:\n")
            append("1) Firebase → Authentication → enable Google (save), then re-download google-services.json, OR\n")
            append("2) Copy scripts/firebase_secrets.xml.example to res/values/firebase_secrets.xml and paste your Web client id.\n")
            append("Full steps: scripts/CONFIG_NOT_FOUND_FIX.txt")
        }
    }
    if (
        lower.contains("operation-not-allowed") ||
        lower.contains("operation not allowed") ||
        lower.contains("not allowed") && (lower.contains("sign-in") || lower.contains("provider") || lower.contains("disabled"))
    ) {
        return buildString {
            append("Email/Password sign-in is turned off in Firebase for this project.\n\n")
            append("Fix: Firebase Console → Build → Authentication → Sign-in method → ")
            append("Email/Password → Enable → Save. Then try logging in again.")
        }
    }
    if (
        (lower.contains("invalid") && (lower.contains("credential") || lower.contains("password"))) ||
        lower.contains("malformed") ||
        (lower.contains("expired") && lower.contains("credential"))
    ) {
        return buildString {
            append("Email or password does not match what is stored in Firebase, or the user is not in Authentication yet. ")
            append("Admin: username `admin` / `AcojidoAdmin` or farmacojido@gmail.com. ")
            append("Field worker: use the email and temporary password generated when the admin adds the employee on the website. ")
            append("If the account exists in Firebase, the password there must match what you type here.")
        }
    }
    if (raw.isNotBlank()) return raw
    return "Invalid username or password. Enable Email/Password in Firebase Authentication."
}
