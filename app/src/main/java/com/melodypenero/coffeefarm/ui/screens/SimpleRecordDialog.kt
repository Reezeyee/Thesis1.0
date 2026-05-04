package com.melodypenero.coffeefarm.ui.screens

import android.app.DatePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale

data class RecordField(
    val label: String,
    val options: List<String> = emptyList()
)

/**
 * Stable id so [RecordField] lists that are re-created every recomposition
 * (e.g. `listOf(RecordField(..., options = sectionNames))` in the parent)
 * do not reset [SimpleRecordDialog] form state. Without this, every parent
 * recomposition looks like a new [fields] instance and the user’s dropdown
 * picks (e.g. Section B) are overwritten by defaults (first option = Section A).
 */
private fun fieldsContentSignature(fields: List<RecordField>): String =
    fields.joinToString("\u0001") { f ->
        f.label + "\u0002" + f.options.joinToString("\u0003")
    }

private fun initialCellForField(field: RecordField, initial: String): String =
    when {
        initial.isNotBlank() -> initial
        field.options.isNotEmpty() -> field.options.first()
        else -> ""
    }

@Composable
fun SimpleRecordDialog(
    title: String,
    fields: List<RecordField>,
    initialValues: List<String> = emptyList(),
    onDismiss: () -> Unit,
    onSave: (List<String>) -> Unit,
    onDelete: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val fieldSignature = fieldsContentSignature(fields)
    // Parent often passes a new [initialValues] list each recomposition; only reset when content changes.
    val initialContentSig = initialValues.joinToString("\u0001")
    // Must populate synchronously: LaunchedEffect runs after first draw, and values[index] in the
    // dialog would throw. Switching Farm Operations tabs with "Add" open changes fieldSignature
    // and recreates the list—first frame would otherwise be empty.
    val values = remember(fieldSignature, initialContentSig) {
        mutableStateListOf<String>().apply {
            fields.forEachIndexed { index, field ->
                add(
                    initialCellForField(
                        field,
                        initialValues.getOrNull(index).orEmpty()
                    )
                )
            }
        }
    }
    val expanded = remember(fieldSignature) {
        mutableStateListOf<Boolean>().apply {
            repeat(fields.size) { add(false) }
        }
    }
    var datePickerIndex by remember(fieldSignature) { mutableStateOf<Int?>(null) }

    fun isDateField(field: RecordField): Boolean {
        return field.label.contains("date", ignoreCase = true)
    }

    fun parseInitialDate(raw: String): LocalDate {
        val value = raw.trim()
        if (value.isBlank()) return LocalDate.now()
        val withYearFormats = listOf(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("MM/dd/yyyy", Locale.getDefault()),
            DateTimeFormatter.ofPattern("MMM d yyyy", Locale.getDefault()),
            DateTimeFormatter.ofPattern("MMM dd yyyy", Locale.getDefault())
        )
        withYearFormats.forEach { formatter ->
            try {
                return LocalDate.parse(value, formatter)
            } catch (_: DateTimeParseException) {
            }
        }
        val currentYear = LocalDate.now().year
        val noYearFormats = listOf("MMM d", "MMM dd")
        noYearFormats.forEach { pattern ->
            try {
                return LocalDate.parse(
                    "$value $currentYear",
                    DateTimeFormatter.ofPattern("$pattern yyyy", Locale.getDefault())
                )
            } catch (_: DateTimeParseException) {
            }
        }
        return LocalDate.now()
    }

    LaunchedEffect(datePickerIndex) {
        val index = datePickerIndex ?: return@LaunchedEffect
        val initial = parseInitialDate(values.getOrElse(index) { "" })
        DatePickerDialog(
            context,
            { _, year, month, dayOfMonth ->
                val selected = LocalDate.of(year, month + 1, dayOfMonth)
                values[index] = selected.format(DateTimeFormatter.ISO_LOCAL_DATE)
                datePickerIndex = null
            },
            initial.year,
            initial.monthValue - 1,
            initial.dayOfMonth
        ).apply {
            setOnCancelListener { datePickerIndex = null }
            setOnDismissListener { datePickerIndex = null }
            show()
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF2D211A),
        title = {
            Text(
                text = title,
                color = Color(0xFFF4EDE6),
                fontWeight = FontWeight.SemiBold
            )
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                fields.forEachIndexed { index, field ->
                    if (field.options.isEmpty() && !isDateField(field)) {
                        OutlinedTextField(
                            value = values[index],
                            onValueChange = { values[index] = it },
                            label = { Text(field.label) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color(0xFFF4EDE6),
                                unfocusedTextColor = Color(0xFFF4EDE6),
                                focusedBorderColor = Color(0xFF84B626),
                                unfocusedBorderColor = Color(0xFF5A463A),
                                focusedLabelColor = Color(0xFF84B626),
                                unfocusedLabelColor = Color(0xFFB8A99E),
                                cursorColor = Color(0xFF84B626)
                            )
                        )
                    } else if (isDateField(field)) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp)
                        ) {
                            OutlinedTextField(
                                value = values[index],
                                onValueChange = {},
                                readOnly = true,
                                label = { Text(field.label) },
                                trailingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.CalendarMonth,
                                        contentDescription = "Open calendar",
                                        tint = Color(0xFF84B626)
                                    )
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedTextColor = Color(0xFFF4EDE6),
                                    unfocusedTextColor = Color(0xFFF4EDE6),
                                    focusedBorderColor = Color(0xFF84B626),
                                    unfocusedBorderColor = Color(0xFF5A463A),
                                    focusedLabelColor = Color(0xFF84B626),
                                    unfocusedLabelColor = Color(0xFFB8A99E)
                                )
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(56.dp)
                                    .clickable {
                                        if (datePickerIndex == null) {
                                            datePickerIndex = index
                                        }
                                    }
                            )
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp)
                        ) {
                            OutlinedTextField(
                                value = values[index],
                                onValueChange = {},
                                readOnly = true,
                                label = { Text(field.label) },
                                trailingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.ArrowDropDown,
                                        contentDescription = "Open options",
                                        tint = Color(0xFF84B626)
                                    )
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedTextColor = Color(0xFFF4EDE6),
                                    unfocusedTextColor = Color(0xFFF4EDE6),
                                    focusedBorderColor = Color(0xFF84B626),
                                    unfocusedBorderColor = Color(0xFF5A463A),
                                    focusedLabelColor = Color(0xFF84B626),
                                    unfocusedLabelColor = Color(0xFFB8A99E)
                                )
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(56.dp)
                                    .clickable { expanded[index] = true }
                            )
                            DropdownMenu(
                                expanded = expanded[index],
                                onDismissRequest = { expanded[index] = false },
                                modifier = Modifier
                                    .heightIn(max = 260.dp)
                                    .background(Color(0xFF2D211A))
                            ) {
                                field.options.forEach { option ->
                                    DropdownMenuItem(
                                        text = { Text(option, color = Color(0xFFF4EDE6)) },
                                        colors = MenuDefaults.itemColors(
                                            textColor = Color(0xFFF4EDE6)
                                        ),
                                        onClick = {
                                            values[index] = option
                                            expanded[index] = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(values.toList())
                    onDismiss()
                },
                enabled = values.all { it.isNotBlank() }
            ) {
                Text("Save", color = Color(0xFF84B626), fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = Color(0xFFB8A99E)) }
        },
        icon = {
            if (onDelete != null) {
                TextButton(onClick = {
                    onDelete()
                    onDismiss()
                }) {
                    Text("Delete", color = Color(0xFFFF7A70), fontWeight = FontWeight.SemiBold)
                }
            }
        }
    )
}
