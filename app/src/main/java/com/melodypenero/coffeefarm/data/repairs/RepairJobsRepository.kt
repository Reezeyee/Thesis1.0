package com.melodypenero.coffeefarm.data.repairs

import com.google.firebase.firestore.FirebaseFirestore
import com.melodypenero.coffeefarm.data.firebase.FirebaseCollections
import com.melodypenero.coffeefarm.domain.MAX_PARTS_PER_JOB
import com.melodypenero.coffeefarm.domain.PartUsed
import com.melodypenero.coffeefarm.domain.RepairJob
import com.melodypenero.coffeefarm.domain.RepairStatus
import com.melodypenero.coffeefarm.domain.isValidFixNote
import com.melodypenero.coffeefarm.domain.parseRepairJob
import com.melodypenero.coffeefarm.domain.sortRepairJobs
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.time.Instant

/**
 * A Maintenance worker's view of `repair_jobs`. firestore.rules only lets a worker read jobs whose `assignedToUid`
 * is their own uid (so the query MUST filter on it) and only change the progress fields: start the repair, then
 * mark it fixed with a note. They can't edit the job, reassign it, or touch it again once it is fixed.
 */
object RepairJobsRepository {
    private val db get() = FirebaseFirestore.getInstance()

    /** Live list of the jobs assigned to [workerUid], already sorted for the worker. */
    fun observe(workerUid: String): Flow<Result<List<RepairJob>>> = callbackFlow {
        val registration = db.collection(FirebaseCollections.REPAIR_JOBS)
            .whereEqualTo("assignedToUid", workerUid)
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    trySend(Result.failure(error ?: IllegalStateException("No data")))
                } else {
                    trySend(Result.success(sortRepairJobs(snapshot.documents.map { parseRepairJob(it.id, it.data.orEmpty()) })))
                }
            }
        awaitClose { registration.remove() }
    }

    suspend fun startRepair(jobId: String) {
        db.collection(FirebaseCollections.REPAIR_JOBS).document(jobId)
            .update(mapOf("status" to RepairStatus.IN_PROGRESS, "startedAt" to Instant.now().toString()))
            .await()
    }

    /**
     * Marks the job fixed. The note (what was done) is required; [parts] are the parts / materials used (may be
     * empty), which the admin deducts from the supplies. Matches what firestore.rules accepts.
     */
    suspend fun markFixed(jobId: String, note: String, parts: List<PartUsed>) {
        require(isValidFixNote(note)) { "A note of 1-500 characters saying what was done is required" }
        require(parts.size <= MAX_PARTS_PER_JOB) { "At most $MAX_PARTS_PER_JOB parts per job" }
        db.collection(FirebaseCollections.REPAIR_JOBS).document(jobId)
            .update(
                mapOf(
                    "status" to RepairStatus.FIXED,
                    "fixedAt" to Instant.now().toString(),
                    "fixNote" to note.trim(),
                    "partsUsed" to parts.map { mapOf("name" to it.name, "quantity" to it.quantity) }
                )
            )
            .await()
    }
}
