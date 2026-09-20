package com.melodypenero.coffeefarm.data.store

import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StateJsonMergeTest {
    private fun obj(json: String) = JsonParser.parseString(json).asJsonObject

    @Test
    fun websiteOnlySectionsSurviveAnAndroidSave() {
        val remote = """{"workers":[{"name":"Old"}],"productListings":[{"listingId":"L-1","name":"Arabica coffee","availableQty":50}],"buyerNotes":"keep"}"""
        val ours = """{"workers":[{"name":"New"}],"tasks":[]}"""
        val merged = obj(preserveUnknownFields(remote, ours))
        // What the Android app models is replaced by its version...
        assertEquals("New", merged["workers"].asJsonArray[0].asJsonObject["name"].asString)
        assertTrue(merged.has("tasks"))
        // ...and what it doesn't model is carried through untouched.
        assertEquals("L-1", merged["productListings"].asJsonArray[0].asJsonObject["listingId"].asString)
        assertEquals(50, merged["productListings"].asJsonArray[0].asJsonObject["availableQty"].asInt)
        assertEquals("keep", merged["buyerNotes"].asString)
    }

    @Test
    fun aDeletedItemInAModeledListIsStillDeleted() {
        val merged = obj(preserveUnknownFields("""{"workers":[{"name":"A"},{"name":"B"}]}""", """{"workers":[{"name":"A"}]}"""))
        assertEquals(1, merged["workers"].asJsonArray.size())
    }

    @Test
    fun noRemoteDocumentJustUsesOurs() {
        assertEquals("""{"a":1}""", preserveUnknownFields(null, """{"a":1}"""))
        assertEquals("""{"a":1}""", preserveUnknownFields("", """{"a":1}"""))
    }

    @Test
    fun unreadableRemoteFallsBackToOurs() {
        assertEquals("""{"a":1}""", preserveUnknownFields("not json {{", """{"a":1}"""))
        assertEquals("""{"a":1}""", preserveUnknownFields("[1,2,3]", """{"a":1}"""))
    }

    @Test
    fun theOldBehaviourWouldHaveLostTheListings() {
        // Documents the bug: writing only Android's JSON drops the website's sections.
        val remote = """{"workers":[],"productListings":[{"listingId":"L-1"}]}"""
        val ours = """{"workers":[]}"""
        assertFalse(obj(ours).has("productListings"))
        assertTrue(obj(preserveUnknownFields(remote, ours)).has("productListings"))
    }
}
