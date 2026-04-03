const express = require("express");
// 修复：使用兼容 CommonJS 的 node-fetch v2，或用原生 fetch 兼容写法
const fetch = require("node-fetch");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// ===================== 【必填】填写你的信息 =====================
const API_KEY = "bce-v3/ALTAK-bYronxW8o9jHgAUkuYW8r/55c3634d99ce9881a72c4395f194a43a1447364b";
const SECRET_KEY = "f25a99b8e6b64b66ac49e30f6f0f5576";
const AI_API_URL = "https://qianfan.baidubce.com/v2/chat/completions";
// ================================================================

// 缓存Token，避免重复获取
let accessToken = "";
let tokenExpireTime = 0;

// 自动获取并缓存Access Token
async function getAccessToken() {
  if (Date.now() < tokenExpireTime) {
    console.log("使用缓存的Token");
    return accessToken;
  }

  try {
    console.log("正在获取新的Access Token...");
    const resp = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`
    );
    const data = await resp.json();

    if (!data.access_token) {
      console.error("获取Token失败，返回数据：", data);
      throw new Error(`获取Token失败: ${data.error || "未知错误"}`);
    }

    accessToken = data.access_token;
    tokenExpireTime = Date.now() + data.expires_in * 1000 - 60000;
    console.log("Token获取成功，有效期：", data.expires_in, "秒");
    return accessToken;
  } catch (err) {
    console.error("Token获取异常：", err);
    throw err;
  }
}

// 聊天接口
app.post("/api/chat", async (req, res) => {
  try {
    console.log("收到前端请求：", req.body);
    const token = await getAccessToken();

    const apiResp = await fetch(AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        model: "ernie-3.5-8k",
        messages: req.body.messages,
        temperature: 0.7,
        top_p: 0.8,
        max_tokens: 1024
      })
    });

    const data = await apiResp.json();
    console.log("千帆API返回：", data);

    if (data.error) {
      console.error("API调用错误：", data.error);
      return res.status(400).json({ error: data.error.message });
    }

    res.json(data);
  } catch (err) {
    console.error("服务异常：", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ 后端服务已启动：http://localhost:${PORT}`);
  console.log("请确保API Key和Secret Key填写正确！");
});
