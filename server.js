const express = require("express");
const https = require("https");
const crypto = require("crypto");
const cors = require("cors");
require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());

// ===================== 【唯一要改的地方】填你那一行完整的AK =====================
// 直接把你那一行完整的AK（bce-v3/ALTAK-xxx/yyy）填在这里，或者写在.env里
const FULL_AK = process.env.BAIDU_AK?.trim();
// ==================================================================================

// 启动前校验AK
if (!FULL_AK) {
  console.error("❌ 错误：.env中未配置BAIDU_AK，或配置为空！");
  process.exit(1);
}

// 🔧 适配一行AK的拆分逻辑（完美兼容3段/一行格式）
function splitAk(fullAk) {
  // 直接按 / 拆分，自动过滤空字符串，完美适配一行AK
  const parts = fullAk.split("/").filter(p => p.trim() !== "");
  console.log("🔍 AK原始分段：", parts.length, "段", parts);
  
  // 你的一行AK是3段：bce-v3 / ALTAK-xxx / yyy
  if (parts.length === 3) {
    return {
      accessKeyId: parts[1],
      secretAccessKey: parts[2]
    };
  }
  throw new Error(`AK格式错误！当前分段数：${parts.length}，请检查AK完整性`);
}

// 🔧 百度云IAM v3 官方标准签名算法（严格对齐文档）
function signRequest(fullAk, method, uri, body = "") {
  const { accessKeyId, secretAccessKey } = splitAk(fullAk);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const host = "qianfan.baidubce.com";

  // 1. 构造规范请求串（严格按百度官方要求，空行、顺序不能错）
  const canonicalUri = uri;
  const canonicalQueryString = "";
  const canonicalHeaders = `host:${host}\nx-bce-date:${timestamp}`;
  const signedHeaders = "host;x-bce-date";
  
  // 计算请求体哈希
  const payloadHash = crypto.createHash("sha256").update(body, "utf8").digest("hex");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  // 2. 构造待签名字符串
  const signingKey = crypto.createHmac("sha256", secretAccessKey)
    .update("bce-auth-v1")
    .update(accessKeyId)
    .update(timestamp)
    .update("1800")
    .digest();
  
  const stringToSign = [
    "bce-auth-v1",
    accessKeyId,
    timestamp,
    "1800",
    signedHeaders,
    crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex")
  ].join("\n");

  // 3. 生成最终签名
  const signature = crypto.createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("base64");

  // 4. 构造认证头
  return {
    "Host": host,
    "x-bce-date": timestamp,
    "Authorization": `bce-auth-v1/${accessKeyId}/${timestamp}/1800/${signedHeaders}/${signature}`
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
          resolve({
            statusCode: res.statusCode,
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
      model: "ernie-5.0", // 你开通的模型
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
  const { accessKeyId, secretAccessKey } = splitAk(FULL_AK);
  console.log("🔑 AK拆分成功：ID=", accessKeyId, "SK长度=", secretAccessKey.length);
});
