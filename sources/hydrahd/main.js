import get_list from './get_list.js';
import get_preview from './get_preview.js';
import get_watch from './get_watch.js';
import open_external from './open_external.js';

const main = async (options) => {
    const method = options.method
    options.domain = "https://hydrahd.sh"
    
    if (!method) {
        console.error("Missing 'method' argument."); 
        return {code:500, message: "Missing 'method' argument."};
    }
    else if (method === "get_list") {return await get_list(options);}
    else if (method === "get_preview") {return await get_preview(options)}
    else if (method === "get_watch") {return await get_watch(options)}
    else if (method === "open_external") {return await open_external(options)}
    else {console.error("Unkown method!");}
}

export default main;