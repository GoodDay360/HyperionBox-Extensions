import fetch from "node-fetch";
import { Parser } from 'm3u8-parser';
import {  writeFileSync } from 'fs';
import path from 'path';


const rephrase_player = ({data, referer, route, options}) => {

    // Parse the M3U8 content
    const parser = new Parser();
    parser.push(data);
    parser.end();
    const parsedManifest = parser.manifest;

    // Base URL for the segments

    // Replace segment URIs with full URLs
    parsedManifest.segments.forEach((segment) => {
        segment.uri = encodeURI(`http://localhost:${options.port}/proxy_request/?referer=${encodeURIComponent(referer)}&url=${encodeURIComponent(route ? `${route}/${segment.uri}` : segment.uri)}`);
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


export const convert_player = async ({url, referer, route, output, options}) =>{
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Referer': referer,
                'User-Agent': 'Mozilla/5.0 (compatible)'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }

        const content = await response.text();  
        const rephrase_content = rephrase_player({data: content, referer, route, options});
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
        console.error('Error fetching M3U8 file:', error.message);
        return {code: 500, message: error.message}
        
    }
}

export const convert_master = async ({url, master_referer, player_referer, master_route, player_route, output_dir, options}) => {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Referer':  master_referer,
            }
        });

        

        if (!response.ok) {
            resolve({code:500,message:response.statusText});
            return;
        }
        
        
        const request_result = await response.text()

        const master_path = path.join(output_dir, "master.m3u8");

        let new_master_content = "";
        const parser = new Parser();
        parser.push(request_result);
        parser.end();
        
        const playlist = []

        for (const players of parser.manifest.playlists){
            const url = `${master_route}/${players.uri}`;
            
            const player_path = path.join(output_dir, players.uri)
            const proxy_convert_player_result = await convert_player({
                url: url,
                referer: player_referer,
                route: player_route||"",
                output: player_path,
                options
            })

            if (proxy_convert_player_result?.code !== 200) {
                resolve(proxy_convert_player_result);
                return;
            }

            playlist.push(player_path);
        }

        const splited_raw_master = request_result.split("\n");

        let count = 0;
        for (const line of splited_raw_master){
            if (line.charAt(0) === "#" || !line) {
                new_master_content += line + "\n";
            }else{
                new_master_content +=  playlist[count] + "\n";
                count++;
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