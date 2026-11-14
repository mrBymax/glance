package com.metaglance.core.contract

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class Lang {
    @SerialName("en")
    EN,

    @SerialName("it")
    IT
}

@Serializable
data class Localized(val en: String, val it: String? = null)

/** Returns the text in `lang`, or the English text when that language is missing. */
fun localize(text: Localized, lang: Lang): String = when (lang) {
    Lang.EN -> text.en
    Lang.IT -> text.it ?: text.en
}
