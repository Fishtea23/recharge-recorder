// API 基础地址
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// 主播名单
export const streamers = [
  '谭思源',
  '仇丽丽',
  '彭思雅',
  '贾智源',
  '董俞贝'
];

// 游戏账号配置（账号名称 -> UID）
export const gameAccounts = {
  '小美会打鱼': '954841382',
  '小美': '877710964',
  '静候破产时': '877768747',
  '晨星从天空坠落': '896268241',
  '牧云天竹': 'LGCDV6',
  '悠然之峰': 'LTDFWA',
  '传说中大哥大': 'LTPQ4V'
};

// 获取所有游戏账号名称
export const getGameAccountNames = () => Object.keys(gameAccounts);

// 根据账号名称获取UID
export const getUidByAccount = (accountName) => {
  return gameAccounts[accountName] || '';
};

// 上传图片并识别
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '上传失败');
  }

  return await response.json();
}

// 提交充值记录
export async function submitRecord(record) {
  const response = await fetch(`${API_BASE_URL}/api/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '提交失败');
  }

  return await response.json();
}

// 获取所有记录
export async function getRecords(filters = {}) {
  const params = new URLSearchParams();
  if (filters.date) params.append('date', filters.date);
  if (filters.streamer) params.append('streamer', filters.streamer);

  const response = await fetch(`${API_BASE_URL}/api/records?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '获取记录失败');
  }

  const result = await response.json();
  return result.data;
}

// 删除记录
export async function deleteRecord(id) {
  const response = await fetch(`${API_BASE_URL}/api/records/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '删除失败');
  }

  return await response.json();
}
