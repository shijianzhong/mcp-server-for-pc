# PC-MCP

[English Version](#english)

## 功能特点

- **天气警报**: 通过美国州代码查询活跃的天气警报
- **天气预报**: 通过坐标获取详细的本地天气预报
- **系统关机/重启**: 计划系统关机或重启
- **智能浏览器搜索**: 打开浏览器并进行智能URL检测的搜索
- **截图捕获**: 捕获和保存屏幕截图

## 技术栈

- TypeScript
- Node.js
- 模型上下文协议(MCP) SDK
- Zod 参数验证

## 安装方法

### 使用npx（无需安装）

```bash
npx pc-mcp
```

### 全局安装

```bash
npm install -g pc-mcp
```

然后可以这样使用：

```bash
pc-mcp
```

### 本地开发

```bash
# 克隆仓库
git clone <repository-url>
cd pc-mcp

# 安装依赖
npm install
# 或
pnpm install

# 构建项目
npm run build

# 本地运行
node build/index.js
```

## 可用命令

1. **获取天气警报**
   ```
   get_alerts
   ```
   参数:
   - `state`: 两字母州代码（例如：CA, NY）

2. **获取天气预报**
   ```
   get_forecast
   ```
   参数:
   - `latitude`: 位置纬度（-90到90）
   - `longitude`: 位置经度（-180到180）

3. **系统关机/重启**
   ```
   shutdown_system
   ```
   参数:
   - `delay`: 关机前延迟（秒）
   - `force`: 是否强制关机（无确认）
   - `restart`: 是否重启（true）或关机（false）

4. **浏览器搜索**
   ```
   open_browser_search
   ```
   参数:
   - `keywords`: 要搜索的关键词
   - `url`: （可选）要打开的URL
   - `browser`: （可选）要使用的浏览器（default, chrome, firefox, safari, edge）
   - `autoFindUrl`: （可选）是否从搜索词智能推断URL

5. **捕获截图**
   ```
   capture_screenshot
   ```
   参数:
   - `savePath`: （可选）保存截图的路径

## API信息

本工具使用美国国家气象服务(NWS) API获取天气数据，仅支持美国地区的天气信息查询。

## 日志系统

应用程序会在当前工作目录下自动创建`mcp-server-for-pc.log`文件，记录所有操作和错误信息，便于故障排除。

## 系统要求

- Node.js v18或更高版本
- 支持Windows、macOS和Linux系统

## 发布

要将此包发布到npm:

```bash
# 登录npm
npm login

# 构建项目（这会在npm publish时自动运行）
npm run build

# 发布包
npm publish
```

发布后，用户可以直接运行：

```bash
npx pc-mcp
```

## 许可证

ISC许可证

---

<a name="english"></a>

# PC-MCP

A Model Context Protocol (MCP) server for accessing weather data and system functions from PC.

## Features

- **Weather Alerts**: Query active weather alerts by US state code
- **Weather Forecasts**: Get detailed local weather forecasts by coordinates
- **System Shutdown/Restart**: Schedule system shutdown or restart
- **Smart Browser Search**: Open browser and perform searches with intelligent URL detection
- **Screenshot Capture**: Capture and save screenshots

## Technology Stack

- TypeScript
- Node.js
- Model Context Protocol (MCP) SDK
- Zod for parameter validation

## Installation

### Using npx (No Installation Required)

```bash
npx pc-mcp
```

### Global Installation

```bash
npm install -g pc-mcp
```

Then you can use it as:

```bash
pc-mcp
```

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd pc-mcp

# Install dependencies
npm install
# or
pnpm install

# Build the project
npm run build

# Run locally
node build/index.js
```

## Available Commands

1. **Get Weather Alerts**
   ```
   get_alerts
   ```
   Parameters:
   - `state`: Two-letter state code (e.g., CA, NY)

2. **Get Weather Forecast**
   ```
   get_forecast
   ```
   Parameters:
   - `latitude`: Latitude of the location (-90 to 90)
   - `longitude`: Longitude of the location (-180 to 180)

3. **System Shutdown/Restart**
   ```
   shutdown_system
   ```
   Parameters:
   - `delay`: Delay before shutdown (seconds)
   - `force`: Whether to force shutdown (no confirmation)
   - `restart`: Whether to restart (true) or shutdown (false)

4. **Browser Search**
   ```
   open_browser_search
   ```
   Parameters:
   - `searchTerm`: Keywords to search for
   - `url`: (Optional) URL to open
   - `browser`: (Optional) Browser to use (default, chrome, firefox, safari, edge)
   - `autoFindUrl`: (Optional) Whether to intelligently infer URL from search term

5. **Capture Screenshot**
   ```
   capture_screenshot
   ```
   Parameters:
   - `savePath`: (Optional) Path to save the screenshot

## API Information

This tool uses the US National Weather Service (NWS) API for weather data, supporting weather information queries only for US regions.

## Logging System

The application automatically creates a `mcp-server-for-pc.log` file in the current working directory, recording all operations and error information for troubleshooting.

## System Requirements

- Node.js v18 or higher
- Supports Windows, macOS, and Linux systems

## Publishing

To publish this package to npm:

```bash
# Login to npm
npm login

# Build the project (this will run automatically with npm publish)
npm run build

# Publish the package
npm publish
```

After publishing, users can run it directly using:

```bash
npx pc-mcp
```

## License

ISC License 
