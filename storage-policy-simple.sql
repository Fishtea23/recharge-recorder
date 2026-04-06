-- ============================================
-- Storage 存储桶权限配置 SQL（简化版）
-- ============================================

-- 1. 创建存储桶（如果不存在）
INSERT INTO storage.buckets (id, name, public)
VALUES ('recharge-images', 'recharge-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. 删除已存在的 policies（避免冲突）
DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;

-- 3. 创建允许匿名上传的 policy（关键！）
CREATE POLICY "Allow anonymous uploads" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'recharge-images');

-- 4. 创建允许匿名查看的 policy
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'recharge-images');
