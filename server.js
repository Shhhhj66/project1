const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();

// 正确引入千帆大模型SDK
const qianfan = require("@baiducloud/qianfan");

// ===================== 【唯一要改的地方】填你完整的AK =====================
const FULL_AK = process.env.BAIDU_AK?.trim();
// 完整AK格式：bce-v3/ALTAK-你的ID/你的SK
// ==========================================================================

// 拆分AK（自动提取AccessKey和SecretKey）
const akParts = FULL_AK.split("/").filter(p => p.trim());
const ACCESS_KEY = akParts[1];
const SECRET_KEY = akParts[2];

// 配置千帆认证（官方正确写法）
qianfan.auth({
  QIANFAN_ACCESS_KEY: ACCESS_KEY,
  QIANFAN_SECRET_KEY: SECRET_KEY
});

app.use(cors());
app.use(express.json());

// 聊天接口
app.post("/api/chat", async (req, res) => {
  try {
    console.log("📥 收到前端请求：", req.body);
    
    // 调用千帆大模型API（官方SDK标准调用）
    const response = await qianfan.ChatCompletion({
      model: "ernie-5.0", // 你开通的模型
      messages: req.body.messages,
      temperature: 0.7
    });

    console.log("📤 API响应成功：", response);
    res.json(response);
    
  } catch (err) {
    console.error("❌ API调用异常：", err);
    res.status(400).json({
      error: err.message || "服务器内部错误"
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 后端服务已启动：http://localhost:${PORT}`);
  console.log("🔑 AK配置状态：✅ 已加载");
});
