import fetch from "node-fetch";

const proxy_request = async ({ url, referer, headers }) => {
    try {
        console.log(url);

        const allowedHeaders = ["Accept", "Accept-Language", "Range"];
        const sanitizedHeaders = Object.keys(headers)
            .filter(key => allowedHeaders.includes(key))
            .reduce((obj, key) => {
                obj[key] = headers[key];
                return obj;
            }, {});

        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                ...sanitizedHeaders, 
                'Referer': referer,
                'User-Agent': 'Mozilla/5.0 (compatible)' 
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }

        const responseHeaders = Object.fromEntries(response.headers.entries());
        const bodyStream = response.body;

        return { data: bodyStream, headers: responseHeaders };

    } catch (error) {
        console.error('Error fetching:', error.message);
        throw error;
    }
};

export default proxy_request;
