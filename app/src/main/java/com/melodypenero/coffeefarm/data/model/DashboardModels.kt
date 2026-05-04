package com.melodypenero.coffeefarm.data.model

data class DashboardSummary(
    val workersCount: Int,
    val treesCount: Int,
    val harvestTodayKg: Double,
    /** Total saved AI grading rows (each references a batch id when recorded). */
    val cherryGradingsCount: Int,
    val currentProfit: Double,
    val totalIncome: Double = 0.0,
    val totalExpenses: Double = 0.0,
    val profitPerKg: Double = 0.0
)

data class ActivityLogItem(
    val id: String,
    val title: String,
    val description: String,
    val timestamp: String
)

data class FarmSnapshot(
    val weather: String,
    val activeTasks: Int,
    val sectionsHealthy: Int,
    val sectionsAtRisk: Int
)

data class CnnClassificationResult(
    val batchId: String,
    val grade: CherryGrade,
    val confidence: Double,
    val imageUrl: String?,
    val createdAt: String
)

enum class CherryGrade {
    GREEN_UNRIPE,
    YELLOW_NEAR_RIPE,
    RED_RIPE,
    OVERRIPE_OR_DEFECTIVE
}
