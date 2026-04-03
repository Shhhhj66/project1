const API_URL = "http://localhost:3000/api/chat";

const chatBox = document.getElementById("chatBox");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  // 显示加载中
  const loadingMsg = addMessage("AI思考中...", "bot");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: text }]
      })
    });

    const data = await res.json();
    
    // 移除加载提示
    loadingMsg.remove();

    // 处理API返回
    if (data.error) {
      addMessage(`错误：${data.error}`, "bot");
      return;
    }

    // 新版千帆接口正确解析方式
    const reply = data.choices?.[0]?.message?.content || "未获取到有效回复";
    addMessage(reply, "bot");
  } catch (err) {
    loadingMsg.remove();
    console.error("请求失败：", err);
    addMessage("请求失败，请检查后端服务是否启动、Key是否正确", "bot");
  }
}

function addMessage(text, role) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return div;
}
