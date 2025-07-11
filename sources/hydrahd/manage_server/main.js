import server_2 from "./server_2.js";
import server_3 from "./server_3.js";
const SERVER = {
    "2": server_2,
    "3": server_3
}

const manage_server = async ({server_id, server_link, options}) => {
    return await SERVER[server_id]({server_id, server_link, options});
}

export default manage_server;