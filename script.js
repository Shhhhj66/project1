// 获取页面元素
const inputBox = document.getElementById('input-box');
const sendBtn = document.getElementById('send-btn');
const chatContainer = document.getElementById('chat-container');

// 消息历史
let messageHistory = [];

// 添加消息到UI
function addMessageToUI(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    // 简单美化样式
    if (role === 'user') {
        messageDiv.style.cssText = 'text-align:right; background:#e0f7fa; padding:10px; border-radius:10px; margin:5px; display:inline-block; float:right; clear:both;';
    } else {
        messageDiv.style.cssText = 'text-align:left; background:#f5f5f5; padding:10px; border-radius:10px; margin:5px; display:inline-block; float:left; clear:both;';
    }
    
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    // 清除浮动
    const clearBr = document.createElement('br');
    clearBr.style.clear = 'both';
    chatContainer.appendChild(clearBr);
    
    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 发送消息函数
async function sendMessage() {
    const content = inputBox.value.trim();
    if (!content) return;

    // 1. 显示用户消息
    addMessageToUI('user', content);
    inputBox.value = '';
    sendBtn.disabled = true;

    // 2. 更新历史记录
    messageHistory.push({ role: 'user', content: content });

    try {
        // 3. 调用后端接口
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: messageHistory })
        });

        // 4. 解析数据（核心修复）
        const data = await response.json();
        
        // 5. 安全获取结果
        const aiReply = data.result || '未收到回复';
        
        // 6. 显示AI回复
        addMessageToUI('assistant', aiReply);
        
        // 7. 更新历史记录
        messageHistory.push({ role: 'assistant', content: aiReply });

    } catch (error) {
        console.error('Fetch error:', error);
        addMessageToUI('system', '😱 网络请求失败，请检查服务是否启动');
    } finally {
        // 8. 恢复按钮状态
        sendBtn.disabled = false;
    }
}

// 事件监听
sendBtn.addEventListener('click', sendMessage);
inputBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});
