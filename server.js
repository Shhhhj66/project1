const express = require("express");
const https = require("https");
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

// 🔧 拆分AK（适配你的3段格式，提取AK和SK）
function splitAk(fullAk) {
  const parts = fullAk.split("/").filter(p => p.trim() !== "");
  console.log("🔍 AK原始分段：", parts.length, "段", parts);
  // 你的AK是3段：bce-v3 / ALTAK-xxx / yyy
  if (parts.length === 3) {
    return {
      accessKey: parts[1],
      secretKey: parts[2]
    };
  }
  throw new Error(`AK格式错误！当前分段数：${parts.length}，请检查AK完整性`);
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

// 聊天接口（用千帆最简单的API，完全不用自己签名！）
app.post("/api/chat", async (req, res) => {
  try {
    console.log("📥 收到前端请求：", req.body);
    const { accessKey, secretKey } = splitAk(FULL_AK);

    // 千帆官方最简单的API：直接在URL里传AK/SK，完全不用签名！
    const uri = `/rpc/2.0/ernie/3.5/chat?access_token=${accessKey}&secret_key=${secretKey}`;
    const requestBody = JSON.stringify({
      messages: req.body.messages,
      temperature: 0.7,
      top_p: 0.8,
      max_output_tokens: 1024
    });

    const options = {
      hostname: "aip.baidubce.com",
      path: uri,
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(requestBody, "utf8")
      }
    };

    const { statusCode, data } = await httpsRequest(options, requestBody);
    console.log("📤 API响应状态码：", statusCode, "响应数据：", data);

    // 处理API错误
    if (statusCode !== 200 || data.error) {
      const errorMsg = data.error?.message || `API请求失败，状态码：${statusCode}`;
      return res.status(statusCode).json({ error: errorMsg });
    }

    // 适配千帆响应格式，提取AI回复
    const reply = data.result || "未获取到有效回复";
    res.json({ choices: [{ message: { content: reply } }] });
    
  } catch (err) {
    console.error("❌ 服务异常：", err);
    res.status(500).json({ error: err.message || "服务器内部错误" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 后端服务已启动：http://localhost:${PORT}`);
  console.log("🔑 AK配置状态：✅ 已加载，长度：", FULL_AK.length);
  const { accessKey, secretKey } = splitAk(FULL_AK);
  console.log("🔑 AK拆分成功：AK=", accessKey, "SK长度=", secretKey.length);
});
