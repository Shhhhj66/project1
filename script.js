async function sendMessage() {
    let input = document.getElementById("userInput");
    let msg = input.value.trim();
    if (!msg) return;

    let chatBox = document.getElementById("chatBox");
    chatBox.innerHTML += `<div class="msg user">${msg}</div>`;
    input.value = "";

    // 模拟 AI 回复（后期可替换成真实AI接口）
    let reply = await getAIReply(msg);

    chatBox.innerHTML += `<div class="msg bot">${reply}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
}

// AI 回复函数（可优化、调参、对接大模型）
async function getAIReply(msg) {
    // 你可以在这里：
    // 1. 对接讯飞 / 通义千问 / Gemini 等AI接口
    // 2. 调整温度、最大长度等参数
    return "你说：“" + msg + "”\n我是 AI 助手，正在为你思考答案...";
}