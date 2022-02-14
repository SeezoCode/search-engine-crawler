package searchengine.types

fun splitUrlToWords(url: String): List<String> {
    val words = url.split("[/.\\-_:]".toRegex()).distinct()
    return words.filter { it.isNotEmpty() }
}