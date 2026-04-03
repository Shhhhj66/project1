require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// BCE-v3签名工具函数（百度智能云标准算法，无需修改）
function signBceV3(ak, sk, method, uri, query, headers, body) {
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 8).replace(/-/g, '');
  const authStringPrefix = `bce-v3/AK/${ak}/${date}`;

  // 构造规范化请求
  const canonicalUri = uri;
  const canonicalQueryString = new URLSearchParams(query).sort().toString();
  const canonicalHeaders = Object.entries(headers)
    .filter(([k]) => k.toLowerCase().startsWith('x-bce-') || k.toLowerCase() === 'host' || k.toLowerCase() === 'content-type')
    .sort(([k1], [k2]) => k1.toLowerCase().localeCompare(k2.toLowerCase()))
    .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}\n`)
    .join('');
  const signedHeaders = Object.entries(headers)
    .filter(([k]) => k.toLowerCase().startsWith('x-bce-') || k.toLowerCase() === 'host' || k.toLowerCase() === 'content-type')
    .map(([k]) => k.toLowerCase())
    .sort()
    .join(';');

  const bodyHash = crypto.createHash('sha256').update(body || '').digest('hex');
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`;

  // 计算签名密钥
  const signingKey = crypto.createHmac('sha256', sk).update(date).digest();

  // 计算最终签名
  const signature = crypto.createHmac('sha256', signingKey)
    .update(canonicalRequest)
    .digest('hex');

  return `${authStringPrefix}/${signedHeaders}/${signature}`;
}

// 千帆大模型对话接口（BCE-v3签名，无需Token）
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: '请求参数错误' });
    }

    const ak = process.env.BAIDU_ACCESS_KEY_ID;
    const sk = process.env.BAIDU_ACCESS_KEY_SECRET;
    if (!ak || !sk) {
      return res.status(500).json({ error: 'IAM凭证未配置，请检查.env文件' });
    }

    // 千帆ERNIE-Bot 4.0 API端点（可替换为其他模型，如ERNIE-Bot 3.5）
    const uri = '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions';
    const method = 'POST';
    const query = {};
    const body = JSON.stringify({
      messages: messages,
      temperature: 0.7,
      top_p: 0.8
    });
    const headers = {
      'Host': 'aip.baidubce.com',
      'Content-Type': 'application/json',
      'x-bce-date': new Date().toISOString().replace(/\.\d+Z$/, 'Z')
    };

    // 生成BCE-v3签名
    const authorization = signBceV3(ak, sk, method, uri, query, headers, body);
    headers['Authorization'] = authorization;

    // 调用千帆API
    const response = await axios.post(`https://aip.baidubce.com${uri}`, body, {
      headers: headers
    });

    res.json({
      result: response.data.result,
      id: response.data.id
    });
  } catch (error) {
    console.error('❌ API调用失败:', error.response?.data || error.message);
    res.status(500).json({
      error: 'AI服务暂时不可用',
      detail: error.response?.data?.error || error.message
    });
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 服务已启动，访问 http://localhost:${PORT}`);
});
