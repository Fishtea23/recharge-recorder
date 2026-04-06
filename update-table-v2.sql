-- 更新数据库表结构（如有需要）
-- 确保 game_account_name 字段存在

ALTER TABLE recharge_records 
ADD COLUMN IF NOT EXISTS game_account_name TEXT;

-- 更新已有数据的 game_account_name（如果有需要）
-- UPDATE recharge_records SET game_account_name = account WHERE game_account_name IS NULL;
