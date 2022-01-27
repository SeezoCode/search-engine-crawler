data class DomainCrawlingManagerItem(
    val domain: String,
    val pageQueue: DomainPageQueue,
    var isBeingCrawled: Boolean = false
)

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
