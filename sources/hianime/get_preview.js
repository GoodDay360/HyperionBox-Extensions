import get_episodes from './get_episodes.js';
import * as cheerio from 'cheerio';


const get_preview = async (options) => {
    if (!options.preview_id) {
        console.error("Missing 'preview_id' key."); 
        return {code:500, message: "Missing 'preview_id' key."};
    }
    try {
        
        const url = encodeURI(`${options.domain}/${encodeURIComponent(options.preview_id)}`);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Referer': `${options.domain}/`,
            }
        });

        if (!response.ok) {
            return {code:500,message:response.statusText};
        }
        
        const data = {};
        

        const $ = cheerio.load(await response.text());

        const main_container = $("#ani_detail")

        // stats
        data.stats = {}

        const film_stats_tick_item = main_container.find(".film-stats").find(".tick").find(".tick-item")
        film_stats_tick_item.each((_, element) => {
            const tick_item = $(element);
            const key = tick_item.attr("class").split(/\s+/)[1].split("-")[1];
            const content = tick_item.text();
            data.stats[key] = content;
        })



        // Info
        data.info = {};
        data.info.cover = main_container.find(".film-poster").find("img").attr("src");
        const detail = main_container.find(".anisc-detail")

        data.info.title = detail.find(".film-name").text();
        // end info part 1

        const anisc_info_item = main_container.find(".anisc-info-wrap").find(".anisc-info").find(".item")

        anisc_info_item.each((_, element) => {
            const item = $(element);
            const key = item.find(".item-head").text().replace(":","").trim();
            
            if (key === "Overview") {
                const content = item.find(".text").text();
                data.info.description = content.trim();
            }else if (key === "Genres"){
                const genre_item_li = item.find("a");
                const genre_list = [];
                genre_item_li.each((_, element) => {
                    genre_list.push($(element).attr("title"));
                });

                data.info[key] = genre_list.join(", ");
            }
            else{
                const content = item.find(".name").text();
                data.info[key] = content.trim();
            }

        })


        const get_ep_result = await get_episodes(options);

        if (get_ep_result?.code !== 200) {
            return get_ep_result;
        }

        data.episodes = get_ep_result.result;

        data.type_schema = 1;
        return {code:200, message:"OK", result:data};
    }catch (error) {
        console.error(error);
        return {code:500, message: error}
    }
    
}

export default get_preview;