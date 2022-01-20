import {Crawler} from "./crawler";
import {domainLimit, elasticIndex, maxDepth, maxPages, visitExternalDomains} from "./config";

console.log(process.argv[2], "starting");
let crawler = new Crawler(process.argv[2], maxDepth, maxPages, elasticIndex, domainLimit, visitExternalDomains)
crawler.run().then()

process.on('SIGINT', async () => {
    await crawler.stop()
    await console.log('\nExiting...')
    process.exit(0)
})
