# 本地部署指南（局域网使用）

适合场景：公司内部使用，同事连接同一WiFi即可访问

## 📋 前提条件

1. 一台电脑作为服务器（Windows/Mac/Linux 都可以）
2. 安装 Node.js 18+ (https://nodejs.org/)
3. 安装 PostgreSQL 15+ (https://www.postgresql.org/download/)
4. 公司WiFi/局域网环境

## 🚀 快速部署步骤

### 第一步：安装依赖

```bash
# 1. 克隆项目
git clone https://github.com/Fishtea23/recharge-recorder.git
cd recharge-recorder

# 2. 安装前端依赖
npm install

# 3. 安装后端依赖
cd server
npm install
cd ..
```

### 第二步：配置数据库

1. 打开 pgAdmin 或命令行，创建数据库：

```sql
CREATE DATABASE recharge_db;
```

2. 复制环境变量文件：

```bash
# Windows
copy .env.local.example .env
copy server\.env.local.example server\.env

# Mac/Linux
cp .env.local.example .env
cp server/.env.local.example server/.env
```

3. 编辑 `server/.env`，填入你的数据库密码和 Gemini API Key

### 第三步：获取本机IP地址

**Windows:**
```cmd
ipconfig
```
找 `IPv4 地址`，例如：`192.168.1.100`

**Mac:**
```bash
ifconfig | grep "inet "
```

**Linux:**
```bash
ip addr show
```

记住这个IP，后面同事要用它访问。

### 第四步：修改前端配置

编辑 `vite.config.js`，添加服务器配置：

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',  // 关键：允许局域网访问
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
```

### 第五步：启动服务

**打开两个终端窗口：**

**终端1 - 启动后端：**
```bash
cd server
npm start
```
看到 `服务器运行在端口 3001` 表示成功

**终端2 - 启动前端：**
```bash
npm run dev
```
看到 `Local: http://localhost:3000` 表示成功

### 第六步：防火墙设置（重要！）

**Windows 防火墙放行端口：**

以管理员身份运行 PowerShell：
```powershell
# 放行 3000 端口（前端）
netsh advfirewall firewall add rule name="Recharge App 3000" dir=in action=allow protocol=tcp localport=3000

# 放行 3001 端口（后端）
netsh advfirewall firewall add rule name="Recharge API 3001" dir=in action=allow protocol=tcp localport=3001
```

或者关闭防火墙（不推荐生产环境）：
```powershell
netsh advfirewall set allprofiles state off
```

## 📱 同事如何使用

假设你的电脑IP是 `192.168.1.100`：

1. **确保你们在同一个WiFi/局域网**

2. **同事在手机/电脑浏览器访问：**
   ```
   http://192.168.1.100:3000
   ```

3. **管理员后台地址：**
   ```
   http://192.168.1.100:3000/admin
   ```

## 🔧 常见问题

### 1. 同事打不开页面
- 检查是否同一WiFi
- 检查防火墙是否放行端口
- 尝试 ping 你的IP：`ping 192.168.1.100`

### 2. 页面打开但无法提交
- 检查后端是否启动（端口3001）
- 检查数据库是否连接正常

### 3. 如何查看我的IP
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

### 4. 电脑休眠后无法访问
- 设置电脑不自动休眠
- 或者重新运行启动命令

## 📝 开机自动启动（可选）

**Windows 使用 PM2：**
```bash
# 全局安装 pm2
npm install -g pm2

# 启动后端
pm2 start server/index.js --name "recharge-api"

# 启动前端
pm2 start "npm run dev" --name "recharge-web"

# 保存配置
pm2 save

# 开机自启
pm2 startup
```

## 🔐 安全提示

1. 仅在公司内部网络使用，不要暴露到公网
2. 定期备份数据库：`pg_dump -U postgres recharge_db > backup.sql`
3. 上传的图片保存在 `server/uploads` 目录

## 📞 需要帮助？

查看服务端日志：
```bash
cd server
npm start
```

查看前端日志：
```bash
npm run dev
```
