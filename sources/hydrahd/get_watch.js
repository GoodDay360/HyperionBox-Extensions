import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { convert_master, convert_player } from '../../scripts/manage_hls.js';
import * as cheerio from 'cheerio';
import custom_fetch_headers from '../../scripts/custom_fetch_headers.js';
import get_episodes from './get_episodes.js';
import manage_server from './manage_server/main.js';
import AbortController from 'abort-controller';


const SUPPORTED_SERVER_ID = ["2", "3"];
const RECOMMENDED_SERVER_ID = "3";

const get_watch = async (options) => { return await new Promise(async (resolve) => {
    
    try{
        let url;
        if (options.watch_id === "full"){
            url = encodeURI(`${options.domain}/${options.preview_id.replace("+","/")}`);
        }else{
            url = encodeURI(`${options.domain}/${options.preview_id.replace("+","/")}/season/${options.season_id}/episode/${options.watch_id}`)
        }
        
        const controller = new AbortController();
        let timeout = setTimeout(() => {
            controller.abort(); 
        }, 30000); 

        const response = await fetch(url, {
            signal: controller.signal,
            method: 'GET',
            headers: {
                ...custom_fetch_headers,
                'Referer': `${options.domain}/`,
            }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return {code:500,message:response.statusText};
        }
        
        const $ = cheerio.load(await response.text());

        const data = {}
        
        // Extract params for server info
        let params_for_server_info = {}

        $('script').each((_, el) => {
            const scriptContent = $(el).html();

            // Check if it contains the AJAX call
            if (scriptContent.includes("$.get")) {
                // Extract endpoint
                const endpointMatch = scriptContent.match(/['"]\/ajax\/(tv_0|mov_0)\.php['"]/);
                const endpoint = endpointMatch ? `/ajax/${endpointMatch[1]}.php` : null;

                // Extract parameters
                const iMatch = scriptContent.match(/["']i["']\s*:\s*["'](tt\d+)["']/);
                const tMatch = scriptContent.match(/["']t["']\s*:\s*["'](\d+)["']/);
                const sMatch = scriptContent.match(/["']s["']\s*:\s*["'](\d+)["']/);
                const eMatch = scriptContent.match(/["']e["']\s*:\s*["'](\d+)["']/);

                params_for_server_info = {
                    endpoint,
                    i: iMatch?.[1],
                    t: tMatch?.[1],
                    s: sMatch?.[1],
                    e: eMatch?.[1]
                };
            }
        });

        if (Object.keys(params_for_server_info).length === 0){
            console.error('Failed to extract id for server info.');
            resolve({code:404, message:"Failed to extract id for server info."});
        }
        // =================

        data.server_info = {};
        data.server_info.server_list = {};
        const server_list = data.server_info.server_list.server = [];

        

        // Get server info
        ;await (async () => {
            const controller = new AbortController();
            let timeout = setTimeout(() => {
                controller.abort(); 
            }, 30000); 

            let url;
            if (options.watch_id === "full"){
                url = encodeURI(`https://hydrahd.sh${params_for_server_info.endpoint}?i=${params_for_server_info.i}&t=${params_for_server_info.t}`)
            }else{
                url = encodeURI(`https://hydrahd.sh${params_for_server_info.endpoint}?i=${params_for_server_info.i}&t=${params_for_server_info.t}&s=${params_for_server_info.s}&e=${params_for_server_info.e}`)
            }

            const response = await fetch(url, {
                signal: controller.signal,
                method: 'GET',
                headers: {
                    ...custom_fetch_headers,
                    'Referer': `${options.domain}/`,
                }
            });
            clearTimeout(timeout);

            if (!response.ok) {
                return {code:500,message:response.statusText};
            }
            
            const $ = cheerio.load(await response.text());

            const server_list_ele = $("#iframeServerList")

            server_list_ele.find(".iframe-server-button").each((index, element) => {
                const server_ele = $(element);
                const server_id = server_ele.attr("data-id")

                if (!SUPPORTED_SERVER_ID.includes(server_id)){
                    return;
                }

                const server_item = {}

                server_item.server_index = index;
                server_item.server_id = server_id;
                server_item.server_link = server_ele.attr("data-link");
                server_item.title = `${server_ele.find("p").first().text()} ${server_ele.find("p").last().text()}`;
                
                server_list.push(server_item);

            })

        })();
        // ============

        // Selecting one server for lookup. return any available server if not exist
        if (data.server_info.server_list.length === 0){
            resolve({code:404, message:"Server list is empty"});
            return;
        }

        
        let prefer_server_id= "";
        let prefer_server_link= "";


        if (options.server_id) {
            if (!data.server_info.server_list.server.find(item => item.server_id === options.server_id)) {
                const reccomended_server_index = data.server_info.server_list.server.findIndex(item => item.server_id === RECOMMENDED_SERVER_ID);
                prefer_server_id = data.server_info.server_list.server[reccomended_server_index??0].server_id;
                console.log(prefer_server_id);
            }else{
                prefer_server_id = options.server_id;
            }
            
        }else{
            const reccomended_server_index = data.server_info.server_list.server.findIndex(item => item.server_id === RECOMMENDED_SERVER_ID);
            prefer_server_id = data.server_info.server_list.server[reccomended_server_index??0].server_id;
            console.log(prefer_server_id);
        }

        
        prefer_server_link = data.server_info.server_list.server.find(item => item.server_id === prefer_server_id)?.server_link;
        data.server_info.current_server_id = prefer_server_id;
        data.server_info.current_server_type = "server";
        // ====================
        

        // Fetch server info + track

        ;await (async () => {
            const manage_server_result = await manage_server({server_id:prefer_server_id, server_link:prefer_server_link, options});
            

            if (manage_server_result.code !== 200){
                resolve(manage_server_result);
                return;
            }

            data.media_info = manage_server_result.data;
        })();

        // ====================

        // Get season+episodes
        ;await (async () => {
            let DOM = $;
            if (options.watch_id !== "full"){
                const controller = new AbortController();
                let timeout = setTimeout(() => {
                    controller.abort(); 
                }, 30000); 
                const url = encodeURI(`${options.domain}/${options.preview_id.replace("+","/")}`);
                const response = await fetch(url, {
                    signal: controller.signal,
                    method: 'GET',
                    headers: {
                        ...custom_fetch_headers,
                        'Referer': `${options.domain}/`,
                    }
                });
                clearTimeout(timeout);

                if (!response.ok) {
                    return {code:500,message:response.statusText};
                }
                
                DOM = cheerio.load(await response.text());
            }

            const get_episodes_result = await get_episodes(DOM);
            if (get_episodes_result.code !== 200) {
                return get_episodes_result;
            }

            data.episodes = get_episodes_result.result.data;
            data.type_schema = get_episodes_result.result.type_schema;

        })();
        
        // ==============

        resolve({code:200, message:"OK", result:data});
        return
    }catch(e){
        console.error(e)
        resolve({code:500, message:e});
        return;
    }

})}

export default get_watch;