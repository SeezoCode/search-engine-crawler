import * as puppeteer from "puppeteer"
import {Page, PageBodyHeadings, PageLink} from "./page-types"

interface MetaTag {
    name: string
    content: string
}

export class ScrapePage {
    constructor() {}

    async scrape(browser: puppeteer.Browser, url: string): Promise<Page> {
        const page: puppeteer.Page = await browser.newPage();
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 120000
        });
        const doc = await this.mapPageToObject(page, url)
        await page.close()
        return doc
    }

    private static async getMeta(page: puppeteer.Page): Promise<MetaTag[]> {
        // @ts-ignore
        return page.$$eval("head > meta", tags => tags.map(tag => {
            return {
                name: tag.getAttribute("name") || tag.getAttribute("property"),
                content: tag.getAttribute('content')
            }
        }))
    }

    private async getBodyAsPlaintext(page: puppeteer.Page): Promise<string> {
        return page.evaluate(() => document.body.innerText)
    }

    cleanUrl(url: string): string {
        const urlParts = url.split('?')
        if (urlParts[0].endsWith('/#') || urlParts[0].endsWith('#')) {
            urlParts[0] = urlParts[0].slice(0, -1)
        }
        if (urlParts[0].endsWith('/')) {
            urlParts[0] = urlParts[0].slice(0, -1)
        }
        urlParts[0] = urlParts[0].replace("www.", "")
        return urlParts[0].split('#')[0]
    }

    private async getPageLinks(page: puppeteer.Page): Promise<Array<PageLink>> {
        // @ts-ignore
        return page.$$eval("a", links => links.map((link: HTMLLinkElement) => {
            function cleanUrl(url: string): string {
                const urlParts = url.split('?')
                if (urlParts[0].endsWith('/#') || urlParts[0].endsWith('#')) {
                    urlParts[0] = urlParts[0].slice(0, -1)
                if (urlParts[0].endsWith('/')) {
                    urlParts[0] = urlParts[0].slice(0, -1)
                }
                urlParts[0] = urlParts[0].replace("www.", "")
                }
                return urlParts[0].split('#')[0]
            }
            return {
                innerText: link.innerText,
                href: cleanUrl(link.href),
                bias: 0.
            }
        }))
    }

    // TODO: assign bias value to links like "download" or "about"
    private static determineLinkTypes(links: PageLink[], url: string): { internal: Array<PageLink>, external: Array<PageLink> } {
        const obj: {internal: PageLink[], external: PageLink[]} = {
            internal: [],
            external: []
        }
        for (let link of links) {
            if (link && link.href) {
                const text = ScrapePage.polishPlaintextToArray(link.innerText).join(' ')
                const linkObj = {
                    innerText: text.length > 0 ? text : "EmptyTextLink",
                    href: link.href,
                    bias: 0.
                }
                if (link.href.split("/")[2] == url.split("/")[2].replace("www.", "")) {
                    obj.internal.push(linkObj)
                } else {
                    obj.external.push(linkObj)
                }
            }
        }
        return obj
    }

    private async getLanguage(page: puppeteer.Page): Promise<string | null> {
        return page.evaluate(() => {
            const attribute = document.querySelector("html")
            if (attribute) {
                return attribute.getAttribute("lang")
            }
            else return null
        })
    }

//  Promise<Array<Array<string>>>
    private static async getHeadings(page: puppeteer.Page): Promise<PageBodyHeadings> {
        let obj: PageBodyHeadings = {
            h1: [],
            h2: [],
            h3: [],
            h4: [],
            h5: [],
            h6: []
        }
        for (let i = 1; i <= 6; i++) {
            // @ts-ignore
            obj[`h${i}`] = await page.$$eval(`h${i}`, links => links.map((link: HTMLHeadingElement) => link.innerText.replace(/\s+/g, " ")))
        }
        return obj
    }

    private async getArticle(page: puppeteer.Page): Promise<string | null> {
        return page.evaluate(() => {
            const article = document.querySelector("article")
            if (article) {
                return article.innerText
            }
            else return null
        })
    }

    private static polishPlaintextToArray(text: string): string[] {
        return text.replace(/[\t]/g, ' ').toLowerCase().split("\n").filter(Boolean)
    }

    async mapPageToObject(page: puppeteer.Page, url: string): Promise<Page> {
        const pageLinksPromise = this.getPageLinks(page)
        const bodyAsPlaintextPromise = this.getBodyAsPlaintext(page)
        const metaPromise = ScrapePage.getMeta(page)
        const languagePromise = this.getLanguage(page)
        const headingsPromise = ScrapePage.getHeadings(page)
        const articlePromise = this.getArticle(page)

        const pageLinks = ScrapePage.determineLinkTypes(await pageLinksPromise, url)
        const bodyAsPlaintext = await bodyAsPlaintextPromise
        const meta = await metaPromise
        const language = await languagePromise
        const headings = await headingsPromise
        const article = await articlePromise

        const metaObj: any = meta.reduce((acc: any, curr) => {
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
                plaintext: ScrapePage.polishPlaintextToArray(bodyAsPlaintext) || null,
                article: article?.split("\n").filter(line => line.length > 0) || null,
                internalLinks: pageLinks.internal,
                externalLinks: pageLinks.external,
            },
            url: this.cleanUrl(url),
            crawlerTimestamp: new Date().getTime(),
            userRating: 0.,
            bias: 0.,
            createdTimestamp: 0.
        }
    }
}
