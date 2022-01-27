import co.elastic.clients.elasticsearch.ElasticsearchClient
import co.elastic.clients.elasticsearch.core.IndexRequest
import co.elastic.clients.elasticsearch.core.SearchRequest
import co.elastic.clients.elasticsearch.core.SearchResponse
import io.ktor.client.*
import io.ktor.client.request.*
import io.ktor.http.*
import kotlinx.coroutines.*

const val domainLimit = 50

data class DomainCrawlingManagerItem(
    val domain: String,
    val pageQueue: DomainPageQueue,
    var isBeingCrawled: Boolean = false
)

fun cleanUrl(url: String): String {
    var urlEdited = Regex("""\?.*""").replace(url, "")
    urlEdited = Regex("""/$""").replace(urlEdited, "")
    return Regex("""www\.""").replace(urlEdited, "")
}

fun getDomainName(url: String): String {
    val domain = Regex("""^(?:https?://)?(?:www\.)?([^/]+)""").find(url)
    return domain?.groupValues?.get(1) ?: ""
}

class DomainPageQueue {
    val queue = mutableSetOf<String>()
    private val crawledPages = mutableSetOf<String>()

    fun add(url: String) {
        if (!crawledPages.contains(url)) {
            queue.add(cleanUrl(url))
        }
    }

    fun getCrawledCount() = crawledPages.count()

    fun get(): String? = if (getCrawledCount() <= domainLimit) queue.firstOrNull() else null

    fun markAsIndexed(url: String) {
        val urlClean = cleanUrl(url)
        queue.remove(urlClean)
        crawledPages.add(urlClean)
    }
}

class DomainCrawlingManager {
    private val domains = mutableMapOf<String, DomainCrawlingManagerItem>()

    fun add(url: String) {
        val domain = getDomainName(url)
        if (!domains.containsKey(domain)) {
            domains[domain] = DomainCrawlingManagerItem(domain, DomainPageQueue())
        }
        domains[domain]?.pageQueue?.add(cleanUrl(url))
    }

    fun getAvailableDomain() = domains.values.firstOrNull { it.pageQueue.get() != null && !it.isBeingCrawled }
}


class Crawler(
    startingUrl: String,
    private val ktorClient: HttpClient,
    private val crawlerUrl: String,
    private val elasticClient: ElasticsearchClient,
    private val elasticIndex: String,
) {
//    private val queueByDomain = mutableMapOf<String, DomainCrawlingManagerItem>()

    private val domainManager = DomainCrawlingManager()
    private var scrapedPagesCount = 0
    private var crawlingDomainsCount = 0

    init {
        domainManager.add(startingUrl)
    }

    private suspend fun pageScrape(url: String): Page? {
        return try {
            val response: Page = ktorClient.post(crawlerUrl) {
                contentType(ContentType.Application.Json)
                body = Url(url)
            }
            response
        } catch (e: Exception) {
            println("$scrapedPagesCount - Error scraping page: $url, ${e.message}")
            null
        }
    }

    suspend fun handleCrawling() = coroutineScope {
        while (true) {
            if (crawlingDomainsCount < 10) {
                async { crawl() }
                delay(100)
            } else {
                delay(100)
            }
        }
    }

    private suspend fun crawl() = coroutineScope {
        val domain = domainManager.getAvailableDomain()
        if (domain != null) crawl(domain)
    }

    private suspend fun crawl(domain: DomainCrawlingManagerItem) {
        domain.isBeingCrawled = true
        handleDomainScrape(domain)
    }

    private suspend fun isPageIndexed(url: String) = coroutineScope {
        val search2: SearchResponse<Page> = withContext(Dispatchers.Default) {
            elasticClient.search({ s: SearchRequest.Builder ->
                s.index(elasticIndex).query { query ->
                    query.term { term ->
                        term.field("url").value { value ->
                            value.stringValue(url)
                        }
                    }
                }
            }, Page::class.java)
        }
        val hits = search2.hits().hits()
        return@coroutineScope if (hits.isNotEmpty()) hits[0].source() else null
    }

    private suspend fun handlePageIndex(page: Page) = coroutineScope {
        val indexRequest = IndexRequest.of<Page> {
            it.index("se12")
            it.document(page)
        }
        async { elasticClient.index(indexRequest) }
    }.await()

    private suspend fun handleDomainScrape(domain: DomainCrawlingManagerItem) = coroutineScope {
        val pageQueue = domain.pageQueue
        domain.isBeingCrawled = true
        println("Crawling domain ${getDomainName(pageQueue.get() ?: "")}")
        crawlingDomainsCount += 1
        launch {
            while (pageQueue.get() != null) {
                val url = pageQueue.get()
                if (url != null) {
                    pageQueue.markAsIndexed(url)
                    val isPageIndexed = isPageIndexed(url)
                    val pageBody = if (isPageIndexed == null) {
                        scrapedPagesCount += 1
                        println("$scrapedPagesCount - Scraping url (${pageQueue.getCrawledCount()} / $domainLimit) $url")
                        val pageBodyPromise = async { pageScrape(url) }
                        val body = pageBodyPromise.await()
                        if (body != null && body.body.plaintext?.isNotEmpty() == true) handlePageIndex(body)
                        body
                    } else {
                        isPageIndexed
                    }
                    if (pageBody != null) {
                        pageBody.body.internalLinks?.forEach { domainManager.add(it.href) }
                        pageBody.body.externalLinks?.forEach { domainManager.add(it.href) }
                    }
                }
            }
            domain.isBeingCrawled = false
            crawlingDomainsCount -= 1
        }
    }
}
