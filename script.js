require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置（必须放在最前面）
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// BCE-v3签名工具函数
function signBceV3(ak, sk, method, uri, headers, body) {
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10).replace(/-/g, '');
    const authStringPrefix = `bce-v3/AK/${ak}/${date}`;

    const canonicalUri = uri;
    const canonicalQueryString = '';
    const canonicalHeaders = Object.entries(headers)
        .filter(([k]) => k.toLowerCase().startsWith('x-bce-') || k === 'Host' || k === 'Content-Type')
        .sort(([k1], [k2]) => k1.toLowerCase().localeCompare(k2.toLowerCase()))
        .map(([k, v]) => `${k.toLowerCase()}:${v.trim()}\n`)
        .join('');
    const signedHeaders = Object.entries(headers)
        .filter(([k]) => k.toLowerCase().startsWith('x-bce-') || k === 'Host' || k === 'Content-Type')
        .map(([k]) => k.toLowerCase())
        .sort()
        .join(';');

    const bodyHash = crypto.createHash('sha256').update(body || '').digest('hex');
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`;

    const signingKey = crypto.createHmac('sha256', sk).update(date).digest();
    const signature = crypto.createHmac('sha256', signingKey).update(canonicalRequest).digest('hex');

    return `${authStringPrefix}/${signedHeaders}/${signature}`;
}

// 核心接口：/api/chat
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: '参数错误', result: '请输入问题' });
        }

// 双保险：优先读.env，读不到用硬编码（仅测试用，上线前必须删除硬编码！）
const ak = process.env.BAIDU_ACCESS_KEY_ID || "ALTAK-UcFJUYMm9kCPNcUOlRNUi";
const sk = process.env.BAIDU_ACCESS_KEY_SECRET || "84dc63a8385f7f99c53fbeada69e2f877d83fe2f";
        
        if (!ak || !sk) {
            console.error('❌ 未配置AK/SK');
            return res.status(500).json({ error: '服务配置错误', result: 'AI服务未配置，请联系管理员' });
        }

        // ERNIE-5.0 2025最新专属API端点，不要用通用/completions路径
const uri = '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-5.0-2025-01-01';
        const method = 'POST';
        const body = JSON.stringify({
            messages: messages,
            temperature: 0.7,
            top_p: 0.8,
            stream: false
        });
        const headers = {
            'Host': 'aip.baidubce.com',
            'Content-Type': 'application/json',
            'x-bce-date': new Date().toISOString().replace(/\.\d+Z$/, 'Z')
        };

        // 3. 生成签名并调用API
        const authorization = signBceV3(ak, sk, method, uri, headers, body);
        headers['Authorization'] = authorization;

        console.log('🔄 正在调用千帆API...');
        const response = await axios.post(`https://aip.baidubce.com${uri}`, body, { headers });

        // 4. 成功返回：确保数据结构存在
        if (response.data && response.data.result) {
            res.json({
                result: response.data.result,
                id: response.data.id || 'unknown'
            });
        } else {
            console.warn('⚠️ API返回数据异常:', response.data);
            res.json({ result: '收到回复，但数据格式异常' });
        }

    } catch (error) {
        // 5. 异常捕获：关键！防止后端崩溃
        console.error('❌ API调用失败:', error.response?.data || error.message);
        
        // 返回友好的错误信息，给前端一个台阶下
        res.status(200).json({ // 用200状态码，避免前端fetch报错
            result: `😅 服务出错了：${error.response?.data?.error?.message || '请稍后重试'}`
        });
    }
});

// 启动服务
app.listen(PORT, () => {
    console.log(`🚀 服务已启动，访问 http://localhost:${PORT}`);
    // 检查环境变量
    console.log('🔑 AK:', process.env.BAIDU_ACCESS_KEY_ID ? '已配置' : '未配置');
});
