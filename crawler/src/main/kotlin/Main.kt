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

const val domainLimit = 2000


suspend fun main() = runBlocking {
    val ktorClient = HttpClient(CIO) {
        install(JsonFeature) {
            serializer = KotlinxSerializer()
        }
        install(HttpTimeout) {
            requestTimeoutMillis = 160_000
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

    val transport: ElasticsearchTransport = RestClientTransport(
        restClient, JacksonJsonpMapper()
    )

    val elasticClient = ElasticsearchClient(transport)

    val crawler = Crawler(
        listOf("https://github.com/"),
        ktorClient,
        "https://crawler-dkmligzhzq-lz.a.run.app/crawler",
//        "http://localhost:8080/crawler",
        elasticClient,
        "se13",
        concurrency = 3,
        language = "en", // for czech it is "cs"
        topLevelDomains = listOf("com", "org", "edu")
    )
    val a = async { crawler.handleCrawling() }

    a.await()
    restClient.close()
}
