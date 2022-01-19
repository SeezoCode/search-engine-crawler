import * as puppeteer from "puppeteer"
import {Page, PageBodyHeadings, PageLink} from "./page-types"
import {crawlPage} from "./page-crawler"

async function siteCrawl(url: string) {
    const browser = await puppeteer.launch({
        headless: true,
    });

    let a = crawlPage(browser, url)

    console.log(await a)
    await browser.close()
}

siteCrawl("https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of")



