package com.melodypenero.coffeefarm.data.model

import android.graphics.RectF

data class BoundingBoxDetection(
    val rect: RectF,
    val classIndex: Int,
    val className: String,
    val confidence: Float,
    val uncertain: Boolean = false,
    val userCorrectedClass: String? = null,
)

data class BranchScanSummary(
    val totalCount: Int,
    val classCounts: Map<String, Int>,
    val ripePercentage: Float,
    val harvestStatus: String,
    val detections: List<BoundingBoxDetection>,
    val timestamp: Long = System.currentTimeMillis(),
    val imageUrl: String? = null,
    val verified: Boolean = false,
    val detectedSpecies: String = "Liberica",
    val speciesConfidence: String = "High",
) {
    companion object {
        fun computeHarvestStatus(ripePct: Float): String = when {
            ripePct >= 75.0f -> "Optimal Harvest Ready (Strip/Batch Pick)"
            ripePct >= 40.0f -> "Selective Picking Recommended (Red Only)"
            else -> "Wait / Unripe (Delay Harvest)"
        }
    }
}
