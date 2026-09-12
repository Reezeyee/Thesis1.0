package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.melodypenero.coffeefarm.auth.AuthManager
import com.melodypenero.coffeefarm.ui.components.FarmPrimaryButton
import com.melodypenero.coffeefarm.ui.components.farmPalette
import com.melodypenero.coffeefarm.ui.components.farmTextFieldColors
import com.melodypenero.coffeefarm.ui.theme.ErrorSoft
import com.melodypenero.coffeefarm.ui.theme.ErrorText
import kotlinx.coroutines.launch

/** Steps of the in-app "Forgot password" flow. */
private enum class ForgotPasswordStep {
    /** Worker enters their username/email and files the request. */
    REQUEST,
    /** Request sent; waiting on the admin to approve it on the Website. */
    WAITING_FOR_ADMIN,
    /** Admin approved and set a new temporary password for the worker. */
    APPROVED
}

private fun friendlyRequestError(raw: String): String {
    val lower = raw.lowercase()
    if (lower.contains("enter your username")) {
        return "Enter your username or email first."
    }
    if (raw.isNotBlank()) return raw
    return "Could not send your request. Check your internet connection and try again."
}

/**
 * "Forgot password" flow: the worker files a request that the admin reviews on the Website
 * (Notifications + a chat message asking to contact the admin). The admin approves it there,
 * which sets a brand-new temporary password on the worker's account directly (no email needed --
 * this also works for accounts that don't have a real, reachable email address). The admin then
 * sends that temporary password to the worker by text message or in person. There's nothing more
 * to do in this dialog after that: the worker just logs in normally with the temporary password,
 * and the app's existing "set a new password" screen takes over automatically.
 */
@Composable
fun ForgotPasswordDialog(
    initialUsername: String,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val palette = farmPalette()

    var step by remember { mutableStateOf(ForgotPasswordStep.REQUEST) }
    var username by remember { mutableStateOf(initialUsername) }
    var requestId by remember { mutableStateOf<String?>(null) }

    var isLoading by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }
    var infoText by remember { mutableStateOf<String?>(null) }

    val isErrorDark = palette.textPrimary.luminance() < 0.5f
    val errorColor = if (isErrorDark) ErrorText else ErrorSoft

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = palette.surface),
            shape = RoundedCornerShape(20.dp),
            border = BorderStroke(1.dp, palette.border),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 26.dp)
            ) {
                Text(
                    text = "Forgot password?",
                    style = MaterialTheme.typography.headlineSmall,
                    color = palette.textPrimary,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(6.dp))

                when (step) {
                    ForgotPasswordStep.REQUEST -> {
                        Text(
                            text = "Enter your username or email. We'll send a request to the farm administrator -- contact them so they know to check it.",
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.textSecondary
                        )
                        Spacer(modifier = Modifier.height(16.dp))
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
                        Spacer(modifier = Modifier.height(16.dp))
                        errorText?.let { message ->
                            Text(text = message, style = MaterialTheme.typography.bodySmall, color = errorColor)
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                        FarmPrimaryButton(
                            text = if (isLoading) "Sending…" else "Contact the admin",
                            onClick = {
                                errorText = null
                                scope.launch {
                                    isLoading = true
                                    val result = AuthManager.requestPasswordReset(context, username)
                                    isLoading = false
                                    result.fold(
                                        onSuccess = { reset ->
                                            requestId = reset.requestId
                                            step = ForgotPasswordStep.WAITING_FOR_ADMIN
                                        },
                                        onFailure = { err ->
                                            errorText = friendlyRequestError(err.message.orEmpty())
                                        }
                                    )
                                }
                            },
                            enabled = username.trim().isNotEmpty() && !isLoading
                        )
                    }

                    ForgotPasswordStep.WAITING_FOR_ADMIN -> {
                        Icon(
                            imageVector = Icons.Default.MailOutline,
                            contentDescription = null,
                            tint = palette.accent,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                        Text(
                            text = "Your request has been sent. Please contact the admin.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = palette.textPrimary,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "The farm administrator has been notified on the Website and will review your request. Once they approve it, they will text you a temporary password -- tap \"Check status\" to see if it's ready.",
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.textSecondary
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        infoText?.let { message ->
                            Text(text = message, style = MaterialTheme.typography.bodySmall, color = palette.textSecondary)
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                        errorText?.let { message ->
                            Text(text = message, style = MaterialTheme.typography.bodySmall, color = errorColor)
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                        FarmPrimaryButton(
                            text = if (isLoading) "Checking…" else "Check status",
                            onClick = {
                                val id = requestId ?: return@FarmPrimaryButton
                                errorText = null
                                scope.launch {
                                    isLoading = true
                                    val statusResult = AuthManager.checkPasswordResetStatus(id)
                                    val status = statusResult.getOrNull()
                                    isLoading = false
                                    if (status == "approved" || status == "resolved") {
                                        step = ForgotPasswordStep.APPROVED
                                    } else if (status != null) {
                                        infoText = "Still waiting for admin approval. Check back soon."
                                    } else {
                                        errorText = statusResult.exceptionOrNull()?.message
                                            ?: "Could not check your request status. Try again."
                                    }
                                }
                            },
                            enabled = !isLoading && requestId != null
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = "Start over",
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.accent,
                            modifier = Modifier.clickable(enabled = !isLoading) {
                                errorText = null
                                infoText = null
                                step = ForgotPasswordStep.REQUEST
                            }
                        )
                    }

                    ForgotPasswordStep.APPROVED -> {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = palette.accent,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                        Text(
                            text = "Approved!",
                            style = MaterialTheme.typography.bodyMedium,
                            color = palette.textPrimary,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "The admin has set a temporary password for you and will send it by text message. Close this dialog and log in with that temporary password -- you'll be asked to set your own new password right after.",
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.textSecondary
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        FarmPrimaryButton(
                            text = "Back to login",
                            onClick = onDismiss,
                            enabled = true
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Text(
                        text = "Close",
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.textSecondary,
                        modifier = Modifier.clickable(enabled = !isLoading, onClick = onDismiss)
                    )
                }
            }
        }
    }
}
