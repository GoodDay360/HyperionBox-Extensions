import fetch from "node-fetch";
import m3u8Parser from "m3u8-parser";
import fs from 'fs/promises';
import path from 'path';

const rephrase_hls = ({data, referer, route, options}) => {

    // Parse the M3U8 content
    const parser = new m3u8Parser.Parser();
    parser.push(data);
    parser.end();
    const parsedManifest = parser.manifest;

    // Base URL for the segments

    // Replace segment URIs with full URLs
    parsedManifest.segments.forEach((segment) => {
        segment.uri = encodeURI(`http://localhost:${options.port}/proxy_request/?referer=${encodeURIComponent(referer)}&url=${encodeURIComponent(route+segment.uri)}`);
    });

    // Collect headers until the first #EXTINF tag
    const headerLines = [];
    const splited = data.split("\n");
    for (const line of splited) {
    if (line.includes("#EXTINF")) break;
    headerLines.push(line);
    }

    const headers = headerLines.join("\n");

    // Build the modified M3U8 content
    let outputdata = headers + "\n";

    parsedManifest.segments.forEach((segment) => {
        outputdata += `#EXTINF:${segment.duration},\n${segment.uri}\n`;
    });

    if (parsedManifest.endList) outputdata += `#EXT-X-ENDLIST\n`;

    return outputdata

}


const convert_hls = async ({url, referer, route, output, options}) =>{
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
        const rephrase_content = rephrase_hls({data: content, referer, route, options});
        try {
            await fs.writeFile(output, rephrase_content);
            console.log('File created successfully!');
            return {code: 200, uri: output}
        } catch (err) {
            console.error('Error creating file:', err);
        }

    } catch (error) {
        console.error('Error fetching M3U8 file:', error.message);
    }
}

export default convert_hls;