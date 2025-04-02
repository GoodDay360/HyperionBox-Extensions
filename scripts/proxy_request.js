import fetch from "node-fetch";

const proxy_request = async ({ url, referer }) => {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Referer': referer,
                'User-Agent': 'Mozilla/5.0 (compatible)'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }

        // Directly return the readable stream and content type
        const contentType = response.headers.get('Content-Type');
        const bodyStream = response.body;

        return { data: bodyStream, content_type: contentType };

    } catch (error) {
        console.error('Error fetching:', error.message);
        throw error; // Re-throw the error for the caller to handle
    }
};




export default proxy_request;