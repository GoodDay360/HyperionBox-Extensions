import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { convert_master, convert_player } from '../../../scripts/manage_hls.js';
import * as cheerio from 'cheerio';
import custom_fetch_headers from '../../../scripts/custom_fetch_headers.js';
import AbortController from 'abort-controller';


const server_3 = async ({server_id, server_link, options})=>{return await new Promise(async (resolve) => {
    
    const data = {}


    data.track = [];

    // Get media source using headless browser.
    ;await (async () => {
        const server_link_domain = new URL(server_link).hostname;

        let url_for_media = ""

        options.browser_page.on('request', async (interceptedRequest) => {
            if (interceptedRequest.isInterceptResolutionHandled()) return;
            const url = interceptedRequest.url();
            if (url.includes("https://vidlink.pro/api/b/movie/") || url.includes("https://vidlink.pro/api/b/tv/")) {
                url_for_media = url;

                options.browser_page.removeAllListeners("request");
                
            }
        });

        await options.browser_page.setExtraHTTPHeaders({ referer: `https://${server_link_domain}/` });

        await options.browser_page.goto(server_link, { waitUntil: 'load', timeout: 30000 });
        
        ;await new Promise(async (local_resolve) => {
            
            let timeoutHandle;
            const timeout = 30000;

            const check_interval = setInterval(() => {
                if (url_for_media){
                    clearInterval(check_interval);
                    clearTimeout(timeoutHandle);
                    local_resolve(true);
                }
            },500);
            
            
            timeoutHandle = setTimeout(() => {
                clearInterval(check_interval);
                resolve({code:500, message:"Look up url for media timeout."}); 
                local_resolve(false);
                options.browser_page.removeAllListeners("request");
            }, timeout);
        });


        if (!url_for_media) {
            resolve({code:500, message:"Look up url for media timeout."}); 
            console.error("Failed to look up url for media ");
            return;
        }

        const controller = new AbortController();
        let timeout = setTimeout(() => {
            controller.abort(); 
        }, 30000); 

        const response = await fetch(url_for_media, {
            signal: controller.signal,
            method: 'GET',
            headers: {
                ...custom_fetch_headers,
                'Referer': `${server_link_domain}/`,
            }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return {code:500,message:response.statusText};
        }
        
        const media_info = await response.json();
        
        data.track = [];
        for (const track of media_info.stream.captions) {
            const track_item = {
                url: track.url,
                label: track.language,
                kind: "captions",
            }
            data.track.push(track_item);
        }

        

        const watch_dir = path.join(options.cache_dir, "watch", options.source_id, options.preview_id, options.season_id, options.watch_id);
        if (!existsSync(watch_dir)) mkdirSync(watch_dir, { recursive: true });

        // Start converting master
        

        const master_url = media_info.stream.playlist;
        const master_path = path.join(watch_dir, "master.m3u8");
        const master_doamin =  new URL(master_url).hostname;
        
        const convert_master_result = await convert_master({
            url: master_url,
            master_referer: `https://${server_link_domain}/`,
            player_referer: `https://${server_link_domain}/`,
            master_route: `https://${master_doamin}`,
            player_route: `https://${master_doamin}`,
            output_dir: watch_dir,
            options
        })

        if (convert_master_result?.code !== 200) {
            resolve(convert_master_result);
            return;
        }
        

        
        data.source = master_path;
        data.type = "master";
        
        // ===============================
        
    })()
    // ===================

    if (!data.source) {
        resolve({code:500, message:"Media source not found."});
        return;
    }

    resolve({code:200,data});
    return;
    
})};

export default server_3;