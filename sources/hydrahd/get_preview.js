import * as cheerio from 'cheerio';
import custom_fetch_headers from '../../scripts/custom_fetch_headers.js';
import get_episodes from './get_episodes.js';
import AbortController from 'abort-controller';

const get_preview = async (options) => {
    if (!options.preview_id) {
        console.error("Missing 'preview_id' key."); 
        return {code:500, message: "Missing 'preview_id' key."};
    }
    try {

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
        
    
        const $ = cheerio.load(await response.text());

        const data = {};

        // No stats
        data.stats = {};
        // ===========

        // Get info

        data.info = {}
        
        const group_ele = $(".btn-group").first();
        if (!group_ele.html()) {
            return {code:404, message: "Preview not found."};
        }
        data.info.cover = group_ele.find(".hidden-xs").attr("src");
        const diz_ele = group_ele.find(".diz-title")

        data.info.title = diz_ele.find(".ploting").find("h1").text();
        data.info.description = diz_ele.find(".ploting").find("p").text();

        data.info["Rating"] = diz_ele.find(".filmsratings").find(".starsmediumorange").attr("title");

        // ========

        // Get episodes
        const get_episodes_result = await get_episodes($);
        if (get_episodes_result.code !== 200) {
            return get_episodes_result;
        }

        data.episodes = get_episodes_result.result.data;
        data.type_schema = get_episodes_result.result.type_schema;
        data.server_type_schema = 2;

        // ========
        console.log(data);
        return {code:200, message:"OK", result:data};
    }catch (error) {
        console.error(error);
        return {code:500, message: error}
    }
    
}

export default get_preview;