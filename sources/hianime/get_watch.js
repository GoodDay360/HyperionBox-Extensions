import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath, pathToFileURL} from 'url'
import convert_hls from '../../scripts/convert_hls.js';

const get_watch = async (options) => {
    try{
        await options.browser_page.goto(encodeURI(`${options.domain}/watch/${encodeURIComponent(options.preview_id)}?ep=${encodeURIComponent(options.watch_id)}`));
        if (options.server_type || options.server_id){
            await options.browser_page.evaluate((server_type,server_id)=>{
                if (server_type) localStorage.setItem('currentSource', server_type);
                if (server_id) localStorage.setItem('v2.7_currentServer', server_id);
            }, options.server_type,options.server_id)
        }
        await options.browser_page.reload(); 
        
        const data = {}
        options.browser_page.removeAllListeners("request");
        data.media_info = await new Promise((resolve) => {
            const data = {};
            data.track = []
            let timeoutHandle;
            const timeout = 8000;
            options.browser_page.on('request', async (interceptedRequest) => {
                if (interceptedRequest.isInterceptResolutionHandled()) return;

                const url = interceptedRequest.url();

                const reset_timout = () =>{
                    clearTimeout(timeoutHandle);
                    timeoutHandle = setTimeout(() => {
                        resolve(data); 
                        options.browser_page.removeAllListeners("request");
                    }, timeout/2);
                }

                if (url.endsWith('.vtt')) {
                    if (!data.track.includes(url)) {
                        const url_obj = new URL(url);
                        const fileName = url_obj.pathname.split('/').pop().split('.').slice(0, -1).join('.');
                        data.track.push({
                            url,
                            label:fileName,
                            kind:"captions"
                        });
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
                options.browser_page.removeAllListeners("request");
            }, timeout);
        });

        await options.browser_page.waitForSelector("#servers-content",{timeout: 5000});
        await options.browser_page.waitForSelector(".server-item",{timeout: 5000});

        data.server_info = await options.browser_page.evaluate(()=> {
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
                    dub.push({title,server_id})
                }
            }
            result.server_list = {};
            if (sub.length > 0) result.server_list.sub = sub;
            if (dub.length > 0) result.server_list.dub = dub;
            
            return result;
        })

        // get list of url and quality
        const list_of_url = [];
        const original_url = new URL(data.media_info.temp_url);
        console.log("original", original_url)
        if (original_url.hostname === "douvid.xyz"){
            list_of_url.push({
                quality: 1080,
                url: original_url.href,
            })
        }else{
            const file_name = original_url.pathname.split("/").pop();
            const splited_file_name = file_name.split("-");
            const basePath = original_url.pathname.split("/").slice(0, -1).join("/");
            for (let i = 1; i <= 3; i++){
                const result = {}
                const managed_file_name = [splited_file_name[0], `f${i}`, ...splited_file_name.slice(2)];
                const file_name = managed_file_name.join("-");
                result.quality = i === 1 ? 1080 : i === 2 ? 720 : 360;
                result.url = `${original_url.origin}${basePath}/${file_name}`;
                list_of_url.push(result)
            }
        }
        console.log("SEVERINFO", data.server_info)
        data.media_info.source = []
        for (const item of list_of_url) {
            try{
                const cache_dir = path.join(options.cache_dir, "watch", options.source_id, options.preview_id, options.watch_id)
                fs.mkdirSync(cache_dir, { recursive: true });
                const output = path.join(cache_dir, `${item.quality}.m3u8`)
                const parsed_temp_url = new URL(item.url);
                const request_convert_result = await convert_hls({
                    url: item.url,
                    referer: 'https://megacloud.blog/',
                    route: data.server_info.current_server_id === "1" ? `${parsed_temp_url.origin}${parsed_temp_url.pathname.substring(0, parsed_temp_url.pathname.lastIndexOf('/'))}/` : "",
                    output,
                    options,
                });
                console.log("E", request_convert_result)
                if (request_convert_result.code === 200) data.media_info.source.push({
                    quality: item.quality,
                    uri: request_convert_result.uri,
                    type: "local",
                });
            }catch(e){
                console.error(e)
            }
        }
        delete data.media_info.temp_url;
        // =================================

        

        await options.browser_page.waitForSelector(".detail-infor-content",{timeout: 5000});
        data.episodes = await options.browser_page.evaluate(()=> {
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
            return result;
        })
        data.type_schema = 1;
        return {code:200, message:"OK", result:data}
    }catch(e){
        console.error(e)
        return {code:500, message:e};
    }
}

export default get_watch;