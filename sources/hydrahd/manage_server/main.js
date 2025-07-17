import { load_new_page } from "../../../setup/initiate_puppeteer.js";
import server_2 from "./server_2.js";
import server_3 from "./server_3.js";
const SERVER = {
    "2": server_2,
    "3": server_3
}

const manage_server = async ({server_id, server_link, options}) => {
    const result_load_new_page = await load_new_page(options.browser);
    if (result_load_new_page.code === 200){
        options.browser_page = result_load_new_page.browser_page;
    }else{
        resolve({code:500, message:"Fail to load new page"})
        return;
    }
    return await SERVER[server_id]({server_id, server_link, options});
}

export default manage_server;