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
 * Native REST API Client for Roboflow Hosted YOLOv8 CNN Inference Engine.
 * Connected to 8,110-image dataset project `coffee-tmlrm-1fnkh/1`.
 */
object RoboflowApiClient {

    private const val API_KEY = "zl9Dmr15qZsJA3TCteGy"
    private const val MODEL_ID = "coffee-fruit-maturity-befkg-q80dw"
    private const val VERSION = "1"


    fun detect(bitmap: Bitmap): Result<BranchScanSummary> {
        return try {
            val baos = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 85, baos)
            val imageBytes = baos.toByteArray()
            val base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP)

            val endpointUrl = "https://detect.roboflow.com/$MODEL_ID/$VERSION?api_key=$API_KEY&confidence=0.50"
            val url = URL(endpointUrl)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            conn.doOutput = true
            conn.doInput = true
            conn.connectTimeout = 8000
            conn.readTimeout = 8000

            OutputStreamWriter(conn.outputStream).use { writer ->
                writer.write(base64Image)
                writer.flush()
            }

            val responseCode = conn.responseCode
            if (responseCode == 404) {
                return Result.failure(IllegalStateException("Roboflow Model Training Pending: Click 'Train Model' on Roboflow website to activate Version 1."))
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

                val cx = pred.optDouble("x", 0.0).toFloat()
                val cy = pred.optDouble("y", 0.0).toFloat()
                val w = pred.optDouble("width", 0.0).toFloat()
                val h = pred.optDouble("height", 0.0).toFloat()
                val rawClass = pred.optString("class", "mentah")


                val normalizedClass = when (rawClass.lowercase().trim()) {
                    "matang", "ripe" -> "Ripe"
                    "matang sempurna", "overripe" -> "Overripe"
                    "setengah matang", "semi_ripe", "ripening" -> "Ripening"
                    "mentah", "unripe" -> "Unripe"
                    "diseased", "dry" -> "Dry_Damaged"
                    else -> "Ripe"
                }

                classCounts[normalizedClass] = (classCounts[normalizedClass] ?: 0) + 1

                val left = (cx - w / 2f).coerceAtLeast(0f)
                val top = (cy - h / 2f).coerceAtLeast(0f)
                val right = (cx + w / 2f).coerceAtMost(origWidth)
                val bottom = (cy + h / 2f).coerceAtMost(origHeight)

                detections.add(
                    BoundingBoxDetection(
                        rect = RectF(left, top, right, bottom),
                        classIndex = YoloTfliteDetector.TARGET_CLASSES.indexOf(normalizedClass).coerceAtLeast(0),
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
        }
    }
}
