package searchengine.elastic

import co.elastic.clients.elasticsearch.ElasticsearchClient
import co.elastic.clients.elasticsearch.core.IndexRequest
import co.elastic.clients.elasticsearch.core.IndexResponse
import co.elastic.clients.elasticsearch.core.SearchRequest
import co.elastic.clients.elasticsearch.core.SearchResponse
import co.elastic.clients.elasticsearch.core.search.Hit
import co.elastic.clients.json.jackson.JacksonJsonpMapper
import co.elastic.clients.transport.ElasticsearchTransport
import co.elastic.clients.transport.rest_client.RestClientTransport
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import org.apache.http.HttpHost
import org.apache.http.auth.AuthScope
import org.apache.http.auth.UsernamePasswordCredentials
import org.apache.http.client.CredentialsProvider
import org.apache.http.impl.client.BasicCredentialsProvider
import org.elasticsearch.client.RestClient
import searchengine.indexer.cleanUrl
import searchengine.indexer.getDomain
import searchengine.types.BackLink
import searchengine.types.ForwardLink
import searchengine.types.PageType

class Elastic(private val elasticIndex: String? = null) {
    private val client: ElasticsearchClient

    init {
        val credentialsProvider: CredentialsProvider = BasicCredentialsProvider()
        credentialsProvider.setCredentials(
            AuthScope.ANY, UsernamePasswordCredentials("elastic", "testerino")
        )

        val restClient = RestClient.builder(
            HttpHost("localhost", 9200)
        ).setHttpClientConfigCallback { httpClientBuilder ->
            httpClientBuilder.disableAuthCaching()
            httpClientBuilder.setDefaultCredentialsProvider(credentialsProvider)
        }.build()

        val transport: ElasticsearchTransport = RestClientTransport(
            restClient, JacksonJsonpMapper()
        )
        client = ElasticsearchClient(transport)
    }

    suspend fun indexPage(page: PageType, index: String? = elasticIndex, id: String? = null): IndexResponse =
        coroutineScope {
            val indexRequest = IndexRequest.of<PageType> {
                if (id != null) it.id(id)
                it.index(index)
                it.document(page)
            }
            val res = async { client.index(indexRequest) }
            res.await()
        }

    suspend fun docsByUrlOrNull(url: String, index: String? = elasticIndex): List<Hit<PageType>>? = coroutineScope {
        val search2: SearchResponse<PageType> = withContext(Dispatchers.Default) {
            client.search({ s: SearchRequest.Builder ->
                s.index(index).query { query ->
                    query.term { term ->
                        term.field("address.url").value { value ->
                            value.stringValue(url)
                        }
                    }
                }
            }, PageType::class.java)
        }
        val hits = search2.hits().hits()
        return@coroutineScope hits.ifEmpty { null }
    }

    private suspend fun putDocBacklinkInfoByUrl(
        docUrl: String,
        originBackLink: BackLink,
        index: String? = elasticIndex
    ): Unit = coroutineScope {
        val docsByUrls = withContext(Dispatchers.Default) { docsByUrlOrNull(docUrl, index) }
        var doc = docsByUrls?.firstOrNull()?.source()
        val id = docsByUrls?.firstOrNull()?.id()
        if (doc == null) {
            println("making new doc for $docUrl")
            doc = PageType(docUrl)
        }
        val backLinksWithOrigin: List<BackLink> =
            (doc.inferredData.backLinks + originBackLink).distinctBy { it.source }

        doc.inferredData.backLinks = backLinksWithOrigin
        doc.inferredData.domainName = getDomain(docUrl)

        indexPage(doc, id = id)
        println("Indexed backlink info, url: $docUrl with id $id, backlinks: ${backLinksWithOrigin.count()}")
    }

    suspend fun putDocsBacklinkInfoByUrl(
        docForwardLinks: List<ForwardLink>,
        originUrl: String,
        index: String? = elasticIndex
    ): Unit = coroutineScope {
        docForwardLinks.forEach { docForwardLink ->
            if (docForwardLink.href != originUrl) {
                withContext(Dispatchers.Default) {
                    putDocBacklinkInfoByUrl(
                        cleanUrl(docForwardLink.href),
                        BackLink(docForwardLink.text, originUrl),
                        index
                    )
                }
            }
        }
    }
}
