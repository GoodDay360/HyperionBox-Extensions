import {initiate_puppeteer, load_new_page} from '../../setup/initiate_puppeteer.js';

const open_external = async (options) =>{
    try {
        if (!options.preview_id) return {code:500, message:"Missing ''preview_id' key."};
        let url;
        if (options.watch_id){
            url = encodeURI(`${options.domain}/watch/${encodeURIComponent(options.preview_id)}?ep=${encodeURIComponent(options.watch_id)}`);
        }else{
            url = encodeURI(`${options.domain}/${encodeURIComponent(options.preview_id)}`);
        }
        
        console.log(options.browser_path)
        const initiate_result = await initiate_puppeteer(options.browser_path, false);
        if (initiate_result.code === 200) {
            const result_load_new_page = await load_new_page(initiate_result.browser);
            if (result_load_new_page.code === 200){
                const browser_page = result_load_new_page.browser_page;
                browser_page.goto(url);
                
                return {code:200, message:"Open successfully"}
            }else{
                return {code:500, message:"Fail to load new page"};
            }
        }else{
            return {code:500, message:"Fail to initiate puppeteer"}
        }
    } catch (error) {
        return {code:500, message:error.message};
    }
}

export default open_external;