import {domainLimit, elasticIndex, maxDepth, maxPages, startingUrls, visitExternalDomains} from "./config";
import {Crawler} from "./crawler";
// import {fork} from "child_process";

let crawler = new Crawler(startingUrls[0], maxDepth, maxPages, elasticIndex, domainLimit, visitExternalDomains)
crawler.run().then()

process.on('SIGINT', async () => {
    await crawler.stop()
    await console.log('\nExiting...')
    process.exit(0)
})

// TODO: implement a better multithreading solution
// fork("worker.js", [startingUrls[0]])
// fork("worker.js", [startingUrls[1]])
// fork("worker.js", [startingUrls[2]])
// fork("worker.js", [startingUrls[3]])

