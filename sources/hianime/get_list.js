import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath, pathToFileURL} from 'url'

const get_list = async (options) => {
    
    try {
        await options.browser_page.goto(encodeURI(`${options.domain}/search?keyword=${encodeURIComponent(options.search)}&page=${encodeURIComponent(options.page || 1)}`));
        const result = {}

        result.data = await options.browser_page.evaluate(() => {
            const _data = []
            const film_item = document.querySelector('.film_list-wrap')?.querySelectorAll('.flw-item');
            film_item.forEach((node) => {
                const item_data = {}
                const film_poster = node.querySelector(".film-poster");
                item_data.cover = film_poster.querySelector("img").getAttribute("data-src");
                
                const film_detail = node.querySelector('.film-detail')
                item_data.title = film_detail.querySelector("h3").querySelector("a").innerText
                
                item_data.id = film_detail.querySelector("h3").querySelector("a").getAttribute("href").split('/')[1].split('?')[0]
                _data.push(item_data)
            })
            return _data;
        })
        const max_page = await options.browser_page.evaluate(() => {
            try {
                let _max_page;
                const pagination = document.querySelector('.pagination');
                const page_items = pagination.querySelectorAll('.page-item')
                page_items.forEach((node) => {
                    const title = node.querySelector(".page-link").getAttribute("title");
                    if (title === "Last"){
                        const url = node.querySelector(".page-link").getAttribute("href");
                        _max_page = parseInt(new URLSearchParams(url.split('?')[1]).get('page')??"", 10);
                    }
                })
                return _max_page;
            } catch (error) {
                return 0;
            }
        })
        if (!max_page){
            if (result.data.length) result.max_page = 1;
            else result.max_page = 0;
        }else result.max_page = max_page;
        
        return {code:200,message:"OK", result: result};
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