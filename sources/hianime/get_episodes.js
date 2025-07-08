import * as cheerio from 'cheerio';
import custom_fetch_headers from '../../scripts/custom_fetch_headers.js';

const get_episodes = async (options) => {
    try{
        const id = options.preview_id.split("-").pop();
        const url = encodeURI(`${options.domain}/ajax/v2/episode/list/${id}`);
        console.log(url)
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                ...custom_fetch_headers,
                'Referer': `${options.domain}/`,
            }
        });

        if (!response.ok) {
            return {code:500,message:response.statusText};
        }
        

        const request_result = await response.json()

        if (!request_result.status) {
            return {code:500, message:request_result.message};
        }

        const $ = cheerio.load(request_result.html);
        const data = [];
        
        const main_container = $(".seasons-block")

        let max_ep_page = 0;

        const ep_pages_ele = main_container.find(".ss-choice").find(".dropdown-menu")

        if (ep_pages_ele.html()){
            max_ep_page = parseInt(ep_pages_ele.find("a").last().attr("data-page"));
            

            for (let i = 1; i <= max_ep_page; i++) {
                const item_data = [];
                const page_ele_li = main_container.find(`#episodes-page-${i}`)

                page_ele_li.find("a").each((index, element) => {
                    const ep_data = {};

                    const ele = $(element);
                    ep_data.index = index;
                    ep_data.title = ele.attr("title");
                    ep_data.id = ele.attr("data-id");

                    item_data.push(ep_data);
                });

                data.push(item_data);
            }

        }else{
            const ss_list = main_container.find("#detail-ss-list").find(".ss-list");
            const item_data = []
            ss_list.find("a").each((_, element) => {
                const ep_data = {};

                const ele = $(element);
                ep_data.index = parseInt(ele.attr("data-number"), 10);
                ep_data.title = ele.attr("title");
                ep_data.id = ele.attr("data-id");

                item_data.push(ep_data);
            });
            
            data.push(item_data);
        }

        
        return {code:200, message:"OK", result:[data]}
    }catch(e){
        console.error(e)
        return {code:500, message:e};
    }fi
}

export default get_episodes;