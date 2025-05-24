import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath, pathToFileURL} from 'url'
import initiate_puppeteer from '../../initiate_puppeteer.js';

const get_episodes = async (options) => {
    const result_initiate_puppeteer = await initiate_puppeteer(options);
    let browser, page;
    try{
        if (result_initiate_puppeteer.code === 200){
            browser = result_initiate_puppeteer.data.browser;
            page = result_initiate_puppeteer.data.page;
        }else{
            return {code:500, message:"Fail to initiate puppeteer"};
        }
        

        await page.goto(encodeURI(`https://hianime.to/watch/${options.preview_id}`));
        // await page.goto("https://bot.sannysoft.com/")
        console.log(encodeURI(`https://hianime.to/watch/${options.preview_id}`))
        
        await page.waitForSelector(".detail-infor-content",{timeout: 5000});

        const data = await page.evaluate(()=> {
            const result = [];

            const detail_infor_content = document.querySelector(".detail-infor-content");
            const ss_list = detail_infor_content.querySelectorAll(".ss-list");
            
            for (const ss of ss_list) {
                const result_per_box = []
                const ssl_item = ss.querySelectorAll(".ssl-item");
                for (const ssl of ssl_item) {
                    const item = {}
                    item.index = parseInt(ssl.getAttribute("data-number"));
                    item.title = ssl.getAttribute("title");
                    item.id = ssl.getAttribute("data-id");
                    result_per_box.push(item)
                }
                result.push(result_per_box)
            }
            return result;
        })
        return {code:200, message:"OK", result:data}
    }catch(e){
        console.error(e)
        return {code:500, message:e};
    }finally{
        await browser.close();
    }
}

export default get_episodes;