#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import chalk from "chalk";
const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";
const LOG_FILE_PATH = path.join(process.cwd(), 'mcp-server-for-pc.log');
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
    if (level === 'TIPS') {
        console.log(chalk.bold.magenta('祝愿作者早日实现财务自由，生活更加丰富多彩' + "            " +
            chalk.blue.underline.bold("******" + chalk.dim.bgYellow('作者联系方式：shijianzhong521@gmail.com') + "******") + "            " +
            chalk.dim.green.bold('期待你的消息')));
        console.log(chalk.dim.yellowBright("生活原本沉闷，但跑起来就会有风"));
        console.log(chalk.dim.yellowBright("正心正念，敬天爱人，愿你我皆能得偿所愿"));
    }
    else {
        // 同时在控制台输出日志
        console.error(logEntry);
    }
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
        const startMessage = `PC MCP Server 服务启动 | 操作系统: ${osInfo} | Node.js版本: ${nodeVersion}`;
        logMessage(startMessage, 'INFO');
        logMessage('欢迎使用PC MCP Server，祝您生活愉快', 'TIPS');
    }
    catch (error) {
        console.error(`初始化日志系统失败: ${error}`);
    }
}
// Create server instance
const server = new McpServer({
    name: "mcp-server-for-pc",
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
            if (force) {
                cmd = 'osascript -e \'tell app "System Events" to restart with force\'';
            }
            else {
                cmd = 'osascript -e \'tell app "System Events" to restart\'';
            }
        }
        else {
            if (force) {
                cmd = 'osascript -e \'tell app "System Events" to shut down with force\'';
            }
            else {
                cmd = 'osascript -e \'tell app "System Events" to shut down\'';
            }
        }
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
    logMessage(`!url && autoFindUrl: ${!url && autoFindUrl}`, "INFO");
    // 检查是否需要智能查找网址
    if (!url && autoFindUrl) {
        // 尝试从搜索词中推断网址
        const possibleUrl = await intelligentUrlFinder(searchTerm);
        logMessage(`possibleUrl: ${possibleUrl}`, "INFO");
        if (possibleUrl) {
            url = possibleUrl;
        }
        else {
            // 如果无法推断出网址，则使用默认搜索引擎
            // 修正：百度的正确搜索URL格式是 s?wd= 而不是 search?q=
            // 同时提供备用搜索引擎，避免IP封禁问题
            const searchEngines = [
                "https://www.bing.com/search?q=", // 必应
                "https://www.baidu.com/s?wd=", // 百度(正确格式)
                "https://www.sogou.com/web?query=" // 搜狗
            ];
            // 默认使用必应作为第一选择
            url = searchEngines[0];
            logMessage(`使用备用搜索引擎: ${url}`, "INFO");
        }
    }
    else if (!url) {
        // 如果没有提供URL且不自动查找，使用默认搜索引擎
        url = "https://www.bing.com/search?q=";
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
// 添加截屏功能
server.tool("capture_screenshot", "截取屏幕并保存为文件", {
    savePath: z.string().optional().describe("保存截图的路径，如果不提供则使用当前目录"),
}, async ({ savePath }) => {
    const timestamp = new Date().getTime();
    const platform = os.platform();
    const homeDir = os.homedir();
    // 如果未提供保存路径，则使用桌面或当前目录
    const defaultDir = platform === 'darwin' || platform === 'win32'
        ? path.join(homeDir, 'Desktop')
        : process.cwd();
    const targetDir = savePath || defaultDir;
    // 确保目录存在
    if (!fs.existsSync(targetDir)) {
        try {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        catch (error) {
            logMessage(`创建截图保存目录失败: ${error}`, "ERROR");
            return {
                content: [
                    {
                        type: "text",
                        text: `创建目录失败: ${error}`
                    }
                ]
            };
        }
    }
    const filename = `screenshot_${timestamp}.png`;
    const filePath = path.join(targetDir, filename);
    let cmd = '';
    logMessage(`正在截取屏幕: 平台 ${platform}, 保存至 ${filePath}`, "INFO");
    if (platform === 'darwin') {
        // macOS使用screencapture命令
        cmd = `screencapture -x "${filePath}"`;
    }
    else if (platform === 'win32') {
        // Windows可以使用PowerShell的截图功能
        cmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{PRTSC}'); Start-Sleep -Milliseconds 250; $img = [System.Windows.Forms.Clipboard]::GetImage(); $img.Save('${filePath}');"`;
    }
    else if (platform === 'linux') {
        // Linux可以使用gnome-screenshot或import(ImageMagick)
        cmd = `if command -v gnome-screenshot &> /dev/null; then gnome-screenshot -f "${filePath}"; elif command -v import &> /dev/null; then import -window root "${filePath}"; else echo "找不到截图工具"; fi`;
    }
    else {
        return {
            content: [
                {
                    type: "text",
                    text: `不支持的操作系统: ${platform}`
                }
            ]
        };
    }
    return new Promise((resolve) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                logMessage(`截图失败: ${error.message}`, "ERROR");
                resolve({
                    content: [
                        {
                            type: "text",
                            text: `截图失败: ${error.message}`
                        }
                    ]
                });
                return;
            }
            // 检查文件是否成功创建
            if (fs.existsSync(filePath)) {
                logMessage(`截图成功: ${filePath}`, "INFO");
                resolve({
                    content: [
                        {
                            type: "text",
                            text: `截图已保存: ${filePath}`
                        }
                    ]
                });
            }
            else {
                logMessage(`截图命令执行成功，但找不到文件: ${filePath}`, "ERROR");
                resolve({
                    content: [
                        {
                            type: "text",
                            text: `截图命令执行成功，但找不到文件: ${filePath}`
                        }
                    ]
                });
            }
        });
    });
});
server.tool("get_system_time", "获取当前系统时间信息", {}, // 不需要参数
async () => {
    const now = new Date();
    const systemInfo = {
        timestamp: now.getTime(),
        iso8601: now.toISOString(),
        localTime: now.toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: now.getTimezoneOffset(),
        osType: os.type(),
        osPlatform: os.platform(),
        osRelease: os.release(),
        hostname: os.hostname(),
        uptime: os.uptime()
    };
    logMessage(`获取系统时间信息: ${systemInfo.localTime}`, "INFO");
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(systemInfo, null, 2)
            }
        ]
    };
});
async function main() {
    // 初始化日志系统
    initializeLogging();
    const transport = new StdioServerTransport();
    // 添加调试日志
    console.error("准备连接到StdioServerTransport...");
    try {
        await server.connect(transport);
        console.log("连接到StdioServerTransport成功");
        logMessage("PC MCP Server 已启动，使用stdio通信", "INFO");
        // 记录工具信息以便调试
        const toolNames = ["get_alerts", "get_forecast", "shutdown_system", "open_browser_search", "capture_screenshot", "get_system_time"];
        console.log(chalk.bold.yellowBright("已注册工具:", toolNames.join(", ")));
        // 确保进程不会退出，保持监听状态
        process.stdin.resume();
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
        logMessage(`搜索词已经是网址: "${searchTerm}"`, "INFO");
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
        '百度': 'https://www.baidu.com/s?wd=',
        'baidu': 'https://www.baidu.com/s?wd=',
        '谷歌': 'https://www.google.com/search?q=',
        'google': 'https://www.google.com/search?q=',
        '必应': 'https://www.bing.com/search?q=',
        'bing': 'https://www.bing.com/search?q=',
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
        '微信': 'https://weixin.sogou.com/weixin?type=2&query=',
        '搜狗': 'https://www.sogou.com/web?query='
    };
    // 检查搜索词是否包含常见网站名称
    for (const [site, url] of Object.entries(commonWebsites)) {
        logMessage(`检查搜索词是否包含常见网站名称: ${site}`, "INFO");
        if (searchTerm.toLowerCase().startsWith(site.toLowerCase() + ' ') ||
            searchTerm.toLowerCase().startsWith('在' + site.toLowerCase() + '搜索') ||
            searchTerm.toLowerCase().startsWith('在' + site.toLowerCase() + '上搜索') ||
            searchTerm.toLowerCase().startsWith('search ' + site.toLowerCase())) {
            // 移除网站名称，保留搜索词
            logMessage(`搜索词包含常见网站名称: ${site}`, "INFO");
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
