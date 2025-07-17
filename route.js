import http from 'http';
import findFreePorts from 'find-free-ports';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import url from 'url';
import normalizeUrl from 'normalize-url';
import proxy_request from './scripts/proxy_request.js';
import { initiate_puppeteer } from './setup/initiate_puppeteer.js';
import request_source from './setup/request_source.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);


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
let REQUEST_DOWNLOAD_BROWSER = null;
let REQUEST_DOWNLOAD_TIMEOUT = false;
let IS_LOADING_DOWNLOAD_BROWSER = false;
let LAST_USE_DOWNLOAD_BROWSER_TIMESTAMP = null; // In minutes
setInterval(async () => {
    const current_timestamp = Math.floor(dayjs().valueOf() / (1000 * 60));
    if (!LAST_USE_DOWNLOAD_BROWSER_TIMESTAMP) return;
    if ((current_timestamp - LAST_USE_DOWNLOAD_BROWSER_TIMESTAMP) > 30){ // Shutdown after 30 minutes
        console.log("Shutting down headless brwoser for getting download info after not use for so long...")
        LAST_USE_DOWNLOAD_BROWSER_TIMESTAMP = null;
        await REQUEST_DOWNLOAD_BROWSER.close();
        REQUEST_DOWNLOAD_BROWSER = null;
        
    }
},[5000])
// ==================


;(async () => {
    const server = http.createServer(async (req, res) => {
        const parsed_url = url.parse(normalizeUrl(`http://${req.headers.host}${req.url}`, { removeTrailingSlash: true }), true);
        res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins (or specify your domain)
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); // Allow specific methods
        res.setHeader('Access-Control-Allow-Headers', [
            'Content-Type',
            'Accept',
            'Authorization',
            'X-Requested-With',
            'Origin',
            'Referer',
            'User-Agent',
            'Cache-Control',
            'If-None-Match'
        ].join(', '));
        if (req.method === 'OPTIONS') {
            res.writeHead(200); // HTTP OK
            res.end();
            return; // End processing here
        }else if (req.method === 'GET') {
            if (parsed_url.pathname === "/proxy_request"){
                
                console.log(parsed_url.query.url);
                try{
                    // Extract headers from the incoming request
                    const incomingHeaders = { ...req.headers }; 
                    let retry_count = 0;
                    
                    while (true){
                        let error;
                        if (retry_count >= 3) {
                            throw new Error(`Failed to fetch: ${error}`);
                        }else{
                            try{
                                const { bodyStream, headers } = await proxy_request({
                                    url: parsed_url.query.url,
                                    origin: parsed_url.query.forward_origin,
                                    referer: parsed_url.query.forward_referer,
                                    headers: incomingHeaders // Forward incoming headers to the proxy function
                                });
                                // Forward response headers
                                res.writeHead(200, headers);
                                
                                bodyStream.pipe(res);
                                break
                            }catch(e){
                                console.error(`${e}, Retrying ${retry_count}...`);    
                                error = e;
                                retry_count += 1;
                                continue;
                            }
                        }
                        
                    }
                }catch (error) {
                    try{
                        console.error('Error in proxy_request route:', error.message);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end(`Internal Server Error: ${JSON.stringify(error)}`);
                    }catch(error){
                        console.error('Unabled: to write error head. Giving away...', error.message);
                    }
                    
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
                    
                    try {
                        await request_source({options,response:res,browser:REQUEST_EXTENSION_BROWSER,request_timeout:REQUEST_EXTENSION_TIMEOUT})
                    }catch (error) {
                        console.error('Error in request_extension route:', error.message);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end(`Internal Server Error: ${JSON.stringify(error)}`);
                    }
                });
            }else if(parsed_url.pathname  === '/request_download_info'){
                let body = '';

                req.on('data', chunk => {
                    body += chunk;
                });

                req.on('end', async () => {
                    const options = JSON.parse(body);
                    options.method = "get_watch";
                    options.BASE_DIRECTORY = BASE_DIRECTORY;
                    options.log_output_dir = options.log_output_dir || path.join(options.BASE_DIRECTORY, "log", "extension");
                    options.cache_dir = options.cache_dir || path.join(options.BASE_DIRECTORY, ".download_cache");
                    options.port = PORT
                    // if (fs.existsSync(options.cache_dir)) fs.rmSync(options.cache_dir, { recursive: true });
                    
                    try {
                        

                        if ((REQUEST_DOWNLOAD_BROWSER === null) && !IS_LOADING_DOWNLOAD_BROWSER){
                            console.log("Booting headless brwoser for getting download info...")
                            IS_LOADING_DOWNLOAD_BROWSER = true;
                            const initiate_puppeteer_for_request_download = await initiate_puppeteer(args.browser_path);
                            if (initiate_puppeteer_for_request_download.code != 200) throw (initiate_puppeteer_for_request_download.message);
                            else {REQUEST_DOWNLOAD_BROWSER=initiate_puppeteer_for_request_download.browser};
                            IS_LOADING_DOWNLOAD_BROWSER = false;
                            console.log("Boot headless brwoser for getting download info done!")
                        }

                        const start_timestamp = Math.floor(dayjs().valueOf() / (1000 * 60));
                        await new Promise((resolve) => {
                            const interval = setInterval(() => {
                                const current_timestamp = Math.floor(dayjs().valueOf() / (1000 * 60));
                                if (current_timestamp - start_timestamp > 3) {
                                    clearInterval(interval);
                                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                                    res.end(`Timeout waiting for headless brwoser for getting download info! `);

                                }
                                if (REQUEST_DOWNLOAD_BROWSER !== null) {
                                    clearInterval(interval);
                                    resolve();
                                }
                            }, 500);
                        })
                        LAST_USE_DOWNLOAD_BROWSER_TIMESTAMP = Math.floor(dayjs().valueOf() / (1000 * 60));


                        await request_source({options,response:res,browser:REQUEST_EXTENSION_BROWSER,request_timeout:REQUEST_EXTENSION_TIMEOUT})
                    }catch (error) {
                        console.error('Error in request_extension route:', error.message);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end(`Internal Server Error: ${JSON.stringify(error)}`);
                    }
                });
            }else if (parsed_url.pathname === "/request_open_external") {
                let body = '';

                req.on('data', chunk => {
                    body += chunk;
                });

                req.on('end', async () => {
                    try {
                        const options = JSON.parse(body);
                        options.browser_path = args.browser_path
                        options.method = "open_external";
                        options.BASE_DIRECTORY = BASE_DIRECTORY;
                        options.log_output_dir = options.log_output_dir || path.join(options.BASE_DIRECTORY, "log", "extension");
                        options.cache_dir = options.cache_dir || path.join(options.BASE_DIRECTORY, ".download_cache");
                        options.port = PORT

                        await request_source({options,response:res,request_timeout:REQUEST_DOWNLOAD_TIMEOUT})
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
