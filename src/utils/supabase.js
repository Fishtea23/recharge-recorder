import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 主播账号配置
export const streamerAccounts = {
  '小美会打鱼': ['954841382'],
  '小美': ['877710964'],
  '静候破产时': ['877768747'],
  '晨星从天空坠落': ['896268241'],
  '牧云天竹': ['LGCDV6'],
  '悠然之峰': ['LTDFWA'],
  '传说中大哥大': ['LTPQ4V']
}

// 获取所有主播姓名
export const getStreamers = () => Object.keys(streamerAccounts)

// 获取主播对应的所有账号
export const getAccountsByStreamer = (streamer) => {
  return streamerAccounts[streamer] || []
}
