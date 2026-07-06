package com.melodypenero.coffeefarm.data.repository

import com.melodypenero.coffeefarm.data.model.ActivityLogItem
import com.melodypenero.coffeefarm.data.model.CnnClassificationResult
import com.melodypenero.coffeefarm.data.model.DashboardSummary
import com.melodypenero.coffeefarm.data.model.FarmSnapshot

interface DashboardRepository {
    suspend fun loadSummary(): DashboardSummary
    suspend fun loadActivityLog(): List<ActivityLogItem>
    suspend fun loadFarmSnapshot(): FarmSnapshot
    suspend fun loadRecentClassifications(): List<CnnClassificationResult>
}

class EmptyDashboardRepository : DashboardRepository {
    override suspend fun loadSummary(): DashboardSummary {
        return DashboardSummary(
            workersCount = 0,
            treesCount = 0,
            harvestTodayKg = 0.0,
            cherryGradingsCount = 0,
            currentProfit = 0.0,
            totalIncome = 0.0,
            totalExpenses = 0.0,
            profitPerKg = 0.0
        )
    }

    override suspend fun loadActivityLog(): List<ActivityLogItem> {
        return emptyList()
    }

    override suspend fun loadFarmSnapshot(): FarmSnapshot {
        return FarmSnapshot(
            activeTasks = 0,
            sectionsHealthy = 0,
            sectionsAtRisk = 0
        )
    }

    override suspend fun loadRecentClassifications(): List<CnnClassificationResult> {
        return emptyList()
    }
}
