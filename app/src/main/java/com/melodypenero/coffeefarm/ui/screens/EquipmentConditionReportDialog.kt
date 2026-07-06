package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.ui.components.farmPalette

enum class EquipmentReportChoice {
    BROKEN,
    OK
}

@Composable
fun EquipmentConditionReportDialog(
    equipmentOptions: List<String>,
    preselectedEquipment: String? = null,
    onDismiss: () -> Unit,
    onSubmit: (equipmentName: String, choice: EquipmentReportChoice, notes: String) -> Unit
) {
    val palette = farmPalette()
    val options = equipmentOptions.filter { it.isNotBlank() }
    var equipmentName by remember(preselectedEquipment, options) {
        mutableStateOf(
            preselectedEquipment?.takeIf { it in options }
                ?: options.firstOrNull().orEmpty()
        )
    }
    var conditionChoice by remember { mutableStateOf("Wrecked / broken") }
    var notes by remember { mutableStateOf("") }
    var equipmentMenuExpanded by remember { mutableStateOf(false) }
    var conditionMenuExpanded by remember { mutableStateOf(false) }

    val conditionOptions = listOf("Wrecked / broken", "Working OK")
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = palette.textPrimary,
        unfocusedTextColor = palette.textPrimary,
        disabledTextColor = palette.textSecondary,
        focusedContainerColor = palette.surfaceElevated,
        unfocusedContainerColor = palette.surfaceElevated,
        disabledContainerColor = palette.surfaceElevated,
        focusedBorderColor = palette.accent,
        unfocusedBorderColor = palette.border,
        focusedLabelColor = palette.accent,
        unfocusedLabelColor = palette.textSecondary,
        focusedTrailingIconColor = palette.accent,
        unfocusedTrailingIconColor = palette.accent,
        cursorColor = palette.accent
    )

    val notesLabel = when {
        conditionChoice.startsWith("Wrecked", ignoreCase = true) -> "What's wrong (optional)"
        else -> "Notes (optional)"
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = palette.surface,
        titleContentColor = palette.textPrimary,
        textContentColor = palette.textPrimary,
        title = {
            Text(
                "Report equipment",
                color = palette.textPrimary,
                fontWeight = FontWeight.SemiBold
            )
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                if (options.isEmpty()) {
                    Text(
                        "No equipment in inventory yet. Ask an admin to add equipment on the website.",
                        color = palette.textSecondary
                    )
                } else {
                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = equipmentName,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Equipment") },
                            modifier = Modifier.fillMaxWidth(),
                            trailingIcon = {
                                Icon(
                                    Icons.Default.ArrowDropDown,
                                    contentDescription = null,
                                    tint = palette.accent
                                )
                            },
                            textStyle = MaterialTheme.typography.bodyLarge.copy(color = palette.textPrimary),
                            colors = fieldColors
                        )
                        Box(
                            modifier = Modifier
                                .matchParentSize()
                                .clickable { equipmentMenuExpanded = true }
                        )
                    }
                    DropdownMenu(
                        expanded = equipmentMenuExpanded,
                        onDismissRequest = { equipmentMenuExpanded = false },
                        modifier = Modifier.fillMaxWidth(0.82f)
                    ) {
                        options.forEach { name ->
                            DropdownMenuItem(
                                text = { Text(name, color = palette.textPrimary) },
                                onClick = {
                                    equipmentName = name
                                    equipmentMenuExpanded = false
                                },
                                colors = MenuDefaults.itemColors(textColor = palette.textPrimary)
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp)
                    ) {
                        OutlinedTextField(
                            value = conditionChoice,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Condition") },
                            modifier = Modifier.fillMaxWidth(),
                            trailingIcon = {
                                Icon(
                                    Icons.Default.ArrowDropDown,
                                    contentDescription = null,
                                    tint = palette.accent
                                )
                            },
                            textStyle = MaterialTheme.typography.bodyLarge.copy(color = palette.textPrimary),
                            colors = fieldColors
                        )
                        Box(
                            modifier = Modifier
                                .matchParentSize()
                                .clickable { conditionMenuExpanded = true }
                        )
                    }
                    DropdownMenu(
                        expanded = conditionMenuExpanded,
                        onDismissRequest = { conditionMenuExpanded = false },
                        modifier = Modifier.fillMaxWidth(0.82f)
                    ) {
                        conditionOptions.forEach { choice ->
                            DropdownMenuItem(
                                text = { Text(choice, color = palette.textPrimary) },
                                onClick = {
                                    conditionChoice = choice
                                    conditionMenuExpanded = false
                                },
                                colors = MenuDefaults.itemColors(textColor = palette.textPrimary)
                            )
                        }
                    }

                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text(notesLabel) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp),
                        minLines = 2,
                        textStyle = MaterialTheme.typography.bodyLarge.copy(color = palette.textPrimary),
                        colors = fieldColors
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val choice = when {
                        conditionChoice.startsWith("Wrecked", ignoreCase = true) ->
                            EquipmentReportChoice.BROKEN
                        else -> EquipmentReportChoice.OK
                    }
                    onSubmit(equipmentName, choice, notes)
                },
                enabled = options.isNotEmpty() && equipmentName.isNotBlank()
            ) {
                Text("Submit report", color = palette.accent, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = palette.textSecondary)
            }
        }
    )
}
