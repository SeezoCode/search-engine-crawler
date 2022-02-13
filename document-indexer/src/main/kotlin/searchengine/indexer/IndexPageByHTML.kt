package searchengine.plugins

import org.jsoup.Jsoup
import org.jsoup.nodes.Document


class MetadataByHTML(doc: Document) : Metadata() {
    override val title: String = doc.title()
    override val description: String = doc.select("meta[name=description]").attr("content")
    override val openGraphImgURL: String = doc.select("meta[property=og:image]").attr("content")
    override val openGraphTitle: String = doc.select("meta[property=og:title]").attr("content")
    override val openGraphDescription: String = doc.select("meta[property=og:description]").attr("content")
    override val type: String = doc.select("meta[property=og:type]").attr("content")
    override val tags: List<String> = doc.select("meta[property=keywords]").map { it.attr("content") }.toList()
}

class HeadingsByHTML(doc: Document) : Headings() {
    override val h1 = doc.select("h1").map { it.text() }.toList()
    override val h2 = doc.select("h2").map { it.text() }.toList()
    override val h3 = doc.select("h3").map { it.text() }.toList()
    override val h4 = doc.select("h4").map { it.text() }.toList()
    override val h5 = doc.select("h5").map { it.text() }.toList()
    override val h6 = doc.select("h6").map { it.text() }.toList()
}

class LinksByHTML(doc: Document, url: String) : BodyLinks() {
    override val internal = mutableListOf<ForwardLink>()
    override val external = mutableListOf<ForwardLink>()

    init {
        val links = doc.select("a[href]")
        for (link in links) {
            val href = cleanUrl(link.attr("href"))
            link.attr("href", href)
            if (href.startsWith("/")) {
                val baseUrl = url.split("/").take(3).joinToString("/")
                link.attr("href", "${baseUrl}$href")
            }
        }
        for (link in links) {
            val href = link.attr("href")
            if (href == "" || !href.startsWith("http")) continue
            if (getDomain(href).startsWith(getDomain(url))) {
                internal.add(ForwardLink(link.text(), cleanUrl(href)))
            } else {
                external.add(ForwardLink(link.text(), cleanUrl(href)))
            }
        }
    }
}

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

class BodyByHTML(doc: Document, url: String) : Body() {
    override val headings = HeadingsByHTML(doc)
    override val boldText = doc.select("b").map { it.text() }.toList()
    override val article = doc.select("article").map { it.text() }.toList()
    override val links = LinksByHTML(doc, url)
}

class InferredDataByHTML(url: String, override var backLinks: List<BackLink>) : InferredData() {
    override val pagerank: Double? = null
    override val smartRank: Double? = null
    override var domainName: String = getDomain(url)
}

fun getDomain(url: String): String {
    val domain = url.substringAfter("//")
    return domain.substringBefore("/")
}

class IndexPageByHTML(html: String, url: String, backLinks: List<BackLink>) : PageType() {
    private val doc = Jsoup.parse(html)
    override val metadata = MetadataByHTML(doc)
    override val body = BodyByHTML(doc, cleanUrl(url))

    override val url = cleanUrl(url)
    override var inferredData = InferredDataByHTML(cleanUrl(url), backLinks)
    override val crawlerStatus: CrawlerStatus = CrawlerStatus.Crawled
    override val crawlerTimestamp: Long = System.currentTimeMillis()
}
