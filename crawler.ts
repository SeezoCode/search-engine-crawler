import {elasticAddress, timeUntilReindex} from "./config"
import * as puppeteer from "puppeteer"
import {Client} from "elasticsearch"
import {CrawlPage} from "./page-crawler"
import {Page} from "./page-types"


export class Crawler extends CrawlPage {
    // @ts-ignore
    client = new Client({node: elasticAddress})
    browser: puppeteer.Browser | undefined
    crawledPagesAmount: number = 0
    newlyCrawledPagesAmount: number = 0
    sessionCrawled: Array<string> = []
    sessionStart = new Date().getTime()

    constructor(private startUrl: string, private maxDepth: number, private maxPages: number, private index: string, private domainLimit: number | null = null, private visitExternalDomains = true) {
        super()
    }

    async run() {
        this.browser = await this.launchBrowser()
        await this.recursiveCrawling(this.startUrl, 0)

        await this.stop()
    }

    async stop() {
        console.log("\n\nStopping crawler")
        console.log(`Crawled pages: ${this.crawledPagesAmount}\nNewly indexed: ${this.newlyCrawledPagesAmount}\nTook: ${(new Date().getTime() - this.sessionStart) / 1000} seconds\n`)
        await this.browser?.close()
    }

    async launchBrowser() {
        return puppeteer.launch({
            headless: true,
        });
    }

    async elasticIndex(body: Page) {
        const now = Date.now()
        // @ts-ignore
        const index = await this.client.index({
            index: this.index,
            body: body
        })
        console.log(`Indexed page in ${Date.now() - now}ms`)
        return index
    }

    async isPageIndexed(url: string) {
        const result = await this.client.search({
            index: this.index,
            body: {
                query: {
                    match: {
                        url: url
                    }
                }
            }
        })
        return {
            // @ts-ignore
            hits: result.hits.total.value,
            // @ts-ignore
            crawlerTimestamp: result.hits.hits[0]?._source.crawlerTimestamp,
            // @ts-ignore
            source: result.hits.hits[0]?._source,
            id: result.hits.hits[0]?._id
        }
    }

    async deleteId(index: string) {
        // @ts-ignore
        await this.client.delete({
            index: this.index,
            id: index
        })
    }

    isUrlLegit(url: string) {
        if (url.endsWith(".jpg")) return false
        if (url.endsWith(".png")) return false
        if (url.endsWith(".gif")) return false
        if (url.endsWith(".tar")) return false
        return !url.endsWith(".zip");
    }

    hasPageContent(page: Page): boolean {
        const plaintext = page.body.plaintext
        if (plaintext) {
            if (plaintext.length > 0) return true
        }
        return false
    }

    async safeCrawlPage(url: string): Promise<Page | null> {
        if (this.sessionCrawled.includes(url) || !this.isUrlLegit(url)) {
            // console.log(`                  - Page already crawled this session: ${url} `)
            return null
        } else {
            this.sessionCrawled.push(url)
            this.crawledPagesAmount += 1
            // @ts-ignore
            const isPageIndexed: { hits: number, crawlerTimestamp: number, source: Page, id: string } = await this.isPageIndexed(url)
            if (isPageIndexed.hits > 0) {
                console.log(`(${String(this.newlyCrawledPagesAmount).padStart(6, ' ')} / ${String(this.crawledPagesAmount).padStart(6, ' ')}) - Page was indexed ${isPageIndexed.hits}x ${Math.round((Date.now() - isPageIndexed.crawlerTimestamp) / 1000 / 60)}m ago: ${url}`)
                if (isPageIndexed.source.crawlerTimestamp + timeUntilReindex < Date.now()) {
                    console.log("reindexing")
                    return await this.reindexOldPage(isPageIndexed)
                }
                return isPageIndexed.source
            } else {
                return await this.handleElasticIndex(url)
            }
        }
    }

    async reindexOldPage(isPageIndexed: { hits: number, crawlerTimestamp: number, source: Page, id: string }) {
        if (this.hasPageContent(isPageIndexed.source)) {
            await this.elasticIndex(isPageIndexed.source)
            return isPageIndexed.source
        } else {
            console.log("Page is empty, deleting (id: " + isPageIndexed.id + ")")
            await this.deleteId(isPageIndexed.id)
            return null
        }
    }

    async handleElasticIndex(url: string) {
        if (!this.browser) throw new Error("Browser is not defined")

        const page = await this.crawlPage(this.browser, url)

        if (this.hasPageContent(page)) {
            this.newlyCrawledPagesAmount += 1
            console.log(`(${String(this.newlyCrawledPagesAmount).padStart(6, ' ')} / ${String(this.crawledPagesAmount).padStart(6, ' ')}) - Indexing page: ${url}`)
            await this.elasticIndex(page)
            return page
        } else {
            console.log("Page is empty, skipping")
            return null
        }
    }

    async recursiveCrawling(url: string, depth: number) {
        const page = await this.safeCrawlPage(this.cleanUrl(url))
        if (page) {
            const internalLinks = page.body.internalLinks
            if (internalLinks?.length) {
                for (let i = 0; i < internalLinks.length; i++) {
                    if (this.domainLimit && this.domainLimit > i) break
                    if (this.crawledPagesAmount < this.maxPages && depth < this.maxDepth) {
                        try {
                            await this.recursiveCrawling(internalLinks[i].href, depth + 1)
                        } catch (e) {
                            console.log(`                  - IError indexing internal: ${internalLinks[i].href}`)
                        }
                    } else break;
                }
            }
            if (this.visitExternalDomains) {
                const externalLinks = page.body.externalLinks
                if (externalLinks?.length) {
                    for (let i = 0; i < externalLinks.length; i++) {
                        if (this.crawledPagesAmount < this.maxPages && depth < this.maxDepth) {
                            try {
                                await this.recursiveCrawling(externalLinks[i].href, depth + 1)
                            } catch (e) {
                                console.log(`                  - Error indexing external: ${externalLinks[i].href}`)
                            }
                        } else break;
                    }
                }
            }
        }
    }
}
