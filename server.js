const express = require("express");
const https = require("https");
const crypto = require("crypto");
const cors = require("cors");
require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());

// ===================== 【填你完整的AK】 =====================
const FULL_AK = process.env.BAIDU_AK?.trim();
// ============================================================

if (!FULL_AK) {
  console.error("❌ 错误：.env中未配置BAIDU_AK！");
  process.exit(1);
}

// 拆分你的 AK（3段格式）
function splitAk(fullAk) {
  const parts = fullAk.split("/").filter(p => p.trim() !== "");
  if (parts.length === 3) {
    return {
      accessKey: parts[1],
      secretKey: parts[2]
    };
  }
  throw new Error("AK格式不正确！");
}

// 原生请求
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(new Error("解析失败：" + data));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body, "utf8");
    req.end();
  });
}

// ===================== 聊天接口 =====================
app.post("/api/chat", async (req, res) => {
  try {
    const { accessKey, secretKey } = splitAk(FULL_AK);
    const uri = "/v2/chat/completions";
    const host = "qianfan.baidubce.com";
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // ✅ 关键：这里换成 ernie-5.0
    const requestBody = JSON.stringify({
      model: "ernie-5.0",  // <--- 就是这里！
      messages: req.body.messages,
      temperature: 0.7
    });

    // 百度官方签名
    const canonicalRequest = [
      "POST", uri, "",
      `host:${host}`,
      `x-bce-date:${timestamp}`,
      "",
      "host;x-bce-date",
      crypto.createHash("sha256").update(requestBody, "utf8").digest("hex")
    ].join("\n");

    const signingKey = crypto.createHmac("sha256", secretKey)
      .update("bce-auth-v1")
      .update(accessKey)
      .update(timestamp)
      .update("1800")
      .digest();

    const signature = crypto.createHmac("sha256", signingKey)
      .update(canonicalRequest, "utf8")
      .digest("base64");

    const headers = {
      "Host": host,
      "x-bce-date": timestamp,
      "Authorization": `bce-auth-v1/${accessKey}/${timestamp}/1800/host;x-bce-date/${signature}`,
      "Content-Type": "application/json; charset=utf-8"
    };

    const options = { hostname: host, path: uri, method: "POST", headers };
    const { statusCode, data } = await httpsRequest(options, requestBody);

    console.log("✅ 成功返回：", data);
    res.json(data);

  } catch (err) {
    console.error("❌ 错误：", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务已启动：http://localhost:${PORT}`);
  const { accessKey } = splitAk(FULL_AK);
  console.log("🔑 AK 加载成功：", accessKey);
});
