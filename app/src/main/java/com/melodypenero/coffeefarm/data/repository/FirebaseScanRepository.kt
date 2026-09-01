package com.melodypenero.coffeefarm.data.repository

import android.content.Context
import android.graphics.Bitmap
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.melodypenero.coffeefarm.data.model.BranchScanSummary
import java.io.ByteArrayOutputStream
import java.util.UUID
import kotlinx.coroutines.tasks.await

/**
 * Repository managing Firestore & Firebase Storage scan persistence.
 *
 * **Offline Resilience:** Firestore's built-in offline cache queues writes locally
 * when no internet connection is present, syncing automatically upon reconnection.
 * Manual corrections are saved with `verified: true` into a separate Firestore collection (`verified_corrections`).
 */
class FirebaseScanRepository(context: Context) {

    private val db = FirebaseFirestore.getInstance()
    private val storage = FirebaseStorage.getInstance()

    suspend fun saveBranchScan(
        summary: BranchScanSummary,
        bitmap: Bitmap,
        userId: String? = "farm_user_demo",
    ): Result<String> {
        return try {
            val scanId = UUID.randomUUID().toString()
            var uploadedUrl: String? = null

            // 1. Upload scan image to Firebase Storage if online
            runCatching {
                val imageRef = storage.reference.child("scans/$scanId.jpg")
                val baos = ByteArrayOutputStream()
                bitmap.compress(Bitmap.CompressFormat.JPEG, 85, baos)
                val data = baos.toByteArray()
                imageRef.putBytes(data).await()
                uploadedUrl = imageRef.downloadUrl.await().toString()
            }

            // 2. Prepare Firestore document
            val scanDoc = mapOf(
                "scanId" to scanId,
                "userId" to userId,
                "timestamp" to summary.timestamp,
                "totalCount" to summary.totalCount,
                "classCounts" to summary.classCounts,
                "ripePercentage" to summary.ripePercentage,
                "harvestStatus" to summary.harvestStatus,
                "imageUrl" to uploadedUrl,
                "verified" to summary.verified,
                "detections" to summary.detections.map { d ->
                    mapOf(
                        "class" to d.className,
                        "confidence" to d.confidence,
                        "uncertain" to d.uncertain,
                        "userCorrectedClass" to d.userCorrectedClass,
                        "box" to mapOf(
                            "left" to d.rect.left,
                            "top" to d.rect.top,
                            "right" to d.rect.right,
                            "bottom" to d.rect.bottom
                        )
                    )
                }
            )

            // Collection choice: verified corrections vs raw model scans
            val collectionName = if (summary.verified) "verified_corrections" else "cherry_scans"
            db.collection(collectionName).document(scanId).set(scanDoc).await()

            Result.success(scanId)
        } catch (t: Throwable) {
            Result.failure(t)
        }
    }
}
