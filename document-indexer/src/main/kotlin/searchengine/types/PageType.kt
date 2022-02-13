package searchengine.plugins

open class Metadata(
    open val title: String,
    open val description: String,
    open val openGraphImgURL: String,
    open val openGraphTitle: String,
    open val openGraphDescription: String,
    open val type: String,
    open val tags: List<String>,
) {
    constructor() : this("", "", "", "", "", "", listOf())
}

open class Headings(
    open val h1: List<String>,
    open val h2: List<String>,
    open val h3: List<String>,
    open val h4: List<String>,
    open val h5: List<String>,
    open val h6: List<String>,
) {
    constructor() : this(listOf(), listOf(), listOf(), listOf(), listOf(), listOf())
}

open class ForwardLink(
    open val text: String,
    open val href: String,
) {
    constructor() : this("", "")
}

open class BodyLinks(
    open val internal: List<ForwardLink>,
    open val external: List<ForwardLink>,
) {
    constructor() : this(listOf(), listOf())
}

open class Body(
    open val headings: Headings,
    open val boldText: List<String>,
    open val article: List<String>,
    open val links: BodyLinks,
) {
    constructor() : this(Headings(), listOf(), listOf(), BodyLinks())
}

open class BackLink(
    open val text: String,
    open val source: String,
) {
    constructor() : this("", "")
}

open class InferredData(
    open var backLinks: List<BackLink>,
    open val pagerank: Double?,
    open val smartRank: Double?,
    open var domainName: String,
) {
    constructor() : this(listOf(), null, null, "")
    constructor(backLinks: List<BackLink>) : this(backLinks, null, null, "")
}

enum class CrawlerStatus {
    Crawled,
    NotCrawled,
    AwaitingPagerank,
    DoesNotExist,
    Error,
}

open class PageType(
    open val metadata: Metadata,
    open val body: Body,
    open val inferredData: InferredData,

    open val url: String,
    open val crawlerTimestamp: Long = System.currentTimeMillis(),
    open val crawlerStatus: CrawlerStatus,
) {
    constructor() : this(Metadata(), Body(), InferredData(), "", System.currentTimeMillis(), CrawlerStatus.NotCrawled)
    constructor(url: String) : this(
        Metadata(),
        Body(),
        InferredData(),
        url,
        System.currentTimeMillis(),
        CrawlerStatus.NotCrawled
    )
//    constructor(url: String, backLinks: List<BackLink>): this(Metadata(), Body(), InferredData(backLinks), url, System.currentTimeMillis(), CrawlerStatus.NotCrawled)
}

