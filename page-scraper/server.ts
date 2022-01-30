import * as puppeteer from "puppeteer";
import {ScrapePage} from "./page-scraper";
const bodyParser = require("body-parser")

const express = require('express');

const app = express();
app.use(bodyParser.json());

const crawlPage = new ScrapePage()

puppeteer.launch({
    headless: true,
    args: [
        "--no-sandbox",
    ]
}).then(browser => {
    app.post('/crawler', async function (request: { body: any; }, response: any ) {
        console.log("url:",request.body.url)
        try {
            response.send(await crawlPage.scrape(browser, request.body.url))
        } catch (e: any) {
            console.log(e)
            return response.status(400).send({
                message: "Server error occurred while scraping",
            });
        }
    });

    app.get('/', function (request: { body: any; }, response: { send: (arg0: any) => void; }) {
        response.send('Welcome to the page synthesizer! Please make a POST request to /crawler with a JSON body' +
            ' containing a "url" property. Example: curl -d \'{"url":"https://google.com"}\' -H "Content-Type:' +
            ' application/json" -X POST [Server URL]/crawler')
    });

    app.listen(8080);
});



