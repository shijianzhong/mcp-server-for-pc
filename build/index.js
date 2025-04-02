#!/usr/bin/env node



import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";
const LOG_FILE_PATH = path.join(process.cwd(), 'weather.log');
// 创建日志记录函数
function logMessage(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    // 将日志写入文件
    fs.appendFile(LOG_FILE_PATH, logEntry, (err) => {
        if (err) {
            console.error(`写入日志文件失败: ${err.message}`);
        }
    });
    // 同时在控制台输出日志
    console.error(logEntry);
}
// 初始化日志文件
function initializeLogging() {
    try {
        // 检查日志文件是否存在，如果不存在则创建
        if (!fs.existsSync(LOG_FILE_PATH)) {
            fs.writeFileSync(LOG_FILE_PATH, `[${new Date().toISOString()}] [INFO] 日志文件已创建\n`);
            console.error(`日志文件已创建: ${LOG_FILE_PATH}`);
        }
        // 写入启动日志
        const osInfo = `${os.type()} ${os.release()}`;
        const nodeVersion = process.version;
        const startMessage = `Weather服务启动 | 操作系统: ${osInfo} | Node.js版本: ${nodeVersion}`;
        logMessage(startMessage, 'INFO');
    }
    catch (error) {
        console.error(`初始化日志系统失败: ${error}`);
    }
}
// Create server instance
const server = new McpServer({
    name: "weather123",
    version: "1.0.0",
});
// Helper function for making NWS API requests
async function makeNWSRequest(url) {
    const headers = {
        "User-Agent": USER_AGENT,
        Accept: "application/geo+json",
    };
    try {
        const response = await fetch(url, { headers });
        logMessage(`API请求: ${url}, 状态码: ${response.status}`);
        if (!response.ok) {
            logMessage(`API请求失败: ${url}, 状态码: ${response.status}`, 'ERROR');
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json());
    }
    catch (error) {
        logMessage(`API请求异常: ${url}, 错误: ${error}`, 'ERROR');
        console.error("Error making NWS request:", error);
        return null;
    }
}
// Format alert data
function formatAlert(feature) {
    const props = feature.properties;
    return [
        `Event: ${props.event || "Unknown"}`,
        `Area: ${props.areaDesc || "Unknown"}`,
        `Severity: ${props.severity || "Unknown"}`,
        `Status: ${props.status || "Unknown"}`,
        `Headline: ${props.headline || "No headline"}`,
        "---",
    ].join("\n");
}
// Register weather tools
server.tool("get_alerts", "查询天气警报", {
    state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
}, async ({ state }) => {
    logMessage(`获取天气警报: 州代码 ${state}`, "INFO");
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest(alertsUrl);
    if (!alertsData) {
        logMessage(`无法获取天气警报数据: 州代码 ${stateCode}`, "ERROR");
        return {
            content: [
                {
                    type: "text",
                    text: "Failed to retrieve alerts data",
                },
            ],
        };
    }
    const features = alertsData.features || [];
    if (features.length === 0) {
        logMessage(`没有活动警报: 州代码 ${stateCode}`, "INFO");
        return {
            content: [
                {
                    type: "text",
                    text: `No active alerts for ${stateCode}`,
                },
            ],
        };
    }
    const formattedAlerts = features.map(formatAlert);
    logMessage(`发现 ${features.length} 个活动警报: 州代码 ${stateCode}`, "INFO");
    const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;
    return {
        content: [
            {
                type: "text",
                text: alertsText,
            },
        ],
    };
});
server.tool("get_forecast", "获取当地天气预报", {
    latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
    longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
}, async ({ latitude, longitude }) => {
    logMessage(`获取天气预报: 坐标 (${latitude}, ${longitude})`, "INFO");
    // Get grid point data
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest(pointsUrl);
    if (!pointsData) {
        logMessage(`无法获取网格点数据: 坐标 (${latitude}, ${longitude})`, "ERROR");
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
                },
            ],
        };
    }
    const forecastUrl = pointsData.properties?.forecast;
    if (!forecastUrl) {
        return {
            content: [
                {
                    type: "text",
                    text: "Failed to get forecast URL from grid point data",
                },
            ],
        };
    }
    // Get forecast data
    const forecastData = await makeNWSRequest(forecastUrl);
    if (!forecastData) {
        return {
            content: [
                {
                    type: "text",
                    text: "Failed to retrieve forecast data",
                },
            ],
        };
    }
    const periods = forecastData.properties?.periods || [];
    if (periods.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: "No forecast periods available",
                },
            ],
        };
    }
    // Format forecast periods
    const formattedForecast = periods.map((period) => [
        `${period.name || "Unknown"}:`,
        `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
        `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
        `${period.shortForecast || "No forecast available"}`,
        "---",
    ].join("\n"));
    const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`;
    return {
        content: [
            {
                type: "text",
                text: forecastText,
            },
        ],
    };
});
// 注册系统关机工具
server.tool("shutdown_system", "Shutdown or restart the system (Windows or Mac) 关机的时候，调用这个工具", {
    restart: z.boolean().optional().describe("True to restart, false to shutdown"),
    delay: z.number().min(0).optional().describe("Delay in seconds before shutdown"),
    force: z.boolean().optional().describe("Force shutdown without confirmation")
}, async ({ restart = false, delay = 0, force = false }) => {
    const platform = os.platform();
    let cmd = '';
    logMessage(`关机命令: ${restart ? '重启' : '关机'}, 延迟: ${delay}秒, 强制: ${force}`, "INFO");
    logMessage(`操作系统: ${platform}`, "INFO");
    if (platform === 'win32') {
        // Windows系统关机命令
        cmd = 'shutdown';
        if (restart) {
            cmd += ' /r';
        }
        else {
            cmd += ' /s';
        }
        if (force) {
            cmd += ' /f';
        }
        cmd += ` /t ${delay}`;
    }
    else if (platform === 'darwin') {
        // macOS系统关机命令
        if (restart) {
            cmd = 'osascript -e \'tell app "System Events" to restart';
        }
        else {
            cmd = 'osascript -e \'tell app "System Events" to shut down';
        }
        if (force) {
            cmd += ' now';
        }
        cmd += '\'';
        // 如果有延迟，需要在执行前等待
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
    }
    else {
        // Linux或其他Unix系统
        if (restart) {
            cmd = `shutdown -r +${Math.floor(delay / 60)}`;
        }
        else {
            cmd = `shutdown -h +${Math.floor(delay / 60)}`;
        }
        if (force) {
            cmd += ' now';
        }
    }
    return new Promise((resolve) => {
        if (!cmd) {
            resolve({
                content: [
                    {
                        type: "text",
                        text: `不支持的操作系统: ${platform}`
                    }
                ]
            });
            return;
        }
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                resolve({
                    content: [
                        {
                            type: "text",
                            text: `执行关机命令失败: ${error.message}`
                        }
                    ]
                });
                return;
            }
            resolve({
                content: [
                    {
                        type: "text",
                        text: `关机命令已执行。${restart ? '系统将重启' : '系统将关机'}${delay > 0 ? `，延迟 ${delay} 秒` : ''}`
                    }
                ]
            });
        });
    });
});
// 注册打开浏览器并搜索的工具
server.tool("open_browser_search", "打开浏览器并搜索关键词, 如果提供url，则打开url，否则使用默认搜索引擎", {
    url: z.string().url().optional().describe("要打开的网址，如果不提供则使用默认搜索引擎"),
    searchTerm: z.string().describe("要搜索的关键词"),
    browser: z.enum(["default", "chrome", "firefox", "safari", "edge"]).optional().describe("要使用的浏览器"),
    autoFindUrl: z.boolean().optional().describe("如果为true，将尝试从搜索词中智能推断网址")
}, async ({ url, searchTerm, browser = "default", autoFindUrl = true }) => {
    logMessage(`打开浏览器并搜索关键词: ${searchTerm}`, "INFO");
    logMessage(`url: ${url}`, "INFO");
    logMessage(`browser: ${browser}`, "INFO");
    logMessage(`autoFindUrl: ${autoFindUrl}`, "INFO");
    const platform = os.platform();
    let cmd = '';
    // 检查是否需要智能查找网址
    if (!url && autoFindUrl) {
        // 尝试从搜索词中推断网址
        const possibleUrl = await intelligentUrlFinder(searchTerm);
        if (possibleUrl) {
            url = possibleUrl;
        }
        else {
            // 如果无法推断出网址，则使用默认搜索引擎
            url = "https://www.baidu.com/search?q=";
        }
    }
    else if (!url) {
        // 如果没有提供URL且不自动查找，使用默认搜索引擎
        url = "https://www.baidu.com/search?q=";
    }
    // 将搜索词编码为URL安全的形式
    const encodedSearchTerm = encodeURIComponent(searchTerm);
    // 如果URL看起来像是一个网站域名而不是完整URL，则自动添加https://
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        // 检查是否是一个可能的域名（包含至少一个点）
        if (/^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+$/.test(url)) {
            url = 'https://' + url;
        }
    }
    // 如果是完整网址，不需要添加搜索参数，直接打开
    let searchUrl = url;
    // 检查URL是否看起来像是一个不需要搜索参数的网站（不包含搜索参数的完整URL）
    const isCompleteWebsite = url.startsWith('http') &&
        !url.includes('search') &&
        !url.includes('query') &&
        !url.includes('q=');
    if (!isCompleteWebsite) {
        // 如果URL不包含搜索参数占位符，则根据常见搜索引擎格式添加
        if (!url.includes('?q=') && !url.includes('&q=') && !url.includes('search=') && !url.includes('query=')) {
            // 添加适当的分隔符
            searchUrl += url.includes('?') ? '&q=' : '?q=';
        }
        // 附加搜索词到URL
        searchUrl += encodedSearchTerm;
    }
    if (platform === 'win32') {
        // Windows系统
        switch (browser) {
            case "chrome":
                cmd = `start chrome "${searchUrl}"`;
                break;
            case "firefox":
                cmd = `start firefox "${searchUrl}"`;
                break;
            case "edge":
                cmd = `start msedge "${searchUrl}"`;
                break;
            case "default":
            default:
                cmd = `start "${searchUrl}"`;
                break;
        }
    }
    else if (platform === 'darwin') {
        // macOS系统
        switch (browser) {
            case "chrome":
                cmd = `open -a "Google Chrome" "${searchUrl}"`;
                break;
            case "firefox":
                cmd = `open -a "Firefox" "${searchUrl}"`;
                break;
            case "safari":
                cmd = `open -a "Safari" "${searchUrl}"`;
                break;
            case "default":
            default:
                cmd = `open "${searchUrl}"`;
                break;
        }
    }
    else {
        // Linux系统
        switch (browser) {
            case "chrome":
                cmd = `xdg-open "${searchUrl}" || google-chrome "${searchUrl}"`;
                break;
            case "firefox":
                cmd = `xdg-open "${searchUrl}" || firefox "${searchUrl}"`;
                break;
            case "default":
            default:
                cmd = `xdg-open "${searchUrl}"`;
                break;
        }
    }
    return new Promise((resolve) => {
        if (!cmd) {
            resolve({
                content: [
                    {
                        type: "text",
                        text: `不支持的操作系统: ${platform}`
                    }
                ]
            });
            return;
        }
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                resolve({
                    content: [
                        {
                            type: "text",
                            text: `打开浏览器失败: ${error.message}`
                        }
                    ]
                });
                return;
            }
            resolve({
                content: [
                    {
                        type: "text",
                        text: `已在${browser === "default" ? "默认浏览器" : browser}中打开网址并搜索"${searchTerm}"`
                    }
                ]
            });
        });
    });
});
async function main() {
    // 初始化日志系统
    initializeLogging();
    const transport = new StdioServerTransport();
    // 添加调试日志
    console.error("准备连接到StdioServerTransport...");
    try {
        await server.connect(transport);
        console.error("连接到StdioServerTransport成功");
        logMessage("Weather MCP Server 已启动，使用stdio通信", "INFO");
        // 添加详细的调试信息
        console.error("Weather MCP Server running on stdio");
        // 记录工具信息以便调试
        const toolNames = ["get_alerts", "get_forecast", "shutdown_system", "open_browser_search"];
        console.error("已注册工具:", toolNames.join(", "));
        // 确保进程不会退出，保持监听状态
        process.stdin.resume();
        // 直接处理标准输入，用于捕获和处理JSON-RPC请求
        process.stdin.on('data', (buffer) => {
            try {
                const inputText = buffer.toString('utf8').trim();
                if (!inputText)
                    return;
                console.error("收到请求:", inputText);
                // 处理可能的多行输入，将输入拆分为多个行并逐行处理
                const lines = inputText.split(/\r?\n/).filter(line => line.trim());
                for (const line of lines) {
                    // 尝试解析请求
                    let request;
                    try {
                        // 尝试将输入作为JSON字符串解析
                        request = JSON.parse(line);
                    }
                    catch (parseError) {
                        console.error("尝试解析字符串失败，检查是否为对象:", parseError);
                        // 如果不是有效的JSON字符串，尝试直接使用（可能是被传递的对象）
                        try {
                            if (typeof line === 'object') {
                                request = line;
                            }
                            else if (line === '[object Object]') {
                                // 特殊处理客户端发送[object Object]字符串的情况
                                // 构建一个假的请求对象以响应工具列表
                                request = {
                                    jsonrpc: "2.0",
                                    id: 1,
                                    method: "mcp.server.listTools",
                                    params: {}
                                };
                            }
                            else {
                                throw new Error("无法识别的请求格式");
                            }
                        }
                        catch (objectError) {
                            console.error("无法处理请求:", objectError);
                            // 发送解析错误响应
                            console.log(JSON.stringify({
                                jsonrpc: "2.0",
                                id: null,
                                error: {
                                    code: -32700,
                                    message: "Parse error"
                                }
                            }));
                            continue; // 继续处理下一行
                        }
                    }
                    // 正常处理请求对象
                    // 特别处理工具列表请求
                    if (request.method &&
                        (request.method === 'mcp.server.listTools' ||
                            request.method === 'listTools' ||
                            request.method === 'mcp.listTools' ||
                            request.method === 'tools/list')) {
                        console.error("处理工具列表请求");
                        // 构建工具列表响应
                        const response = {
                            jsonrpc: "2.0",
                            id: request.id,
                            result: {
                                tools: [
                                    {
                                        name: "get_alerts",
                                        description: "Get weather alerts for a state",
                                        inputSchema: {
                                            type: "object",
                                            properties: {
                                                state: { type: "string", description: "Two-letter state code (e.g. CA, NY)" }
                                            },
                                            required: ["state"]
                                        }
                                    },
                                    {
                                        name: "get_forecast",
                                        description: "Get weather forecast for a location",
                                        inputSchema: {
                                            type: "object",
                                            properties: {
                                                latitude: { type: "number", description: "Latitude of the location" },
                                                longitude: { type: "number", description: "Longitude of the location" }
                                            },
                                            required: ["latitude", "longitude"]
                                        }
                                    },
                                    {
                                        name: "shutdown_system",
                                        description: "Shutdown or restart the system (Windows or Mac)",
                                        inputSchema: {
                                            type: "object",
                                            properties: {
                                                restart: { type: "boolean", description: "True to restart, false to shutdown" },
                                                delay: { type: "number", description: "Delay in seconds before shutdown" },
                                                force: { type: "boolean", description: "Force shutdown without confirmation" }
                                            }
                                        }
                                    },
                                    {
                                        name: "open_browser_search",
                                        description: "打开浏览器并搜索关键词",
                                        inputSchema: {
                                            type: "object",
                                            properties: {
                                                url: { type: "string", description: "要打开的网址，如果不提供则使用默认搜索引擎" },
                                                searchTerm: { type: "string", description: "要搜索的关键词" },
                                                browser: { type: "string", description: "要使用的浏览器" },
                                                autoFindUrl: { type: "boolean", description: "如果为true，将尝试从搜索词中智能推断网址" }
                                            },
                                            required: ["searchTerm"]
                                        }
                                    }
                                ]
                            }
                        };
                        // 输出响应
                        console.log(JSON.stringify(response));
                        return;
                    }
                }
            }
            catch (e) {
                console.error("处理请求时出错:", e);
                // 发送内部错误响应
                try {
                    console.log(JSON.stringify({
                        jsonrpc: "2.0",
                        id: null,
                        error: {
                            code: -32603,
                            message: "Internal error"
                        }
                    }));
                }
                catch (logError) {
                    console.error("发送错误响应失败:", logError);
                }
            }
        });
        // 添加错误处理
        process.on('uncaughtException', (err) => {
            logMessage(`未捕获的异常: ${err}`, "ERROR");
            console.error("未捕获的异常:", err);
            // 不要在未捕获的异常处理程序中退出进程
        });
    }
    catch (error) {
        logMessage(`连接到StdioServerTransport失败: ${error}`, "ERROR");
        console.error("连接到StdioServerTransport失败:", error);
        throw error;
    }
}
main().catch((error) => {
    logMessage(`主程序发生致命错误: ${error}`, "ERROR");
    console.error("Fatal error in main():", error);
    process.exit(1);
});
/**
 * 智能网址查找器 - 尝试将用户的搜索词转换为合适的网址
 * @param searchTerm 用户的搜索词
 * @returns 可能的网址或null
 */
async function intelligentUrlFinder(searchTerm) {
    logMessage(`尝试为搜索词查找URL: "${searchTerm}"`, "INFO");
    // 步骤1: 检查搜索词是否已经是一个网址
    if (searchTerm.match(/^(https?:\/\/)?[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+/)) {
        // 如果是网址但没有协议，添加https://
        if (!searchTerm.startsWith('http://') && !searchTerm.startsWith('https://')) {
            const url = 'https://' + searchTerm;
            logMessage(`已将搜索词转换为URL: "${url}"`, "INFO");
            return url;
        }
        logMessage(`搜索词已经是URL: "${searchTerm}"`, "INFO");
        return searchTerm;
    }
    // 步骤2: 检查是否包含常见的网站名称
    const commonWebsites = {
        '百度': 'https://www.baidu.com/s',
        'baidu': 'https://www.baidu.com/s',
        '谷歌': 'https://www.google.com/search?q=',
        'google': 'https://www.google.com/search?q=',
        '必应': 'https://www.bing.com/search',
        'bing': 'https://www.bing.com/search',
        '淘宝': 'https://s.taobao.com/search?q=',
        'taobao': 'https://s.taobao.com/search?q=',
        '京东': 'https://search.jd.com/Search?keyword=',
        'jd': 'https://search.jd.com/Search?keyword=',
        '知乎': 'https://www.zhihu.com/search?type=content&q=',
        'zhihu': 'https://www.zhihu.com/search?type=content&q=',
        '哔哩哔哩': 'https://search.bilibili.com/all?keyword=',
        'bilibili': 'https://search.bilibili.com/all?keyword=',
        'b站': 'https://search.bilibili.com/all?keyword=',
        '微博': 'https://s.weibo.com/weibo?q=',
        'weibo': 'https://s.weibo.com/weibo?q=',
        '抖音': 'https://www.douyin.com/search/',
        'douyin': 'https://www.douyin.com/search/',
        '小红书': 'https://www.xiaohongshu.com/search_result?keyword=',
        'xiaohongshu': 'https://www.xiaohongshu.com/search_result?keyword=',
        '天猫': 'https://list.tmall.com/search_product.htm?q=',
        'tmall': 'https://list.tmall.com/search_product.htm?q=',
        '亚马逊': 'https://www.amazon.cn/s?k=',
        'amazon': 'https://www.amazon.com/s?k=',
        'twitter': 'https://twitter.com/search?q=',
        '推特': 'https://twitter.com/search?q=',
        'youtube': 'https://www.youtube.com/results?search_query=',
        '油管': 'https://www.youtube.com/results?search_query=',
        'facebook': 'https://www.facebook.com/search/top?q=',
        '脸书': 'https://www.facebook.com/search/top?q=',
        'instagram': 'https://www.instagram.com/explore/tags/',
        'ins': 'https://www.instagram.com/explore/tags/',
        '微信': 'https://weixin.sogou.com/weixin?type=2&query='
    };
    // 检查搜索词是否包含常见网站名称
    for (const [site, url] of Object.entries(commonWebsites)) {
        if (searchTerm.toLowerCase().startsWith(site.toLowerCase() + ' ') ||
            searchTerm.toLowerCase().startsWith('在' + site.toLowerCase() + '搜索') ||
            searchTerm.toLowerCase().startsWith('在' + site.toLowerCase() + '上搜索') ||
            searchTerm.toLowerCase().startsWith('search ' + site.toLowerCase())) {
            // 移除网站名称，保留搜索词
            return url;
        }
    }
    // 步骤3: 尝试猜测搜索词中是否包含网站域名
    const words = searchTerm.split(' ');
    for (const word of words) {
        // 检查是否看起来像域名（包含.com, .cn, .org等）
        if (word.match(/\.(com|cn|net|org|edu|gov|io|co|me|tv|app|xyz|site|online|shop|store|tech|ai)$/i)) {
            if (!word.startsWith('http://') && !word.startsWith('https://')) {
                return 'https://' + word;
            }
            return word;
        }
    }
    // 步骤4: 如果上述方法都失败，返回null（将使用默认搜索引擎）
    return null;
}
