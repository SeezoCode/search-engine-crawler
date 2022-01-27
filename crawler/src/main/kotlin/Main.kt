import co.elastic.clients.elasticsearch.ElasticsearchClient
import co.elastic.clients.json.jackson.JacksonJsonpMapper
import co.elastic.clients.transport.ElasticsearchTransport
import co.elastic.clients.transport.rest_client.RestClientTransport
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.features.*
import io.ktor.client.features.json.*
import io.ktor.client.features.json.serializer.*
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.Serializable
import org.apache.http.HttpHost
import org.apache.http.auth.AuthScope
import org.apache.http.auth.UsernamePasswordCredentials
import org.apache.http.client.CredentialsProvider
import org.apache.http.impl.client.BasicCredentialsProvider
import org.elasticsearch.client.RestClient


@Serializable
data class Url(val url: String)

suspend fun main() = runBlocking {
//    println("Program arguments: ${args.joinToString()}")

    val ktorClient = HttpClient(CIO) {
        install(JsonFeature) {
            serializer = KotlinxSerializer()
        }
        install(HttpTimeout) {
            requestTimeoutMillis = 120000
        }
    }

    val credentialsProvider: CredentialsProvider = BasicCredentialsProvider()
    credentialsProvider.setCredentials(
        AuthScope.ANY,
        UsernamePasswordCredentials("elastic", "testerino")
    )

    val restClient = RestClient.builder(
        HttpHost("localhost", 9200)
    ).setHttpClientConfigCallback { httpClientBuilder ->
            httpClientBuilder.disableAuthCaching()
            httpClientBuilder
                .setDefaultCredentialsProvider(credentialsProvider)
        }.build()

//    val restClient = RestClient.builder(
//        HttpHost("localhost", 9200)
//    ).build()

    val transport: ElasticsearchTransport = RestClientTransport(
        restClient, JacksonJsonpMapper()
    )

    val elasticClient = ElasticsearchClient(transport)

    val crawler = Crawler("https://github.com", ktorClient, "https://crawler-dkmligzhzq-lz.a.run.app/crawler", elasticClient, "se12")
//    async {crawler.crawl()}.let {
//        it.await()
//        restClient.close()
//    }
    val a = async { crawler.handleCrawling() }

    a.await()
    restClient.close()
//    // make a post request to the crawler with body containing url
//    val response: Page = client.post("https://crawler-dkmligzhzq-lz.a.run.app/crawler") {
//        contentType(ContentType.Application.Json)
//        body = Url("https://google.com")
//    }
//    println(response.metadata)
}