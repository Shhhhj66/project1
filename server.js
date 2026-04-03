const express = require("express");
const https = require("https");
const crypto = require("crypto");
const cors = require("cors");
require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());

// ===================== 【唯一要改的地方】填你完整的AK =====================
// 完整AK格式：bce-v3/ALTAK-你的ID/你的SK
// 示例：bce-v3/ALTAK-umtg7D6UH2C66OYvaii8x/5ffa6b0987e01b1045b5dc744fe13b5b97622755
const AK = process.env.BAIDU_AK?.trim(); // 自动去除首尾空格
// ==========================================================================

// 启动前校验AK
if (!AK) {
  console.error("❌ 错误：.env中未配置BAIDU_AK，或配置为空！");
  process.exit(1);
}

// 新版IAM v3 签名工具（修复AK拆分逻辑，100%适配你的AK）
function signRequest(ak, method, uri, body = "") {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const host = "qianfan.baidubce.com";
  
  // 🔧 修复：兼容3段/4段AK，自动提取ID和SK
  const akParts = ak.split("/").filter(part => part.trim() !== ""); // 过滤空字符串
  if (akParts.length < 3) {
    throw new Error(`AK格式错误！当前分段：${akParts.length}，请检查AK完整性`);
  }
  const accessKeyId = akParts[2];
  const secretAccessKey = akParts.slice(3).join("/") || akParts[2]; // 兼容不同格式

  console.log("🔑 AK拆分：ID=", accessKeyId, "SK长度=", secretAccessKey.length);

  // 构造规范请求串
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

  // 生成签名密钥
  const signingKey = crypto.createHmac("sha256", secretAccessKey)
    .update("bce-auth-v1")
    .update(accessKeyId)
    .update(timestamp)
    .update("1800")
    .digest();
  
  // 生成最终签名
  const signature = crypto.createHmac("sha256", signingKey)
    .update(canonicalRequest)
    .digest("base64");

  return {
    "Host": host,
    "x-bce-date": timestamp,
    "Authorization": `bce-auth-v1/${accessKeyId}/${timestamp}/1800/host;x-bce-date/${signature}`
  };
}

// 原生https请求封装
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`响应解析失败: ${e.message}，原始数据: ${data}`));
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
    console.log("📥 收到前端请求：", req.body);
    const uri = "/v2/chat/completions";
    const requestBody = JSON.stringify({
      model: "ernie-3.5-8k",
      messages: req.body.messages,
      temperature: 0.7,
      top_p: 0.8,
      max_tokens: 1024
    });

    // 生成签名头
    const headers = signRequest(AK, "POST", uri, requestBody);
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(requestBody);

    const options = {
      hostname: "qianfan.baidubce.com",
      path: uri,
      method: "POST",
      headers
    };

    const { statusCode, data } = await httpsRequest(options, requestBody);
    console.log("📤 API响应状态码：", statusCode, "响应数据：", data);

    // 处理API错误
    if (statusCode !== 200 || data.error) {
      const errorMsg = data.error?.message || `API请求失败，状态码：${statusCode}`;
      return res.status(statusCode).json({ error: errorMsg });
    }

    res.json(data);
  } catch (err) {
    console.error("❌ 服务异常：", err);
    res.status(500).json({ error: err.message || "服务器内部错误" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 后端服务已启动：http://localhost:${PORT}`);
  console.log("🔑 AK配置状态：✅ 已加载，长度：", AK.length);
});
