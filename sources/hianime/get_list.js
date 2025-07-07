import * as cheerio from 'cheerio';
import fetch from "node-fetch";
import custom_fetch_headers from '../../scripts/custom_fetch_headers.js';

const get_list = async (options) => {
    
    try {
        const url = encodeURI(`${options.domain}/search?keyword=${encodeURIComponent(options.search||'+')}&page=${encodeURIComponent(options.page || 1)}`);
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
        

        const $ = cheerio.load(await response.text());
        const data = [];

        $(".film_list-wrap").find(".flw-item").each((index, element) => {
            const item_data = {};
            const flw_item = $(element);

            item_data.cover = flw_item.find(".film-poster").find("img").attr("data-src");
            
            const film_detail = flw_item.find(".film-detail");
            item_data.title = film_detail.find("h3").find("a").text();
            item_data.id = film_detail.find("h3").find("a").attr("href").split('/')[1].split('?')[0];
            data.push(item_data);
        });

        let max_page = 0;
        const last_page_item = $(".pre-pagination").find(".page-item").last()

        if (last_page_item.html()) {
            const page_url = last_page_item.find("a").attr("href")
            if (page_url){
                max_page = parseInt(new URLSearchParams(page_url.split('?')[1]).get('page')??"", 10);
            }else{
                max_page = parseInt(last_page_item.find("a").text(), 10);
            }
            
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