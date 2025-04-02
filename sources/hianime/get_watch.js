import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath, pathToFileURL} from 'url'
import initiate_puppeteer from '../../initiate_puppeteer.js';
import convert_hls from '../../scripts/convert_hls.js';

const get_watch = async (options) => {
    const result_initiate_puppeteer = await initiate_puppeteer(options);
    let browser, page;
    try{
        if (result_initiate_puppeteer.code === 200){
            browser = result_initiate_puppeteer.data.browser;
            page = result_initiate_puppeteer.data.page;
        }else{
            return {code:500, message:"Fail to initiate puppeteer"};
        }
        
        

        await page.setRequestInterception(true);
        
        
        await page.goto(encodeURI(`https://hianime.to/watch/${encodeURIComponent(options.preview_id)}?ep=${encodeURIComponent(options.watch_id)}`));
        await page.evaluate((options)=>{
            localStorage.setItem('currentSource', options.server_type);
            localStorage.setItem('v2.6_currentServer', options.server_id);
        }, options)
        
        await page.reload(); 
        
        const data = {}
        page.removeAllListeners("request");
        data.media_info = await new Promise((resolve) => {
            const data = {};
            data.cc = []
            let timeoutHandle;
            const timeout = 8000;
            page.on('request', async (interceptedRequest) => {
                if (interceptedRequest.isInterceptResolutionHandled()) return;

                const url = interceptedRequest.url();

                const reset_timout = () =>{
                    clearTimeout(timeoutHandle);
                    timeoutHandle = setTimeout(() => {
                        resolve(data); 
                        page.removeAllListeners("request");
                    }, timeout/2);
                }

                if (url.endsWith('.vtt')) {
                    if (!data.cc.includes(url)) {
                        const url_obj = new URL(url);
                        const fileName = url_obj.pathname.split('/').pop().split('.').slice(0, -1).join('.');
                        data.cc.push({[fileName]:url});
                        console.log(`Found .vtt file: ${url}`);
                    }
                    reset_timout()
                }else if (url.endsWith('.m3u8')) {
                    const url_obj = new URL(url);
                    const fileName = url_obj.pathname.split('/').pop().split('.').slice(0, -1).join('.');
                    if (fileName != "master"){
                        data.temp_url = url;
                        data.type = "hls";
                    }
                }
            });
            timeoutHandle = setTimeout(() => {
                resolve(data); 
                page.removeAllListeners("request");
            }, timeout);
        });

        // get list of url and quality
        const list_of_url = [];
        const original_url = new URL(data.media_info.temp_url);
        const file_name = original_url.pathname.split("/").pop();
        const splited_file_name = file_name.split("-");
        const basePath = original_url.pathname.split("/").slice(0, -1).join("/");
        for (let i = 1; i <= 3; i++){
            const result = {}
            const managed_file_name = [splited_file_name[0], `f${i}`, ...splited_file_name.slice(2)];
            const file_name = managed_file_name.join("-");
            result.quality = i === 1 ? "1080p" : i === 2 ? "720p" : "360p";
            result.url = `${original_url.origin}${basePath}/${file_name}`;
            list_of_url.push(result)
        }
        
        data.media_info.source = []
        for (const item of list_of_url) {
            try{
                const cache_dir = path.join(options.cache_dir, "watch", options.source_id, options.preview_id, options.watch_id)
                await fs.mkdir(cache_dir, { recursive: true });
                const output = path.join(cache_dir, `${item.quality}.m3u8`)

                const parsed_temp_url = new URL(item.url);
                const request_convert_result = await convert_hls({
                    url: item.url,
                    referer: 'https://megacloud.club/',
                    route: options.server_id === "1" ? `${parsed_temp_url.origin}${parsed_temp_url.pathname.substring(0, parsed_temp_url.pathname.lastIndexOf('/'))}/` : "",
                    output,
                    options,
                });

                if (request_convert_result.code === 200) data.media_info.source.push({
                    quality: item.quality,
                    uri: request_convert_result.uri
                });
            }catch(e){
                console.error(e)
            }
        }
        delete data.media_info.temp_url;
        // =================================

        await page.waitForSelector("#servers-content",{timeout: 5000});
        await page.waitForSelector(".server-item",{timeout: 5000});

        

        data.server_info = await page.evaluate(()=> {
            const result = {}
            const server_content = document.querySelector("#servers-content");
            const server_item_list = server_content.querySelectorAll(".server-item")
            const sub = []
            const dub = []
            for (const item of server_item_list) {
                const server_type = item.getAttribute("data-type");
                const server_id = item.getAttribute("data-server-id");
                const title = item.querySelector("a").textContent;
                if (item.querySelector("a").classList.contains("active")){
                    result.current_server_id = server_id
                    result.current_server_type = server_type
                }
                if (server_type == "sub") {
                    sub.push({
                        title,
                        server_id,
                    })
                } else if (server_type == "dub") {
                    dub.push({
                        title,
                        server_id,
                    })
                }
            }
            result.server_list = {sub,dub};
            
            return result;
        })

        await page.waitForSelector(".detail-infor-content",{timeout: 5000});
        data.episodes = await page.evaluate(()=> {
            const result = [];

            const detail_infor_content = document.querySelector(".detail-infor-content");
            const ss_list = detail_infor_content.querySelectorAll(".ss-list");
            
            for (const ss of ss_list) {
                const result_per_box = []
                const ssl_item = ss.querySelectorAll(".ssl-item");
                for (const ssl of ssl_item) {
                    const item = {}
                    item.index = ssl.getAttribute("data-number");
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

export default get_watch;