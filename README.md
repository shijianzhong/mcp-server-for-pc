# 个人PC助手，MCP Server for PC


这是一个基于 Model Context Protocol (MCP) 的个人PC操作及其他实用工具功能。

该项目当前主要是作为smart-pet项目的演示验证服务

smart-pet 是一个MCP Client 应用，该应用是一个MCP server应用

smart-pet 开源地址：https://github.com/shijianzhong/smart-pet-with-mcp

## 功能特点

- **天气警报查询**: 根据美国州代码查询当前活动的天气警报
- **天气预报获取**: 根据经纬度获取详细的当地天气预报
- **系统关机/重启**: 允许定时关机或重启系统
- **智能浏览器搜索**: 打开浏览器并进行搜索，支持智能网址识别
- **屏幕截图**: 捕获屏幕截图并保存到指定位置

## 技术栈

- TypeScript
- Node.js
- Model Context Protocol (MCP) SDK
- Zod 用于参数验证

## 安装

```bash
# 安装依赖
npm install

# 或使用 pnpm
pnpm install

# 构建项目
npm run build
```



## 使用方法

本工具设计为通过 MCP 协议与 AI 助手连接，提供天气信息和系统功能。安装后可以通过以下方式使用：

```bash
# 作为命令行工具使用
mcp-server-for-pc
```

## 可用的工具命令

1. **获取天气警报**
   ```
   get_alerts
   ```
   参数:
   - `state`: 两字母州代码 (例如 CA, NY)

2. **获取天气预报**
   ```
   get_forecast
   ```
   参数:
   - `latitude`: 位置的纬度 (-90 到 90)
   - `longitude`: 位置的经度 (-180 到 180)

3. **系统关机/重启**
   ```
   shutdown_system
   ```
   参数:
   - `delay`: 关机前延迟（秒）
   - `force`: 是否强制关机（不提示确认）
   - `restart`: 是否重启（true）或关机（false）

4. **浏览器搜索**
   ```
   open_browser_search
   ```
   参数:
   - `searchTerm`: 要搜索的关键词
   - `url`: (可选) 要打开的网址
   - `browser`: (可选) 使用的浏览器 (默认, chrome, firefox, safari, edge)
   - `autoFindUrl`: (可选) 是否尝试从搜索词智能推断网址

5. **截取屏幕**
   ```
   capture_screenshot
   ```
   参数:
   - `savePath`: (可选) 保存截图的路径

## API 信息

该工具使用美国国家气象服务 (NWS) API 获取天气数据，仅支持美国地区的天气信息查询。

## 日志系统

应用程序会自动在当前工作目录创建 `mcp-server-for-pc.log` 文件，记录所有操作和错误信息，方便故障排查。

## 系统要求

- Node.js v14 或更高版本
- 支持 Windows, macOS 和 Linux 系统

## 开发

```bash
# 安装开发依赖
npm install

# 构建项目
npm run build
```

## 许可证

ISC License 
