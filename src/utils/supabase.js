import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 主播名单
export const streamers = [
  '谭思源',
  '仇丽丽',
  '彭思雅',
  '贾智源',
  '董俞贝'
]

// 游戏账号配置（账号名称 -> UID）
export const gameAccounts = {
  '小美会打鱼': '954841382',
  '小美': '877710964',
  '静候破产时': '877768747',
  '晨星从天空坠落': '896268241',
  '牧云天竹': 'LGCDV6',
  '悠然之峰': 'LTDFWA',
  '传说中大哥大': 'LTPQ4V'
}

// 获取所有游戏账号名称
export const getGameAccountNames = () => Object.keys(gameAccounts)

// 根据账号名称获取UID
export const getUidByAccount = (accountName) => {
  return gameAccounts[accountName] || ''
}
