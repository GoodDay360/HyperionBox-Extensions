import fetch from "node-fetch";

const convert_hls = async ({url, referer, output, options}) =>{
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

        const content = await response.text(); // Read the response body as text
        console.log(content);
    } catch (error) {
        console.error('Error fetching M3U8 file:', error.message);
    }
}

export default convert_hls;