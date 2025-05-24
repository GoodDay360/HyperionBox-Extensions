import get_episodes from './get_episodes.js';
import initiate_puppeteer from '../../initiate_puppeteer.js';
import fs from 'fs';
import path, { dirname } from 'path';

const get_preview = async (options) => {
    if (!options.preview_id) {
        console.error("Missing 'preview_id' key."); 
        return {code:500, message: "Missing 'preview_id' key."};
    }
    const result_initiate_puppeteer = await initiate_puppeteer(options);
    let browser, page;
    try {
        if (result_initiate_puppeteer.code === 200){
            browser = result_initiate_puppeteer.data.browser;
            page = result_initiate_puppeteer.data.page;
        }else{
            return {code:200, message:"Fail to initiate puppeteer"};
        }
        
        await page.goto(encodeURI(`https://hianime.to/${encodeURIComponent(options.preview_id)}`));
        


        const data = await page.evaluate(()=> {
            const result = {};

            const main_wrapper = document.querySelector("#main-wrapper");
            const detial = main_wrapper.querySelector("#ani_detail");
            const content = detial.querySelector(".anis-content");
            result.info = {};
            result.info.cover = content.querySelector(".anisc-poster").querySelector("img").getAttribute("src");
            result.info.title = content.querySelector(".anisc-detail").querySelector(".film-name").textContent;
            const film_stats = content.querySelector(".anisc-detail").querySelector(".film-stats");

            result.stats = {}
            result.stats.pg = film_stats.querySelector(".tick-pg").textContent;
            result.stats.quality = film_stats.querySelector(".tick-quality").textContent;
            const sub = film_stats.querySelector(".tick-sub")?.textContent;
            if (sub) {result.stats.sub = sub}
            const dub = film_stats.querySelector(".tick-dub")?.textContent;
            if (dub) {result.stats.dub = dub}
            const eps = film_stats.querySelector(".tick-eps")?.textContent;
            if (eps) {result.stats.eps = eps}
            
            content.querySelector(".film-description").querySelector(".text").querySelector("span").click()
            content.querySelector(".film-description").querySelector(".text").querySelector("span").remove()
            result.info.description = (content.querySelector(".film-description").querySelector(".text").textContent).trim();
            
            const film_info_wrap = content.querySelector(".anisc-info").querySelectorAll(".item");
            film_info_wrap.forEach((item_el, _)=>{
                const info_list = []
                item_el.querySelectorAll(".name").forEach(name_el => {
                    if (name_el.textContent) {
                        info_list.push(name_el.textContent)
                    }
                });
                result.info[item_el.querySelector(".item-head").textContent] = info_list.join(", ");
            })
            
            return result;
        })
        const episodes_response = await get_episodes(options);
        if (episodes_response.code !== 200) return episodes_response;
        else data.episodes = episodes_response.result
        data.type_schema = 1;
        
        return {code:200, message:"OK", result:data};
    }catch (error) {
        console.error(error);
        return {code:500, message: error}
    }finally{
        await browser.close();
    }
    
}

export default get_preview;