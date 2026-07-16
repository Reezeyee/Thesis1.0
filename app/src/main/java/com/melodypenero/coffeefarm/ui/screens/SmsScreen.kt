package com.melodypenero.coffeefarm.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telephony.SmsManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material.icons.filled.SettingsPhone
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.melodypenero.coffeefarm.auth.AuthSession
import com.melodypenero.coffeefarm.auth.UserRole
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.data.store.SmsMessageRecord
import com.melodypenero.coffeefarm.ui.components.FarmCard
import com.melodypenero.coffeefarm.ui.components.FarmInfoBanner
import com.melodypenero.coffeefarm.ui.components.FarmLazyScreen
import com.melodypenero.coffeefarm.ui.components.FarmPrimaryButton
import com.melodypenero.coffeefarm.ui.components.FarmSectionTitle
import com.melodypenero.coffeefarm.ui.components.farmPalette
import com.melodypenero.coffeefarm.ui.components.FarmPalette
import androidx.compose.ui.graphics.luminance
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SmsScreen(session: AuthSession) {
    val store = LocalAppStore.current
    val state by store.appState
    val context = LocalContext.current
    val palette = farmPalette()

    // Configurable/default phone numbers
    var adminPhoneNumber by remember { mutableStateOf("+639171234567") }
    var selectedWorker by remember { mutableStateOf<String?>(null) }
    var messageText by remember { mutableStateOf("") }

    val isWorker = session.role == UserRole.FARM_STAFF
    val linkedWorker = remember(state.workers, session.userId, session.email) {
        state.workers.firstOrNull { worker ->
            val wUid = worker.authUid ?: ""
            val wEmail = worker.accountEmail ?: ""
            wUid.equals(session.userId, ignoreCase = true) ||
                wEmail.equals(session.email, ignoreCase = true)
        }
    }
    val myName = if (isWorker) (linkedWorker?.name ?: session.displayName) else session.displayName

    // Load available workers
    val workers = state.workers
    val workerOptions = remember(workers) {
        workers.map { it.name }.distinct().sorted()
    }

    // Set first worker as default if Admin
    if (!isWorker && selectedWorker == null && workerOptions.isNotEmpty()) {
        selectedWorker = workerOptions.first()
    }

    // Determine current chat partner name and phone
    val partnerName = if (isWorker) "Admin" else (selectedWorker ?: "Select Worker")
    val partnerPhone = if (isWorker) {
        adminPhoneNumber
    } else {
        workers.firstOrNull { it.name.equals(selectedWorker, ignoreCase = true) }?.phoneNumber.orEmpty()
            .ifBlank { "" }
    }

    // Filter messages for active chat thread
    val threadMessages = remember(state.smsMessages, selectedWorker, myName, isWorker) {
        state.smsMessages.filter { msg ->
            if (isWorker) {
                // Worker sees their own messages with admin
                (msg.senderName.equals(myName, ignoreCase = true) && msg.recipientName.equals("Admin", ignoreCase = true)) ||
                (msg.senderName.equals("Admin", ignoreCase = true) && msg.recipientName.equals(myName, ignoreCase = true))
            } else {
                // Admin sees messages with the selected worker
                val wName = selectedWorker ?: ""
                (msg.senderName.equals("Admin", ignoreCase = true) && msg.recipientName.equals(wName, ignoreCase = true)) ||
                (msg.senderName.equals(wName, ignoreCase = true) && msg.recipientName.equals("Admin", ignoreCase = true))
            }
        }.sortedBy { it.timestamp }
    }

    val handleSyncInAppOnly = {
        val text = messageText.trim()
        val phone = partnerPhone.trim()
        if (text.isBlank()) {
            Toast.makeText(context, "Cannot sync: Message is empty.", Toast.LENGTH_SHORT).show()
        } else {
            store.addSmsMessage(
                senderName = if (isWorker) myName else "Admin",
                senderRole = if (isWorker) "Worker" else "Admin",
                recipientName = partnerName,
                recipientPhoneNumber = phone,
                messageBody = text,
                sentViaCellularSms = false
            )
            messageText = ""
            Toast.makeText(context, "Synced in-app", Toast.LENGTH_SHORT).show()
        }
    }

    val handleSendViaSmsLink = {
        val phone = partnerPhone.trim()
        val text = messageText.trim()
        if (phone.isBlank()) {
            Toast.makeText(context, "Cannot send: No phone number specified.", Toast.LENGTH_LONG).show()
        } else if (text.isBlank()) {
            Toast.makeText(context, "Cannot send: Message is empty.", Toast.LENGTH_SHORT).show()
        } else {
            try {
                val intent = Intent(Intent.ACTION_SENDTO).apply {
                    data = Uri.parse("smsto:$phone")
                    putExtra("sms_body", text)
                }
                context.startActivity(intent)

                // Log in Firestore
                store.addSmsMessage(
                    senderName = if (isWorker) myName else "Admin",
                    senderRole = if (isWorker) "Worker" else "Admin",
                    recipientName = partnerName,
                    recipientPhoneNumber = phone,
                    messageBody = text,
                    sentViaCellularSms = true
                )
                messageText = ""
                Toast.makeText(context, "Opened in SMS App", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, "Failed to open SMS app: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    val isDark = MaterialTheme.colorScheme.background.luminance() < 0.5f

    FarmLazyScreen(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            FarmSectionTitle(
                title = "SMS Communication Module",
                subtitle = "Send direct cellular text messages or sync notes in-app between Workers and Farm Admin."
            )
        }

        // Configuration card
        item {
            FarmCard {
                Column(modifier = Modifier.padding(2.dp)) {
                    Text(
                        text = "Communication Settings",
                        fontWeight = FontWeight.SemiBold,
                        color = palette.textPrimary,
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    
                    if (isWorker) {
                        // Workers edit or see Admin phone number
                        OutlinedTextField(
                            value = adminPhoneNumber,
                            onValueChange = { adminPhoneNumber = it },
                            label = { Text("Admin Phone Number") },
                            leadingIcon = { Icon(Icons.Default.SettingsPhone, contentDescription = null, tint = palette.textSecondary) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        // Admin selects which worker they are texting
                        if (workerOptions.isEmpty()) {
                            FarmInfoBanner(text = "No worker profiles found in settings. Add workers on the website first.")
                        } else {
                            var expanded by remember { mutableStateOf(false) }
                            ExposedDropdownMenuBox(
                                expanded = expanded,
                                onExpandedChange = { expanded = !expanded }
                            ) {
                                OutlinedTextField(
                                    value = selectedWorker ?: "Choose worker...",
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text("Recipient Worker") },
                                    leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = palette.textSecondary) },
                                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                                    modifier = Modifier
                                        .menuAnchor()
                                        .fillMaxWidth()
                                )
                                ExposedDropdownMenu(
                                    expanded = expanded,
                                    onDismissRequest = { expanded = false }
                                ) {
                                    workerOptions.forEach { name ->
                                        DropdownMenuItem(
                                            text = { Text(name) },
                                            onClick = {
                                                selectedWorker = name
                                                expanded = false
                                            }
                                        )
                                    }
                                }
                            }
                        }
                    }

                    if (partnerPhone.isNotBlank()) {
                        Text(
                            text = "Recipient Phone: $partnerPhone",
                            color = palette.accent,
                            fontWeight = FontWeight.Medium,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    } else if (partnerName.isNotBlank() && !isWorker) {
                        Text(
                            text = "Warning: selected worker does not have a phone number registered.",
                            color = Color(0xFFD4183D),
                            fontWeight = FontWeight.Medium,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }
            }
        }

        // Chat Thread Box
        item {
            FarmCard {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Chat Thread: $partnerName",
                        fontWeight = FontWeight.SemiBold,
                        color = palette.textPrimary,
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(280.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isDark) Color(0xFF1E1410) else Color(0xFFFAF6F2))
                            .padding(8.dp)
                    ) {
                        if (threadMessages.isEmpty()) {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "No messages synced with $partnerName yet.\nSend an SMS below to start the conversation.",
                                    color = palette.textSecondary,
                                    fontSize = 13.sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                                reverseLayout = false
                            ) {
                                items(threadMessages) { msg ->
                                    val isMe = if (isWorker) msg.senderRole == "Worker" else msg.senderRole == "Admin"
                                    ChatBubble(msg = msg, isMe = isMe, palette = palette)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Sender input & option card
        item {
            FarmCard {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Compose SMS",
                        fontWeight = FontWeight.SemiBold,
                        color = palette.textPrimary,
                        style = MaterialTheme.typography.titleMedium
                    )

                    OutlinedTextField(
                        value = messageText,
                        onValueChange = { messageText = it },
                        placeholder = { Text("Type report / reply details...") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(100.dp)
                            .padding(vertical = 8.dp)
                    )

                    // Quick worker templates
                    if (isWorker) {
                        Text(
                            text = "Quick templates:",
                            color = palette.textSecondary,
                            fontWeight = FontWeight.Medium,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(bottom = 4.dp)
                        )
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.padding(bottom = 12.dp)
                        ) {
                            val templates = listOf(
                                "I have arrived at the farm",
                                "Completed CNN scans for block",
                                "Irrigation damage reported in Field A",
                                "Finished daily shift, clocking out",
                                "Need additional supplies: bags"
                            )
                            templates.forEach { temp ->
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(palette.drawerSelected)
                                        .clickable { messageText = temp }
                                        .padding(horizontal = 8.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        text = temp,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = palette.accent
                                    )
                                }
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(modifier = Modifier.weight(1f)) {
                            FarmPrimaryButton(
                                text = "Sync In-App Only",
                                onClick = { handleSyncInAppOnly() },
                                enabled = messageText.isNotBlank()
                            )
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            FarmPrimaryButton(
                                text = "Send via SMS Link",
                                onClick = { handleSendViaSmsLink() },
                                enabled = partnerPhone.isNotBlank() && messageText.isNotBlank()
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ChatBubble(msg: SmsMessageRecord, isMe: Boolean, palette: FarmPalette) {
    val date = Date(msg.timestamp)
    val formatter = SimpleDateFormat("HH:mm · MMM dd", Locale.getDefault())
    val formattedTime = formatter.format(date)

    val alignment = if (isMe) Alignment.End else Alignment.Start
    val bg = if (isMe) palette.accent else palette.drawerSelected
    val textColor = if (isMe) palette.onAccent else palette.accent

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = alignment
    ) {
        Box(
            modifier = Modifier
                .clip(
                    RoundedCornerShape(
                        topStart = 12.dp,
                        topEnd = 12.dp,
                        bottomStart = if (isMe) 12.dp else 2.dp,
                        bottomEnd = if (isMe) 2.dp else 12.dp
                    )
                )
                .background(bg)
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .fillMaxWidth(0.82f)
        ) {
            Column {
                Text(
                    text = msg.messageBody,
                    color = textColor,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.height(3.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (isMe) "Sent" else msg.senderName,
                        color = textColor.copy(alpha = 0.7f),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = formattedTime,
                        color = textColor.copy(alpha = 0.7f),
                        fontSize = 9.sp
                    )
                }
            }
        }
    }
}
