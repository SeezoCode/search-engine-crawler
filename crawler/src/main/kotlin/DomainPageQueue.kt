class DomainPageQueue {
    private val queue = mutableSetOf<String>()
    private val crawledPages = mutableSetOf<String>()

    fun add(url: String) {
        if (isValidUrl(url) && !crawledPages.contains(url)) {
            queue.add(cleanUrl(url))
        }
    }

    private fun isValidUrl(url: String): Boolean {
        val cUrl = cleanUrl(url)
        val forbiddenSuffixed = listOf(".pdf", ".zip", ".png", ".jpg" , ".gif")
        return cUrl.startsWith("http") && !forbiddenSuffixed.any { cUrl.endsWith(it) }
    }

    fun getCrawledCount() = crawledPages.count()

    fun get(): String? = if (getCrawledCount() < domainLimit) queue.firstOrNull() else null

    fun markAsIndexed(url: String) {
        val urlClean = cleanUrl(url)
        queue.remove(urlClean)
        crawledPages.add(urlClean)
    }
}