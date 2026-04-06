#!/bin/sh

# 启动后端服务
cd /app/server && npm start &

# 等待后端启动
sleep 2

# 启动 Nginx
nginx -g 'daemon off;'
