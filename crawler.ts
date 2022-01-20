import {DEBUG, elasticAddress} from "./config"
import * as puppeteer from "puppeteer"
import {Client} from "elasticsearch"
import {CrawlPage} from "./page-crawler"
import {Page} from "./page-types"

export class Crawler extends CrawlPage {
    client = new Client({node: elasticAddress})
    browser: puppeteer.Browser
    crawledPagesAmount: number = 0
    newlyCrawledPagesAmount: number = 0
    sessionCrawled: Array<string> = []
    sessionStart = new Date().getTime()

    constructor(private startUrl: string, private maxDepth: number, private maxPages: number, private index: string) {
        super()
        this.browser = this.browser
    }

    async run() {
        this.browser = await this.launchBrowser()
        await this.recursiveCrawling(this.startUrl, 0)

        await this.stop()
    }

    async stop() {
        console.log("\n\nStopping crawler")
        console.log(`Crawled pages: ${this.crawledPagesAmount}\nNewly indexed: ${this.newlyCrawledPagesAmount}\ntook: ${(new Date().getTime() - this.sessionStart) / 1000} seconds\n`)
        await this.browser.close()
    }

    async launchBrowser() {
        return await puppeteer.launch({
            headless: true,
        });
    }

    async elasticIndex(body: Page) {
        const result = await this.client.index({
            index: this.index,
            body: body
        })
        return result
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
        return result.hits.total.value > 0
    }

    async safeCrawlPage(url: string): Promise<Page | null> {
        if (this.sessionCrawled.includes(url)) {
            console.log(`                  - Page already crawled this session: ${url} `)
            return null
        } else this.sessionCrawled.push(url)

        if (await this.isPageIndexed(url)) {
            console.log(`(${String(this.newlyCrawledPagesAmount).padStart(6, ' ')} / ${String(this.crawledPagesAmount).padStart(6, ' ')}) - Page already indexed in DB: ${url}`)
            return DEBUG ? (await this.crawlPage(this.browser, url)) : null
        } else {
            this.newlyCrawledPagesAmount += 1
            console.log(`(${String(this.newlyCrawledPagesAmount).padStart(6, ' ')} / ${String(this.crawledPagesAmount).padStart(6, ' ')}) - Indexing page: ${url}`)
            const page = await this.crawlPage(this.browser, url)
            await this.elasticIndex(page)
            return page
        }
    }

    async recursiveCrawling(url: string, depth: number) {
        const page = await this.safeCrawlPage(this.cleanUrl(url))
        if (page) {
            const links = await page.body.internalLinks
            for (const link of links) {
                if (this.crawledPagesAmount < this.maxPages && depth < this.maxDepth) {
                    this.crawledPagesAmount += 1
                    await this.recursiveCrawling(link.href, depth + 1)
                } else {
                    break
                }
            }
        }
    }
}
