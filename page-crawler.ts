import * as puppeteer from "puppeteer"
import {Page, PageBodyHeadings, PageLink} from "./page-types"

interface MetaTag {
    name: string
    content: string
}


export class CrawlPage {
    constructor() {
    }

    async crawlPage(browser: puppeteer.Browser, url: string): Promise<Page> {
        const page: puppeteer.Page = await browser.newPage();
        await page.goto(url, {
            // waitUntil: 'networkidle2'
        });
        const doc = await this.mapPageToObject(page, url)
        await page.close()
        return doc
    }

    async getMeta(page: puppeteer.Page): Promise<MetaTag[]> {
        const arr = page.$$eval("head > meta", tags => tags.map(tag => {
            return {
                name: tag.getAttribute("name") || tag.getAttribute("property"),
                content: tag.getAttribute('content')
            }
        }))
        return arr
    }

    async getBodyAsPlaintext(page: puppeteer.Page): Promise<string> {
        return page.evaluate(() => document.body.innerText)
    }

    async getBodyAsHTML(page: puppeteer.Page): Promise<string> {
        const body = page.evaluate(() => document.body.innerHTML)
        return body
    }

    protected cleanUrl(url: string): string {
        const urlParts = url.split('?')
        if (urlParts[0].endsWith('/#') || urlParts[0].endsWith('#')) {
            urlParts[0] = urlParts[0].slice(0, -1)
        }
        if (urlParts[0].endsWith('/')) {
            urlParts[0] = urlParts[0].slice(0, -1)
        }
        return urlParts[0]
    }

    async getPageLinks(page: puppeteer.Page): Promise<Array<PageLink>> {
        return page.$$eval("a", links => links.map((link: HTMLLinkElement) => {
            const urlParts = link.href.split('?')
            if (urlParts[0].endsWith('/#') || urlParts[0].endsWith('#')) {
                urlParts[0] = urlParts[0].slice(0, -1)
            }
            if (urlParts[0].endsWith('/')) {
                urlParts[0] = urlParts[0].slice(0, -1)
            }
            return {
                innerText: link.innerText,
                href: urlParts[0],
                bias: 0.
            }
        }))
    }

// TODO: assing bias value to links like "dowload" or "about"
    determineLinkTypes(links: PageLink[], url: string): { internal: Array<PageLink>, external: Array<PageLink> } {
        const obj = {
            internal: [],
            external: []
        }
        for (let link of links) {
            if (link && link.href) {
                if (link.href.split("/")[2]?.startsWith(url.split("/")[2])) {
                    obj.internal.push(link)
                } else {
                    obj.external.push(link)
                }
            }
        }
        return obj
    }

    async getLanguage(page: puppeteer.Page): Promise<string> {
        return page.evaluate(() => {
            return document.querySelector("html").getAttribute("lang")
        })
    }

//  Promise<Array<Array<string>>>
    async getHeadings(page: puppeteer.Page): Promise<PageBodyHeadings> {
        let obj: PageBodyHeadings = {
            h1: [],
            h2: [],
            h3: [],
            h4: [],
            h5: [],
            h6: []
        }
        for (let i = 1; i <= 6; i++) {
            obj[`h${i}`] = await page.$$eval(`h${i}`, links => links.map((link: HTMLHeadingElement) => link.innerText.replace(/\s+/g, " ")))
        }
        return obj
    }

    async getArticle(page: puppeteer.Page): Promise<string> {
        return page.evaluate(() => {
            return document.querySelector("article")?.innerText
        })
        return ""
    }

    async mapPageToObject(page: puppeteer.Page, url: string): Promise<Page> {
        const pageLinksPromise = this.getPageLinks(page)
        const bodyAsPlaintextPromise = this.getBodyAsPlaintext(page)
        const bodyAsHTMLPromise = this.getBodyAsHTML(page)
        const metaPromise = this.getMeta(page)
        const languagePromise = this.getLanguage(page)
        const headingsPromise = this.getHeadings(page)
        const articlePromise = this.getArticle(page)

        const pageLinks = this.determineLinkTypes(await pageLinksPromise, url)
        const bodyAsPlaintext = await bodyAsPlaintextPromise
        const bodyAsHTML = await bodyAsHTMLPromise
        const meta = await metaPromise
        const language = await languagePromise
        const headings = await headingsPromise
        const article = await articlePromise

        const metaObj: any = meta.reduce((acc, curr) => {
            acc[curr.name] = curr.content
            return acc
        }, {})

        return {
            metadata: {
                title: await page.title(),
                author: metaObj["author"] || null,
                description: metaObj["description"] || metaObj["og:description"] || null,
                openGraphImgURL: metaObj["og:image"] || null,
                openGraphTitle: metaObj["og:title"] || null,
                type: metaObj["og:type"] || null,
                tags: (metaObj["keywords"]?.split(",") || null),
                siteName: metaObj["og:site_name"] || null,
                // TODO: add checking for favicon.ico
                hasIcon: true,
                language: language || null,
            },
            body: {
                headings: {
                    h1: headings.h1,
                    h2: headings.h2,
                    h3: headings.h3,
                    h4: headings.h4,
                    h5: headings.h5,
                    h6: headings.h6
                },
                plaintext: bodyAsPlaintext?.replace(/\n|\t/g, ' '),
                article: article?.split("\n").filter(line => line.length > 0) || null,
                internalLinks: pageLinks.internal,
                externalLinks: pageLinks.external,
                imgLinks: []
            },

            url: this.cleanUrl(url),
            crawlerTimestamp: new Date().getTime(),
            userRating: 0.,
            bias: 0.,
            createdTimestamp: 0.
        }
    }
}
