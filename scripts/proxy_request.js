import fetch from "node-fetch";

const proxy_request = async ({ url, referer, headers }) => {
    try {
        // Remove `host` to prevent conflicts
        const sanitizedHeaders = { ...headers };
        delete sanitizedHeaders.host;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                ...sanitizedHeaders, // Include headers from client request
                'Referer': referer,
                'User-Agent': sanitizedHeaders['User-Agent'] || 'Mozilla/5.0 (compatible)'
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
