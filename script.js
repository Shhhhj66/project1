// 消息容器
const chatContainer = document.getElementById('chat-container');
// 输入框
const inputBox = document.getElementById('input-box');
// 发送按钮
const sendBtn = document.getElementById('send-btn');

// 消息历史（传给后端，保持对话上下文）
let messageHistory = [];

// 发送消息
async function sendMessage() {
  const content = inputBox.value.trim();
  if (!content) return;

  // 1. 添加用户消息到页面
  addMessageToUI('user', content);
  inputBox.value = '';
  // 禁用发送按钮，防止重复提交
  sendBtn.disabled = true;

  // 2. 更新消息历史
  messageHistory.push({ role: 'user', content: content });

  // 3. 调用后端API
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messageHistory })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || '请求失败');

    // 4. 添加AI回复到页面
    addMessageToUI('assistant', data.result);
    // 更新消息历史
    messageHistory.push({ role: 'assistant', content: data.result });
  } catch (error) {
    // 5. 错误处理
    addMessageToUI('system', `错误：${error.message}`);
    console.error('请求失败:', error);
  } finally {
    // 恢复发送按钮
    sendBtn.disabled = false;
    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// 添加消息到UI
function addMessageToUI(role, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  messageDiv.textContent = content;
  chatContainer.appendChild(messageDiv);
}

// 事件监听
sendBtn.addEventListener('click', sendMessage);
inputBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});
