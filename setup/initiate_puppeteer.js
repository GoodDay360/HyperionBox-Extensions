import puppeteer from 'puppeteer-core';


export const initiate_puppeteer = async (browser_path, headless=true) => {
    if (!browser_path) {
        console.error("Missing 'browser_path' argument."); 
        return {code:500, message: "Missing 'browser_path' argument."};
    }
    const browser = await puppeteer.launch({
        browser:"firefox",
        executablePath: browser_path,
        headless,
        extraPrefsFirefox: {
            'dom.allow_scripts_to_close_windows': true,
        },
    });
    return {code:200, message:"OK", browser};
}


export const load_new_page = async (browser) => {
    if (browser === null)  return {code:500, message: "Puppeteer not initiate_puppeteer yet!"};
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    await page.setViewport({width: 1080, height: 1024});
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:104.0) Gecko/20100101 Firefox/104.0');
    await page.evaluateOnNewDocument(() => {
        delete navigator.__proto__.webdriver;
    });

    return {code:200, message:"OK", browser_page:page};
}

