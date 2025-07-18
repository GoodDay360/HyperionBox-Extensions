import custom_fetch_headers from "./custom_fetch_headers.js";
import AbortController from 'abort-controller';
import fetch from "node-fetch";

const proxy_request = async ({ url, origin="",referer="", headers }) => {
    try {
        console.log("=================")
        console.log("Proxy origin: ", origin);
        console.log("Proxy referer: ", referer);
        console.log("Proxy url: ",url);
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

        const controller = new AbortController();
        let timeout = setTimeout(() => {
            controller.abort(); 
        }, 30000); 

        const forward_headers = {
            ...sanitizedHeaders, 
            ...custom_fetch_headers
        }
        if (origin) forward_headers['Origin'] = origin;
        if (referer) forward_headers['Referer'] = referer;
        
        const response = await fetch(url, {
            signal: controller.signal,
            method: 'GET',
            headers: forward_headers
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Proxy Request Failed to fetch: ${response.status} ${response.statusText}`);
        }
        

        const responseHeaders = Object.fromEntries(response.headers.entries());
        delete responseHeaders['content-encoding'];
        delete responseHeaders['origin'];
        delete responseHeaders['referer'];
        delete responseHeaders['access-control-allow-origin']
        console.log(responseHeaders)

        const bodyStream = response.body;

        return { bodyStream, headers: responseHeaders };

    } catch (error) {
        console.error('Proxy Request Error fetching:', error.message);
        throw error;
    }
};

export default proxy_request;
