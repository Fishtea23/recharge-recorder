import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import * as XLSX from 'xlsx'

function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    date: '',
    streamer: ''
  })
  const [selectedImages, setSelectedImages] = useState(null)
  const [viewingRecord, setViewingRecord] = useState(null)

  const ADMIN_PASSWORD = 'Fishtea2332'

  // 登录
  const handleLogin = (e) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setLoginError('')
      loadRecords()
    } else {
      setLoginError('密码错误')
    }
  }

  // 加载记录
  const loadRecords = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('recharge_records')
        .select('*')
        .order('submit_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters.date) {
        query = query.eq('submit_date', filters.date)
      }

      if (filters.streamer) {
        query = query.ilike('streamer', `%${filters.streamer}%`)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      setRecords(data || [])
    } catch (error) {
      console.error('加载记录失败:', error)
      alert('加载记录失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 导出 Excel
  const exportToExcel = () => {
    if (records.length === 0) {
      alert('没有数据可导出')
      return
    }

    const exportData = records.map(record => {
      const amountsText = (record.amounts || []).map((amount, index) => 
        `第${index + 1}笔: ¥${amount}`
      ).join(', ')

      // 生成截图链接文本
      const imageLinks = (record.image_urls || []).map((url, index) => 
        `截图${index + 1}: ${url}`
      ).join('\n')

      return {
        '提交日期': record.submit_date,
        '主播姓名': record.streamer,
        '游戏账号': record.game_account_name || '',
        '账号UID': record.account,
        '各笔金额': amountsText,
        '总计金额': record.total_amount,
        '支付宝账号': record.alipay_account,
        '充值类别': record.category,
        '是否报销': record.is_reimbursed ? '是' : '否',
        '截图链接': imageLinks,
        '创建时间': new Date(record.created_at).toLocaleString('zh-CN')
      }
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)
    
    // 设置列宽
    ws['!cols'] = [
      { wch: 12 },   // 提交日期
      { wch: 12 },   // 主播姓名
      { wch: 15 },   // 游戏账号
      { wch: 15 },   // 账号UID
      { wch: 25 },   // 各笔金额
      { wch: 10 },   // 总计金额
      { wch: 18 },   // 支付宝账号
      { wch: 10 },   // 充值类别
      { wch: 8 },    // 是否报销
      { wch: 80 },   // 截图链接
      { wch: 20 }    // 创建时间
    ]

    XLSX.utils.book_append_sheet(wb, ws, '充值记录')
    XLSX.writeFile(wb, `充值记录_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // 查看图片
  const viewImages = (record) => {
    setViewingRecord(record)
    setSelectedImages(record.image_urls || [])
  }

  // 关闭图片查看
  const closeImageViewer = () => {
    setSelectedImages(null)
    setViewingRecord(null)
  }

  // 获取所有主播（用于筛选）
  const uniqueStreamers = [...new Set(records.map(r => r.streamer))]

  const styles = {
    container: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px'
    },
    header: {
      marginBottom: '20px'
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '10px'
    },
    loginBox: {
      maxWidth: '400px',
      margin: '100px auto',
      padding: '30px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    },
    loginTitle: {
      textAlign: 'center',
      fontSize: '20px',
      marginBottom: '20px'
    },
    input: {
      width: '100%',
      padding: '12px',
      fontSize: '16px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      marginBottom: '16px',
      outline: 'none'
    },
    button: {
      width: '100%',
      padding: '12px',
      fontSize: '16px',
      fontWeight: 'bold',
      color: 'white',
      backgroundColor: '#1890ff',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer'
    },
    error: {
      color: '#ff4d4f',
      textAlign: 'center',
      marginBottom: '10px',
      fontSize: '14px'
    },
    toolbar: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      alignItems: 'center',
      marginBottom: '20px',
      padding: '16px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    filterGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    filterLabel: {
      fontSize: '14px',
      color: '#666'
    },
    filterInput: {
      padding: '8px 12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '6px',
      outline: 'none'
    },
    filterSelect: {
      padding: '8px 12px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '6px',
      outline: 'none',
      backgroundColor: 'white'
    },
    actionBtn: {
      padding: '8px 16px',
      fontSize: '14px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      backgroundColor: '#1890ff',
      color: 'white'
    },
    exportBtn: {
      padding: '8px 16px',
      fontSize: '14px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      backgroundColor: '#52c41a',
      color: 'white'
    },
    logoutBtn: {
      padding: '8px 16px',
      fontSize: '14px',
      border: '1px solid #ff4d4f',
      borderRadius: '6px',
      cursor: 'pointer',
      backgroundColor: 'white',
      color: '#ff4d4f',
      marginLeft: 'auto'
    },
    tableContainer: {
      overflowX: 'auto',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '14px'
    },
    th: {
      padding: '12px',
      textAlign: 'left',
      backgroundColor: '#fafafa',
      borderBottom: '2px solid #eee',
      fontWeight: '600',
      whiteSpace: 'nowrap'
    },
    td: {
      padding: '12px',
      borderBottom: '1px solid #eee',
      verticalAlign: 'top'
    },
    trHover: {
      ':hover': {
        backgroundColor: '#f5f5f5'
      }
    },
    amountsList: {
      margin: 0,
      paddingLeft: '16px',
      fontSize: '13px'
    },
    amountItem: {
      marginBottom: '2px'
    },
    totalCell: {
      fontWeight: 'bold',
      color: '#1890ff'
    },
    imageBtn: {
      padding: '4px 10px',
      fontSize: '12px',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      backgroundColor: '#722ed1',
      color: 'white'
    },
    badge: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500'
    },
    badgeYes: {
      backgroundColor: '#f6ffed',
      color: '#52c41a',
      border: '1px solid #b7eb8f'
    },
    badgeNo: {
      backgroundColor: '#f5f5f5',
      color: '#999',
      border: '1px solid #d9d9d9'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: '#999'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    },
    modalContent: {
      backgroundColor: 'white',
      borderRadius: '12px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      overflow: 'auto',
      padding: '20px',
      position: 'relative'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid #eee'
    },
    modalTitle: {
      fontSize: '18px',
      fontWeight: 'bold'
    },
    closeBtn: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      border: 'none',
      backgroundColor: '#f5f5f5',
      cursor: 'pointer',
      fontSize: '18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    imageGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
      gap: '16px'
    },
    imageContainer: {
      border: '1px solid #eee',
      borderRadius: '8px',
      overflow: 'hidden'
    },
    screenshot: {
      width: '100%',
      height: 'auto',
      display: 'block'
    },
    imageCaption: {
      padding: '8px',
      textAlign: 'center',
      fontSize: '13px',
      color: '#666',
      backgroundColor: '#fafafa'
    },
    backLink: {
      display: 'inline-block',
      marginTop: '20px',
      color: '#1890ff',
      textDecoration: 'none',
      fontSize: '14px'
    }
  }

  // 登录页面
  if (!isAuthenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.loginBox}>
          <h2 style={styles.loginTitle}>🔐 管理员登录</h2>
          {loginError && <p style={styles.error}>{loginError}</p>}
          <form onSubmit={handleLogin}>
            <input
              type="password"
              style={styles.input}
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" style={styles.button}>登录</button>
          </form>
        </div>
        <div style={{ textAlign: 'center' }}>
          <a href="/" style={styles.backLink}>← 返回提交页面</a>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📊 充值记录管理</h1>
      </div>

      {/* 工具栏 */}
      <div style={styles.toolbar}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>日期筛选:</label>
          <input
            type="date"
            style={styles.filterInput}
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          />
        </div>
        
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>主播:</label>
          <select
            style={styles.filterSelect}
            value={filters.streamer}
            onChange={(e) => setFilters({ ...filters, streamer: e.target.value })}
          >
            <option value="">全部主播</option>
            {uniqueStreamers.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <button style={styles.actionBtn} onClick={loadRecords}>
          🔄 刷新
        </button>
        
        <button style={styles.exportBtn} onClick={exportToExcel}>
          📥 导出 Excel
        </button>
        
        <button style={styles.logoutBtn} onClick={() => setIsAuthenticated(false)}>
          退出登录
        </button>
      </div>

      {/* 数据表格 */}
      <div style={styles.tableContainer}>
        {loading ? (
          <div style={styles.emptyState}>加载中...</div>
        ) : records.length === 0 ? (
          <div style={styles.emptyState}>
            <p>暂无数据</p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>日期</th>
                <th style={styles.th}>主播</th>
                <th style={styles.th}>游戏账号</th>
                <th style={styles.th}>UID</th>
                <th style={styles.th}>各笔金额</th>
                <th style={styles.th}>总计</th>
                <th style={styles.th}>支付宝</th>
                <th style={styles.th}>类别</th>
                <th style={styles.th}>报销</th>
                <th style={styles.th}>截图</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id} style={styles.trHover}>
                  <td style={styles.td}>{record.submit_date}</td>
                  <td style={styles.td}>{record.streamer}</td>
                  <td style={styles.td}>{record.game_account_name || '-'}</td>
                  <td style={styles.td}>{record.account}</td>
                  <td style={styles.td}>
                    <ul style={styles.amountsList}>
                      {(record.amounts || []).map((amount, idx) => (
                        <li key={idx} style={styles.amountItem}>
                          第{idx + 1}笔: ¥{amount}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td style={{ ...styles.td, ...styles.totalCell }}>
                    ¥{record.total_amount}
                  </td>
                  <td style={styles.td}>{record.alipay_account}</td>
                  <td style={styles.td}>{record.category}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      ...(record.is_reimbursed ? styles.badgeYes : styles.badgeNo)
                    }}>
                      {record.is_reimbursed ? '是' : '否'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {(record.image_urls || []).length > 0 && (
                      <button
                        style={styles.imageBtn}
                        onClick={() => viewImages(record)}
                      >
                        查看 ({record.image_urls.length}张)
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <a href="/" style={styles.backLink}>← 返回提交页面</a>
      </div>

      {/* 图片查看弹窗 */}
      {selectedImages && (
        <div style={styles.modal} onClick={closeImageViewer}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                截图查看 - {viewingRecord?.streamer} ({viewingRecord?.submit_date})
              </h3>
              <button style={styles.closeBtn} onClick={closeImageViewer}>×</button>
            </div>
            <div style={styles.imageGrid}>
              {selectedImages.map((url, idx) => (
                <div key={idx} style={styles.imageContainer}>
                  <img
                    src={url}
                    alt={`截图 ${idx + 1}`}
                    style={styles.screenshot}
                    onClick={() => window.open(url, '_blank')}
                  />
                  <div style={styles.imageCaption}>
                    第 {idx + 1} 张 - ¥{viewingRecord?.amounts?.[idx] || '未知'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
