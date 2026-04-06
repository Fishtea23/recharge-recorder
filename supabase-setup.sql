-- ============================================
-- 充值记录系统 - Supabase 数据库初始化 SQL
-- ============================================

-- 1. 创建充值记录表
CREATE TABLE IF NOT EXISTS recharge_records (
  id SERIAL PRIMARY KEY,
  streamer TEXT NOT NULL,           -- 主播姓名
  account TEXT NOT NULL,            -- 充值账号
  category TEXT NOT NULL,           -- 充值类别（直播充值/预充）
  alipay_account TEXT NOT NULL,     -- 支付宝账号
  amounts NUMERIC[] DEFAULT '{}',   -- 各笔金额数组
  total_amount NUMERIC DEFAULT 0,   -- 总计金额
  image_urls TEXT[] DEFAULT '{}',   -- 图片URL数组
  is_reimbursed BOOLEAN DEFAULT false,  -- 是否报销
  submit_date DATE NOT NULL,        -- 提交日期
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()  -- 创建时间
);

-- 2. 添加表注释
COMMENT ON TABLE recharge_records IS '主播充值记录表';
COMMENT ON COLUMN recharge_records.streamer IS '主播姓名';
COMMENT ON COLUMN recharge_records.account IS '充值账号UID';
COMMENT ON COLUMN recharge_records.category IS '充值类别：直播充值/预充';
COMMENT ON COLUMN recharge_records.alipay_account IS '主播支付宝账号';
COMMENT ON COLUMN recharge_records.amounts IS '每张截图识别的金额数组';
COMMENT ON COLUMN recharge_records.total_amount IS '总金额自动计算';
COMMENT ON COLUMN recharge_records.image_urls IS '充值截图存储URL数组';
COMMENT ON COLUMN recharge_records.is_reimbursed IS '是否已报销';
COMMENT ON COLUMN recharge_records.submit_date IS '提交日期';

-- 3. 启用 RLS (行级安全)
ALTER TABLE recharge_records ENABLE ROW LEVEL SECURITY;

-- 4. 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS "Allow anonymous insert" ON recharge_records;
DROP POLICY IF EXISTS "Allow anonymous select" ON recharge_records;

-- 5. 创建允许匿名插入的策略
CREATE POLICY "Allow anonymous insert" ON recharge_records
  FOR INSERT WITH CHECK (true);

-- 6. 创建允许匿名查询的策略
CREATE POLICY "Allow anonymous select" ON recharge_records
  FOR SELECT USING (true);

-- ============================================
-- Storage 存储桶配置说明
-- ============================================
-- 请在 Supabase Dashboard 中手动完成以下操作：
--
-- 1. 创建存储桶
--    - 进入 Storage → New bucket
--    - 名称：recharge-images
--    - 勾选：Public bucket
--
-- 2. 设置存储桶权限（Policies）
--    - 添加 INSERT 策略，允许 anon 角色上传
--
-- ============================================
