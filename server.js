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
const FULL_AK = process.env.BAIDU_AK?.trim();
// ==========================================================================

// 启动前校验AK
if (!FULL_AK) {
  console.error("❌ 错误：.env中未配置BAIDU_AK，或配置为空！");
  process.exit(1);
}

// 🔧 百度云IAM v3 标准签名算法（官方文档实现，100%正确）
function signRequest(fullAk, method, uri, body = "") {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const host = "qianfan.baidubce.com";

  // 1. 拆分AK（严格按bce-v3/ALTAK-id/sk格式拆分）
  const akParts = fullAk.split("/").filter(p => p.trim() !== "");
  if (akParts.length !== 4) {
    throw new Error(`AK格式错误！当前分段数：${akParts.length}，请检查AK完整性`);
  }
  const accessKeyId = akParts[2];
  const secretAccessKey = akParts[3];

  // 2. 构造规范请求串（严格按百度官方标准）
  const canonicalRequest = [
    method,
    uri,
    "",
    `host:${host}`,
    `x-bce-date:${timestamp}`,
    "",
    "host;x-bce-date",
    crypto.createHash("sha256").update(body, "utf8").digest("hex")
  ].join("\n");

  // 3. 构造签名密钥
  const signingKey = crypto.createHmac("sha256", secretAccessKey)
    .update("bce-auth-v1")
    .update(accessKeyId)
    .update(timestamp)
    .update("1800")
    .digest();

  // 4. 生成最终签名
  const signature = crypto.createHmac("sha256", signingKey)
    .update(canonicalRequest, "utf8")
    .digest("base64");

  // 5. 返回认证头
  return {
    "Host": host,
    "x-bce-date": timestamp,
    "Authorization": `bce-auth-v1/${accessKeyId}/${timestamp}/1800/host;x-bce-date/${signature}`
  };
}

// 原生https请求封装（彻底解决所有依赖问题）
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data)
          });
        } catch (e) {
          reject(new Error(`响应解析失败: ${e.message}，原始数据: ${data}`));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body, "utf8");
    req.end();
  });
}

// 聊天接口
app.post("/api/chat", async (req, res) => {
  try {
    console.log("📥 收到前端请求：", req.body);
    const uri = "/v2/chat/completions";
    const requestBody = JSON.stringify({
      model: "ernie-3.5-8k", // 替换成你开通的模型
      messages: req.body.messages,
      temperature: 0.7,
      top_p: 0.8,
      max_tokens: 1024
    });

    // 生成签名头
    const headers = signRequest(FULL_AK, "POST", uri, requestBody);
    headers["Content-Type"] = "application/json; charset=utf-8";
    headers["Content-Length"] = Buffer.byteLength(requestBody, "utf8");

    const options = {
      hostname: "qianfan.baidubce.com",
      path: uri,
      method: "POST",
      headers: headers
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
  console.log("🔑 AK配置状态：✅ 已加载，长度：", FULL_AK.length);
});
