package com.melodypenero.coffeefarm.domain

import com.melodypenero.coffeefarm.data.store.TreeRipenessScanRecord
import kotlin.math.roundToInt

/**
 * Tree-level ripeness: multiple cherry scans per tree, averaged to a 0.0–1.0 score, then a harvest decision.
 * One cherry / one frame does not represent the whole tree.
 */
object TreeRipeness {
    const val MIN_SCANS_FOR_STATUS: Int = 10
    const val HARVEST_BATCH_MIN_SCORE: Double = 0.80
    /**
     * Minimum softmax probability for the winning ripeness class; below this → [CherryGradePrediction.uncertain].
     * Higher values reduce bogus labels on random objects (model has no \"not cherry\" class).
     */
    const val CHERRY_MIN_CONFIDENCE_FOR_DETECTION: Float = 0.35f
    const val SPECIES_MIN_CONFIDENCE_FOR_DETECTION: Float = 0.28f

    /** If 1st–2nd class probability is smaller than this, the scene is too ambiguous (often not a cherry/leaf in frame). */
    const val CHERRY_MIN_TOP1_TOP2_MARGIN: Float = 0.10f
    const val SPECIES_MIN_TOP1_TOP2_MARGIN: Float = 0.08f

    /**
     * User-facing when confidence/margin says the photo is not a coffee cherry, not a coffee leaf, or is unclear.
     */
    const val CAPTURE_NOT_RECOGNIZED_PLEASE_RETRY: String =
        "This doesn't look like a coffee cherry or coffee leaf. Please try again."

    const val CAPTURE_PLEASE_TRY_AGAIN_FOCUS_CHERRIES: String =
        "Please try again — focus on coffee cherries, not leaves."

    /** Model could not confidently tell ripeness (often not cherries in frame). */
    const val CAPTURE_NOT_CONFIDENT_CHERRY_SCAN: String =
        "Couldn't confidently detect coffee cherries. Fill the frame with cherries and try again."

    /**
     * Species CNN was trained only on **leaves**, so it often mislabels **coffee cherries** as Liberica/Robusta.
     * Do **not** reject on species alone — only when the cherry head is already **uncertain** *and* species
     * looks like a confident leaf class (likely leaf-only / wrong framing).
     */
    fun shouldClearRipenessForLeafPhoto(
        speciesClassifierReady: Boolean,
        speciesDisplay: String?,
        cherryConfidenceText: String?,
    ): Boolean {
        if (!speciesClassifierReady) return false
        val cherryUncertain = cherryConfidenceText?.contains("uncertain", ignoreCase = true) == true
        if (!cherryUncertain) return false
        val s = speciesDisplay?.trim()?.lowercase() ?: return false
        if (s == "uncertain") return false
        return s == "liberica" || s == "robusta"
    }

    const val LABEL_UNRIPE: String = "unripe"
    const val LABEL_SEMI_RIPE: String = "semi-ripe"
    const val LABEL_RIPE: String = "ripe"

    /** Growth stage when the tree is carrying cherry; only this stage is valid for scan attribution and harvest batch links. */
    const val STAGE_FRUITING: String = "fruiting"

    fun isFruitingStage(stage: String): Boolean = stage.trim().equals(STAGE_FRUITING, ignoreCase = true)

    /**
     * Shown when a user tries to save a scan or link a batch to a tree that is not in the fruiting growth stage.
     */
    const val CHERRY_AND_HARVEST_ONLY_FOR_FRUITING: String =
        "Only trees in the Fruiting growth stage can use Capture and be linked to harvest batches. " +
            "Set the tree to Fruiting in Farm → Operations (Trees), or add a fruiting tree."

    /** Ripe = 1.0, semi-ripe = 0.5, unripe = 0.0. */
    fun scoreForLabel(ripenessLabel: String): Double = when (ripenessLabel.trim().lowercase()) {
        LABEL_RIPE -> 1.0
        LABEL_SEMI_RIPE -> 0.5
        LABEL_UNRIPE -> 0.0
        else -> 0.0
    }

    /**
     * Map CNN / UI display strings to the three tree labels used for scoring.
     * Thesis 3-class: Green/Unripe, Red/Ripe, Overripe/Defective; 4-class: adds Yellow/Near Ripe.
     */
    fun mapDisplayGradeToRipenessLabel(grade: String): String {
        val g = grade.trim().lowercase()
        return when {
            g in listOf("green/unripe", "unripe") -> LABEL_UNRIPE
            g in listOf("red/ripe", "ripe") -> LABEL_RIPE
            g in listOf("yellow/near ripe", "overripe/defective", "overripe", "semi-ripe", "near ripe") -> LABEL_SEMI_RIPE
            else -> when {
                g.contains("unripe") || g.contains("green") -> LABEL_UNRIPE
                g.contains("near") || g.contains("yellow") || g.contains("overripe") || g.contains("defective") -> LABEL_SEMI_RIPE
                g.contains("ripe") && !g.contains("un") -> LABEL_RIPE
                else -> LABEL_UNRIPE
            }
        }
    }

    /** Largest and second-largest class probabilities (reject if too close = random / not in domain). */
    fun topTwoProbabilities(probs: FloatArray, numClasses: Int): Pair<Float, Float> {
        val n = numClasses.coerceIn(1, probs.size)
        val slice = probs.copyOfRange(0, n)
        slice.sortDescending()
        return slice[0] to if (n > 1) slice[1] else 0f
    }

    fun averageScore(scans: List<TreeRipenessScanRecord>): Double? {
        if (scans.size < MIN_SCANS_FOR_STATUS) return null
        if (scans.isEmpty()) return null
        val sum = scans.sumOf { scoreForLabel(it.ripenessLabel) }
        return sum / scans.size
    }

    /** 0–100, only meaningful when [averageScore] is non-null. */
    fun percentFromAverage(avg: Double): Int = (avg * 100.0).roundToInt().coerceIn(0, 100)

    /**
     * Human-readable decision from final averaged score.
     * [averageScore] must be from at least [MIN_SCANS_FOR_STATUS] scans; otherwise return a collecting message.
     */
    fun decisionText(avg: Double?, scanCount: Int): String = when {
        scanCount < MIN_SCANS_FOR_STATUS -> "Collecting samples ($scanCount/${MIN_SCANS_FOR_STATUS} scans)"
        avg == null -> "Not enough scans"
        avg >= 0.80 -> "Harvest Now"
        avg >= 0.60 -> "Selective Picking"
        else -> "Not Ready"
    }

    fun canCreateHarvestBatch(avg: Double?, scanCount: Int): Boolean =
        scanCount >= MIN_SCANS_FOR_STATUS && avg != null && avg >= HARVEST_BATCH_MIN_SCORE
}
