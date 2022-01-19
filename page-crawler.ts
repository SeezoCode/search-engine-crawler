import * as puppeteer from "puppeteer"
import {Page, PageBodyHeadings, PageLink} from "./page-types"

export async function crawlPage(browser: puppeteer.Browser, url: string) {
    const page: puppeteer.Page = await browser.newPage();
    await page.goto(url, {
        // waitUntil: 'networkidle2'
    });
    const doc = await mapPageToObject(page, url)
    await page.close()
    return doc
}


interface MetaTag {
    name: string
    content: string
}

async function getMeta(page: puppeteer.Page): Promise<MetaTag[]> {
    console.log("getMeta")
    const arr = page.$$eval("head > meta", tags => tags.map(tag => {
        return {
            name: tag.getAttribute("name") || tag.getAttribute("property"),
            content: tag.getAttribute('content')
        }
    }))
    return arr
}

async function getBodyAsPlaintext(page: puppeteer.Page): Promise<string> {
    console.log("getBodyAsPlaintext")
    return page.evaluate(() => document.body.innerText)
}

async function getBodyAsHTML(page: puppeteer.Page): Promise<string> {
    console.log("getBodyAsHTML")
    const body = page.evaluate(() => document.body.innerHTML)
    return body
}

async function getPageLinks(page: puppeteer.Page): Promise<Array<PageLink>> {
    console.log("getPageLinks")
    return page.$$eval("a", links => links.map((link: HTMLLinkElement) => {
        return {
            innerText: link.innerText,
            href: link.href,
            bias: 0.
        }
    }))
}

// TODO: assing bias value to links like "dowload" or "about"
function determineLinkTypes(links: PageLink[], url: string): { internal: Array<PageLink>, external: Array<PageLink> } {
    console.log("determineLinkTypes")
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

async function getLanguage(page: puppeteer.Page): Promise<string> {
    console.log("getLanguage")
    return page.evaluate(() => {
        return document.querySelector("html").getAttribute("lang")
    })
}

//  Promise<Array<Array<string>>>
async function getHeadings(page: puppeteer.Page): Promise<PageBodyHeadings> {
    console.log("getHeadings")
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

async function getArticle(page: puppeteer.Page): Promise<string> {
    console.log("getArticle")
    try {
        page.$$eval("article", (article: any[]) => article[0]?.innerText)
    } catch (e) {
        return ""
    }
    return ""
}

// async function hasFaviIcon(page: puppeteer.Page, url: string) {
//     // http request to url + favicon.ico
//     https.request(url + "/favicon.ico", res => {
//         if (res.statusCode === 200) {
//             return true
//         }
//         return false
//     })
// }

// Promise<Page>
async function mapPageToObject(page: puppeteer.Page, url: string): Promise<Page> {
    const pageLinksPromise = getPageLinks(page)
    const bodyAsPlaintextPromise = getBodyAsPlaintext(page)
    const bodyAsHTMLPromise = getBodyAsHTML(page)
    const metaPromise = getMeta(page)
    const languagePromise = getLanguage(page)
    const headingsPromise = getHeadings(page)
    const articlePromise = getArticle(page)

    const pageLinks = determineLinkTypes(await pageLinksPromise, url)
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
            icon: true,
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
            article: article.split("\n").filter(line => line.length > 0),
            internalLinks: pageLinks.internal,
            externalLinks: pageLinks.external,
        },

        url: url,
        crawlerTimestamp: new Date().getTime(),
        userRating: 0.,
        bias: 0.,
    }
}
