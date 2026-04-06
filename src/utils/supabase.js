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
  '董俞'
]
