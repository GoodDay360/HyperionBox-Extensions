import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath, pathToFileURL} from 'url'


const get_episodes = async (options) => {
    try{
        await options.browser_page.evaluate(() => {
            window.stop();
        });
        await options.browser_page.goto(encodeURI(`${options.domain}/watch/${options.preview_id}`));
        
        
        await options.browser_page.waitForSelector(".detail-infor-content",{timeout: 5000});

        const data = await options.browser_page.evaluate(()=> {
            const result = [];

            const detail_infor_content = document.querySelector(".detail-infor-content");
            const ss_list = detail_infor_content.querySelectorAll(".ss-list");
            
            for (const ss of ss_list) {
                const result_per_box = []
                const ssl_item = ss.querySelectorAll(".ssl-item");
                for (const ssl of ssl_item) {
                    const item = {}
                    item.index = parseInt(ssl.getAttribute("data-number"), 10);
                    item.title = ssl.getAttribute("title");
                    item.id = ssl.getAttribute("data-id");
                    result_per_box.push(item)
                }
                result.push(result_per_box)
            }
            return [result];
        })
        return {code:200, message:"OK", result:data}
    }catch(e){
        console.error(e)
        return {code:500, message:e};
    }fi
}

export default get_episodes;