package com.melodypenero.coffeefarm.ml

import android.graphics.Bitmap
import android.graphics.RectF
import android.util.Base64
import com.melodypenero.coffeefarm.data.model.BoundingBoxDetection
import com.melodypenero.coffeefarm.data.model.BranchScanSummary
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Native REST API Client for Roboflow Hosted YOLO CNN Inference Engine.
 * Connected to dataset project `coffee-cherries-qpktr-4zkou/2` (YOLOv26n-t1 architecture, workspace `fates-workspace`).
 */
object RoboflowApiClient {

    private const val API_KEY = "zl9Dmr15qZsJA3TCteGy"
    private const val MODEL_ID = "coffee-cherries-qpktr-4zkou"
    private const val VERSION = "2"

    val TARGET_CLASSES = listOf("Unripe", "Ripening", "Ripe", "Overripe", "Dry_Damaged")

    /**
     * The numeric class_id this hosted model version actually returns, verified against the
     * labeled validation set in yolo_detection/dataset: querying detect.roboflow.com directly and
     * spatially matching each returned box to its nearest annotated ground-truth box showed
     * class_id=4 landing on annotated Unripe cherries ~95% of the time (n=150+, confidence up to
     * 0.97 -- too consistent and too confident to be model uncertainty) and class_id=0 never
     * appearing at all, while class_id 1/2/3 lined up with Ripening/Ripe/Overripe as expected. So
     * despite yolo_detection/dataset/data.yaml declaring 0=Unripe/4=Dry_Damaged (the order
     * TARGET_CLASSES above still uses for display), this hosted model version's real 0 and 4 are
     * swapped from that -- only those two positions differ from TARGET_CLASSES.
     */
    private val HOSTED_CLASS_ID_ORDER = listOf("Dry_Damaged", "Ripening", "Ripe", "Overripe", "Unripe")


    /**
     * Detections come back in this image's pixel space, so callers scanning at full camera
     * resolution (routinely 3000px+ on one side) would otherwise upload several megabytes of
     * base64 over what can be a weak rural mobile connection on a farm -- easily blowing past the
     * old 8s timeout and surfacing as "Ripeness Check Unavailable" with no indication that it was
     * really an upload-size/timeout problem. The model doesn't need more than this to detect
     * cherries, so downscale before upload and scale detections back up to the original bitmap's
     * coordinate space afterward.
     */
    private const val MAX_UPLOAD_DIMENSION = 1280

    fun detect(bitmap: Bitmap): Result<BranchScanSummary> {
        var uploadBitmap = bitmap
        return try {
            val longestSide = maxOf(bitmap.width, bitmap.height).toFloat()
            val downscale = if (longestSide > MAX_UPLOAD_DIMENSION) MAX_UPLOAD_DIMENSION / longestSide else 1f
            if (downscale < 1f) {
                uploadBitmap = Bitmap.createScaledBitmap(
                    bitmap,
                    (bitmap.width * downscale).toInt().coerceAtLeast(1),
                    (bitmap.height * downscale).toInt().coerceAtLeast(1),
                    true
                )
            }
            // Maps a coordinate from the (possibly downscaled) uploaded image back to the
            // original bitmap's pixel space.
            val scaleBack = if (downscale < 1f) 1f / downscale else 1f

            val baos = ByteArrayOutputStream()
            uploadBitmap.compress(Bitmap.CompressFormat.JPEG, 85, baos)
            val imageBytes = baos.toByteArray()
            val base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP)

            val endpointUrl = "https://detect.roboflow.com/$MODEL_ID/$VERSION?api_key=$API_KEY&confidence=0.50"
            val url = URL(endpointUrl)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            conn.doOutput = true
            conn.doInput = true
            // A resized upload is normally small (tens of KB), but rural mobile connections on a
            // farm can still be slow to establish/complete a request -- give it real headroom
            // instead of failing fast on flaky signal.
            conn.connectTimeout = 20000
            conn.readTimeout = 20000

            OutputStreamWriter(conn.outputStream).use { writer ->
                writer.write(base64Image)
                writer.flush()
            }

            val responseCode = conn.responseCode
            if (responseCode == 404) {
                return Result.failure(IllegalStateException("Roboflow Model Training Pending: Click 'Train Model' on Roboflow website to activate Version $VERSION."))
            } else if (responseCode != 200) {
                return Result.failure(IllegalStateException("Roboflow API returned HTTP $responseCode"))
            }


            val responseJson = conn.inputStream.bufferedReader().use { it.readText() }
            val jsonObject = JSONObject(responseJson)

            val predictions = jsonObject.optJSONArray("predictions")
                ?: return Result.failure(IllegalStateException("No predictions key in Roboflow response"))

            val detections = mutableListOf<BoundingBoxDetection>()
            val classCounts = mutableMapOf<String, Int>(
                "Ripe" to 0,
                "Unripe" to 0,
                "Overripe" to 0,
                "Ripening" to 0,
                "Dry_Damaged" to 0
            )

            val origWidth = bitmap.width.toFloat()
            val origHeight = bitmap.height.toFloat()

            for (i in 0 until predictions.length()) {
                val pred = predictions.getJSONObject(i)
                val conf = pred.optDouble("confidence", 0.0).toFloat()
                if (conf < 0.50f) continue

                // The model returns coordinates in the uploaded (possibly downscaled) image's
                // pixel space; scale back up so the box lines up with the original bitmap.
                val cx = pred.optDouble("x", 0.0).toFloat() * scaleBack
                val cy = pred.optDouble("y", 0.0).toFloat() * scaleBack
                val w = pred.optDouble("width", 0.0).toFloat() * scaleBack
                val h = pred.optDouble("height", 0.0).toFloat() * scaleBack
                val rawClass = pred.optString("class", "mentah")

                // The hosted model's Roboflow project has no class names configured (its
                // "classes" metadata is empty), so every prediction comes back as "class":"0".."4"
                // / class_id 0..4, never a semantic string like "ripe" -- map the numeric id via
                // HOSTED_CLASS_ID_ORDER (see its doc comment for why that differs from
                // TARGET_CLASSES), and only fall back to semantic-string matching for a
                // differently-configured or future hosted model version.
                val classId = pred.optInt("class_id", -1).takeIf { it in HOSTED_CLASS_ID_ORDER.indices }
                    ?: rawClass.trim().toIntOrNull()?.takeIf { it in HOSTED_CLASS_ID_ORDER.indices }
                val normalizedClass = if (classId != null) {
                    HOSTED_CLASS_ID_ORDER[classId]
                } else {
                    when (rawClass.lowercase().trim()) {
                        "matang", "ripe" -> "Ripe"
                        "matang sempurna", "overripe" -> "Overripe"
                        "setengah matang", "semi_ripe", "ripening" -> "Ripening"
                        "mentah", "unripe" -> "Unripe"
                        "diseased", "dry", "dry_damaged" -> "Dry_Damaged"
                        else -> null
                    }
                } ?: continue

                classCounts[normalizedClass] = (classCounts[normalizedClass] ?: 0) + 1

                val left = (cx - w / 2f).coerceAtLeast(0f)
                val top = (cy - h / 2f).coerceAtLeast(0f)
                val right = (cx + w / 2f).coerceAtMost(origWidth)
                val bottom = (cy + h / 2f).coerceAtMost(origHeight)

                detections.add(
                    BoundingBoxDetection(
                        rect = RectF(left, top, right, bottom),
                        classIndex = TARGET_CLASSES.indexOf(normalizedClass).coerceAtLeast(0),
                        className = normalizedClass,
                        confidence = conf,
                        uncertain = conf < 0.40f
                    )
                )
            }

            val totalCount = detections.size
            val ripeCount = classCounts["Ripe"] ?: 0
            val ripePercentage = if (totalCount > 0) (ripeCount.toFloat() / totalCount * 100.0f) else 0.0f
            val harvestStatus = BranchScanSummary.computeHarvestStatus(ripePercentage)

            Result.success(
                BranchScanSummary(
                    totalCount = totalCount,
                    classCounts = classCounts,
                    ripePercentage = ripePercentage,
                    harvestStatus = harvestStatus,
                    detections = detections
                )
            )

        } catch (t: Throwable) {
            Result.failure(t)
        } finally {
            if (uploadBitmap !== bitmap) uploadBitmap.recycle()
        }
    }
}
