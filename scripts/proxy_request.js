import fetch from "node-fetch";

const proxy_request = async ({ url, referer, headers }) => {
    try {
        console.log("=================")
        console.log(referer);
        console.log(url);
        console.log("=================")

        const allowedPatterns = [
            /^Accept$/,
            /^Accept-Language$/,
            /^Range$/,
            /^Content-Type$/,
            /^Accept-Ranges$/,
            /^Content-Length$/,
            /^Access-Control-.+$/,  // Matches anything starting with Access-Control-
            /^X-.+$/                // Matches headers like X-Custom-Header, X-Requested-With, etc.
        ];

        const sanitizedHeaders = Object.keys(headers)
        .filter(key => allowedPatterns.some(pattern => pattern.test(key)))
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
        delete responseHeaders['content-encoding'];

        const bodyStream = response.body;
        console.log(responseHeaders);

        return { data: bodyStream, headers: responseHeaders };

    } catch (error) {
        console.error('Error fetching:', error.message);
        throw error;
    }
};

export default proxy_request;
