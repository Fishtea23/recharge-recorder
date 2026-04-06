-- ============================================
-- Storage 存储桶权限配置 SQL
-- ============================================

-- 1. 首先确保 storage 扩展已启用
CREATE EXTENSION IF NOT EXISTS "storage";

-- 2. 创建存储桶（如果不存在）
INSERT INTO storage.buckets (id, name, public)
VALUES ('recharge-images', 'recharge-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. 删除已存在的 policies（避免冲突）
DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;

-- 4. 创建允许匿名上传的 policy
CREATE POLICY "Allow anonymous uploads" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'recharge-images');

-- 5. 创建允许匿名查看的 policy
CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'recharge-images');

-- 6. 创建允许匿名删除的 policy（可选，方便管理）
DROP POLICY IF EXISTS "Allow anonymous delete" ON storage.objects;
CREATE POLICY "Allow anonymous delete" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'recharge-images');

-- ============================================
-- 验证配置
-- ============================================
-- 查看存储桶
SELECT * FROM storage.buckets WHERE id = 'recharge-images';

-- 查看 policies
SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
