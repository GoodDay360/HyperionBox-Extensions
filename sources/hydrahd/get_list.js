import * as cheerio from 'cheerio';
import custom_fetch_headers from '../../scripts/custom_fetch_headers.js';
import AbortController from 'abort-controller';
const get_list = async (options) => {
    
    try {
        const controller = new AbortController();
        let timeout = setTimeout(() => {
            controller.abort(); 
        }, 30000); 

        const url = encodeURI(`${options.domain}/search/${options.search.replace(/ /g, "+")||'+'}/${options.page || 1}`)
        console.log(url)
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
        const data = [];

        const browse_grid = $(".browse-grid");
        
        browse_grid.find(".figured").each((_, element) => {
            const item_data = {}
            const figured_ele = $(element);
            item_data.id = figured_ele.find("a").attr("href").split('/').slice(1).join("+");
            item_data.cover = figured_ele.find("a").find("img").attr("data-src");
            item_data.title = figured_ele.find(".title").text();
            data.push(item_data);

        });
        let max_page = 9;
        if (data.length === 0) {
            max_page = 0;
        }

        
        return {code:200,message:"OK", result: {data, max_page}};
    }catch (error) {
        console.error(error);
        return  {
            status: {
                code: 500,
                message: error,
            }
        }
    }
}

export default get_list;