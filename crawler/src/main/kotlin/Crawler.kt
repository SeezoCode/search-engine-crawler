import co.elastic.clients.elasticsearch.ElasticsearchClient
import co.elastic.clients.elasticsearch.core.IndexRequest
import co.elastic.clients.elasticsearch.core.SearchRequest
import co.elastic.clients.elasticsearch.core.SearchResponse
import io.ktor.client.*
import io.ktor.client.request.*
import io.ktor.http.*
import kotlinx.coroutines.*

const val domainLimit = 50

class Crawler(
    startingUrl: String,
    private val ktorClient: HttpClient,
    private val crawlerUrl: String,
    private val elasticClient: ElasticsearchClient,
    private val elasticIndex: String,
) {
    private val domainManager = DomainCrawlingManager()
    private var scrapedPagesCount = 0
    private var crawlingDomainsCount = 0

    init {
        domainManager.add(startingUrl)
    }

    suspend fun handleCrawling() = coroutineScope {
        while (true) {
            if (crawlingDomainsCount < 10) {
                launch { crawlAvailableDomain() }.also { crawlingDomainsCount += 1 }
                delay(100)
            } else {
                delay(100)
            }
        }
    }

    private suspend fun crawlAvailableDomain() = domainManager.getAvailableDomain()?.let { handleDomainScrape(it) }

    private suspend fun ifUrlIsIndexedGetDoc(url: String) = coroutineScope {
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
        domain.isBeingCrawled = true
        println("Crawling domain ${domain.domain}")
        while (domain.pageQueue.get() != null) {
            withContext(Dispatchers.Default) { handlePageScrape(domain.pageQueue) }
        }
        println("Done crawling domain ${domain.domain}")
        domain.isBeingCrawled = false
        crawlingDomainsCount -= 1
    }

    private suspend fun handlePageScrape(pageQueue: DomainPageQueue) = coroutineScope {
        pageQueue.get()?.let { url ->
            pageQueue.markAsIndexed(url)
            val indexedDoc = ifUrlIsIndexedGetDoc(url)
            val pageBody = if (indexedDoc == null) {
                println("${scrapedPagesCount++} - Scraping url (${pageQueue.getCrawledCount()} / $domainLimit) $url")
                val page = withContext(Dispatchers.Default) { pageScrape(url) }
                if (page != null && page.body.plaintext?.isNotEmpty() == true) handlePageIndex(page)
                page
            } else indexedDoc
            if (pageBody != null) {
                pageBody.body.internalLinks?.forEach { domainManager.add(it.href) }
                pageBody.body.externalLinks?.forEach { domainManager.add(it.href) }
            }
        }
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
}
