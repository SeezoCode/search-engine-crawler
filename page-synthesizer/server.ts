import * as puppeteer from "puppeteer";
import {SynthesizePage} from "./page-synthesizer";
const bodyParser = require("body-parser")

const express = require('express');

const app = express();
app.use(bodyParser.json());

const crawlPage = new SynthesizePage()

puppeteer.launch({
    headless: true,
    args: [
        "--no-sandbox",
    ]
}).then(browser => {
    app.post('/crawler', async function (request: { body: any; }, response: { send: (arg0: any) => void; }) {
        console.log(request.body);      // your JSON
        response.send(await crawlPage.synthesize(browser, request.body.url))
    });

    app.get('/', function (request: { body: any; }, response: { send: (arg0: any) => void; }) {
        response.send('Welcome to the page synthesizer! Please make a POST request to /crawler with a JSON body' +
            ' containing a "url" property. Example: curl -d \'{"url":"https://google.com"}\' -H "Content-Type:' +
            ' application/json" -X POST [Server URL]/crawler')
    });

    app.listen(8080);
});



