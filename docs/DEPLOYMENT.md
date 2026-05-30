# FundScope 部署与运行教程

这份文档给从 GitHub clone 项目的人使用。目标是先在本地跑起来，再根据需要部署前端和后端。

## 环境要求

- Node.js 20+，包含 `npm`
- Python 3.11+
- Git

确认环境：

```bash
node -v
npm -v
python --version
```

macOS / Linux 通常使用：

```bash
python3 --version
```

## 拉取项目

```bash
git clone https://github.com/qqqqzh/fundscope.git
cd fundscope
```

本地默认配置已经够用。需要连接远程后端时，再复制环境变量样例：

```bash
cp .env.example .env.local
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
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

终端 1：后端

```bash
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
backend/.venv/Scripts/python backend/main.py
```

macOS / Linux：

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python backend/main.py
```

终端 2：前端

```bash
npm ci
npm run dev
```

访问 <http://localhost:3000>。

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

先关闭占用这些端口的旧进程，再重新运行启动脚本。

### Python 依赖安装慢或失败

`akshare`、`pandas` 会拉取较多依赖。可以换网络环境或使用国内镜像：

```bash
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

macOS / Linux：

```bash
backend/.venv/bin/python -m pip install -r backend/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 页面能打开但没有数据

先确认后端是否可访问：

```bash
curl http://localhost:8000/api/index
```

如果前端部署在线上，确认 `BACKEND_BASE_URL` 指向公网可访问的后端地址，并确认后端 `FRONTEND_ORIGINS` 包含前端域名。
