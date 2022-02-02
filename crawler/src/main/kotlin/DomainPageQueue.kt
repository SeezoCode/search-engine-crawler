class DomainPageQueue {
    private val queuesMap = mutableMapOf<Int, MutableSet<String>>()
    private val crawledPages = mutableSetOf<String>()

    fun add(url: String) {
        val cUrl = cleanUrl(url)
        if (isValidUrl(cUrl) && !crawledPages.contains(cUrl)) {
            val i = cUrl.split("/").count()
            if (queuesMap.containsKey(i)) {
                queuesMap[i]?.add(cUrl)
            } else {
                queuesMap[i] = mutableSetOf(cUrl)
            }
        }
    }

    private fun isValidUrl(url: String): Boolean {
        val cUrl = cleanUrl(url)
        val forbiddenSuffixed = listOf(".pdf", ".zip", ".png", ".jpg", ".gif", ".mp4")
        return cUrl.startsWith("http") && !forbiddenSuffixed.any { cUrl.endsWith(it) }
    }

    fun getCrawledCount() = crawledPages.count()

    fun get(): String? {
        if (getCrawledCount() < domainLimit) {
            queuesMap.keys.sorted().forEach {
                val queue = queuesMap[it]
                if (queue != null) {
                    if (queue.isNotEmpty()) {
                        return@get queue.firstOrNull()
                    }
                }
            }
        }
        return null
    }

    fun markAsIndexed(url: String) {
        val urlClean = cleanUrl(url)
        queuesMap[urlClean.split("/").count()]?.remove(urlClean)
        crawledPages.add(urlClean)
    }
}