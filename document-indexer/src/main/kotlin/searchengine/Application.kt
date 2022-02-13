package searchengine

import searchengine.plugins.Server

//fun main() {
//    embeddedServer(Netty, port = 8082, host = "0.0.0.0") {
//        configureRouting()
//    }.start(wait = true)
//}

fun main() = try {
    val server = Server(8082)
    server.run()
    Unit
} catch (e: Exception) {
    e.printStackTrace()
}