package searchengine.indexer

fun cleanUrl(url: String): String {
    var href = url
    href = href.split("#")[0]
    href = href.split("?")[0]
    href = href.replace("www.", "")
    if (href.endsWith("/")) {
        href = href.substring(0, href.length - 1)
    }
    return href
}


fun getDomain(url: String): String {
    val domain = url.substringAfter("//")
    return domain.substringBefore("/")
}


fun cleanText(text: String): String = text.split("[\"']".toRegex()).joinToString(" ")
