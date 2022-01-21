import {Crawler} from "./crawler";
import {domainLimit, elasticIndex, maxDepth, maxPages, visitExternalDomains} from "./config";
import {parentPort} from "worker_threads";

let crawler: Crawler | null = null;

parentPort?.once('message', async (message: any) => {
    console.log(message, "starting");
    if (message != "exit") {
        crawler = new Crawler(message, maxDepth, maxPages, elasticIndex, domainLimit, visitExternalDomains)
        crawler.run().then()
    }

    if (message == "exit") {
        await crawler?.stop()
    }
})
