# FundScope 部署与运行教程

这份文档给从 GitHub clone 项目的人使用。目标是先在本地跑起来，再根据需要部署前端和后端。

## 环境要求

- **Node.js 20+**（包含 `npm`）
- **Python 3.11+**
- **Git**

### 确认环境

**Windows：**

```powershell
node -v      # 应显示 v20.x.x 或更高
npm -v       # 应显示 10.x.x 或更高
python --version  # 应显示 Python 3.11.x 或更高
git --version
```

**macOS / Linux：**

```bash
node -v
npm -v
python3 --version  # 注意是 python3
git --version
```

> 💡 如果 Python 未安装，请从 [python.org](https://www.python.org/downloads/) 下载安装，安装时勾选 "Add Python to PATH"。

## 拉取项目

```bash
git clone https://github.com/qqqqzh/fundscope.git
cd fundscope
```

本地默认配置已经够用。需要连接远程后端时，再复制环境变量样例：

**Windows：**

```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux：**

```bash
cp .env.example .env.local
```

## 一键启动

### Windows

双击 `start-dev.cmd`，或在 PowerShell 中运行：

```powershell
.\start-dev.cmd -OpenBrowser
```

跳过依赖安装检查：

```powershell
.\start-dev.cmd -SkipInstall
```

### macOS / Linux

```bash
bash scripts/start-dev.sh --open
```

跳过依赖安装检查：

```bash
bash scripts/start-dev.sh --skip-install
```

脚本会做这些事：

- 安装前端依赖：`npm ci`
- 创建后端虚拟环境：`backend/.venv`
- 安装后端依赖：`pip install -r backend/requirements.txt`
- 启动 FastAPI 后端：<http://localhost:8000>
- 启动 Next.js 前端：<http://localhost:3000>
- 写入日志到 `.run/`

停止服务：在启动脚本所在窗口按 `Ctrl+C`。

## 手动启动

如果脚本不适合你的环境，可以分两个终端启动。

### 终端 1：后端

**Windows（PowerShell）：**

```powershell
# 创建虚拟环境
python -m venv backend\.venv

# 激活虚拟环境（可选，直接用完整路径也行）
backend\.venv\Scripts\activate

# 安装依赖
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# 启动后端
backend\.venv\Scripts\python.exe backend\main.py
```

**macOS / Linux：**

```bash
# 创建虚拟环境
python3 -m venv backend/.venv

# 安装依赖
backend/.venv/bin/python -m pip install -r backend/requirements.txt

# 启动后端
backend/.venv/bin/python backend/main.py
```

> 💡 首次安装依赖可能需要几分钟，`akshare`、`pandas` 包较大。如果下载慢，可以使用国内镜像（见下方常见问题）。

后端启动成功后会显示：
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 终端 2：前端

```bash
# 安装依赖（有 package-lock.json 时推荐用 npm ci）
npm ci

# 启动开发服务器
npm run dev
```

> 💡 `npm ci` 和 `npm install` 都可以，`npm ci` 更快且保证版本一致。

前端启动成功后会显示：
```
▲ Next.js 16.x.x
- Local: http://localhost:3000
```

访问 <http://localhost:3000> 即可打开应用。

## 环境变量

前端的 Next.js API 路由会代理到 FastAPI 后端。

```env
BACKEND_BASE_URL=http://localhost:8000
```

部署到线上时，把它改成后端公网地址，例如：

```env
BACKEND_BASE_URL=https://fundscope-api.example.com
```

后端允许的前端来源：

```env
FRONTEND_ORIGINS=http://localhost:3000
```

线上可以配置成：

```env
FRONTEND_ORIGINS=https://your-fundscope.vercel.app
```

多个来源用英文逗号分隔。

## 前端部署

推荐把 Next.js 前端部署到 Vercel。

1. 在 Vercel 导入 GitHub 仓库。
2. Framework Preset 选择 `Next.js`。
3. Build Command 使用 `npm run build`。
4. Output Directory 保持默认。
5. 添加环境变量 `BACKEND_BASE_URL`，值为你的后端公网地址。
6. 部署完成后，把前端域名加入后端环境变量 `FRONTEND_ORIGINS`。

如果只部署前端但没有部署后端，基金数据接口会请求失败；本地演示仍然需要同时启动后端。

## 后端部署

后端是 `backend/main.py` 中的 FastAPI 应用。部署到 Render、Railway、Fly.io、云服务器等支持 Python 的平台时，可参考：

- Root Directory：`backend`
- Install Command：`pip install -r requirements.txt`
- Start Command：`uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment：设置 `FRONTEND_ORIGINS`

如果平台不提供 `PORT`，可以使用 `8000`。

## Vercel 说明

仓库包含 `vercel.json`，用于尝试 Vercel 的前后端服务配置。如果你的 Vercel 项目不支持该实验能力，建议采用“Vercel 部署前端 + 其他平台部署 FastAPI 后端”的稳定方案。

## 常见问题

### 端口被占用

默认端口：

- 前端：`3000`
- 后端：`8000`

**Windows 查看占用端口的进程：**

```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :8000
```

然后根据 PID 关闭进程：

```powershell
taskkill /PID <进程ID> /F
```

**macOS / Linux：**

```bash
lsof -i :3000
lsof -i :8000
kill -9 <进程ID>
```

### Python 依赖安装慢或失败

`akshare`、`pandas` 会拉取较多依赖。可以换网络环境或使用国内镜像：

**Windows：**

```powershell
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

**macOS / Linux：**

```bash
backend/.venv/bin/python -m pip install -r backend/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 虚拟环境创建失败

如果提示 "No module named venv"：

```bash
# Ubuntu/Debian
sudo apt install python3-venv

# CentOS/RHEL
sudo yum install python3-venv
```

### npm install 失败

1. 确认 Node.js 版本 ≥ 20：`node -v`
2. 清除缓存重试：
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

### 页面能打开但没有数据

1. 先确认后端是否可访问：

   **Windows（PowerShell）：**
   ```powershell
   curl http://localhost:8000/api/index
   ```

   **macOS / Linux：**
   ```bash
   curl http://localhost:8000/api/index
   ```

2. 如果返回 JSON 数据，说明后端正常，检查前端配置
3. 如果返回错误，查看后端日志：
   ```bash
   # 查看后端错误日志（如果用一键脚本启动）
   cat .run/backend.err.log
   ```

### 首次加载较慢

首次启动时，后端需要从数据源拉取基金列表，可能需要 1-2 分钟。后续请求会使用缓存，速度会快很多。

如果前端部署在线上，确认 `BACKEND_BASE_URL` 指向公网可访问的后端地址，并确认后端 `FRONTEND_ORIGINS` 包含前端域名。
