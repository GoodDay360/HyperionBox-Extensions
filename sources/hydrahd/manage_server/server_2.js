import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { convert_master, convert_player } from '../../../scripts/manage_hls.js';
import * as cheerio from 'cheerio';
import custom_fetch_headers from '../../../scripts/custom_fetch_headers.js';
import AbortController from 'abort-controller';

import { parse } from 'acorn';
import * as walk from 'acorn-walk'
import { clear } from 'console';

const server_2 = async ({server_id, server_link, options})=>{return await new Promise(async (resolve) => {
    

    console.log("server_link is:", server_link)
    
    const data = {}

    

    let forward_url_1 = "";
    // Extract forwarded url #1
    ;await (async () => {
        const controller = new AbortController();
        let timeout = setTimeout(() => {
            controller.abort(); 
        }, 30000); 
        const response = await fetch(server_link, {
            signal: controller.signal,
            method: 'GET',
            headers: {
                ...custom_fetch_headers,
                'Referer': `${options.domain}/`,
            }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            resolve({code:500,message:response.statusText});
            return;
        }
        
        const $ = cheerio.load(await response.text());
        const player_frame_src = $(`#player_iframe`).attr("src");
        if (!player_frame_src){
            resolve({code:500,message:"Player frame 1 not found"});
            return;
        }

        forward_url_1 = `https:${player_frame_src}`;
    })();
    // =================

    let forward_url_2 = "";
    // Extract forwarded url #1
    ;await (async () => {
        const controller = new AbortController();
        let timeout = setTimeout(() => {
            controller.abort(); 
        }, 30000); 
        const forward_domain = new URL(forward_url_1).hostname;
        const response = await fetch(forward_url_1, {
            signal: controller.signal,
            method: 'GET',
            headers: {
                ...custom_fetch_headers,
                'Referer': `https://${forward_domain}/`,
            }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            resolve({code:500,message:response.statusText});
            return;
        }
        
        const $ = cheerio.load(await response.text());
        
        $('script').each((i, el) => {
            const scriptContent = $(el).html();
            if (!scriptContent) return;

            try {
                const ast = parse(scriptContent, { ecmaVersion: 2020 });

                walk.simple(ast, {
                CallExpression(node) {
                    if (
                    node.callee.type === 'Identifier' &&
                    node.callee.name === '$' &&
                    node.arguments.length === 2 &&
                    node.arguments[0].type === 'Literal' &&
                    node.arguments[0].value === '<iframe>'
                    ) {
                    const config = node.arguments[1];
                    if (config.type === 'ObjectExpression') {
                        for (const prop of config.properties) {
                        if (
                            prop.key.type === 'Identifier' &&
                            prop.key.name === 'src' &&
                            prop.value.type === 'Literal'
                        ) {
                            forward_url_2 = `https://${forward_domain}${prop.value.value}`;
                        }
                        }
                    }
                    }
                }
                });
            } catch (err) {
                console.error('Error parsing forward_url_2:', err);
                resolve({code:500,message:`Error parsing forward_url_2: ${JSON.stringify(err)}`});
                return
            }
        });
    })();
    // =================

    

    data.track = [];
    // Extract server info from forwarded_url
    ;await (async () => {
        const controller = new AbortController();
        let timeout = setTimeout(() => {
            controller.abort(); 
        }, 30000); 
        const forward_domain = new URL(forward_url_2).hostname;
        const response = await fetch(forward_url_2, {
            signal: controller.signal,
            method: 'GET',
            headers: {
                ...custom_fetch_headers,
                'Referer': `https://${forward_domain}/`,
            }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            resolve({code:500,message:response.statusText});
            return;
        }
        
        const $ = cheerio.load(await response.text());

        let targetScript = '';
        $('script').each((_, el) => {
            const content = $(el).html();
            if (content && content.includes('default_subtitles')) {
                targetScript = content;
            }
            });

            // Parse the script content
            let subtitleString = '';
            const ast = parse(targetScript, { ecmaVersion: 'latest' });

            walk.simple(ast, {
            AssignmentExpression(node) {
                if (
                node.left.type === 'Identifier' &&
                node.left.name === 'default_subtitles' &&
                node.right.type === 'Literal'
                ) {
                subtitleString = node.right.value;
                }
            }
        });

        // Convert the string into structured objects
        data.track = subtitleString
        .split(',')
        .map(entry => {
            const match = entry.match(/^\[([^\]]+)\](.+)$/);
            if (match) {
            return { label: match[1], url: `https://${forward_domain}${match[2]}`, kind: "captions" };
            }
            return null;
        })
        .filter(Boolean);
        

    })();
    // ===================

    // Get media source using headless browser.
    ;await (async () => {
        const forward_domain = new URL(forward_url_2).hostname;

        const look_up_media_result = {}

        options.browser_page.on('request', async (interceptedRequest) => {
            if (interceptedRequest.isInterceptResolutionHandled()) return;
            const url = interceptedRequest.url();
            if (url.endsWith('.m3u8')) {
                const url_obj = new URL(url);
                const fileName = url_obj.pathname.split('/').pop().split('.').slice(0, -1).join('.');
                if (fileName === "master"){
                    look_up_media_result.code = 200;
                    look_up_media_result.message = "Look up media success.";
                    look_up_media_result.data = {url, type: "master"};

                    options.browser_page.removeAllListeners("request");
                }
            }
        });

        await options.browser_page.goto(forward_url_2);
        
        ;await new Promise(async (local_resolve) => {
            
            let timeoutHandle;
            const timeout = 8000;

            const check_interval = setInterval(() => {
                if (look_up_media_result.code === 200){
                    clearInterval(check_interval);
                    clearTimeout(timeoutHandle);
                    local_resolve(true);
                }
            },500);
            
            
            timeoutHandle = setTimeout(() => {
                clearInterval(check_interval);
                resolve({code:500, message:"Look up media timeout."}); 
                local_resolve(false);
                options.browser_page.removeAllListeners("request");
            }, timeout);
        });
        


        
        
        

        if (look_up_media_result?.code !== 200) {
            resolve(look_up_media_result);
            console.error("Failed to look_up_media_result: ", look_up_media_result);
            return;
        }


        const media_result = look_up_media_result.data;

        

        const watch_dir = path.join(options.cache_dir, "watch", options.source_id, options.preview_id, options.season_id, options.watch_id);
        if (!existsSync(watch_dir)) mkdirSync(watch_dir, { recursive: true });

        // Start converting master
        

        if (media_result.type === "master"){
            const master_path = path.join(watch_dir, "master.m3u8");
            const master_doamin =  new URL(media_result.url).hostname;
            console.log("master_doamin: ",`https://${master_doamin}`);
            console.log("media_result: ",media_result);
            const convert_master_result = await convert_master({
                url: media_result.url,
                master_referer: `https://${forward_domain}/`,
                player_referer: `https://${forward_domain}/`,
                master_route: `https://${master_doamin}`,
                player_route: "",
                output_dir: watch_dir,
                options
            })

            if (convert_master_result?.code !== 200) {
                resolve(convert_master_result);
                return;
            }
            

            
            data.source = master_path;
            data.type = "master";
        }else{

            const player_path = path.join(watch_dir, "player.m3u8");
            const proxy_convert_player_result = await convert_player({
                url: media_result.url,
                referer: `https://${forward_domain}/`,
                route: ``,
                output: player_path,
                options
            })

            if (proxy_convert_player_result?.code !== 200) {
                resolve(proxy_convert_player_result);
                return;
            }

            data.source = player_path;
            data.type = "player";
        }
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

export default server_2;