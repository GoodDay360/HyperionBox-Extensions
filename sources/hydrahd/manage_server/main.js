import server_2 from "./server_2.js";

const SERVER = {
    "2": server_2
}

const manage_server = async ({server_id, server_link, options}) => {
    return await SERVER[server_id]({server_id, server_link, options});
}

export default manage_server;