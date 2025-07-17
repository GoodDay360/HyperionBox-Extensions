import { Parser } from 'm3u8-parser';
import {  writeFileSync } from 'fs';
import path from 'path';
import custom_fetch_headers from "./custom_fetch_headers.js";
import AbortController from "abort-controller";
const rephrase_player = ({data, origin="" ,referer="", route, options}) => {

    // Parse the M3U8 content
    const parser = new Parser();
    parser.push(data);
    parser.end();
    const parsedManifest = parser.manifest;

    // Base URL for the segments

    // Replace segment URIs with full URLs
    parsedManifest.segments.forEach((segment) => {
        segment.uri = encodeURI(`http://localhost:${options.port}/proxy_request/?forward_origin=${encodeURIComponent(origin)}&forward_referer=${encodeURIComponent(referer)}&url=${encodeURIComponent(route ? `${route}${segment.uri}` : segment.uri)}`);
    });

    // Collect headers until the first #EXTINF tag
    const content_lines = [];
    const splited = data.split("\n");
    let count = 0;
    for (const line of splited) {
        if (line.charAt(0) === "#" || !line) {
            content_lines.push(line);
        }else{
            content_lines.push(parsedManifest.segments[count].uri);
            count++;
        }
    }

    const outputdata = content_lines.join("\n");


    return outputdata;

}


export const convert_player = async ({url, origin="", referer="", route, output, options}) =>{
    try {
        const controller = new AbortController();
        let timeout = setTimeout(() => {
            controller.abort(); 
        }, 30000); 
        const forward_headers = {
            ...custom_fetch_headers,
        }

        if (origin) forward_headers['Origin'] = origin;
        if (referer) forward_headers['Referer'] = referer;
        
        const response = await fetch(url, {
            signal: controller.signal,
            method: 'GET',
            headers: forward_headers
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }

        const content = await response.text();  
        const rephrase_content = rephrase_player({data: content, origin, referer, route, options});
        try {
            writeFileSync(output, rephrase_content, { flag: 'w' }, (err) => {
                if (err) throw err;
                console.log('File written successfully!');
            });
            console.log('File created successfully!');
            return {code: 200, uri: output}
        } catch (err) {
            console.error('Error creating file:', err);
        }

    } catch (error) {
        console.error(`[manage_hls->convert_player] Error fetching M3U8 url: ${url}`, error.message);
        return {code: 500, message: error.message}
        
    }
}

export const convert_master = async ({
    url, 
    master_origin="", master_referer,
    player_origin="", player_referer,
    master_route, player_route,
    output_dir, options}) => {
    try {

        const forward_headers = {
            ...custom_fetch_headers,
        }

        if (master_origin) forward_headers['Origin'] = master_origin;
        if (master_referer) forward_headers['Referer'] = master_referer;

        const response = await fetch(url, {
            method: 'GET',
            headers: forward_headers,
        });

        

        if (!response.ok) {
            return {code:500,message:response.statusText};
        }
        
        
        const request_result = await response.text()

        const master_path = path.join(output_dir, "master.m3u8");

        let new_master_content = "";
        const parser = new Parser();
        parser.push(request_result);
        parser.end();
        
        const playlist = []

        let player_count = 0;
        for (const players of parser.manifest.playlists){
            const url = `${master_route}${players.uri}`;
            
            const player_path = path.join(output_dir, `index_${player_count}.m3u8`);
            
            const proxy_convert_player_result = await convert_player({
                url: url,
                origin: player_origin,
                referer: player_referer,
                route: player_route||"",
                output: player_path,
                options
            })

            if (proxy_convert_player_result?.code !== 200) {
                playlist.push(null);
            }else{
                playlist.push(player_path);
                player_count++;
            }

            
        }

        if (player_count === 0) {
            return {code:500, message:"No playlist found"};
        }

        const splited_raw_master = request_result.split("\n");

        let count = 0;
        let last_check_line = "";
        for (const line of splited_raw_master){
            if (line.charAt(0) === "#" || !line) {
                if (last_check_line){
                    new_master_content += last_check_line;
                }
                last_check_line = line + "\n";
                
            }else{
                console.log(playlist[count])
                if (playlist[count] !== null) {
                    if (last_check_line){
                        new_master_content += last_check_line;
                        last_check_line = "";
                    }
                    new_master_content +=  playlist[count] + "\n";
                    count++;
                }else{
                    last_check_line = "";
                    count++;
                }
            }
        }
        writeFileSync(master_path, new_master_content, { flag: 'w' }, (err) => {
            if (err) throw err;
            console.log('File written successfully!');
        });

        return {code: 200, uri: master_path}

    } catch (error) {

        console.error('Error fetching M3U8 file:', error.message);
        return {code: 500, message: error.message}
    }
}