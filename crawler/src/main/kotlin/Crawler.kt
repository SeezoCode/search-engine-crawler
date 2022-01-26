import co.elastic.clients.elasticsearch.ElasticsearchClient
import co.elastic.clients.elasticsearch.core.IndexRequest
import io.ktor.client.*
import io.ktor.client.request.*
import io.ktor.http.*
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch


data class DomainCrawlingManagerItem(val domain: String, val pageQueue: DomainPageQueue, var isBeingCrawled: Boolean = false)

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

    fun get(): String? = queue.firstOrNull()

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
        domains[domain]?.pageQueue?.add(url)
    }

    fun getAvailableDomain(): DomainCrawlingManagerItem? {
        val domainManagerItem = domains.values.firstOrNull { it.pageQueue.queue.isNotEmpty() }
        domainManagerItem?.isBeingCrawled = true
        return domainManagerItem
    }
}


class Crawler(startingUrl: String, private val ktorClient: HttpClient, private val crawlerUrl: String, private val elasticClient: ElasticsearchClient) {
//    private val queueByDomain = mutableMapOf<String, DomainCrawlingManagerItem>()

    private val domainManager = DomainCrawlingManager()
    private var scrapedPagesCount = 0

    init {
        domainManager.add(startingUrl)
//        domainManager.add("https://kotlinlang.org/docs/server-overview.html")
//        domainManager.add("https://kotlinlang.org/docs/android-overview.html")
//        domainManager.add("https://kotlinlang.org/docs/js-overview.html")
//        domainManager.add("https://kotlinlang.org/docs/native-overview.html")
//        domainManager.add("https://kotlinlang.org/docs/data-science-overview.html")
    }

    private suspend fun pageScrape(url: String): Page {
        val response: Page = ktorClient.post(crawlerUrl) {
            contentType(ContentType.Application.Json)
            body = Url(url)
        }
        return response
    }

    suspend fun crawl() {
        val domain = domainManager.getAvailableDomain()
        if (domain != null) {
            handleDomainScrape(domain)
        }
    }

    private suspend fun handlePageIndex(page: Page) = coroutineScope {
        // add page to elasticsearch
        val indexRequest = IndexRequest.of<Page> {
            it.index("se12")
            it.document(page)
        }
        val res = async { elasticClient.index(indexRequest) }
        println(res.await().id())
    }

    private suspend fun handleDomainScrape(domain: DomainCrawlingManagerItem) = coroutineScope {
        val pageQueue = domain.pageQueue
        println("Handling domain ${getDomainName(pageQueue.get() ?: "")}")
        launch {
            while (pageQueue.get() != null && scrapedPagesCount < 20) {
                scrapedPagesCount += 1
                val url = pageQueue.get()
                if (url != null) {
                    println("Handling url $url")
                    val pageBodyPromise = async { pageScrape(url) }
                    val pageBody = pageBodyPromise.await()
                    handlePageIndex(pageBody)
                    pageBody.body.internalLinks?.forEach { domainManager.add(it.href) }
//                    pageBody.body.internalLinks?.forEach { domainManager.add(it.href) }
                    pageQueue.markAsIndexed(url)
                }
            }
            domain.isBeingCrawled = false
        }
    }

}