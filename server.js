const express = require("express");
const https = require("https");
const crypto = require("crypto");
const cors = require("cors");
require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());

// ===================== 【唯一要改的地方】填你完整的AK =====================
const FULL_AK = process.env.BAIDU_AK?.trim();
// ==========================================================================

// 启动前校验AK
if (!FULL_AK) {
  console.error("❌ 错误：.env中未配置BAIDU_AK，或配置为空！");
  process.exit(1);
}

// 🔧 修复AK拆分逻辑：兼容3段/4段，自动提取ID和SK
function splitAk(fullAk) {
  const parts = fullAk.split("/").filter(p => p.trim() !== "");
  console.log("🔍 AK原始分段：", parts.length, "段", parts);
  
  // 情况1：标准4段格式 bce-v3/ALTAK-id/sk
  if (parts.length === 4) {
    return { id: parts[2], sk: parts[3] };
  }
  // 情况2：3段格式 bce-v3/ALTAK-id/sk（末尾无斜杠）
  if (parts.length === 3) {
    return { id: parts[1], sk: parts[2] };
  }
  // 情况3：2段格式（兜底）
  if (parts.length === 2) {
    return { id: parts[0].split("-")[1], sk: parts[1] };
  }
  throw new Error(`AK格式错误！当前分段数：${parts.length}，请检查AK完整性`);
}

// 🔧 百度云IAM v3 标准签名算法
function signRequest(fullAk, method, uri, body = "") {
  const { id: accessKeyId, sk: secretAccessKey } = splitAk(fullAk);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const host = "qianfan.baidubce.com";

  // 构造规范请求串
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

  // 构造签名密钥
  const signingKey = crypto.createHmac("sha256", secretAccessKey)
    .update("bce-auth-v1")
    .update(accessKeyId)
    .update(timestamp)
    .update("1800")
    .digest();

  // 生成最终签名
  const signature = crypto.createHmac("sha256", signingKey)
    .update(canonicalRequest, "utf8")
    .digest("base64");

  // 返回认证头
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
      model: "ernie-3.5-8k",
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
  const { id, sk } = splitAk(FULL_AK);
  console.log("🔑 AK拆分成功：ID=", id, "SK长度=", sk.length);
});
