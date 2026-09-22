package com.melodypenero.coffeefarm.domain

import com.melodypenero.coffeefarm.data.store.AppState
import com.melodypenero.coffeefarm.data.store.CherryHarvestRecord
import com.melodypenero.coffeefarm.data.store.ExpenseRecord
import com.melodypenero.coffeefarm.data.store.MaintenanceRecord
import com.melodypenero.coffeefarm.data.store.PayrollRecord
import com.melodypenero.coffeefarm.data.store.SaleRecord
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import kotlin.math.roundToInt
import java.util.Locale

/**
 * Central finance and analytics for the coffee farm: income, expenses, profit, per-kg metrics,
 * and decision-support heuristics. Totals recompute whenever [AppState] changes (Compose observes [appState]).
 */
object FarmFinance {

    /** Standard paid shift: 8:00 AM-5:00 PM minus a 1-hour unpaid lunch = 8 paid regular hours/day. */
    const val STANDARD_SHIFT_HOURS = 8.0

    /** Overtime pay bonus: hours worked beyond [STANDARD_SHIFT_HOURS] are paid at hourlyRate x this. */
    const val OVERTIME_MULTIPLIER = 1.25

    fun saleLineTotal(s: SaleRecord): Int {
        if (s.quantityKg > 0.0 && s.pricePerKg > 0.0) {
            return (s.quantityKg * s.pricePerKg).roundToInt()
        }
        return s.total
    }

    fun parseHarvestKg(h: CherryHarvestRecord): Double {
        val t = h.weightText.filter { it.isDigit() || it == '.' }
        return t.toDoubleOrNull() ?: 0.0
    }

    fun totalHarvestKg(harvests: List<CherryHarvestRecord>): Double =
        harvests.sumOf { parseHarvestKg(it) }

    fun totalIncome(sales: List<SaleRecord>): Int = sales.sumOf { saleLineTotal(it) }

    fun totalOperatingExpenses(expenses: List<ExpenseRecord>): Int = expenses.sumOf { it.amount }

    fun totalMaintenanceExpenses(logs: List<MaintenanceRecord>): Int =
        logs.sumOf { parseMoneyAmount(it.costText) }

    fun parseMoneyAmount(raw: String): Int {
        val cleaned = raw.trim().replace(",", "")
        val numeric = cleaned.filter { it.isDigit() || it == '.' }
        return (numeric.toDoubleOrNull() ?: 0.0).roundToInt()
    }

    /** Sum of every deduction line on a payroll record (e.g. broken equipment charged against pay). */
    fun payrollDeductionsTotal(p: PayrollRecord): Int = p.deductions?.sumOf { it.amount } ?: 0

    /**
     * Line total for display; for expenses only [payrollAmountIfPaid] is used.
     * When [PayrollRecord.regularHours] / [PayrollRecord.overtimeHours] are present, overtime
     * hours are paid at hourlyRate x [OVERTIME_MULTIPLIER]; older rows without a split fall back
     * to the flat hourlyRate x hoursWorked (or dailyRate x daysWorked) behavior unchanged. Any
     * deduction lines (see [payrollDeductionsTotal]) are then subtracted, floored at 0.
     */
    fun payrollLineAmount(p: PayrollRecord): Int {
        val regular = p.regularHours
        val overtime = p.overtimeHours
        val hasSplit = (regular != null && regular > 0.0) || (overtime != null && overtime > 0.0)
        val gross = when {
            p.hourlyRate > 0.0 && hasSplit -> {
                val reg = regular ?: 0.0
                val ot = overtime ?: 0.0
                (p.hourlyRate * reg + p.hourlyRate * OVERTIME_MULTIPLIER * ot).roundToInt()
            }
            p.hourlyRate > 0.0 && p.hoursWorked > 0.0 -> (p.hourlyRate * p.hoursWorked).roundToInt()
            p.dailyRate > 0.0 && p.daysWorked > 0 -> (p.dailyRate * p.daysWorked).roundToInt()
            else -> p.amount
        }
        return (gross - payrollDeductionsTotal(p)).coerceAtLeast(0)
    }

    /** True for the Maintenance role. Maintenance workers get the repair-jobs screens in the app. */
    fun isMaintenanceRole(roleRate: String): Boolean = roleRate.trim().lowercase().contains("maintenance")

    /** Roles an admin can assign to a worker (fixed list, no free-text "Other"). Keep in sync with the website's WORKER_ROLES. */
    val WORKER_ROLES = listOf("Picker", "Maintenance", "Farm Assist")

    /**
     * Official ₱/hour by worker role (Farm Ops role picker). A role with no fixed rate maps to 0 (enter manually in payroll).
     */
    fun hourlyRateForWorkerRole(roleRate: String): Double {
        val key = roleRate.trim().lowercase()
        return when {
            key == "picker" || key.contains("harvester") -> 50.0
            key.contains("farm assist") -> 150.0
            key.contains("maintenance") -> 180.0
            else -> 0.0
        }
    }

    /**
     * Parses "HH:mm" or "H:mm" (24h). Returns hours duration vs [clockOut], or null if invalid.
     * If end is before start, assumes overnight shift (adds 24h to end).
     */
    fun computeHoursFromClock(clockIn: String, clockOut: String): Double? {
        val start = parseClockToMinutes(clockIn) ?: return null
        val end = parseClockToMinutes(clockOut) ?: return null
        var mins = end - start
        if (mins < 0) mins += 24 * 60
        if (mins <= 0) return null
        return mins / 60.0
    }

    /**
     * Splits [totalHours] into (regularHours, overtimeHours) against [STANDARD_SHIFT_HOURS].
     * Returns null when there is nothing to split yet (null or non-positive hours), so callers can
     * tell "not clocked out yet" apart from "worked zero hours."
     */
    fun splitRegularAndOvertimeHours(totalHours: Double?): Pair<Double, Double>? {
        val hours = totalHours ?: return null
        if (hours <= 0.0) return null
        val regular = minOf(hours, STANDARD_SHIFT_HOURS)
        val overtime = maxOf(0.0, hours - STANDARD_SHIFT_HOURS)
        return regular to overtime
    }

    /** Splits the hours between a clock-in/clock-out pair into (regularHours, overtimeHours). */
    fun splitRegularAndOvertimeFromClock(clockIn: String, clockOut: String): Pair<Double, Double>? {
        val hours = computeHoursFromClock(clockIn, clockOut) ?: return null
        return splitRegularAndOvertimeHours(hours)
    }

    /** e.g. "8.00 h regular + 1.50 h overtime (×1.25 rate)", or just "8.00 h regular" with no overtime. */
    fun formatHoursBreakdown(regularHours: Double?, overtimeHours: Double?): String? {
        val reg = regularHours ?: return null
        val ot = overtimeHours ?: 0.0
        val base = String.format(Locale.getDefault(), "%.2f h regular", reg)
        if (ot <= 0.0) return base
        val otStr = String.format(Locale.getDefault(), "%.2f", ot)
        val multiplierStr = String.format(Locale.getDefault(), "%.2f", OVERTIME_MULTIPLIER)
        return "$base + $otStr h overtime (×$multiplierStr rate)"
    }

    /** Convenience overload: splits [totalHours] first, then formats the breakdown. */
    fun formatHoursBreakdown(totalHours: Double?): String? {
        val split = splitRegularAndOvertimeHours(totalHours) ?: return null
        return formatHoursBreakdown(split.first, split.second)
    }

    /** Hour and minute for Android [android.app.TimePickerDialog] (24-hour); defaults if [raw] is invalid. */
    fun clockHourMinuteForPicker(raw: String, defaultHour: Int = 8, defaultMinute: Int = 0): Pair<Int, Int> {
        val total = parseClockToMinutes(raw.trim()) ?: return defaultHour to defaultMinute
        return (total / 60) to (total % 60)
    }

    /** Displays a parsed time as HH:mm (24h); returns trimmed [raw] if parsing fails. */
    fun formatClock24h(raw: String): String {
        val total = parseClockToMinutes(raw.trim()) ?: return raw.trim()
        return String.format(Locale.getDefault(), "%02d:%02d", total / 60, total % 60)
    }

    private fun parseClockToMinutes(raw: String): Int? {
        val s = raw.trim()
        if (s.isBlank()) return null
        val parts = s.split(':', limit = 3)
        if (parts.size < 2) return null
        val h = parts[0].filter { it.isDigit() }.toIntOrNull() ?: return null
        val m = parts[1].filter { it.isDigit() }.take(2).toIntOrNull() ?: 0
        if (h !in 0..23 || m !in 0..59) return null
        return h * 60 + m
    }

    /** Cash labor expense: only payroll rows marked [PayrollRecord.paid]. */
    fun payrollAmountIfPaid(p: PayrollRecord): Int = if (p.paid) payrollLineAmount(p) else 0

    fun totalPaidPayroll(payroll: List<PayrollRecord>): Int =
        payroll.sumOf { payrollAmountIfPaid(it) }

    fun totalPendingPayroll(payroll: List<PayrollRecord>): Int =
        payroll.filter { !it.paid }.sumOf { payrollLineAmount(it) }

    /**
     * Total expenses = operating + disbursed payroll (paid lines only) + equipment maintenance.
     * Attendance and worker role do not affect profit; labor enters only via payroll.
     */
    fun totalExpenses(state: AppState): Int {
        return totalOperatingExpenses(state.expenses) +
            totalPaidPayroll(state.payroll) +
            totalMaintenanceExpenses(state.maintenanceLogs)
    }

    fun netProfit(state: AppState): Int = totalIncome(state.sales) - totalExpenses(state)

    fun profitPerKg(state: AppState): Double {
        val kg = totalHarvestKg(state.cherryHarvests)
        if (kg <= 0.0) return 0.0
        return netProfit(state) / kg
    }

    fun bestSellingProductType(sales: List<SaleRecord>): String? {
        if (sales.isEmpty()) return null
        val byType = sales.groupBy { it.type.trim().ifBlank { "other" } }
        val top = byType.maxByOrNull { (_, list) -> list.sumOf { saleLineTotal(it) } } ?: return null
        return productTypeLabel(top.key)
    }

    fun highestExpenseCategory(expenses: List<ExpenseRecord>): Pair<String, Int>? {
        if (expenses.isEmpty()) return null
        val by = expenses.groupBy { it.category.trim().ifBlank { "other" } }
        val top = by.maxByOrNull { e -> e.value.sumOf { it.amount } } ?: return null
        return top.key to top.value.sumOf { it.amount }
    }

    fun productTypeLabel(key: String): String = when (key.lowercase().replace(" ", "_")) {
        "cherry" -> "Cherry"
        "green_bean", "green bean" -> "Green bean"
        "roasted" -> "Roasted"
        "buyer", "cafe" -> key.replaceFirstChar { c -> c.uppercase() }
        else -> key.replaceFirstChar { c -> c.uppercase() }
    }

    // --- decision support ---

    data class FinanceAlerts(
        val messages: List<String>
    )

    fun buildAlerts(state: AppState): FinanceAlerts {
        val messages = mutableListOf<String>()
        val now = YearMonth.now()
        val thisMonth = monthTotalExpenses(state, now)
        val lastMonth = monthTotalExpenses(state, now.minusMonths(1))
        if (lastMonth > 0 && thisMonth > lastMonth * 1.2) {
            messages.add("Expenses this month are more than 20% higher than last month. Review large purchases and labor.")
        }
        val ppkNow = profitPerKgForMonth(state, now)
        val ppkPrev = profitPerKgForMonth(state, now.minusMonths(1))
        if (ppkPrev > 0.0 && ppkNow < ppkPrev * 0.85 && state.cherryHarvests.isNotEmpty()) {
            messages.add("Profit per kg has decreased versus last month. Check selling prices and input costs.")
        }
        if (revenueLast30d(state) < revenuePrev30d(state) * 0.8 && state.sales.size >= 3) {
            messages.add("Recent sales are lower than the prior 30 days. Review buyer activity and product mix.")
        }
        val pendingAttendance = state.attendance.count { it.awaitingPayrollLine }
        if (pendingAttendance > 0) {
            val noun = if (pendingAttendance == 1) "entry" else "entries"
            messages.add(
                "$pendingAttendance worker attendance $noun need a payroll line under Payroll (tap + or open an attendance record). Pay is computed as hourly rate × hours; mark Paid when disbursed."
            )
        }
        return FinanceAlerts(messages)
    }

    private fun revenueLast30d(state: AppState): Int {
        val end = LocalDate.now()
        val start = end.minusDays(29)
        return state.sales.filter { saleDateOrNull(it.date)?.let { d -> !d.isBefore(start) && !d.isAfter(end) } == true }
            .sumOf { saleLineTotal(it) }
    }

    private fun revenuePrev30d(state: AppState): Int {
        val end = LocalDate.now().minusDays(30)
        val start = end.minusDays(29)
        return state.sales.filter { saleDateOrNull(it.date)?.let { d -> !d.isBefore(start) && !d.isAfter(end) } == true }
            .sumOf { saleLineTotal(it) }
    }

    /**
     * Month-totals for operating, payroll, and maintenance (dated rows only; matches chart logic).
     * Only [PayrollRecord.paid] lines count in payroll; undated or unparseable dates are excluded here
     * but may still be included in [totalExpenses] when they have a date the parser accepts elsewhere.
     */
    private fun monthTotalExpenses(state: AppState, ym: YearMonth): Int {
        val op = state.expenses.filter { parseToYearMonth(it.date.orEmpty()) == ym }.sumOf { it.amount }
        val pr = state.payroll
            .filter { it.paid && parseToYearMonth(it.date.orEmpty()) == ym }
            .sumOf { payrollLineAmount(it) }
        val m = state.maintenanceLogs.filter { parseToYearMonth(it.date.orEmpty()) == ym }
            .sumOf { parseMoneyAmount(it.costText) }
        return op + pr + m
    }

    private fun profitPerKgForMonth(state: AppState, ym: YearMonth): Double {
        val rev = state.sales.filter { parseToYearMonth(it.date) == ym }.sumOf { saleLineTotal(it) }
        val ex = monthTotalExpenses(state, ym)
        val kg = state.cherryHarvests.filter { parseToYearMonth(it.date.orEmpty()) == ym }
            .sumOf { parseHarvestKg(it) }
        if (kg <= 0.0) return 0.0
        return (rev - ex) / kg
    }

    private fun saleDateOrNull(raw: String): LocalDate? = parseToLocalDate(raw)

    fun parseToLocalDate(raw: String): LocalDate? {
        val cleaned = raw.trim()
        if (cleaned.isBlank()) return null
        val withYearFormats = listOf(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("MM/dd/yyyy", Locale.getDefault()),
            DateTimeFormatter.ofPattern("MMM d yyyy", Locale.getDefault()),
            DateTimeFormatter.ofPattern("MMM dd yyyy", Locale.getDefault())
        )
        for (fmt in withYearFormats) {
            try {
                return LocalDate.parse(cleaned, fmt)
            } catch (_: DateTimeParseException) {
            }
        }
        val noYearFormats = listOf("MMM d", "MMM dd")
        for (pattern in noYearFormats) {
            try {
                return LocalDate.parse(
                    "$cleaned ${LocalDate.now().year}",
                    DateTimeFormatter.ofPattern("$pattern yyyy", Locale.getDefault())
                )
            } catch (_: Exception) {
            }
        }
        return null
    }

    fun parseToYearMonth(raw: String): YearMonth? {
        val d = parseToLocalDate(raw) ?: return null
        return YearMonth.from(d)
    }

    /**
     * Daily net profit (revenue - expense lines dated that day) for charting. Payroll without day uses month spread skipped (0 for undated). Only paid payroll counts.
     */
    fun dailyNetSeriesLastDays(state: AppState, days: Int = 7): List<Pair<LocalDate, Int>> {
        val end = LocalDate.now()
        return (0 until days).map { i ->
            val d = end.minusDays((days - 1 - i).toLong())
            val dayRev = state.sales.filter { parseToLocalDate(it.date) == d }.sumOf { saleLineTotal(it) }
            val dayOp = state.expenses.filter { parseToLocalDate(it.date.orEmpty()) == d }.sumOf { it.amount }
            val dayPay = state.payroll
                .filter { it.paid && parseToLocalDate(it.date.orEmpty()) == d }
                .sumOf { payrollLineAmount(it) }
            val dayM = state.maintenanceLogs.filter { parseToLocalDate(it.date.orEmpty()) == d }
                .sumOf { parseMoneyAmount(it.costText) }
            d to (dayRev - dayOp - dayPay - dayM)
        }
    }
}
