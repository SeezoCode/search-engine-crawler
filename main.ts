import {domainLimit, elasticIndex, maxDepth, maxPages, startingUrls, visitExternalDomains} from "./config";
import {Crawler} from "./crawler";

let crawler = new Crawler(startingUrls[0], maxDepth, maxPages, elasticIndex, domainLimit, visitExternalDomains)
crawler.run().then()

process.on('SIGINT', async () => {
    await crawler.stop()
    await console.log('\nExiting...')
    process.exit(0)
})



// Concurrent crawler
// import {concurrency} from "./config";
// import {Worker} from "worker_threads";
// import "./worker"
//
// for (let i = 0; i < startingUrls.length; i++) {
//     if (i < threads && i < startingUrls.length) {
//         const worker = new Worker("./worker.js");
//         worker.postMessage(startingUrls[i]);
//         process.on('SIGINT', async () => {
//             await worker.postMessage('exit');
//             await console.log(`Exiting: ${startingUrls[i]}`)
//         })
//     }
// }


