import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.newSingleThreadContext
import kotlinx.coroutines.withContext

data class DomainCrawlingManagerItem(
    val domain: String,
    val pageQueue: DomainPageQueue,
    var isBeingCrawled: Boolean = false
)

@OptIn(ExperimentalCoroutinesApi::class)
val domainCrawlingManagerContext = newSingleThreadContext("DomainCrawlingManager")

class DomainCrawlingManager {
    private val domains = mutableMapOf<String, DomainCrawlingManagerItem>()

    suspend fun add(url: String) = withContext(domainCrawlingManagerContext) { addSynchronous(url) }

    fun addSynchronous(url: String) {
        val domain = getDomainName(url)
        if (!domains.containsKey(domain)) {
            domains[domain] = DomainCrawlingManagerItem(domain, DomainPageQueue())
        }
        domains[domain]?.pageQueue?.add(cleanUrl(url))
    }

    suspend fun getAvailableDomain() = withContext(domainCrawlingManagerContext) {
        domains.values.firstOrNull { !it.isBeingCrawled && it.pageQueue.get() != null }
    }
}
