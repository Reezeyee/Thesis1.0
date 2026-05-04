package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Paid
import androidx.compose.material.icons.filled.Percent
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import android.widget.Toast
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.data.store.AttendanceRecord
import com.melodypenero.coffeefarm.data.store.AppState
import com.melodypenero.coffeefarm.data.store.ExpenseRecord
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.data.store.MaintenanceRecord
import com.melodypenero.coffeefarm.data.store.PayrollRecord
import com.melodypenero.coffeefarm.data.store.SaleRecord
import com.melodypenero.coffeefarm.domain.FarmFinance
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

private const val PROFIT_LINK_NONE = "(None)"

private enum class PayrollListFilter { All, Paid, Pending }

@Composable
fun ProfitScreen(
    initialTab: String? = null,
    onInitialTabHandled: () -> Unit = {}
) {
    val store = LocalAppStore.current
    val state by store.appState
    val tabs = listOf("Overview", "Sales", "Expenses", "Payroll", "Buyers", "Reports")
    var activeTab by remember { mutableStateOf(initialTab ?: "Overview") }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingIndex by remember { mutableStateOf<Int?>(null) }
    androidx.compose.runtime.LaunchedEffect(initialTab) {
        if (!initialTab.isNullOrBlank()) {
            activeTab = initialTab
            onInitialTabHandled()
        }
    }

    val revenue = FarmFinance.totalIncome(state.sales)
    val effectiveLaborExpense = FarmFinance.totalPaidPayroll(state.payroll)
    val laborPendingAmount = FarmFinance.totalPendingPayroll(state.payroll)
    val totalExpenses = FarmFinance.totalExpenses(state)
    val netProfit = FarmFinance.netProfit(state)
    val totalHarvestKg = FarmFinance.totalHarvestKg(state.cherryHarvests)
    val profitPerKg = FarmFinance.profitPerKg(state)
    val margin = if (revenue > 0) ((netProfit.toDouble() / revenue.toDouble()) * 100.0) else 0.0
    val context = LocalContext.current
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val pageBackground = if (isDarkPalette) Color(0xFF1A120D) else Color(0xFFF5F5F5)
    val tabContainer = if (isDarkPalette) Color(0xFF1F140F) else Color(0xFFFFFFFF)
    val tabContent = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val tabDivider = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val tabUnselected = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(pageBackground)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            ScrollableTabRow(
                selectedTabIndex = tabs.indexOf(activeTab).coerceAtLeast(0),
                edgePadding = 12.dp,
                containerColor = tabContainer,
                contentColor = tabContent,
                divider = {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .background(tabDivider)
                    )
                }
            ) {
                tabs.forEach { tab ->
                    Tab(
                        selected = tab == activeTab,
                        onClick = { activeTab = tab },
                        text = {
                            Text(
                                tab,
                                color = if (tab == activeTab) Color(0xFF84B626) else tabUnselected,
                                fontWeight = if (tab == activeTab) FontWeight.SemiBold else FontWeight.Medium
                            )
                        }
                    )
                }
            }

            when (activeTab) {
                "Overview" -> OverviewTab(
                    revenue = revenue,
                    expenses = totalExpenses,
                    netProfit = netProfit,
                    margin = margin,
                    sales = state.sales,
                    expenseRecords = state.expenses,
                    payrollRecords = state.payroll,
                    maintenanceRecords = state.maintenanceLogs,
                    laborPaidAmount = effectiveLaborExpense,
                    laborPendingAmount = laborPendingAmount,
                    totalHarvestKg = totalHarvestKg,
                    profitPerKg = profitPerKg
                )
                "Sales" -> SalesTab(state.sales) { editingIndex = it }
                "Expenses" -> ExpensesTab(state.expenses) { editingIndex = it }
                "Payroll" -> PayrollTab(state.payroll) { editingIndex = it }
                "Buyers" -> BuyersTab(state.sales)
                "Reports" -> ReportsTab(state)
            }
        }

        if (activeTab in listOf("Sales", "Expenses", "Payroll")) {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(18.dp),
                containerColor = Color(0xFF84B626),
                contentColor = Color(0xFF111111)
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add")
            }
        }
    }

    val productTypeOptions = listOf("Cherry", "Green bean", "Roasted")
    val expenseCategoryOptions = listOf(
        "Labor", "Fertilizer", "Equipment", "Maintenance", "Transport",
        "Packaging", "Utilities", "Land", "Processing", "Other"
    )

    if (showAddDialog) {
        val workerOptions = state.workers.map { it.name }
        val batchOptions = listOf(PROFIT_LINK_NONE) + state.batches.map { it.batchId }
        val equipmentOptions = listOf(PROFIT_LINK_NONE) + state.equipment.map { it.name }
        val fields = when (activeTab) {
            "Sales" -> listOf(
                RecordField("Buyer name"),
                RecordField("Product type", options = productTypeOptions),
                RecordField("Link batch (Cherry)", options = batchOptions),
                RecordField("Notes"),
                RecordField("Date"),
                RecordField("Quantity (kg)"),
                RecordField("Price per kg (₱)")
            )
            "Expenses" -> listOf(
                RecordField("Category", options = expenseCategoryOptions),
                RecordField("Link equipment (optional)", options = equipmentOptions),
                RecordField("Description"),
                RecordField("Amount (₱)"),
                RecordField("Date")
            )
            else -> listOf(
                RecordField("Worker name", options = workerOptions),
                RecordField("Worker ID (optional, or auto from Farm Ops)"),
                RecordField("Hourly rate (₱); leave 0 for role default"),
                RecordField("Period label (e.g. March Week 1)"),
                RecordField("Status", options = listOf("pending", "paid")),
                RecordField("Date")
            )
        }
        SimpleRecordDialog(
            title = "Add $activeTab",
            fields = fields,
            onDismiss = { showAddDialog = false },
            onSave = { values ->
                when (activeTab) {
                    "Sales" -> {
                        val typeKey = productTypeKeyFromLabel(values[1])
                        val qty = parseAmountToDouble(values[5])
                        val price = parseAmountToDouble(values[6])
                        val linkBatch = values[2].trim().takeUnless { it.isBlank() || it == PROFIT_LINK_NONE }.orEmpty()
                        store.addSale(
                            buyer = values[0].trim(),
                            details = values[3].trim(),
                            date = values[4].trim(),
                            total = 0,
                            type = typeKey,
                            quantityKg = qty,
                            pricePerKg = price,
                            linkedBatchId = linkBatch
                        )
                    }
                    "Expenses" -> {
                        val amount = values[3].filter { it.isDigit() }.toIntOrNull() ?: 0
                        val linkEq = values[1].trim().takeUnless { it.isBlank() || it == PROFIT_LINK_NONE }.orEmpty()
                        store.addExpense(
                            values[0],
                            values[2],
                            amount,
                            values.getOrElse(4) { "" },
                            linkedEquipmentName = linkEq
                        )
                    }
                    "Payroll" -> {
                        val hourlyInput = parseAmountToDouble(values[2])
                        val wName = values[0].trim()
                        val pendingAtt = pendingStaffAttendanceForPayroll(state, wName)
                        val hoursInput = pendingAtt?.hoursWorked ?: 0.0
                        val linkedId = pendingAtt?.attendanceId?.trim().orEmpty()
                        if (hoursInput <= 0.0 || linkedId.isEmpty()) {
                            Toast.makeText(
                                context,
                                "No pending worker attendance with hours for this name. Workers log time first; then add payroll here.",
                                Toast.LENGTH_LONG
                            ).show()
                        } else {
                            val wId = values[1].trim().ifBlank {
                                state.workers.find { it.name.equals(wName, ignoreCase = true) }?.workerId?.trim().orEmpty()
                            }
                            val roleRate = state.workers.find { it.name.equals(wName, ignoreCase = true) }?.roleRate ?: ""
                            val hourlyResolved = when {
                                hourlyInput > 0.0 -> hourlyInput
                                else -> FarmFinance.hourlyRateForWorkerRole(roleRate)
                            }
                            store.addPayroll(
                                workerName = wName,
                                period = values[3].trim(),
                                paid = values[4].equals("paid", ignoreCase = true),
                                date = values.getOrElse(5) { "" },
                                workerId = wId,
                                hourlyRate = hourlyResolved,
                                hoursWorked = hoursInput,
                                linkedAttendanceId = linkedId
                            )
                        }
                    }
                }
            }
        )
    }

    editingIndex?.let { index ->
        val workerOptions = state.workers.map { it.name }
        val batchOptionsEdit = listOf(PROFIT_LINK_NONE) + state.batches.map { it.batchId }
        val equipmentOptionsEdit = listOf(PROFIT_LINK_NONE) + state.equipment.map { it.name }
        val fields = when (activeTab) {
            "Sales" -> listOf(
                RecordField("Buyer name"),
                RecordField("Product type", productTypeOptions),
                RecordField("Link batch (Cherry)", batchOptionsEdit),
                RecordField("Notes"),
                RecordField("Date"),
                RecordField("Quantity (kg)"),
                RecordField("Price per kg (₱)")
            )
            "Expenses" -> listOf(
                RecordField("Category", expenseCategoryOptions),
                RecordField("Link equipment (optional)", equipmentOptionsEdit),
                RecordField("Description"),
                RecordField("Amount (₱)"),
                RecordField("Date")
            )
            else -> listOf(
                RecordField("Worker name", workerOptions),
                RecordField("Worker ID (optional, or auto from Farm Ops)"),
                RecordField("Hourly rate (₱); leave 0 for role default"),
                RecordField("Period label"),
                RecordField("Status", listOf("pending", "paid")),
                RecordField("Date")
            )
        }
        val initial = when (activeTab) {
            "Sales" -> state.sales.getOrNull(index)?.let {
                val label = productTypeLabelForEdit(it.type)
                val qty = if (it.quantityKg > 0.0) it.quantityKg.toString() else ""
                val price = if (it.pricePerKg > 0.0) it.pricePerKg.toString() else ""
                val batchSel = it.linkedBatchId.trim().ifBlank { PROFIT_LINK_NONE }
                listOf(it.buyer, label, batchSel, it.details, it.date, qty, price)
            } ?: emptyList()
            "Expenses" -> state.expenses.getOrNull(index)?.let {
                val eq = it.linkedEquipmentName.trim().ifBlank { PROFIT_LINK_NONE }
                listOf(it.category, eq, it.description, it.amount.toString(), it.date.orEmpty())
            } ?: emptyList()
            else -> state.payroll.getOrNull(index)?.let {
                val hourlyCell = when {
                    it.hourlyRate > 0.0 -> it.hourlyRate.toString()
                    it.dailyRate > 0.0 -> it.dailyRate.toString()
                    else -> ""
                }
                listOf(
                    it.workerName,
                    it.workerId,
                    hourlyCell,
                    it.period,
                    if (it.paid) "paid" else "pending",
                    it.date.orEmpty()
                )
            } ?: emptyList()
        }
        SimpleRecordDialog(
            title = "Edit $activeTab",
            fields = fields,
            initialValues = initial,
            onDismiss = { editingIndex = null },
            onSave = { values ->
                when (activeTab) {
                    "Sales" -> {
                        val typeKey = productTypeKeyFromLabel(values[1])
                        val qty = parseAmountToDouble(values[5])
                        val price = parseAmountToDouble(values[6])
                        val linkBatch = values[2].trim().takeUnless { it.isBlank() || it == PROFIT_LINK_NONE }.orEmpty()
                        store.updateSale(
                            index = index,
                            buyer = values[0].trim(),
                            details = values[3].trim(),
                            date = values[4].trim(),
                            total = 0,
                            type = typeKey,
                            quantityKg = qty,
                            pricePerKg = price,
                            linkedBatchId = linkBatch
                        )
                    }
                    "Expenses" -> {
                        val amount = values[3].filter { it.isDigit() }.toIntOrNull() ?: 0
                        val linkEq = values[1].trim().takeUnless { it.isBlank() || it == PROFIT_LINK_NONE }.orEmpty()
                        store.updateExpense(
                            index = index,
                            category = values[0],
                            description = values[2],
                            amount = amount,
                            date = values.getOrElse(4) { "" },
                            linkedEquipmentName = linkEq
                        )
                    }
                    else -> {
                        val hourlyInput = parseAmountToDouble(values[2])
                        val wName = values[0].trim()
                        val prev = state.payroll.getOrNull(index)
                        if (prev != null) {
                            val linked = (prev.linkedAttendanceId ?: "").trim()
                            val hoursInput = if (linked.isNotEmpty()) {
                                state.attendance.find { (it.attendanceId ?: "").trim() == linked }?.hoursWorked
                                    ?: prev.hoursWorked
                            } else {
                                prev.hoursWorked
                            }
                            val wId = values[1].trim().ifBlank {
                                state.workers.find { it.name.equals(wName, ignoreCase = true) }?.workerId?.trim().orEmpty()
                            }
                            val roleRate = state.workers.find { it.name.equals(wName, ignoreCase = true) }?.roleRate ?: ""
                            val hourlyResolved = when {
                                hourlyInput > 0.0 -> hourlyInput
                                else -> FarmFinance.hourlyRateForWorkerRole(roleRate)
                            }
                            store.updatePayroll(
                                index = index,
                                workerName = wName,
                                period = values[3].trim(),
                                paid = values[4].equals("paid", ignoreCase = true),
                                date = values.getOrElse(5) { "" },
                                workerId = wId,
                                hourlyRate = hourlyResolved,
                                hoursWorked = hoursInput
                            )
                        }
                    }
                }
            },
            onDelete = {
                when (activeTab) {
                    "Sales" -> store.deleteSale(index)
                    "Expenses" -> store.deleteExpense(index)
                    else -> store.deletePayroll(index)
                }
            }
        )
    }
}

private fun pendingStaffAttendanceForPayroll(state: AppState, workerNameTrimmed: String): AttendanceRecord? =
    state.attendance.firstOrNull { a ->
        a.submittedByStaff && a.awaitingPayrollLine &&
            a.workerName.trim().equals(workerNameTrimmed.trim(), ignoreCase = true) &&
            (a.hoursWorked ?: 0.0) > 0
    }

@Composable
private fun OverviewTab(
    revenue: Int,
    expenses: Int,
    netProfit: Int,
    margin: Double,
    sales: List<SaleRecord>,
    expenseRecords: List<ExpenseRecord>,
    payrollRecords: List<PayrollRecord>,
    maintenanceRecords: List<MaintenanceRecord>,
    laborPaidAmount: Int,
    laborPendingAmount: Int,
    totalHarvestKg: Double,
    profitPerKg: Double
) {
    val store = LocalAppStore.current
    val appState by store.appState
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    val now = YearMonth.now()
    val monthWindow = (5 downTo 0).map { now.minusMonths(it.toLong()) }
    val monthLabels = monthWindow.map {
        it.atDay(1).format(DateTimeFormatter.ofPattern("MMM", Locale.getDefault()))
    }
    val revenueSeries = monthWindow.map { month ->
        sales.filter { FarmFinance.parseToYearMonth(it.date) == month }
            .sumOf { FarmFinance.saleLineTotal(it) }
            .toFloat()
    }
    val expenseSeries = monthWindow.map { month ->
        val operating = expenseRecords.filter { FarmFinance.parseToYearMonth(it.date.orEmpty()) == month }.sumOf { it.amount }
        val payroll = payrollRecords
            .filter { it.paid && FarmFinance.parseToYearMonth(it.date.orEmpty()) == month }
            .sumOf { FarmFinance.payrollLineAmount(it) }
        val maintenance = maintenanceRecords.filter { FarmFinance.parseToYearMonth(it.date.orEmpty()) == month }
            .sumOf { FarmFinance.parseMoneyAmount(it.costText) }
        (operating + payroll + maintenance).toFloat()
    }
    val profitSeries = revenueSeries.zip(expenseSeries) { rev, exp -> rev - exp }
    val dailySeries = remember(appState) { FarmFinance.dailyNetSeriesLastDays(appState, 7) }
    val dayLabels = dailySeries.map { (d, _) -> d.dayOfMonth.toString() }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProfitStatCard("Total income", "₱${"%,d".format(revenue)}", Icons.Default.TrendingUp, Modifier.weight(1f))
                ProfitStatCard("Total expenses", "₱${"%,d".format(expenses)}", Icons.Default.TrendingDown, Modifier.weight(1f))
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    "Labor (payroll, disbursed): ₱${"%,d".format(laborPaidAmount)}",
                    color = subtitleColor,
                    style = MaterialTheme.typography.bodySmall
                )
                if (laborPendingAmount > 0) {
                    Text(
                        "Open payroll (pending): ₱${"%,d".format(laborPendingAmount)}",
                        color = subtitleColor,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProfitStatCard("Net profit", "₱${"%,d".format(netProfit)}", Icons.Default.Paid, Modifier.weight(1f))
                ProfitStatCard("Margin", "${"%.1f".format(margin)}%", Icons.Default.Percent, Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProfitStatCard(
                    "Profit / kg",
                    if (totalHarvestKg > 0) "₱${"%,.0f".format(profitPerKg)}" else "—",
                    Icons.Default.PointOfSale,
                    Modifier.weight(1f)
                )
                ProfitStatCard(
                    "Harvest vol.",
                    if (totalHarvestKg > 0) "${"%.1f".format(totalHarvestKg)} kg" else "0 kg",
                    Icons.Default.ReceiptLong,
                    Modifier.weight(1f)
                )
            }
        }
        item {
            Text(
                "Daily net (last 7 days)",
                color = titleColor,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }
        item {
            ChartContainer {
                MiniLineChart(
                    months = dayLabels,
                    values = dailySeries.map { it.second.toFloat() }
                )
            }
        }
        item {
            Text(
                "Income – last 6 months",
                color = titleColor,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
        item {
            ChartContainer {
                MiniBarChart(months = monthLabels, values = revenueSeries)
            }
        }
        item {
            Text(
                "Monthly profit trend",
                color = titleColor,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }
        item {
            ChartContainer {
                MiniLineChart(months = monthLabels, values = profitSeries)
            }
        }
    }
}

private fun productTypeKeyFromLabel(label: String): String = when (label.trim().lowercase()) {
    "cherry" -> "cherry"
    "green bean" -> "green_bean"
    "roasted" -> "roasted"
    else -> label.trim().lowercase().replace(" ", "_")
}

private fun productTypeLabelForEdit(type: String): String = when (type.trim().lowercase()) {
    "cherry" -> "Cherry"
    "green_bean" -> "Green bean"
    "roasted" -> "Roasted"
    "buyer", "cafe" -> "Cherry"
    else -> if (type.isBlank()) "Cherry" else type.replaceFirstChar { c -> c.uppercase() }
}

private fun parseAmountToDouble(s: String): Double =
    s.replace(",", "").filter { it.isDigit() || it == '.' }.toDoubleOrNull() ?: 0.0

@Composable
private fun SalesTab(sales: List<SaleRecord>, onEdit: (Int) -> Unit) {
    val store = LocalAppStore.current
    val appState by store.appState
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(sales) { index, sale ->
            val line = FarmFinance.saleLineTotal(sale)
            val typeLabel = FarmFinance.productTypeLabel(sale.type)
            val batchStatus = sale.linkedBatchId.trim().takeIf { it.isNotEmpty() }?.let { bid ->
                appState.batches.find { it.batchId == bid }?.status
            }
            val batchLine = sale.linkedBatchId.trim().takeIf { it.isNotEmpty() }?.let { bid ->
                if (batchStatus != null) "Batch: $bid ($batchStatus)" else "Batch: $bid"
            }
            val qtyLine = if (sale.quantityKg > 0.0 && sale.pricePerKg > 0.0) {
                "${"%.1f".format(sale.quantityKg)} kg × ₱${"%,.0f".format(sale.pricePerKg)}"
            } else {
                "Amount entered as total"
            }
            Card(
                modifier = Modifier.clickable { onEdit(index) },
                colors = CardDefaults.cardColors(containerColor = cardColor),
                border = BorderStroke(1.dp, borderColor)
            ) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(sale.buyer, color = titleColor, fontWeight = FontWeight.SemiBold)
                            if (batchLine != null) {
                                Text(batchLine, color = Color(0xFF84B626), style = MaterialTheme.typography.bodySmall)
                            }
                            if (sale.details.isNotBlank()) {
                                Text(sale.details, color = subtitleColor, style = MaterialTheme.typography.bodySmall)
                            }
                            Text(qtyLine, color = subtitleColor, style = MaterialTheme.typography.bodySmall)
                            Text(sale.date, color = subtitleColor, style = MaterialTheme.typography.bodySmall)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("₱${"%,d".format(line)}", color = Color(0xFF84B626), fontWeight = FontWeight.Bold)
                            StatusChip(typeLabel, "blue")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ExpensesTab(expenses: List<ExpenseRecord>, onEdit: (Int) -> Unit) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(expenses) { index, e ->
            val equip = e.linkedEquipmentName.trim()
            val datePart = e.date.orEmpty()
            val sub = buildString {
                if (equip.isNotEmpty()) append("Equipment: $equip")
                if (e.description.isNotBlank()) {
                    if (isNotEmpty()) append(" · ")
                    append(e.description)
                }
                if (datePart.isNotBlank()) {
                    if (isNotEmpty()) append(" · ")
                    append(datePart)
                }
            }
            Card(
                modifier = Modifier.clickable { onEdit(index) },
                colors = CardDefaults.cardColors(containerColor = cardColor),
                border = BorderStroke(1.dp, borderColor)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.CreditCard, contentDescription = null, tint = Color(0xFF84B626))
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 8.dp)
                    ) {
                        Text(e.category, color = titleColor, fontWeight = FontWeight.SemiBold)
                        if (sub.isNotBlank()) {
                            Text(sub, color = subtitleColor, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Text("-₱${"%,d".format(e.amount)}", color = Color(0xFFFF7A70), fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun PayrollTab(payroll: List<PayrollRecord>, onEdit: (Int) -> Unit) {
    var listFilter by remember { mutableStateOf(PayrollListFilter.All) }
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    val chipUnselected = if (isDarkPalette) Color(0xFF8A7B6F) else Color(0xFF5D4E45)
    val nPaid = payroll.count { it.paid }
    val nPending = payroll.size - nPaid
    val filtered = remember(payroll, listFilter) {
        payroll.mapIndexed { index, p -> index to p }.filter { (_, p) ->
            when (listFilter) {
                PayrollListFilter.All -> true
                PayrollListFilter.Paid -> p.paid
                PayrollListFilter.Pending -> !p.paid
            }
        }
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = listFilter == PayrollListFilter.All,
                    onClick = { listFilter = PayrollListFilter.All },
                    label = { Text("All (${payroll.size})", color = if (listFilter == PayrollListFilter.All) titleColor else chipUnselected) }
                )
                FilterChip(
                    selected = listFilter == PayrollListFilter.Paid,
                    onClick = { listFilter = PayrollListFilter.Paid },
                    label = { Text("Paid ($nPaid)", color = if (listFilter == PayrollListFilter.Paid) titleColor else chipUnselected) }
                )
                FilterChip(
                    selected = listFilter == PayrollListFilter.Pending,
                    onClick = { listFilter = PayrollListFilter.Pending },
                    label = { Text("Pending ($nPending)", color = if (listFilter == PayrollListFilter.Pending) titleColor else chipUnselected) }
                )
            }
        }
        if (payroll.isEmpty()) {
            item {
                Text(
                    "No payroll yet. Hours come from worker attendance (same name, pending payroll). Add a line here after workers log time from their account; mark Paid after disburse.",
                    color = subtitleColor,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        } else if (filtered.isEmpty()) {
            item {
                Text(
                    "No entries in this view.",
                    color = subtitleColor,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
        items(filtered.size) { i ->
            val (index, p) = filtered[i]
            val line = FarmFinance.payrollLineAmount(p)
            val rateLine = when {
                p.hourlyRate > 0.0 && p.hoursWorked > 0.0 ->
                    "₱${"%,.0f".format(p.hourlyRate)} × ${"%.1f".format(p.hoursWorked)} h"
                p.dailyRate > 0.0 && p.daysWorked > 0 ->
                    "₱${"%,.0f".format(p.dailyRate)} × ${p.daysWorked} d"
                else -> p.period
            }
            Card(
                modifier = Modifier.clickable { onEdit(index) },
                colors = CardDefaults.cardColors(containerColor = cardColor),
                border = BorderStroke(1.dp, borderColor)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(p.workerName, color = titleColor, fontWeight = FontWeight.SemiBold)
                        if (p.workerId.isNotBlank()) {
                            Text("ID: ${p.workerId}", color = subtitleColor, style = MaterialTheme.typography.bodySmall)
                        }
                        Text(rateLine, color = subtitleColor, style = MaterialTheme.typography.bodySmall)
                        if (!p.date.isNullOrBlank()) {
                            Text(p.date, color = subtitleColor, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("₱${"%,d".format(line)}", color = titleColor, fontWeight = FontWeight.Bold)
                        StatusChip(if (p.paid) "Paid" else "Pending", if (p.paid) "green" else "amber")
                    }
                }
            }
        }
    }
}

@Composable
private fun ReportsTab(state: AppState) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    val harvestVol = FarmFinance.totalHarvestKg(state.cherryHarvests)
    val income = FarmFinance.totalIncome(state.sales)
    val expenses = FarmFinance.totalExpenses(state)
    val best = FarmFinance.bestSellingProductType(state.sales)
    val high = FarmFinance.highestExpenseCategory(state.expenses)
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Summary reports", color = titleColor, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        }
        item {
            Text("Total harvest volume: ${"%.1f".format(harvestVol)} kg", color = subtitleColor)
        }
        item {
            Text(
                "Income vs expenses: ₱${"%,d".format(income)} income, ₱${"%,d".format(expenses)} expenses (net ₱${"%,d".format(income - expenses)})",
                color = subtitleColor
            )
        }
        item {
            Text(
                "Best selling product (by revenue): ${best ?: "—"}",
                color = subtitleColor
            )
        }
        item {
            Text(
                "Highest expense category: ${high?.first ?: "—"} (₱${"%,d".format(high?.second ?: 0)})",
                color = subtitleColor
            )
        }
        item {
            val maint = FarmFinance.totalMaintenanceExpenses(state.maintenanceLogs)
            Text(
                "Equipment module: ${state.maintenanceLogs.size} maintenance records (₱${"%,d".format(maint)} toward total expenses). " +
                    "Farm Operations: ${state.workers.size} workers, ${state.sections.size} sections. " +
                    "Cherry: ${state.batches.size} batches, ${"%.1f".format(FarmFinance.totalHarvestKg(state.cherryHarvests))} kg recorded harvest.",
                color = subtitleColor
            )
        }
    }
}

@Composable
private fun BuyersTab(sales: List<SaleRecord>) {
    val buyers = sales.groupBy { it.buyer }
        .map { (name, list) -> Triple(name, "${list.size} sales", list.sumOf { FarmFinance.saleLineTotal(it) }) }
        .sortedByDescending { it.third }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(buyers) { b ->
            ProfitRowCard(
                icon = Icons.Default.AccountBalanceWallet,
                title = b.first,
                subtitle = b.second,
                trailing = "₱${"%,d".format(b.third)}",
                trailingColor = Color(0xFF84B626)
            )
        }
    }
}

@Composable
private fun ProfitStatCard(label: String, value: String, icon: ImageVector, modifier: Modifier = Modifier) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val labelColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    val valueColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, borderColor)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(label, color = labelColor)
                Icon(icon, contentDescription = null, tint = Color(0xFF84B626))
            }
            Text(value, color = valueColor, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineSmall)
        }
    }
}

@Composable
private fun ProfitRowCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    trailing: String,
    trailingColor: Color,
    onClick: () -> Unit = {}
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    Card(
        modifier = Modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, borderColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, tint = Color(0xFF84B626))
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 8.dp)
            ) {
                Text(title, color = titleColor, fontWeight = FontWeight.SemiBold)
                Text(subtitle, color = subtitleColor)
            }
            Text(trailing, color = trailingColor, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun StatusChip(label: String, tone: String) {
    val (bg, fg) = when (tone) {
        "green" -> Color(0xFF234917) to Color(0xFF9AD45E)
        "amber" -> Color(0xFF4D2F0E) to Color(0xFFF3B562)
        "blue" -> Color(0xFF133A5E) to Color(0xFF6AB0FF)
        else -> Color(0xFF3B3B3B) to Color(0xFFDADADA)
    }
    Surface(color = bg, shape = MaterialTheme.shapes.extraLarge) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            color = fg,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun ChartContainer(content: @Composable () -> Unit) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    Card(
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, borderColor)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(210.dp)
                .padding(12.dp)
        ) {
            content()
        }
    }
}

@Composable
private fun MiniBarChart(months: List<String>, values: List<Float>) {
    val max = (values.maxOrNull() ?: 1f).coerceAtLeast(1f)
    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
        ) {
            values.forEach { v ->
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 4.dp),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height((120f * (v / max)).dp)
                            .background(Color(0xFF6B9620), MaterialTheme.shapes.small)
                    )
                }
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            months.forEach { m ->
                Text(m, color = Color(0xFFB8A99E), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun MiniLineChart(months: List<String>, values: List<Float>) {
    val minV = values.minOrNull() ?: 0f
    val maxV = values.maxOrNull() ?: 1f
    val span = (maxV - minV).coerceAtLeast(1f)
    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            val stepX = if (values.size > 1) size.width / (values.size - 1) else size.width
            val points = values.mapIndexed { index, value ->
                val x = index * stepX
                val y = size.height - (size.height * ((value - minV) / span))
                Offset(x, y)
            }
            for (i in 0 until points.lastIndex) {
                drawLine(
                    color = Color(0xFFFF6D57),
                    start = points[i],
                    end = points[i + 1],
                    strokeWidth = 6f,
                    cap = StrokeCap.Round
                )
            }
            points.forEach { p ->
                drawCircle(Color(0xFF2D211A), radius = 9f, center = p)
                drawCircle(Color(0xFFFF6D57), radius = 6f, center = p, style = Stroke(width = 4f))
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            months.forEach { m ->
                Text(m, color = Color(0xFFB8A99E), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

