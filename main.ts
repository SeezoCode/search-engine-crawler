import {Crawler} from "./crawler"

let crawler = new Crawler("https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-get.html", 3, 1000, "se12")
crawler.run()
process.on('SIGINT', async () => {
    await crawler.stop()
    await console.log('\nCrawler stopped')
    process.exit(0)
})
