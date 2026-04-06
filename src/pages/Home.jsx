import { useState, useEffect, useRef } from 'react'
import { supabase, streamers, getGameAccountNames, getUidByAccount } from '../utils/supabase'

// 预设充值金额选项
const PRESET_AMOUNTS = [6, 12, 50, 98, 168, 328, 648]

// 单个充值条目初始状态
const createEmptyEntry = () => ({
  id: Date.now() + Math.random().toString(36).substr(2, 9),
  gameAccount: '',
  accountUid: '',
  category: '',
  rechargeDate: new Date().toISOString().split('T')[0],
  images: [], // { id, file, arrayBuffer, preview, amount, amountType, customAmount, loading }
  totalAmount: 0
})

function Home() {
  const [formData, setFormData] = useState({
    streamer: '',
    alipayAccount: '',
    isReimbursed: '否'
  })
  
  // 多个充值条目
  const [entries, setEntries] = useState([createEmptyEntry()])
  
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [enlargedImage, setEnlargedImage] = useState(null) // 放大查看的图片
  
  const fileInputRefs = useRef({})

  const gameAccountNames = getGameAccountNames()

  // 计算单个条目的总金额
  const calculateEntryTotal = (images) => {
    return images.reduce((sum, img) => {
      const amount = img.amountType === 'custom' 
        ? (parseFloat(img.customAmount) || 0)
        : (parseFloat(img.amount) || 0)
      return sum + amount
    }, 0)
  }

  // 处理游戏账号选择
  const handleGameAccountChange = (entryId, accountName) => {
    const uid = getUidByAccount(accountName)
    setEntries(prev => prev.map(entry => 
      entry.id === entryId 
        ? { ...entry, gameAccount: accountName, accountUid: uid }
        : entry
    ))
  }

  // 添加新的充值条目
  const addEntry = () => {
    setEntries(prev => [...prev, createEmptyEntry()])
  }

  // 删除充值条目
  const removeEntry = (entryId) => {
    if (entries.length <= 1) {
      setMessage({ type: 'error', text: '至少保留一个充值条目' })
      return
    }
    setEntries(prev => prev.filter(entry => entry.id !== entryId))
  }

  // 文件转 ArrayBuffer
  const fileToArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = (e) => reject(e)
      reader.readAsArrayBuffer(file)
    })
  }

  // 调用 Gemini API 识别金额
  const recognizeAmount = async (base64Image) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) return null

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: '这是一张充值截图，请只识别图中的充值金额数字，不含任何单位和文字' },
                { inline_data: { mime_type: 'image/jpeg', data: base64Image.split(',')[1] } }
              ]
            }]
          })
        }
      )

      if (!response.ok) throw new Error(`API 请求失败: ${response.status}`)

      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const numbers = text.match(/\d+(\.\d+)?/g)
      if (numbers && numbers.length > 0) return parseFloat(numbers[0])
      return null
    } catch (error) {
      console.error('识别失败:', error)
      return null
    }
  }

  // 检测金额是否匹配预设选项
  const matchPresetAmount = (amount) => {
    if (!amount) return { type: 'preset', value: '' }
    const numAmount = parseFloat(amount)
    if (PRESET_AMOUNTS.includes(numAmount)) {
      return { type: 'preset', value: numAmount.toString() }
    }
    return { type: 'custom', value: '', customValue: numAmount.toString() }
  }

  // 处理条目内的图片选择
  const handleEntryImageSelect = async (entryId, e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setLoading(true)

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: `${file.name} 不是图片文件` })
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        setMessage({ type: 'error', text: `${file.name} 超过 10MB 限制` })
        continue
      }

      const previewReader = new FileReader()
      previewReader.onload = async (event) => {
        const preview = event.target.result
        const imgId = Date.now() + Math.random().toString(36).substr(2, 9)
        const arrayBuffer = await fileToArrayBuffer(file)
        
        const newImage = { 
          id: imgId, 
          file, 
          arrayBuffer,
          preview, 
          amount: '',
          amountType: 'preset',
          customAmount: '',
          loading: true 
        }

        setEntries(prev => prev.map(entry => {
          if (entry.id !== entryId) return entry
          const updatedImages = [...entry.images, newImage]
          return { ...entry, images: updatedImages }
        }))

        // AI 识别
        const recognizedAmount = await recognizeAmount(preview)
        const amountMatch = matchPresetAmount(recognizedAmount)

        setEntries(prev => prev.map(entry => {
          if (entry.id !== entryId) return entry
          const updatedImages = entry.images.map(img => {
            if (img.id !== imgId) return img
            if (amountMatch.type === 'preset') {
              return { ...img, amount: amountMatch.value, amountType: 'preset', customAmount: '', loading: false }
            } else {
              return { ...img, amount: '', amountType: 'custom', customAmount: amountMatch.customValue || '', loading: false }
            }
          })
          return { ...entry, images: updatedImages, totalAmount: calculateEntryTotal(updatedImages) }
        }))
      }
      previewReader.readAsDataURL(file)
    }

    setLoading(false)
    if (fileInputRefs.current[entryId]) {
      fileInputRefs.current[entryId].value = ''
    }
  }

  // 删除条目内的图片
  const removeEntryImage = (entryId, imgId) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id !== entryId) return entry
      const updatedImages = entry.images.filter(img => img.id !== imgId)
      return { ...entry, images: updatedImages, totalAmount: calculateEntryTotal(updatedImages) }
    }))
  }

  // 修改条目内图片金额类型
  const handleEntryImageAmountTypeChange = (entryId, imgId, type) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id !== entryId) return entry
      const updatedImages = entry.images.map(img => 
        img.id === imgId ? { ...img, amountType: type, amount: '', customAmount: '' } : img
      )
      return { ...entry, images: updatedImages, totalAmount: calculateEntryTotal(updatedImages) }
    }))
  }

  // 修改条目内图片预设金额
  const handleEntryImagePresetChange = (entryId, imgId, value) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id !== entryId) return entry
      const updatedImages = entry.images.map(img => 
        img.id === imgId ? { ...img, amount: value } : img
      )
      return { ...entry, images: updatedImages, totalAmount: calculateEntryTotal(updatedImages) }
    }))
  }

  // 修改条目内图片自定义金额
  const handleEntryImageCustomChange = (entryId, imgId, value) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id !== entryId) return entry
      const updatedImages = entry.images.map(img => 
        img.id === imgId ? { ...img, customAmount: value } : img
      )
      return { ...entry, images: updatedImages, totalAmount: calculateEntryTotal(updatedImages) }
    }))
  }

  // 获取图片的实际金额
  const getImageAmount = (img) => {
    if (img.amountType === 'custom') return parseFloat(img.customAmount) || 0
    return parseFloat(img.amount) || 0
  }

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // 验证基本信息
    if (!formData.streamer) {
      setMessage({ type: 'error', text: '请选择主播姓名' })
      return
    }
    if (!formData.alipayAccount.trim()) {
      setMessage({ type: 'error', text: '请填写支付宝账号' })
      return
    }

    // 验证每个条目
    for (const entry of entries) {
      if (!entry.gameAccount) {
        setMessage({ type: 'error', text: '请为每个充值条目选择游戏账号' })
        return
      }
      if (!entry.category) {
        setMessage({ type: 'error', text: '请为每个充值条目选择充值类别' })
        return
      }
      if (entry.images.length === 0) {
        setMessage({ type: 'error', text: '每个充值条目至少上传一张截图' })
        return
      }
      for (const img of entry.images) {
        if (getImageAmount(img) <= 0) {
          setMessage({ type: 'error', text: '请填写所有截图的充值金额' })
          return
        }
      }
    }

    setSubmitting(true)
    setMessage({ type: '', text: '' })

    try {
      // 逐个条目提交
      for (const entry of entries) {
        const imageUrls = []
        const amounts = []

        // 上传该条目的所有图片
        for (const img of entry.images) {
          const fileExt = img.file.name.split('.').pop() || 'jpg'
          const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
          const filePath = `recharge-screenshots/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('recharge-images')
            .upload(filePath, img.arrayBuffer, {
              contentType: img.file.type || 'image/jpeg',
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
            throw new Error(`图片上传失败: ${uploadError.message}`)
          }

          const { data: { publicUrl } } = supabase.storage
            .from('recharge-images')
            .getPublicUrl(filePath)

          imageUrls.push(publicUrl)
          amounts.push(getImageAmount(img))
        }

        // 保存记录
        const { error: insertError } = await supabase
          .from('recharge_records')
          .insert([{
            streamer: formData.streamer,
            account: entry.accountUid,
            game_account_name: entry.gameAccount,
            category: entry.category,
            alipay_account: formData.alipayAccount,
            amounts: amounts,
            total_amount: entry.totalAmount,
            image_urls: imageUrls,
            is_reimbursed: formData.isReimbursed === '是',
            submit_date: entry.rechargeDate
          }])

        if (insertError) {
          throw new Error(`记录保存失败: ${insertError.message}`)
        }
      }

      // 重置表单
      setFormData({
        streamer: '',
        alipayAccount: '',
        isReimbursed: '否'
      })
      setEntries([createEmptyEntry()])
      setMessage({ type: 'success', text: `成功提交 ${entries.length} 条充值记录！` })

      setTimeout(() => {
        setMessage({ type: '', text: '' })
      }, 3000)

    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  const styles = {
    container: {
      maxWidth: '700px',
      margin: '0 auto',
      padding: '16px',
      paddingBottom: '40px'
    },
    header: {
      textAlign: 'center',
      marginBottom: '24px'
    },
    title: {
      fontSize: '22px',
      fontWeight: 'bold',
      color: '#333'
    },
    subtitle: {
      fontSize: '14px',
      color: '#666',
      marginTop: '4px'
    },
    form: {
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    sectionTitle: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: '#333',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '2px solid #1890ff'
    },
    formGroup: {
      marginBottom: '16px'
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      fontSize: '14px',
      fontWeight: '500',
      color: '#555'
    },
    select: {
      width: '100%',
      padding: '12px',
      fontSize: '16px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: 'white',
      outline: 'none',
      touchAction: 'manipulation'
    },
    input: {
      width: '100%',
      padding: '12px',
      fontSize: '16px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      outline: 'none',
      touchAction: 'manipulation'
    },
    uidDisplay: {
      marginTop: '6px',
      fontSize: '13px',
      color: '#1890ff',
      padding: '6px 12px',
      backgroundColor: '#f0f9ff',
      borderRadius: '6px',
      border: '1px solid #91caff'
    },
    radioGroup: {
      display: 'flex',
      gap: '20px'
    },
    radioLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '16px',
      cursor: 'pointer'
    },
    entryCard: {
      backgroundColor: '#fafafa',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      border: '2px solid #e8e8e8'
    },
    entryHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px'
    },
    entryTitle: {
      fontSize: '15px',
      fontWeight: 'bold',
      color: '#333'
    },
    removeEntryBtn: {
      padding: '6px 12px',
      fontSize: '13px',
      color: '#ff4d4f',
      backgroundColor: '#fff2f0',
      border: '1px solid #ffccc7',
      borderRadius: '6px',
      cursor: 'pointer'
    },
    addEntryBtn: {
      width: '100%',
      padding: '12px',
      fontSize: '15px',
      color: '#1890ff',
      backgroundColor: '#f0f9ff',
      border: '2px dashed #91caff',
      borderRadius: '8px',
      cursor: 'pointer',
      marginBottom: '20px'
    },
    uploadArea: {
      border: '2px dashed #ccc',
      borderRadius: '8px',
      padding: '24px 16px',
      textAlign: 'center',
      cursor: 'pointer',
      backgroundColor: 'white'
    },
    uploadText: {
      color: '#666',
      fontSize: '14px'
    },
    hiddenInput: {
      display: 'none'
    },
    imageGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: '12px',
      marginTop: '12px'
    },
    imageCard: {
      position: 'relative',
      border: '1px solid #eee',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: 'white',
      cursor: 'pointer'
    },
    imagePreview: {
      width: '100%',
      height: '140px',
      objectFit: 'cover'
    },
    imageAmountBadge: {
      position: 'absolute',
      top: '28px',
      left: '4px',
      right: '4px',
      backgroundColor: 'rgba(24, 144, 255, 0.95)',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: 'bold',
      textAlign: 'center',
      zIndex: 5
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    },
    modalImage: {
      maxWidth: '90vw',
      maxHeight: '80vh',
      objectFit: 'contain'
    },
    modalCloseBtn: {
      position: 'absolute',
      top: '20px',
      right: '20px',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      backgroundColor: 'rgba(255,255,255,0.9)',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer'
    },
    imageInfo: {
      padding: '8px',
      paddingTop: '36px'
    },
    amountTypeSelect: {
      width: '100%',
      padding: '4px',
      fontSize: '12px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      marginBottom: '4px'
    },
    presetSelect: {
      width: '100%',
      padding: '6px',
      fontSize: '13px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      textAlign: 'center'
    },
    customInput: {
      width: '100%',
      padding: '6px',
      fontSize: '13px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      textAlign: 'center'
    },
    removeBtn: {
      position: 'absolute',
      top: '4px',
      right: '4px',
      width: '22px',
      height: '22px',
      borderRadius: '50%',
      backgroundColor: 'rgba(255,0,0,0.8)',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    loadingBadge: {
      position: 'absolute',
      top: '4px',
      left: '4px',
      backgroundColor: '#1890ff',
      color: 'white',
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '10px'
    },
    entryTotal: {
      marginTop: '12px',
      padding: '10px',
      backgroundColor: '#f0f9ff',
      borderRadius: '8px',
      textAlign: 'center'
    },
    entryTotalLabel: {
      fontSize: '13px',
      color: '#666'
    },
    entryTotalValue: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#1890ff'
    },
    grandTotal: {
      backgroundColor: '#e6f7ff',
      border: '2px solid #1890ff',
      borderRadius: '12px',
      padding: '20px',
      textAlign: 'center',
      marginTop: '20px',
      marginBottom: '20px'
    },
    grandTotalLabel: {
      fontSize: '14px',
      color: '#666'
    },
    grandTotalValue: {
      fontSize: '32px',
      fontWeight: 'bold',
      color: '#1890ff'
    },
    grandTotalDesc: {
      fontSize: '13px',
      color: '#888',
      marginTop: '4px'
    },
    submitBtn: {
      width: '100%',
      padding: '16px',
      fontSize: '17px',
      fontWeight: 'bold',
      color: 'white',
      backgroundColor: '#1890ff',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer'
    },
    submitBtnDisabled: {
      backgroundColor: '#ccc',
      cursor: 'not-allowed'
    },
    message: {
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '16px',
      textAlign: 'center',
      fontSize: '14px'
    },
    success: {
      backgroundColor: '#f6ffed',
      border: '1px solid #b7eb8f',
      color: '#52c41a'
    },
    error: {
      backgroundColor: '#fff2f0',
      border: '1px solid #ffccc7',
      color: '#ff4d4f'
    },
    adminLink: {
      textAlign: 'center',
      marginTop: '20px'
    },
    link: {
      color: '#1890ff',
      textDecoration: 'none',
      fontSize: '14px'
    }
  }

  // 计算总金额
  const grandTotal = entries.reduce((sum, entry) => sum + entry.totalAmount, 0)

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>💰 充值记录提交</h1>
        <p style={styles.subtitle}>一场直播可提交多个账号的充值记录</p>
      </div>

      {message.text && (
        <div style={{
          ...styles.message,
          ...(styles[message.type] || {})
        }}>
          {message.text}
        </div>
      )}

      <form style={styles.form} onSubmit={handleSubmit}>
        {/* 基本信息部分 */}
        <div style={styles.sectionTitle}>👤 基本信息（只需填写一次）</div>
        
        {/* 主播姓名 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>主播姓名 *</label>
          <select
            style={styles.select}
            value={formData.streamer}
            onChange={(e) => setFormData({ ...formData, streamer: e.target.value })}
          >
            <option value="">请选择主播</option>
            {streamers.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* 支付宝账号 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>支付宝账号 *</label>
          <input
            type="text"
            style={styles.input}
            placeholder="请输入支付宝账号"
            value={formData.alipayAccount}
            onChange={(e) => setFormData({ ...formData, alipayAccount: e.target.value })}
          />
        </div>

        {/* 是否报销 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>是否报销 *</label>
          <div style={styles.radioGroup}>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="isReimbursed"
                value="否"
                checked={formData.isReimbursed === '否'}
                onChange={(e) => setFormData({ ...formData, isReimbursed: e.target.value })}
              />
              否
            </label>
            <label style={styles.radioLabel}>
              <input
                type="radio"
                name="isReimbursed"
                value="是"
                checked={formData.isReimbursed === '是'}
                onChange={(e) => setFormData({ ...formData, isReimbursed: e.target.value })}
              />
              是
            </label>
          </div>
        </div>

        {/* 充值条目部分 */}
        <div style={{...styles.sectionTitle, marginTop: '24px'}}>💎 充值明细（可添加多个账号）</div>

        {entries.map((entry, index) => (
          <div key={entry.id} style={styles.entryCard}>
            <div style={styles.entryHeader}>
              <span style={styles.entryTitle}>充值记录 #{index + 1}</span>
              <button
                type="button"
                style={styles.removeEntryBtn}
                onClick={() => removeEntry(entry.id)}
              >
                删除
              </button>
            </div>

            {/* 游戏账号 */}
            <div style={styles.formGroup}>
              <label style={styles.label}>游戏账号 *</label>
              <select
                style={styles.select}
                value={entry.gameAccount}
                onChange={(e) => handleGameAccountChange(entry.id, e.target.value)}
              >
                <option value="">请选择游戏账号</option>
                {gameAccountNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {entry.accountUid && (
                <div style={styles.uidDisplay}>
                  对应UID: {entry.accountUid}
                </div>
              )}
            </div>

            {/* 充值日期 */}
            <div style={styles.formGroup}>
              <label style={styles.label}>充值日期 *</label>
              <input
                type="date"
                style={styles.input}
                value={entry.rechargeDate}
                onChange={(e) => setEntries(prev => prev.map(en => 
                  en.id === entry.id ? { ...en, rechargeDate: e.target.value } : en
                ))}
              />
            </div>

            {/* 充值类别 */}
            <div style={styles.formGroup}>
              <label style={styles.label}>充值类别 *</label>
              <select
                style={styles.select}
                value={entry.category}
                onChange={(e) => setEntries(prev => prev.map(en => 
                  en.id === entry.id ? { ...en, category: e.target.value } : en
                ))}
              >
                <option value="">请选择类别</option>
                <option value="直播充值">直播充值</option>
                <option value="预充">预充</option>
              </select>
            </div>

            {/* 上传截图 */}
            <div style={styles.formGroup}>
              <label style={styles.label}>充值截图 *</label>
              <div
                style={styles.uploadArea}
                onClick={() => fileInputRefs.current[`${entry.id}-camera`]?.click()}
              >
                <div style={styles.uploadText}>
                  📷 点击上传截图<br />
                  <small>支持手机拍照/相册</small>
                </div>
              </div>
              {/* 拍照按钮 */}
              <button
                type="button"
                style={{
                  width: '48%',
                  padding: '12px',
                  fontSize: '14px',
                  backgroundColor: '#f0f9ff',
                  border: '2px dashed #91caff',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '8px'
                }}
                onClick={() => fileInputRefs.current[`${entry.id}-camera`]?.click()}
              >
                📷 拍照上传
              </button>
              
              {/* 相册按钮 */}
              <button
                type="button"
                style={{
                  width: '48%',
                  padding: '12px',
                  fontSize: '14px',
                  backgroundColor: '#f6ffed',
                  border: '2px dashed #b7eb8f',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  marginLeft: '4%'
                }}
                onClick={() => fileInputRefs.current[`${entry.id}-gallery`]?.click()}
              >
                🖼️ 相册选图
              </button>

              {/* 拍照 input */}
              <input
                ref={el => fileInputRefs.current[`${entry.id}-camera`] = el}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                style={styles.hiddenInput}
                onChange={(e) => handleEntryImageSelect(entry.id, e)}
              />
              
              {/* 相册 input - 支持多选 */}
              <input
                ref={el => fileInputRefs.current[`${entry.id}-gallery`] = el}
                type="file"
                accept="image/*"
                multiple
                style={styles.hiddenInput}
                onChange={(e) => handleEntryImageSelect(entry.id, e)}
              />

              {/* 图片预览 */}
              {entry.images.length > 0 && (
                <div style={styles.imageGrid}>
                  {entry.images.map(img => {
                    const displayAmount = img.amountType === 'custom' 
                      ? (img.customAmount || '待填写')
                      : (img.amount || '待选择')
                    return (
                      <div key={img.id} style={styles.imageCard}>
                        {img.loading && (
                          <span style={styles.loadingBadge}>AI识别中...</span>
                        )}
                        <button
                          type="button"
                          style={styles.removeBtn}
                          onClick={() => removeEntryImage(entry.id, img.id)}
                        >
                          ×
                        </button>
                        {/* 图片点击放大 */}
                        <img
                          src={img.preview}
                          alt="充值截图"
                          style={styles.imagePreview}
                          onClick={() => setEnlargedImage(img.preview)}
                        />
                        {/* 显示金额 */}
                        <div style={styles.imageAmountBadge}>
                          ¥{displayAmount}
                        </div>
                        {/* 修改金额按钮 */}
                        <div style={styles.imageInfo}>
                          <select
                            style={styles.amountTypeSelect}
                            value={img.amountType}
                            onChange={(e) => handleEntryImageAmountTypeChange(entry.id, img.id, e.target.value)}
                          >
                            <option value="preset">选金额</option>
                            <option value="custom">手动填</option>
                          </select>
                          
                          {img.amountType === 'preset' && (
                            <select
                              style={styles.presetSelect}
                              value={img.amount}
                              onChange={(e) => handleEntryImagePresetChange(entry.id, img.id, e.target.value)}
                            >
                              <option value="">选金额</option>
                              {PRESET_AMOUNTS.map(amt => (
                                <option key={amt} value={amt}>¥{amt}</option>
                              ))}
                            </select>
                          )}
                          
                          {img.amountType === 'custom' && (
                            <input
                              type="number"
                              style={styles.customInput}
                              placeholder="输入金额"
                              value={img.customAmount}
                              onChange={(e) => handleEntryImageCustomChange(entry.id, img.id, e.target.value)}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 该条目小计 */}
            {entry.totalAmount > 0 && (
              <div style={styles.entryTotal}>
                <span style={styles.entryTotalLabel}>本账号合计</span>
                <div style={styles.entryTotalValue}>¥{entry.totalAmount.toFixed(2)}</div>
              </div>
            )}
          </div>
        ))}

        {/* 添加条目按钮 */}
        <button
          type="button"
          style={styles.addEntryBtn}
          onClick={addEntry}
        >
          + 添加另一个账号的充值记录
        </button>

        {/* 总计金额 */}
        <div style={styles.grandTotal}>
          <div style={styles.grandTotalLabel}>本次提交总计</div>
          <div style={styles.grandTotalValue}>¥{grandTotal.toFixed(2)}</div>
          <div style={styles.grandTotalDesc}>共 {entries.length} 个账号</div>
        </div>

        {/* 提交按钮 */}
        <button
          type="submit"
          style={{
            ...styles.submitBtn,
            ...(submitting || loading ? styles.submitBtnDisabled : {})
          }}
          disabled={submitting || loading}
        >
          {submitting ? '提交中...' : `提交 ${entries.length} 条充值记录`}
        </button>
      </form>

      <div style={styles.adminLink}>
        <a href="/admin" style={styles.link}>进入管理员页面 →</a>
      </div>

      {/* 放大图片查看 */}
      {enlargedImage && (
        <div style={styles.modal} onClick={() => setEnlargedImage(null)}>
          <button style={styles.modalCloseBtn} onClick={() => setEnlargedImage(null)}>×</button>
          <img src={enlargedImage} alt="放大查看" style={styles.modalImage} />
        </div>
      )}
    </div>
  )
}

export default Home
