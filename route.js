import http from 'http';
import findFreePorts from 'find-free-ports';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import url from 'url';
import normalizeUrl from 'normalize-url';
import proxy_request from './scripts/proxy_request.js';
import { initiate_puppeteer, load_new_page } from './setup/initiate_puppeteer.js';
import request_source from './setup/request_source.js';

const BASE_DIRECTORY = dirname(fileURLToPath(import.meta.url))

const validArgs = ['log_path', 'port', "browser_path"];
// Parse command-line arguments into an object
const all_args = process.argv.slice(2);
const args = {};
for (let i = 0; i < all_args.length; i++) {
    const arg = all_args[i];
    const key = arg.replace('--', ''); // Strip "--" prefix from argument

    if (validArgs.includes(key)) {
        args[key] = all_args[i + 1] || `Value for ${key} not provided`; // Get the next argument as its value
        i++; // Skip the next argument as it's already processed
    } else {
        console.log(`Invalid argument: ${arg}`);
    }
}
if (!args.log_path) {
    const log_dir = path.join(BASE_DIRECTORY, "log");
    if (!fs.existsSync(log_dir)) fs.mkdirSync(log_dir, { recursive: true });
    args.log_path = path.join(log_dir, "initiate_extension_result.json");
}

let PORT;
if (args.port === "random"){
    [PORT] = await findFreePorts(1);
}else{
    PORT = Number(args.port);
}
if (!args.browser_path) throw ("Missing argument 'browser_path'.")

// Setup config for request_extension endpoints
let REQUEST_EXTENSION_BROWSER;
const initiate_puppeteer_for_request_extension = await initiate_puppeteer(args.browser_path);
if (initiate_puppeteer_for_request_extension.code != 200) throw (initiate_puppeteer_for_request_extension.message);
else {REQUEST_EXTENSION_BROWSER=initiate_puppeteer_for_request_extension.browser};
let REQUEST_EXTENSION_TIMEOUT = false;
// ==================


// Setup config for request_download endpoints
let REQUEST_DOWNLOAD_BROWSER;
const initiate_puppeteer_for_request_download = await initiate_puppeteer(args.browser_path);
if (initiate_puppeteer_for_request_download.code != 200) throw (initiate_puppeteer_for_request_download.message);
else {REQUEST_DOWNLOAD_BROWSER=initiate_puppeteer_for_request_download.browser};
let REQUEST_DOWNLOAD_TIMEOUT = false;
// ==================


;(async () => {
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
                    console.log(parsed_url.query.url);

                    // Extract headers from the incoming request
                    const incomingHeaders = { ...req.headers }; 

                    const { data, headers } = await proxy_request({
                        url: parsed_url.query.url,
                        referer: parsed_url.query.referer,
                        headers: incomingHeaders // Forward incoming headers to the proxy function
                    });
                    
                    // Forward response headers
                    res.writeHead(200, headers);
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
                    const options = JSON.parse(body);
                    options.BASE_DIRECTORY = BASE_DIRECTORY;
                    options.log_output_dir = options.log_output_dir || path.join(options.BASE_DIRECTORY, "log", "extension");
                    options.cache_dir = options.cache_dir || path.join(options.BASE_DIRECTORY, ".cache");
                    options.port = PORT
                    
                    await request_source({options,response:res,browser:REQUEST_EXTENSION_BROWSER,request_timeout:REQUEST_EXTENSION_TIMEOUT})
                });
            }else if(parsed_url.pathname  === '/request_download_info'){
                let body = '';

                req.on('data', chunk => {
                    body += chunk;
                });

                req.on('end', async () => {
                    const options = JSON.parse(body);
                    console.log("B",JSON.parse(body))
                    options.method = "get_watch";
                    options.BASE_DIRECTORY = BASE_DIRECTORY;
                    options.log_output_dir = options.log_output_dir || path.join(options.BASE_DIRECTORY, "log", "extension");
                    options.cache_dir = options.cache_dir || path.join(options.BASE_DIRECTORY, ".download_cache");
                    options.port = PORT
                    // if (fs.existsSync(options.cache_dir)) fs.rmSync(options.cache_dir, { recursive: true });
                    
                    await request_source({options,response:res,browser:REQUEST_DOWNLOAD_BROWSER,request_timeout:REQUEST_DOWNLOAD_TIMEOUT})
                });
            }else if (parsed_url.pathname === "/request_open_external") {
                let body = '';

                req.on('data', chunk => {
                    body += chunk;
                });

                req.on('end', async () => {
                    try {

                        const options = JSON.parse(body);
                        const url = options.url;
                        const initiate_result = await initiate_puppeteer(args.browser_path, false);
                        if (initiate_result.code == 200) {
                            const result_load_new_page = await load_new_page(initiate_result.browser);
                            if (result_load_new_page.code === 200){
                                const browser_page = result_load_new_page.browser_page;
                                await browser_page.goto(url, { waitUntil: 'networkidle0' });
                                
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.write(JSON.stringify({code:200, message:"Open successfully"}));
                                res.end();
                            }else{
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.write(JSON.stringify({code:200, message:"Fail to load new page"}));
                                res.end();
                                return;
                            }
                        
                        }else{
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.write(JSON.stringify({code:500, message:"Fail to initiate puppeteer"}));
                            res.end();
                        }
                    } catch (error) {
                        console.error('Error in request_open_external route:', error.message);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Internal Server Error');
                    }
                    
                });

                
                
            }else if (parsed_url.pathname === "/shutdown") {
                try {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.write('Server is shutting down...');
                    res.end();

                    try{
                        REQUEST_EXTENSION_BROWSER.close()
                        REQUEST_DOWNLOAD_BROWSER.close()
                    }catch (error) {
                        console.error('Error shutting down the server:', error.message);
                    }

                    process.exit(0);
                    
                } catch (error) {
                    console.error('Error shutting down the server:', error.message);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(`Failed to shut down the server: ${JSON.stringify(error.message)}`);
                }
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

    server.listen(PORT, () => {
        fs.writeFile(args.log_path, JSON.stringify({ port:PORT }), (err) => {
            if (err) {
                console.error('Error writing port info to file:', err);
            } else {
                console.log(`Port info successfully written to "${args.log_path}"`);
            }
        });
        console.log(`Server started on http://localhost:${PORT}`);
    });
})();
