const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 数据库连接
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'recharge_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 初始化数据库表
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recharge_records (
        id SERIAL PRIMARY KEY,
        streamer TEXT NOT NULL,
        account TEXT NOT NULL,
        game_account_name TEXT,
        category TEXT NOT NULL,
        alipay_account TEXT NOT NULL,
        amounts NUMERIC[] DEFAULT '{}',
        total_amount NUMERIC DEFAULT 0,
        image_urls TEXT[] DEFAULT '{}',
        is_reimbursed BOOLEAN DEFAULT false,
        submit_date DATE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('数据库表初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
}

// AI 识别金额和日期
async function recognizeImage(filePath) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const imageData = fs.readFileSync(filePath);
    const base64Image = imageData.toString('base64');
    
    const result = await model.generateContent([
      '请识别这张充值截图中的两个信息：\n1. 充值金额（纯数字）\n2. 充值日期（格式：YYYY-MM-DD 或 MM-DD）\n\n请按以下格式回复：\n金额: xxx\n日期: xxxx-xx-xx\n\n如果识别不到日期，日期字段回复"无"',
      {
        inlineData: {
          data: base64Image,
          mimeType: 'image/jpeg'
        }
      }
    ]);
    
    const text = result.response.text();
    console.log('AI识别结果:', text);
    
    // 提取金额
    let amount = null;
    const amountMatch = text.match(/金额[:：]\s*(\d+(\.\d+)?)/);
    if (amountMatch) amount = parseFloat(amountMatch[1]);
    
    // 提取日期
    let date = null;
    const dateMatch = text.match(/日期[:：]\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})/);
    if (dateMatch) {
      date = dateMatch[1];
      if (/^\d{2}-\d{2}$/.test(date)) {
        const currentYear = new Date().getFullYear();
        date = `${currentYear}-${date}`;
      }
    }
    
    return { amount, date };
  } catch (error) {
    console.error('AI识别失败:', error);
    return { amount: null, date: null };
  }
}

// API 路由

// 上传图片并识别
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    
    // AI 识别
    const { amount, date } = await recognizeImage(req.file.path);
    
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      recognizedAmount: amount,
      recognizedDate: date
    });
  } catch (error) {
    console.error('上传失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 提交充值记录
app.post('/api/records', async (req, res) => {
  try {
    const {
      streamer,
      account,
      game_account_name,
      category,
      alipay_account,
      amounts,
      total_amount,
      image_urls,
      is_reimbursed,
      submit_date
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO recharge_records 
       (streamer, account, game_account_name, category, alipay_account, amounts, total_amount, image_urls, is_reimbursed, submit_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [streamer, account, game_account_name, category, alipay_account, amounts, total_amount, image_urls, is_reimbursed, submit_date]
    );
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('保存记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取所有记录
app.get('/api/records', async (req, res) => {
  try {
    const { date, streamer } = req.query;
    let query = 'SELECT * FROM recharge_records WHERE 1=1';
    const params = [];
    
    if (date) {
      params.push(date);
      query += ` AND submit_date = $${params.length}`;
    }
    
    if (streamer) {
      params.push(`%${streamer}%`);
      query += ` AND streamer ILIKE $${params.length}`;
    }
    
    query += ' ORDER BY submit_date DESC, created_at DESC';
    
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('获取记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除记录
app.delete('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先获取记录，删除关联的图片
    const record = await pool.query('SELECT image_urls FROM recharge_records WHERE id = $1', [id]);
    if (record.rows.length > 0 && record.rows[0].image_urls) {
      for (const url of record.rows[0].image_urls) {
        const filename = path.basename(url);
        const filepath = path.join(uploadsDir, filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }
    }
    
    await pool.query('DELETE FROM recharge_records WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('删除记录失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 启动服务器
app.listen(PORT, async () => {
  console.log(`服务器运行在端口 ${PORT}`);
  await initDatabase();
});
