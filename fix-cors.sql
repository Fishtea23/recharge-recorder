-- 修复 Supabase Storage CORS 配置
-- 允许来自任何域名的请求（适用于 Vercel 部署）

-- 先删除现有的 CORS 配置
DELETE FROM storage.config WHERE key = 'cors_rules';

-- 插入新的 CORS 配置
INSERT INTO storage.config (key, value)
VALUES ('cors_rules', '[
  {
    "origin": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "headers": ["*"],
    "maxAgeSeconds": 86400
  }
]'::jsonb);
