package com.metaglance.core.contract

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/** The 14 allergens of Annex II of Regulation (EU) No 1169/2011. */
@Serializable
enum class Allergen {
    @SerialName("gluten")
    GLUTEN,

    @SerialName("crustaceans")
    CRUSTACEANS,

    @SerialName("eggs")
    EGGS,

    @SerialName("fish")
    FISH,

    @SerialName("peanuts")
    PEANUTS,

    @SerialName("soy")
    SOY,

    @SerialName("milk")
    MILK,

    @SerialName("nuts")
    NUTS,

    @SerialName("celery")
    CELERY,

    @SerialName("mustard")
    MUSTARD,

    @SerialName("sesame")
    SESAME,

    @SerialName("sulphites")
    SULPHITES,

    @SerialName("lupin")
    LUPIN,

    @SerialName("molluscs")
    MOLLUSCS
}

@Serializable
enum class Detail {
    @SerialName("brief")
    BRIEF,

    @SerialName("standard")
    STANDARD,

    @SerialName("detailed")
    DETAILED
}

@Serializable
enum class YesGesture {
    @SerialName("nod")
    NOD,

    @SerialName("shake")
    SHAKE
}

@Serializable
enum class MainYes {
    @SerialName("head")
    HEAD,

    @SerialName("touch")
    TOUCH,

    @SerialName("voice")
    VOICE,

    @SerialName("phone")
    PHONE,

    @SerialName("key")
    KEY
}

/**
 * `headWindowMs` is 8000, 15000, or null for "while in view".
 * `budgetCents` is a positive number of cents, or null for no budget.
 */
@Serializable
data class Profile(
    val lang: Lang,
    val detail: Detail,
    val speechRate: Double,
    val speakPrices: Boolean,
    val headGestures: Boolean,
    val yesGesture: YesGesture,
    val headWindowMs: Long?,
    val haptics: Boolean,
    val mainYes: MainYes,
    val allergens: List<Allergen>,
    val vegan: Boolean,
    val vegetarian: Boolean,
    val budgetCents: Int?
)

object Profiles {
    val DEFAULT = Profile(
        lang = Lang.EN,
        detail = Detail.STANDARD,
        speechRate = 1.0,
        speakPrices = true,
        headGestures = true,
        yesGesture = YesGesture.NOD,
        headWindowMs = Timing.headWindowMs,
        haptics = true,
        mainYes = MainYes.HEAD,
        allergens = emptyList(),
        vegan = false,
        vegetarian = false,
        budgetCents = null
    )

    /**
     * Returns the profile with the keys of a `ProfilePatch` of Plan 0 set. A key with the value null sets null.
     * A patch that does not decode changes nothing.
     */
    fun applyPatch(profile: Profile, patch: JsonObject): Profile {
        val merged = JsonObject(GlanceJson.encodeToJsonElement(Profile.serializer(), profile).jsonObject + patch)
        return try {
            GlanceJson.decodeFromJsonElement(Profile.serializer(), merged)
        } catch (_: SerializationException) {
            profile
        } catch (_: IllegalArgumentException) {
            profile
        }
    }
}
