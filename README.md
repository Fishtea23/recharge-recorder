# 充值记录收集系统

支持 Docker 一键部署的充值记录收集工具。

## 功能特性

- 📱 主播填写页：拍照/相册上传充值截图
- 🤖 AI 自动识别：金额和日期
- 📊 管理员后台：查看、筛选、导出 Excel
- 🗑️ 删除功能：支持删除错误记录
- 🐳 Docker 部署：一键启动，无需配置

## Docker 一键部署

### 1. 克隆项目

```bash
git clone https://github.com/Fishtea23/recharge-recorder.git
cd recharge-recorder
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入 Gemini API Key：
```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 访问系统

- 主播填写页：http://localhost:8080
- 管理员后台：http://localhost:8080/admin
- 默认密码：`Fishtea2332`

### 5. 查看日志

```bash
docker-compose logs -f
```

### 6. 停止服务

```bash
docker-compose down
```

### 7. 数据备份

数据库数据保存在 Docker volume 中：

```bash
# 备份
docker exec recharge-db pg_dump -U postgres recharge_db > backup.sql

# 恢复
docker exec -i recharge-db psql -U postgres recharge_db < backup.sql
```

## 技术栈

- **前端**：React + Vite
- **后端**：Node.js + Express
- **数据库**：PostgreSQL
- **AI 识别**：Google Gemini 1.5 Flash
- **部署**：Docker + Docker Compose

## 数据说明

- 数据库：`recharge_db`
- 用户名：`postgres`
- 密码：`postgres123`
- 图片存储：`./uploads` 目录

## 默认主播名单

- 谭思源
- 仇丽丽
- 彭思雅
- 贾智源
- 董俞贝

## 预设充值金额

6, 12, 50, 98, 168, 328, 648
