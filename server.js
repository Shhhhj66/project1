const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// ===================== 填写你的信息 =====================
const API_KEY = "bce-v3/ALTAK-bYronxW8o9jHgAUkuYW8r/55c3634d99ce9881a72c4395f194a43a1447364b";
const SECRET_KEY = "f25a99b8e6b64b66ac49e30f6f0f5576";
const AI_API_URL = "https://qianfan.baidubce.com/v2/chat/completions";
// ========================================================

async function getAccessToken() {
  const resp = await fetch(
    `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`
  );
  const data = await resp.json();
  return data.access_token;
}

app.post("/api/chat", async (req, res) => {
  try {
    const token = await getAccessToken();
    const resp = await fetch(AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "服务异常" });
  }
});

app.listen(3000, () => {
  console.log("后端服务已启动：http://localhost:3000");
});