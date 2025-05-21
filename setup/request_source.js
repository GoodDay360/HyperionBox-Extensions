

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc);

import source_manager from './source_manager.js';
import { load_new_page } from './initiate_puppeteer.js';

const request_source = async ({options,response,browser,request_timeout})=>{
    try {
        const last_timestamp = dayjs.utc().unix()
        while (true){
            const browser_pages = await browser.pages();
            if (browser_pages.length <= 1) break;
            else if ((dayjs.utc().unix() - last_timestamp) >= 15){
                request_timeout = true
                for (let i = 1; i < browser_pages.length; i++) {
                    await browser_pages[i].evaluate(() => {
                        window.opener = null;
                        window.stop();
                        window.close();
                    });
                    browser_pages[i].close()
                }
                break;
            }
        };while (request_timeout == true);

        
        const result_load_new_page = await load_new_page(browser);
        if (result_load_new_page.code === 200){
            options.browser_page = result_load_new_page.browser_page;
        }else{
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.write({code:200, message:"Fail to load new page"});
            response.end();
            return;
        }

        
        let result;
        try{result = await source_manager(options)}
        catch(e) {console.error(e)}
        
        const browser_pages = await browser.pages();
        for (let i = 1; i < browser_pages.length; i++) {
            console.log(browser_pages[i].url())
            await browser_pages[i].evaluate(() => {
                window.opener = null;
                window.stop();
                window.close();
            });
            browser_pages[i].close()
        }
        
        if (!request_timeout){
            response.writeHead(result.code === 200 ? 200 : 500, { 'Content-Type': 'application/json' });
            response.write(JSON.stringify(result));
            response.end();
        }else{
            response.writeHead(400, { 'Content-Type': 'text/plain' });
            response.write('Request timeout!');
            response.end();
        }
        request_timeout = false
    } catch (error) {
        console.error('Error parsing JSON:', error);
        response.writeHead(400, { 'Content-Type': 'text/plain' });
        response.write(JSON.stringify(error));
        response.end();
        request_timeout = false
    }
}

export default request_source;