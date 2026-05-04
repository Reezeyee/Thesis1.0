package com.melodypenero.coffeefarm.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.melodypenero.coffeefarm.data.model.ActivityLogItem
import com.melodypenero.coffeefarm.data.model.CnnClassificationResult
import com.melodypenero.coffeefarm.data.model.DashboardSummary
import com.melodypenero.coffeefarm.data.model.FarmSnapshot
import com.melodypenero.coffeefarm.data.repository.DashboardRepository
import com.melodypenero.coffeefarm.data.repository.EmptyDashboardRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class DashboardUiState(
    val summary: DashboardSummary? = null,
    val activity: List<ActivityLogItem> = emptyList(),
    val snapshot: FarmSnapshot? = null,
    val classifications: List<CnnClassificationResult> = emptyList()
)

class DashboardViewModel(
    private val repository: DashboardRepository = EmptyDashboardRepository()
) : ViewModel() {
    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = DashboardUiState(
                summary = repository.loadSummary(),
                activity = repository.loadActivityLog(),
                snapshot = repository.loadFarmSnapshot(),
                classifications = repository.loadRecentClassifications()
            )
        }
    }
}
