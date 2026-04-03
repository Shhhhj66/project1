const express = require("express");
const https = require("https");
const crypto = require("crypto");
const cors = require("cors");
require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());

// ===================== 【必填】填你完整的AK（两行合起来） =====================
const AK = process.env.BAIDU_AK;
// 完整AK就是你截图里的两行：
// bce-v3/ALTAK-umtg7D6UH2C66OYvaii8x/5ffa6b0987e01b1045b5dc744fe13b5b97622755
// ============================================================================

// 新版IAM v3 签名工具（完美适配你这个AK，不需要SK！）
function signRequest(ak, method, uri, body = "") {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const host = "qianfan.baidubce.com";
  
  // 1. 拆分AK（新版AK格式：bce-v3/ALTAK-id/sk）
  const akParts = ak.split("/");
  const accessKeyId = akParts[2];
  const secretAccessKey = akParts[3];

  // 2. 构造规范请求串
  const canonicalRequest = [
    method,
    uri,
    "",
    `host:${host}`,
    `x-bce-date:${timestamp}`,
    "",
    "host;x-bce-date",
    crypto.createHash("sha256").update(body).digest("hex")
  ].join("\n");

  // 3. 构造签名密钥
  const signingKey = crypto.createHmac("sha256", secretAccessKey)
    .update("bce-auth-v1")
    .update(accessKeyId)
    .update(timestamp)
    .update("1800")
    .digest();
  
  // 4. 生成签名
  const signature = crypto.createHmac("sha256", signingKey)
    .update(canonicalRequest)
    .digest("base64");

  // 5. 返回认证头
  return {
    "Host": host,
    "x-bce-date": timestamp,
    "Authorization": `bce-auth-v1/${accessKeyId}/${timestamp}/1800/host;x-bce-date/${signature}`
  };
}

// 原生https请求封装（彻底解决fetch is not a function问题）
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// 聊天接口
app.post("/api/chat", async (req, res) => {
  try {
    const uri = "/v2/chat/completions";
    const requestBody = JSON.stringify({
      model: "ernie-3.5-8k", // 必须指定你开通的模型
      messages: req.body.messages,
      temperature: 0.7,
      top_p: 0.8,
      max_tokens: 1024
    });

    // 生成签名头（只需要AK，不需要SK！）
    const headers = signRequest(AK, "POST", uri, requestBody);
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(requestBody);

    // 配置请求选项
    const options = {
      hostname: "qianfan.baidubce.com",
      path: uri,
      method: "POST",
      headers
    };

    // 发起请求
    const data = await httpsRequest(options, requestBody);
    res.json(data);
  } catch (err) {
    console.error("服务异常：", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 后端服务已启动：http://localhost:${PORT}`);
  console.log("🔑 AK状态：", AK ? "✅ 已配置" : "❌ 未配置，请检查.env文件");
});
