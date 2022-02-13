package searchengine.plugins

import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import searchengine.elastic.Elastic

@Serializable
data class Response(val url: String, val html: String?, val status: Int)


class Server(port: Int) {
    private val elasticIndex = "se14"
    private val elastic = Elastic(elasticIndex)

    private val server = embeddedServer(Netty, port) {
        install(ContentNegotiation) {
            json()
        }
        routing {
            put("/index") {
                val response = call.receive<Response>()
                val cUrl = cleanUrl(response.url)
                println("got index request for $cUrl")
                val elasticDocs = elastic.docsByUrlOrNull(cUrl)

                if (response.html != null) {
                    val pageBody = IndexPageByHTML(response.html, cUrl, listOf())
                    println(pageBody.metadata.title)
                    val docId: String
                    if (elasticDocs != null) {
                        println("elastic doc already exists (${elasticDocs.count()})")
                        pageBody.inferredData.backLinks =
                            (elasticDocs.firstOrNull()?.source()?.inferredData?.backLinks ?: listOf())
                        docId = elastic.indexPage(pageBody, id = elasticDocs.firstOrNull()?.id()).id()
                    } else {
                        docId = elastic.indexPage(pageBody).id()
                    }
                    println("indexed $cUrl at $docId")
                    println(pageBody.body.links.internal.count())
                    elastic.putDocsBacklinkInfoByUrl(pageBody.body.links.internal, cUrl)
                    elastic.putDocsBacklinkInfoByUrl(pageBody.body.links.external, cUrl)
                    call.respond(200)
                } else call.respond(400)
            }
        }
    }

    fun run() {
        server.start(wait = true)
    }
}
