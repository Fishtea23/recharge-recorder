# 前端构建阶段
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# 复制前端依赖文件
COPY package*.json ./
RUN npm ci

# 复制前端源代码并构建
COPY . .
RUN npm run build

# 后端和前端服务阶段
FROM node:18-alpine

WORKDIR /app

# 安装 Nginx 用于服务前端静态文件
RUN apk add --no-cache nginx

# 复制后端依赖和代码
COPY server/package*.json ./server/
RUN cd server && npm ci --production

COPY server/ ./server/

# 从前端构建阶段复制构建产物
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/http.d/default.conf

# 创建上传目录
RUN mkdir -p /app/server/uploads

# 暴露端口
EXPOSE 80 3001

# 启动脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
