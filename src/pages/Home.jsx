import { useState, useEffect, useRef } from 'react'
import { supabase, streamers, getGameAccountNames, getUidByAccount } from '../utils/supabase'

// 预设充值金额选项
const PRESET_AMOUNTS = [6, 12, 50, 98, 168, 328, 648]

function Home() {
  const [formData, setFormData] = useState({
    streamer: '',
    gameAccount: '',
    accountUid: '',
    category: '',
    alipayAccount: '',
    customDate: '',  // 自定义日期（可选）
    isReimbursed: '否',
    submitDate: new Date().toISOString().split('T')[0]  // 默认今天
  })
  
  const [images, setImages] = useState([]) // { file, preview, amount, amountType, customAmount, id }
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileInputRef = useRef(null)

  const gameAccountNames = getGameAccountNames()

  // 计算总金额
  useEffect(() => {
    const total = images.reduce((sum, img) => {
      const amount = img.amountType === 'custom' 
        ? (parseFloat(img.customAmount) || 0)
        : (parseFloat(img.amount) || 0)
      return sum + amount
    }, 0)
    setTotalAmount(total)
  }, [images])

  // 处理游戏账号选择
  const handleGameAccountChange = (accountName) => {
    const uid = getUidByAccount(accountName)
    setFormData({
      ...formData,
      gameAccount: accountName,
      accountUid: uid
    })
  }

  // 获取实际使用的日期（自定义日期优先，否则用今天）
  const getSubmitDate = () => {
    return formData.customDate || formData.submitDate
  }

  // 调用 Gemini API 识别金额
  const recognizeAmount = async (base64Image) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (!apiKey) {
      console.error('Gemini API Key 未配置')
      return null
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: '这是一张充值截图，请只识别图中的充值金额数字，不含任何单位和文字' },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image.split(',')[1]
                  }
                }
              ]
            }]
          })
        }
      )

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`)
      }

      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      
      // 提取数字
      const numbers = text.match(/\d+(\.\d+)?/g)
      if (numbers && numbers.length > 0) {
        return parseFloat(numbers[0])
      }
      return null
    } catch (error) {
      console.error('识别失败:', error)
      return null
    }
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

  // 检测金额是否匹配预设选项
  const matchPresetAmount = (amount) => {
    if (!amount) return { type: 'preset', value: '' }
    const numAmount = parseFloat(amount)
    if (PRESET_AMOUNTS.includes(numAmount)) {
      return { type: 'preset', value: numAmount.toString() }
    }
    return { type: 'custom', value: '', customValue: numAmount.toString() }
  }

  // 处理图片选择
  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setLoading(true)
    setMessage({ type: '', text: '' })

    for (const file of files) {
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: `${file.name} 不是图片文件` })
        continue
      }

      // 检查文件大小 (最大 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setMessage({ type: 'error', text: `${file.name} 超过 10MB 限制` })
        continue
      }

      // 生成预览图
      const previewReader = new FileReader()
      previewReader.onload = async (event) => {
        const preview = event.target.result
        const id = Date.now() + Math.random().toString(36).substr(2, 9)
        
        // 存储 file 和 arrayBuffer
        const arrayBuffer = await fileToArrayBuffer(file)
        
        // 先添加图片到列表，显示加载状态
        const newImage = { 
          id, 
          file, 
          arrayBuffer,
          preview, 
          amount: '',
          amountType: 'preset',
          customAmount: '',
          loading: true 
        }
        setImages(prev => [...prev, newImage])

        // 调用 Gemini API 识别
        const recognizedAmount = await recognizeAmount(preview)
        
        // 匹配预设金额
        const amountMatch = matchPresetAmount(recognizedAmount)
        
        // 更新识别结果
        setImages(prev => prev.map(img => {
          if (img.id !== id) return img
          if (amountMatch.type === 'preset') {
            return { 
              ...img, 
              amount: amountMatch.value,
              amountType: 'preset',
              customAmount: '',
              loading: false 
            }
          } else {
            return { 
              ...img, 
              amount: '',
              amountType: 'custom',
              customAmount: amountMatch.customValue || '',
              loading: false 
            }
          }
        }))
      }
      previewReader.readAsDataURL(file)
    }

    setLoading(false)
    // 清空 input 以便可以重复选择相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 删除图片
  const removeImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }

  // 修改金额类型
  const handleAmountTypeChange = (id, type) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, amountType: type, amount: '', customAmount: '' } : img
    ))
  }

  // 修改预设金额
  const handlePresetAmountChange = (id, value) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, amount: value } : img
    ))
  }

  // 修改自定义金额
  const handleCustomAmountChange = (id, value) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, customAmount: value } : img
    ))
  }

  // 获取图片的实际金额
  const getImageAmount = (img) => {
    if (img.amountType === 'custom') {
      return parseFloat(img.customAmount) || 0
    }
    return parseFloat(img.amount) || 0
  }

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // 验证
    if (!formData.streamer) {
      setMessage({ type: 'error', text: '请选择主播姓名' })
      return
    }
    if (!formData.gameAccount) {
      setMessage({ type: 'error', text: '请选择游戏账号' })
      return
    }
    if (!formData.category) {
      setMessage({ type: 'error', text: '请选择充值类别' })
      return
    }
    if (!formData.alipayAccount.trim()) {
      setMessage({ type: 'error', text: '请填写支付宝账号' })
      return
    }
    if (images.length === 0) {
      setMessage({ type: 'error', text: '请至少上传一张充值截图' })
      return
    }

    // 验证每张图都有金额
    for (const img of images) {
      const amount = getImageAmount(img)
      if (amount <= 0) {
        setMessage({ type: 'error', text: '请填写所有图片的充值金额' })
        return
      }
    }

    setSubmitting(true)
    setMessage({ type: '', text: '' })

    try {
      // 1. 上传图片到 Supabase Storage
      const imageUrls = []
      const amounts = []

      for (const img of images) {
        const fileExt = img.file.name.split('.').pop() || 'jpg'
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
        const filePath = `recharge-screenshots/${fileName}`

        // 使用 ArrayBuffer 上传，避免 Chrome 的 Headers 问题
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

        // 获取公开 URL
        const { data: { publicUrl } } = supabase.storage
          .from('recharge-images')
          .getPublicUrl(filePath)

        imageUrls.push(publicUrl)
        amounts.push(getImageAmount(img))
      }

      // 2. 保存记录到数据库
      const { error: insertError } = await supabase
        .from('recharge_records')
        .insert([{
          streamer: formData.streamer,
          account: formData.accountUid,
          game_account_name: formData.gameAccount,
          category: formData.category,
          alipay_account: formData.alipayAccount,
          amounts: amounts,
          total_amount: totalAmount,
          image_urls: imageUrls,
          is_reimbursed: formData.isReimbursed === '是',
          submit_date: getSubmitDate()
        }])

      if (insertError) {
        throw new Error(`记录保存失败: ${insertError.message}`)
      }

      // 重置表单
      setFormData({
        streamer: '',
        gameAccount: '',
        accountUid: '',
        category: '',
        alipayAccount: '',
        customDate: '',
        isReimbursed: '否',
        submitDate: new Date().toISOString().split('T')[0]
      })
      setImages([])
      setMessage({ type: 'success', text: '提交成功！' })

      // 3秒后清除成功消息
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
      maxWidth: '600px',
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
    form: {
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
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
    inputReadonly: {
      width: '100%',
      padding: '12px',
      fontSize: '16px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f5f5f5',
      color: '#666'
    },
    uidDisplay: {
      marginTop: '6px',
      fontSize: '13px',
      color: '#1890ff',
      padding: '8px 12px',
      backgroundColor: '#f0f9ff',
      borderRadius: '6px',
      border: '1px solid #91caff'
    },
    dateHint: {
      marginTop: '6px',
      fontSize: '12px',
      color: '#888'
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
    uploadArea: {
      border: '2px dashed #ccc',
      borderRadius: '8px',
      padding: '30px 20px',
      textAlign: 'center',
      cursor: 'pointer',
      backgroundColor: '#fafafa'
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
      marginTop: '16px'
    },
    imageCard: {
      position: 'relative',
      border: '1px solid #eee',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: 'white'
    },
    imagePreview: {
      width: '100%',
      height: '100px',
      objectFit: 'cover'
    },
    imageInfo: {
      padding: '10px'
    },
    amountTypeSelect: {
      width: '100%',
      padding: '6px',
      fontSize: '13px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      marginBottom: '6px'
    },
    presetSelect: {
      width: '100%',
      padding: '8px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      textAlign: 'center'
    },
    customInput: {
      width: '100%',
      padding: '8px',
      fontSize: '14px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      textAlign: 'center'
    },
    removeBtn: {
      position: 'absolute',
      top: '4px',
      right: '4px',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: 'rgba(255,0,0,0.8)',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
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
    totalBox: {
      backgroundColor: '#f0f9ff',
      border: '1px solid #91caff',
      borderRadius: '8px',
      padding: '16px',
      textAlign: 'center',
      marginTop: '20px'
    },
    totalLabel: {
      fontSize: '14px',
      color: '#666'
    },
    totalValue: {
      fontSize: '28px',
      fontWeight: 'bold',
      color: '#1890ff',
      marginTop: '4px'
    },
    submitBtn: {
      width: '100%',
      padding: '14px',
      fontSize: '16px',
      fontWeight: 'bold',
      color: 'white',
      backgroundColor: '#1890ff',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      marginTop: '20px'
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>💰 充值记录提交</h1>
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

        {/* 游戏账号选择 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>游戏账号 *</label>
          <select
            style={styles.select}
            value={formData.gameAccount}
            onChange={(e) => handleGameAccountChange(e.target.value)}
          >
            <option value="">请选择游戏账号</option>
            {gameAccountNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {formData.accountUid && (
            <div style={styles.uidDisplay}>
              对应UID: {formData.accountUid}
            </div>
          )}
        </div>

        {/* 充值类别 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>充值类别 *</label>
          <select
            style={styles.select}
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            <option value="">请选择类别</option>
            <option value="直播充值">直播充值</option>
            <option value="预充">预充</option>
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

        {/* 充值日期 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>充值日期 *</label>
          <input
            type="date"
            style={styles.input}
            value={formData.customDate || formData.submitDate}
            onChange={(e) => setFormData({ ...formData, customDate: e.target.value })}
          />
          <div style={styles.dateHint}>
            默认今天 ({formData.submitDate})，可选择其他日期
          </div>
        </div>

        {/* 上传截图 */}
        <div style={styles.formGroup}>
          <label style={styles.label}>充值截图 *</label>
          <div
            style={styles.uploadArea}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={styles.uploadText}>
              📷 点击上传截图<br />
              <small>支持手机拍照/相册/电脑文件</small>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            style={styles.hiddenInput}
            onChange={handleImageSelect}
          />

          {/* 图片预览 */}
          {images.length > 0 && (
            <div style={styles.imageGrid}>
              {images.map(img => (
                <div key={img.id} style={styles.imageCard}>
                  {img.loading && (
                    <span style={styles.loadingBadge}>识别中...</span>
                  )}
                  <button
                    type="button"
                    style={styles.removeBtn}
                    onClick={() => removeImage(img.id)}
                  >
                    ×
                  </button>
                  <img
                    src={img.preview}
                    alt="充值截图"
                    style={styles.imagePreview}
                  />
                  <div style={styles.imageInfo}>
                    {/* 金额类型选择 */}
                    <select
                      style={styles.amountTypeSelect}
                      value={img.amountType}
                      onChange={(e) => handleAmountTypeChange(img.id, e.target.value)}
                    >
                      <option value="preset">选择金额</option>
                      <option value="custom">手动输入</option>
                    </select>
                    
                    {/* 预设金额下拉 */}
                    {img.amountType === 'preset' && (
                      <select
                        style={styles.presetSelect}
                        value={img.amount}
                        onChange={(e) => handlePresetAmountChange(img.id, e.target.value)}
                      >
                        <option value="">选择金额</option>
                        {PRESET_AMOUNTS.map(amt => (
                          <option key={amt} value={amt}>¥{amt}</option>
                        ))}
                      </select>
                    )}
                    
                    {/* 自定义金额输入 */}
                    {img.amountType === 'custom' && (
                      <input
                        type="number"
                        style={styles.customInput}
                        placeholder="输入金额"
                        value={img.customAmount}
                        onChange={(e) => handleCustomAmountChange(img.id, e.target.value)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 总计金额 */}
        <div style={styles.totalBox}>
          <div style={styles.totalLabel}>总计金额</div>
          <div style={styles.totalValue}>¥{totalAmount.toFixed(2)}</div>
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

        {/* 提交按钮 */}
        <button
          type="submit"
          style={{
            ...styles.submitBtn,
            ...(submitting || loading ? styles.submitBtnDisabled : {})
          }}
          disabled={submitting || loading}
        >
          {submitting ? '提交中...' : '提交记录'}
        </button>
      </form>

      <div style={styles.adminLink}>
        <a href="/admin" style={styles.link}>进入管理员页面 →</a>
      </div>
    </div>
  )
}

export default Home
