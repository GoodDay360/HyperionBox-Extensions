import http from 'http';
import findFreePorts from 'find-free-ports';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import extension_manager from './extension_manager.js';
import url from 'url';
import normalizeUrl from 'normalize-url';
import proxy_request from './scripts/proxy_request.js';

const validArgs = ['log_path', 'port'];

// Parse command-line arguments into an object
const all_args = process.argv.slice(2);
const arges = {};
for (let i = 0; i < all_args.length; i++) {
    const arg = all_args[i];
    const key = arg.replace('--', ''); // Strip "--" prefix from argument

    if (validArgs.includes(key)) {
        arges[key] = all_args[i + 1] || `Value for ${key} not provided`; // Get the next argument as its value
        i++; // Skip the next argument as it's already processed
    } else {
        console.log(`Invalid argument: ${arg}`);
    }
}
if (!arges.log_path) arges.log_path = "./log/extension/initiate_result.json";

let port;
if (arges.port === "random"){
    [port] = await findFreePorts(1);
}else{
    port = Number(arges.port);
}

(async () => {
    const server = http.createServer(async (req, res) => {
        const parsed_url = url.parse(normalizeUrl(`http://${req.headers.host}${req.url}`, { removeTrailingSlash: true }), true);
        res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins (or specify your domain)
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); // Allow specific methods
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(200); // HTTP OK
            res.end();
            return; // End processing here
        }else if (req.method === 'GET') {
            if (parsed_url.pathname === "/proxy_request"){
                try {
                    // Use the proxy_request function to fetch the HLS segment stream
                    const { data, content_type } = await proxy_request({ url: parsed_url.query.url, referer: parsed_url.query.referer });

                    res.writeHead(200, { 'Content-Type': content_type });
                    data.pipe(res);
            
                } catch (error) {
                    console.error('Error in proxy_request route:', error.message);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                }
            }else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.write('Route not found');
                res.end();
            }
        }else if (req.method === 'POST') {
            if (parsed_url.pathname  === '/request_extension') {
                let body = '';

                req.on('data', chunk => {
                    body += chunk;
                });

                req.on('end', async () => {
                    try {
                        const options = JSON.parse(body);
                        
                        options.BASE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
                        options.log_output_dir = options.log_output_dir || path.join(options.BASE_DIRECTORY, "log", "extension");
                        options.cache_dir = options.cache_dir || path.join(options.BASE_DIRECTORY, ".cache");
                        options.port = port;
                        console.log(options);
                        const result = await extension_manager(options);

                        res.writeHead(result.code === 200 ? 200 : 500, { 'Content-Type': 'application/json' });
                        res.write(JSON.stringify(result));
                        res.end();
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        res.write('Invalid JSON');
                        res.end();
                    }
                });
            }else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.write('Route not found');
                res.end();
            }
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.write('Request Method not allowed');
            res.end();
        }
    });

    server.listen(port, () => {
        fs.writeFile(arges.log_path, JSON.stringify({ port }), (err) => {
            if (err) {
                console.error('Error writing port info to file:', err);
            } else {
                console.log(`Port info successfully written to "${arges.log_path}"`);
            }
        });
        console.log(`Server started on http://localhost:${port}`);
    });
})();
