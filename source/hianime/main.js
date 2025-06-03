import get_list from './get_list.js';
import get_preview from './get_preview.js';
import get_watch from './get_watch.js';

const main = async (options) => {
    const method = options.method
    if (!method) {
        console.error("Missing 'method' argument."); 
        return {code:500, message: "Missing 'method' argument."};
    }
    else if (method === "get_list") {return await get_list(options);}
    else if (method === "get_preview") {return await get_preview(options)}
    else if (method === "get_watch") {return await get_watch(options)}
    else {console.error("Unkown method!");}
}

export default main;