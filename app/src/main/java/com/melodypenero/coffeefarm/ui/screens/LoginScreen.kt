package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.melodypenero.coffeefarm.auth.AuthManager
import com.melodypenero.coffeefarm.auth.AuthSession
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
@Composable
fun LoginScreen(
    onAuthSuccess: (AuthSession) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var errorText by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var rememberMe by remember { mutableStateOf(false) }
    var showPassword by remember { mutableStateOf(false) }
    val canSubmit = username.trim().isNotEmpty() && password.trim().isNotEmpty() && !isLoading
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val pageBackground = if (isDarkPalette) {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFF241710),
                Color(0xFF1A120D),
                Color(0xFF140C08)
            )
        )
    } else {
        Brush.verticalGradient(colors = listOf(Color(0xFFF5F5F5), Color(0xFFF5F5F5)))
    }
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(pageBackground),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.88f)
                .padding(horizontal = 16.dp),
            colors = CardDefaults.cardColors(containerColor = cardColor),
            shape = RoundedCornerShape(14.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 22.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Sign in",
                    style = MaterialTheme.typography.headlineSmall,
                    color = titleColor,
                    fontWeight = FontWeight.SemiBold
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
                    colors = coffeeTextFieldColors()
                )
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = {
                        password = it
                        errorText = null
                    },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                imageVector = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = if (showPassword) "Hide password" else "Show password",
                                tint = Color(0xFFB8A99E)
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = coffeeTextFieldColors()
                )

                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = rememberMe,
                            onCheckedChange = { rememberMe = it },
                            colors = CheckboxDefaults.colors(
                                checkedColor = Color(0xFF84B626),
                                uncheckedColor = Color(0xFF7A6A5F),
                                checkmarkColor = Color(0xFF1A120D)
                            )
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = "Remember me",
                            style = MaterialTheme.typography.bodySmall,
                            color = subtitleColor
                        )
                    }
                    Text(
                        text = "Forgot password?",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF8EB95B),
                        modifier = Modifier.clickable { }
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))
                errorText?.let { message ->
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFFF9A8F)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                Button(
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
                    enabled = canSubmit,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF84B626),
                        contentColor = Color(0xFF1A120D),
                        disabledContainerColor = Color(0xFF3A5D3F),
                        disabledContentColor = Color(0xFFB8A99E)
                    )
                ) {
                    Text(if (isLoading) "Signing in…" else "Log in")
                }
            }
        }
    }
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
            append("Field worker: `worker` or `workerstaff` with the account password. ")
            append("If the account exists in Firebase Console, the password there must match what you type here.")
        }
    }
    if (raw.isNotBlank()) return raw
    return "Invalid username or password. Enable Email/Password in Firebase Authentication."
}

@Composable
private fun coffeeTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = Color(0xFF3A2A21),
    unfocusedContainerColor = Color(0xFF3A2A21),
    focusedTextColor = Color(0xFFF4EDE6),
    unfocusedTextColor = Color(0xFFF4EDE6),
    focusedBorderColor = Color(0xFF8EB95B),
    unfocusedBorderColor = Color(0xFF5A463A),
    focusedLabelColor = Color(0xFF8EB95B),
    unfocusedLabelColor = Color(0xFFB8A99E),
    cursorColor = Color(0xFF8EB95B)
)
