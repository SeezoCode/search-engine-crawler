import kotlinx.serialization.Serializable

@Serializable
data class PageMetadata (
    val title: String?,
    val author: String?,
    val description: String?,
    val openGraphImgURL: String?,
    val openGraphTitle: String?,
    val type: String?,
    val tags: List<String>?,
    val siteName: String?,
    val hasIcon: Boolean,
    val language: String?,
) {
    constructor() : this(
        title = null,
        author = null,
        description = null,
        openGraphImgURL = null,
        openGraphTitle = null,
        type = null,
        tags = null,
        siteName = null,
        hasIcon = false,
        language = null,
    )
}

@Serializable
data class PageBodyHeadings (
    val h1: List<String>?,
    val h2: List<String>?,
    val h3: List<String>?,
    val h4: List<String>?,
    val h5: List<String>?,
    val h6: List<String>?,
) {
    constructor() : this(
        h1 = null,
        h2 = null,
        h3 = null,
        h4 = null,
        h5 = null,
        h6 = null,
    )
}

@Serializable
data class PageLink (
    val innerText: String?,
    var href: String,
    val bias: Double?,
) {
    @Suppress("unused")
    constructor() : this(
        innerText = null,
        href = "",
        bias = null,
    )
}

@Serializable
data class PageBody (
    val headings: PageBodyHeadings,
    val plaintext: List<String>?,
    val article: List<String>?,
    val internalLinks: List<PageLink>?,
    val externalLinks: List<PageLink>?,
) {
    constructor() : this(
        headings = PageBodyHeadings(),
        plaintext = null,
        article = null,
        internalLinks = null,
        externalLinks = null,
    )
}
@Serializable
data class Page (
    val metadata: PageMetadata,
    val body: PageBody, // ??

    val url: String,
    val crawlerTimestamp: Long,
    val userRating: Double,
    val bias: Double,
    val createdTimestamp: Long
) {
    @Suppress("unused")
    constructor() : this(
        metadata = PageMetadata(),
        body = PageBody(),
        url = "",
        crawlerTimestamp = 0,
        userRating = 0.0,
        bias = 0.0,
        createdTimestamp = 0
    )
}