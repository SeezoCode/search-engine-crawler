fun cleanUrl(url: String): String {
    var urlEdited = Regex("""\?.*""").replace(url, "")
    urlEdited = Regex("""/$""").replace(urlEdited, "")
    urlEdited = Regex("""www\.""").replace(urlEdited, "")
    return Regex("""#.*""").replace(urlEdited, "")
}

fun getDomainName(url: String): String {
    val domain = Regex("""^(?:https?://)?(?:www\.)?([^/]+)""").find(url)
    return domain?.groupValues?.get(1) ?: ""
}