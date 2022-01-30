import * as puppeteer from "puppeteer"
import {Page, PageBodyHeadings, PageLink} from "./page-types"

interface MetaTag {
    name: string
    content: string
}

export class ScrapePage {
    constructor() {
    }

    async scrape(browser: puppeteer.Browser, url: string): Promise<Page> {
        const page: puppeteer.Page = await browser.newPage();
        try {
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 100_000
            });
        } catch (e) {
            console.log(`Page ${url} could not be loaded dynamically, trying to load statically`);
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 50_000
            });
        }
        const doc = await this.mapPageToObject(page, url)
        await page.close()
        return doc
    }

    private static async getMeta(page: puppeteer.Page): Promise<MetaTag[]> {
        // @ts-ignore
        return page.$$eval("head > meta", tags => tags.map(tag => {
            try {
                return {
                    name: tag.getAttribute("name") || tag.getAttribute("property"),
                    content: tag.getAttribute('content')
                }
            } catch (e) {
                return []
            }
        }))
    }

    private async getBodyAsPlaintext(page: puppeteer.Page): Promise<string> {
        return page.$eval("body", (body: any) => body.innerText)
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
            try {
                return {
                    innerText: link.innerText,
                    href: link.href,
                    bias: 0.
                }
            } catch (e) {
                return []
            }
        }))
    }

    // TODO: assign bias value to links like "download" or "about"
    private static determineLinkTypes(links: PageLink[], url: string): { internal: Array<PageLink>, external: Array<PageLink> } {
        const obj: { internal: PageLink[], external: PageLink[] } = {
            internal: [],
            external: []
        }
        for (let link of links) {
            if (link && link.href) {
                const text = ScrapePage.polishPlaintextToArray(link.innerText).join(' ')
                const linkObj = {
                    innerText: text.length > 0 ? ScrapePage.polishPlaintextToArray(text).join(" ") : "",
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
            try {
                const attribute = document.querySelector("html")
                if (attribute) {
                    return attribute.getAttribute("lang")
                } else return null
            } catch (e) {
                return null
            }
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
            obj[`h${i}`] = await page.$$eval(`h${i}`, headings => headings.map((h: HTMLHeadingElement) => {
                try {
                    return h.innerText
                } catch (e) {
                    return ""
                }
            }))
        }
        obj.h1 = obj.h1.map(h => ScrapePage.polishPlaintextToArray(h).join(" "))
        obj.h2 = obj.h2.map(h => ScrapePage.polishPlaintextToArray(h).join(" "))
        obj.h3 = obj.h3.map(h => ScrapePage.polishPlaintextToArray(h).join(" "))
        obj.h4 = obj.h4.map(h => ScrapePage.polishPlaintextToArray(h).join(" "))
        obj.h5 = obj.h5.map(h => ScrapePage.polishPlaintextToArray(h).join(" "))
        obj.h6 = obj.h6.map(h => ScrapePage.polishPlaintextToArray(h).join(" "))
        return obj
    }

    private async getArticle(page: puppeteer.Page): Promise<string | null> {
        return page.evaluate(() => {
            try {
                const article = document.querySelector("article")
                if (article) {
                    return article.innerText
                } else return null
            } catch (e) {
                return null
            }
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
        const description = metaObj["description"] || metaObj["og:description"]
        return {
            metadata: {
                title: await page.title(),
                author: metaObj["author"] || null,
                description: description ? ScrapePage.polishPlaintextToArray(description).join(' ') : null,
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
