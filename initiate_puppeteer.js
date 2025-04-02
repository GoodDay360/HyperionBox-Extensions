import puppeteer from 'puppeteer-core';

const initiate_puppeteer = async (options) => {
    if (!options.browser_path) {
        console.error("Missing 'browser_path' argument."); 
        return {code:500, message: "Missing 'browser_path' argument."};
    }
    const browser = await puppeteer.launch({
        browser:"firefox",
        executablePath: options.browser_path,
        headless:true,
    });
    const page = await browser.newPage();
    await page.setViewport({width: 1080, height: 1024});
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:104.0) Gecko/20100101 Firefox/104.0');
    await page.evaluateOnNewDocument(() => {
        delete navigator.__proto__.webdriver;
    });

    return {code:200, message:"OK", data: {browser, page}};
}

export default initiate_puppeteer;