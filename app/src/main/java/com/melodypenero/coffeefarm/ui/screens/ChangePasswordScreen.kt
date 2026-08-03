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
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
fun ChangePasswordScreen(
    currentSession: AuthSession,
    onPasswordChanged: (AuthSession) -> Unit,
    onSignOut: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val palette = farmPalette()

    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var showNewPassword by remember { mutableStateOf(false) }
    var showConfirmPassword by remember { mutableStateOf(false) }

    var errorText by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }

    val canSubmit = newPassword.trim().length >= 6 &&
            confirmPassword.trim() == newPassword.trim() &&
            !isLoading

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.pageGradient),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .padding(horizontal = 16.dp),
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
                Box(
                    modifier = Modifier
                        .background(palette.accentContainer, RoundedCornerShape(50))
                        .padding(12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Temporary Password",
                        tint = palette.accent
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "Set Custom Password",
                    style = MaterialTheme.typography.headlineSmall,
                    color = palette.textPrimary,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "Welcome, ${currentSession.displayName}! You logged in with a temporary password. Please create your own private password (at least 6 characters) to secure your account.",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.textSecondary,
                    modifier = Modifier.padding(top = 6.dp, bottom = 20.dp)
                )

                OutlinedTextField(
                    value = newPassword,
                    onValueChange = {
                        newPassword = it
                        errorText = null
                    },
                    label = { Text("New Password (min 6 chars)") },
                    singleLine = true,
                    visualTransformation = if (showNewPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showNewPassword = !showNewPassword }) {
                            Icon(
                                imageVector = if (showNewPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = if (showNewPassword) "Hide" else "Show",
                                tint = palette.textSecondary
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = farmTextFieldColors()
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = {
                        confirmPassword = it
                        errorText = null
                    },
                    label = { Text("Confirm New Password") },
                    singleLine = true,
                    visualTransformation = if (showConfirmPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showConfirmPassword = !showConfirmPassword }) {
                            Icon(
                                imageVector = if (showConfirmPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = if (showConfirmPassword) "Hide" else "Show",
                                tint = palette.textSecondary
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = farmTextFieldColors()
                )

                if (confirmPassword.isNotEmpty() && confirmPassword != newPassword) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Passwords do not match",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (palette.textPrimary.luminance() < 0.5f) ErrorText else ErrorSoft
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                errorText?.let { message ->
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (palette.textPrimary.luminance() < 0.5f) ErrorText else ErrorSoft
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                FarmPrimaryButton(
                    text = if (isLoading) "Updating Password…" else "Update Password & Access App",
                    onClick = {
                        val pass = newPassword.trim()
                        val confirm = confirmPassword.trim()

                        if (pass.length < 6) {
                            errorText = "Password must be at least 6 characters."
                            return@FarmPrimaryButton
                        }
                        if (pass != confirm) {
                            errorText = "Passwords do not match."
                            return@FarmPrimaryButton
                        }

                        errorText = null
                        scope.launch {
                            isLoading = true
                            val result = AuthManager.updateUserPassword(context, pass)
                            isLoading = false

                            result.fold(
                                onSuccess = {
                                    val updatedSession = currentSession.copy(mustChangePassword = false)
                                    onPasswordChanged(updatedSession)
                                },
                                onFailure = { err ->
                                    errorText = err.message ?: "Failed to update password. Try again."
                                }
                            )
                        }
                    },
                    enabled = canSubmit
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Sign out",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.accent,
                    modifier = Modifier.clickable {
                        AuthManager.clearSession(context)
                        onSignOut()
                    }
                )
            }
        }
    }
}
