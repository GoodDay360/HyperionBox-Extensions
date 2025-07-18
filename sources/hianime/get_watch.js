import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { convert_master, convert_player } from '../../scripts/manage_hls.js';
import * as cheerio from 'cheerio';
import custom_fetch_headers from '../../scripts/custom_fetch_headers.js';
import get_episodes from './get_episodes.js';
import { load_new_page } from '../../setup/initiate_puppeteer.js';


const get_watch = async (options) => { return await new Promise(async (resolve) => {
    
    try{
        options.season_id = options.season_id || "0";
        // const url = encodeURI(`${options.domain}/watch/${encodeURIComponent(options.preview_id)}?ep=${encodeURIComponent(options.watch_id)}`);
        const data = {}
        data.server_info = {};


        // Get server info list
        
        ;await (async () => {
            data.server_info.server_list = {}
            const server_list = data.server_info.server_list;

            const url = encodeURI(`https://hianime.to/ajax/v2/episode/servers?episodeId=${encodeURIComponent(options.watch_id)}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...custom_fetch_headers,
                    'Referer': `${options.domain}/`,
                }
            });

            

            if (!response.ok) {
                console.error(`Failed to fetch: ${url}`);
                resolve({code:500,message:response.statusText});
                return;
            }
            
            
            const request_result = await response.json()
            
            if (!request_result.status) {
                console.error(`Failed to fetch: ${request_result}`);
                resolve({code:500, message:request_result.message});
                return;
            }

            const $ = cheerio.load(request_result.html);

            const server_ele_li  = $(".ps_-block");
            server_ele_li.each((_, element) => {
                const item_ele = $(element);
                const key = item_ele.find(".ps__-title").text().replace(":", "").trim().toLowerCase();
                server_list[key] = [];
                const per_type_server_ele = item_ele.find(".ps__-list").find(".item")
                per_type_server_ele.each((_, element) => {
                    const server_item = {}
                    const server_ele = $(element);
                    server_item.server_index = parseInt(server_ele.attr("data-server-id"),10);
                    server_item.server_id = server_ele.attr("data-id");
                    server_item.title = server_ele.find("a").text().trim();
                    server_list[key].push(server_item);
                })

            })

        })();
        // =============================

        // Selecting one server for lookup
        if (data.server_info.server_list.length === 0){
            resolve({code:404, message:"Server list is empty"});
            return;
        }

        let prefer_server_type = "";
        let prefer_server_id= "";

        if (options.server_type) {
            if (!data.server_info.server_list[options.server_type]) {
                prefer_server_id = Object.keys(data.server_info.server_list)[0];
            }else{
                prefer_server_type = options.server_type;
            }
            
        }else{
            prefer_server_type = Object.keys(data.server_info.server_list)[0];
        }

        if (options.server_id) {
            if (!data.server_info.server_list[options.server_type].find(item => item.server_id === options.server_id)) {
                prefer_server_id = data.server_info.server_list[prefer_server_type][0].server_id;
            }else{
                prefer_server_id = options.server_id;
            }
            
        }else{
            prefer_server_id = data.server_info.server_list[prefer_server_type][0].server_id;
        }
        
        data.server_info.current_server_id = prefer_server_id;
        data.server_info.current_server_type = prefer_server_type;
        console.log(options.server_id);
        console.log(data.server_info.server_list)
        // ====================
        

        // Get selected server info source id
        let forward_source_id = "";
        ;await ((async () => {
            
            const url = encodeURI(`https://hianime.to/ajax/v2/episode/sources?id=${prefer_server_id}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...custom_fetch_headers,
                    'Referer': `${options.domain}/`,
                    'Origin': `${options.domain}`,
                }
            });

            

            if (!response.ok) {
                console.error(`Failed to fetch: ${url}`);
                resolve({code:500,message:response.statusText});
                return;
            }
            
            
            const request_result = await response.json()
            
            if (!request_result.type === "error") {
                console.error(`Error unable to get prefered_server_id: ${prefer_server_id}`)
                resolve({code:500, message:`Error unable to get prefered_server_id: ${prefer_server_id}`});
                return;
            }

            forward_source_id = request_result.link.split("/").pop().split("?")[0];

        }))();
        // ===================

        let forward_key_token = "";
        // Get token
        data.media_info = {};
        ;await ((async () => {
            const url = encodeURI(`https://megacloud.blog/embed-2/v3/e-1/${forward_source_id}?k=1`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...custom_fetch_headers,
                    'Referer': `https://megacloud.blog/`,
                    'Origin': `https://megacloud.blog`,
                }
            });

            

            if (!response.ok) {
                console.error(`Failed to fetch: ${url}`);
                resolve({code:500,message:response.statusText});
                return;
            }
            
            
            const request_result = await response.text()
            const $ = cheerio.load(request_result, { decodeEntities: false });
            
            forward_key_token =
                $('meta[name="_gg_fb"]').attr('content') ||
                $('script[nonce]').attr('nonce') ||
                $('div[data-dpi]').attr('data-dpi') ||
                $('script')
                    .filter((_, el) => $(el).html().includes('window._xy_ws'))
                    .map((_, el) => $(el).html().split('"')[1])
                    .get(0) ||
                $('*')
                    .contents()
                    .filter((_, el) => el.type === 'comment' && el.data.trim().startsWith('_is_th:'))
                    .map((_, el) => el.data.trim().split(':')[1])
                    .get(0) ||
                $('script')
                    .map((_, el) => {
                    const js = $(el).html();
                    const match = js.match(/window\._lk_db\s*=\s*{[^}]*}/);
                    if (match) {
                        try {
                        const obj = Function('window', match[0] + '; return window._lk_db;')({});
                        return obj.x + obj.y + obj.z;
                        } catch (err) {}
                    }
                    })
                    .get(0);




            
            if (!forward_key_token) {
                console.error("Token not found");
                resolve({code:500, message:"Token not found"});
                return;
            }else{
                console.log("FORWARD TOKEN: " ,forward_key_token || 'Token not found');
            }
        }))();
        // ===================
        if (!forward_key_token) return;
        resolve({})
        return
        // Get tracks
        data.media_info = {};
        ;await ((async () => {
            const url = encodeURI(`https://megacloud.blog/embed-2/v3/e-1/getSources?id=${forward_source_id}&_k=${forward_key_token}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...custom_fetch_headers,
                    'Referer': `${options.domain}/`,
                    'Origin': `${options.domain}`,
                }
            });

            

            if (!response.ok) {
                console.error(`Failed to fetch: ${url}`);
                resolve({code:500,message:response.statusText});
                return;
            }
            
            
            const request_result = await response.json()
            
            data.media_info.track = []
            
            for (const track of request_result.tracks) {
                data.media_info.track.push({
                    url: track.file,
                    label: track.label,
                    kind: track.kind,
                    default: track?.default
                });
            }
        }))();
        // ===================
        if (Object.keys(data.media_info).length === 0) return;

        // Get forward url
        let forward_url = "";
        ;await ((async () => {
            const url = encodeURI(`https://hianime.to/ajax/v2/episode/sources?id=${prefer_server_id}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...custom_fetch_headers,
                    'Referer': `${options.domain}/`,
                    'Origin': `${options.domain}`,
                }
            });

            

            if (!response.ok) {
                console.error(`Failed to fetch: ${url}`);
                resolve({code:500,message:response.statusText});
                return;
            }
            
            
            const request_result = await response.json()
            
            forward_url = request_result.link;
        }))();

        if (!forward_url) {
            console.error(`Error unable to get forwarded_url.`)
            resolve({code:500, message:`Error unable to get forwarded_url.`});
            return;
        }

        // ===================

        // Get media source using headless browser.
        ;await (async () => {

            const selected_server_index = data.server_info.server_list[prefer_server_type].find(item => item.server_id === prefer_server_id).server_index
            
            
            const look_up_media_result = {};

            const result_load_new_page = await load_new_page(options.browser);
            if (result_load_new_page.code === 200){
                options.browser_page = result_load_new_page.browser_page;
            }else{
                console.error("Fail to load new page");
                resolve({code:500, message:"Fail to load new page"})
                return;
            }


            options.browser_page.on('request', async (interceptedRequest) => {
                if (interceptedRequest.isInterceptResolutionHandled()) return;
                const url = interceptedRequest.url();
                if (url.endsWith('.m3u8')) {
                    const url_obj = new URL(url);
                    const fileName = url_obj.pathname.split('/').pop().split('.').slice(0, -1).join('.');
                    if (selected_server_index === 6){
                        look_up_media_result.code = 200;
                        look_up_media_result.data = {url, type: "player"};
                        options.browser_page.removeAllListeners("request");
                    }else{
                        if (fileName === "master"){
                            look_up_media_result.code = 200;
                            look_up_media_result.data = {url, type: "master"};
                            options.browser_page.removeAllListeners("request");
                        }
                    }
                }
            });

            const referer = `https://${new URL(forward_url).hostname}/`;

            await options.browser_page.setExtraHTTPHeaders({ referer });

            await options.browser_page.goto(forward_url, { waitUntil: 'load', timeout: 30000 });


            ;await new Promise(async (local_resolve) => {
                
                let timeoutHandle;
                const timeout = 30000;

                const check_interval = setInterval(() => {
                    if (look_up_media_result.code === 200){
                        clearInterval(check_interval);
                        clearTimeout(timeoutHandle);
                        local_resolve(true);
                    }
                },500);
                
                
                timeoutHandle = setTimeout(() => {
                    clearInterval(check_interval);
                    console.error("Look up media timeout.");
                    resolve({code:500, message:"Look up media timeout."}); 
                    local_resolve(false);
                    options.browser_page.removeAllListeners("request");
                }, timeout);
            });


            if (look_up_media_result.code !== 200) {
                console.error(`Error look up media source: ${JSON.stringify(look_up_media_result)}`)
                resolve(look_up_media_result);
                return;
            }
            
            const media_result = look_up_media_result.data;
            
            const watch_dir = path.join(options.cache_dir, "watch", options.source_id, options.preview_id, options.season_id, options.watch_id);
            if (!existsSync(watch_dir)) mkdirSync(watch_dir, { recursive: true });

            // Start converting master
            

            if (media_result.type === "master"){
                const master_path = path.join(watch_dir, "master.m3u8");

                const convert_master_result = await convert_master({
                    url: media_result.url,
                    master_origin: "https://megacloud.blog",
                    master_referer: "https://megacloud.blog/",
                    player_origin: "https://megacloud.blog",
                    player_referer: "https://megacloud.blog/",
                    master_route: `${media_result.url.split("/").slice(0, -1).join("/")}/`,
                    player_route: selected_server_index === 1 ? `${media_result.url.split("/").slice(0, -1).join("/")}/` : "",
                    output_dir: watch_dir,
                    options
                })

                if (convert_master_result?.code !== 200) {
                    resolve(convert_master_result);
                    return;
                }
                

                
                data.media_info.source = master_path;
                data.media_info.type = "master";
            }else{

                const player_path = path.join(watch_dir, "player.m3u8");
                const proxy_convert_player_result = await convert_player({
                    url: media_result.url,
                    origin: "https://megacloud.blog",
                    referer: "https://megacloud.blog/",
                    route: ``,
                    output: player_path,
                    options
                })

                if (proxy_convert_player_result?.code !== 200) {
                    resolve(proxy_convert_player_result);
                    return;
                }

                data.media_info.source = player_path;
                data.media_info.type = "player";
            }
            // ===============================
            
        })();
        // ===================



        // Get episode list
        const get_ep_result = await get_episodes(options);

        if (get_ep_result?.code !== 200) {
            resolve(get_ep_result);
            return;
        }

        data.episodes = get_ep_result.result;
        // ===================

        data.type_schema = 1;
        resolve({code:200, message:"OK", result:data});
        return
    }catch(e){
        console.error(e)
        resolve({code:500, message:e});
        return;
    }

    })
}

export default get_watch;