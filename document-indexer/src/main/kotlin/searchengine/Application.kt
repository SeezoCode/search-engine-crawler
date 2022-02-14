package searchengine

import searchengine.plugins.Server

fun main() = try {
    val server = Server(8082)
    server.run()
} catch (e: Exception) {
    e.printStackTrace()
}