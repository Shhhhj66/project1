const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();

// 引入百度官方SDK
const bce = require("baidubce-sdk");

// ===================== 【填你完整的AK】 =====================
const AK = process.env.BAIDU_AK;
// ==========================================================

// 配置SDK（自动解析AK中的ID和SK，完美适配你的Key）
const config = {
  credentials: {
    accessKeyId: AK.split("/")[2], // 提取AccessKeyID
    secretAccessKey: AK.split("/")[3] // 提取SecretAccessKey
  },
  endpoint: "https://qianfan.baidub.com"
};

// 初始化千帆客户端
const client = new bce.qianfan.V2Client(config);

app.use(cors());
app.use(express.json());

// 聊天接口（直接调用SDK，不用手动写签名，不用Token）
app.post("/api/chat", async (req, res) => {
  try {
    const request = {
      model: "ernie-3.5-8k", // 替换成你开通的模型
      messages: req.body.messages,
      temperature: 0.7
    };

    // 官方SDK调用（这一行就够了，所有验证都由SDK完成）
    const response = await client.chatCompletions(request);
    
    // 提取回复结果
    const result = response.data;
    res.json(result);
    
  } catch (err) {
    console.error("❌ API调用异常：", err.response ? err.response.data : err.message);
    // 把具体错误返回给前端
    res.status(400).json({
      error: err.response ? err.response.data.error : "网络异常"
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 后端服务已启动：http://localhost:${PORT}`);
});
