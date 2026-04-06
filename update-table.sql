-- 更新充值记录表，添加游戏账号名称字段
ALTER TABLE recharge_records 
ADD COLUMN IF NOT EXISTS game_account_name TEXT;

-- 添加注释
COMMENT ON COLUMN recharge_records.game_account_name IS '游戏账号名称（如：小美会打鱼）';
COMMENT ON COLUMN recharge_records.account IS '游戏账号对应的UID';
