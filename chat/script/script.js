/**
 * NOOB ENGINE V5.5 - CORE SCRIPT
 * Developed by AbcsNoob.ai
 * Features: Auto-save, Multi-session, Voice-to-Text, Vision, Data Export.
 */

const NoobEngine = {
    // --- 1. CONFIGURATION & CONSTANTS ---
    config: {
        api: 'https://abcsnoobai.abcsnoob.workers.dev',
        typingSpeed: 12,
        maxHistory: 30,
        dbName: 'noob_engine_v55',
        theme: 'material_dark',
        maxTokens: 7000,
        resetTime: 3600000 // 1 giờ
    },

    // --- 2. INTERNAL STATE ---
    state: {
        currentId: null,
        sessions: {},
        isTyping: false,
        pendingImage: null,
        recognition: null,
        isSkipping: false,
        abortController: null,
        isMicActive: false,
        tokensUsed: 0,
        lastReset: Date.now(),
        typeQueue: "",
        isProcessingQueue: false,
    },
/**
 * Tự động rút chữ từ hàng đợi và hiển thị lên UI
 */
async processTypeQueue(element, sessionHistoryObj) {
    if (this.state.isProcessingQueue) return;
    this.state.isProcessingQueue = true;

    while (this.state.typeQueue.length > 0) {
        // Lấy ký tự đầu tiên
        const char = this.state.typeQueue.charAt(0);
        this.state.typeQueue = this.state.typeQueue.substring(1);

        // Cập nhật text vào object lịch sử và render
        sessionHistoryObj.text += char;
        element.innerHTML = DOMPurify.sanitize(marked.parse(sessionHistoryObj.text));
        
        // Cuộn xuống
        this.ui.chat.scrollTop = this.ui.chat.scrollHeight;

        // Chờ theo tốc độ cấu hình
        await new Promise(r => setTimeout(r, this.config.typingSpeed));
    }

    this.state.isProcessingQueue = false;
},

    // --- 3. INITIALIZATION ---
    async init() {
        console.info("Initializing Noob Engine V5.5...");
        await this.loadSecureQuota();
        this.setupMarkdown();
        this.initVoice();
        
        // Bind UI Elements
        this.ui = {
            list: document.getElementById('session-list'),
            chat: document.getElementById('chat-scroller'),
            input: document.getElementById('userInput'),
            preview: document.getElementById('imagePreview'),
            sendBtn: document.getElementById('sendBtn')
        };

        this.bindGlobalEvents();

        // Load Persistence Data
        try {
            const data = await localforage.getItem(this.config.dbName);
            if (data && Object.keys(data).length > 0) {
                this.state.sessions = data;
                const lastSession = await localforage.getItem('last_session_active');
                this.switchSession(lastSession || Object.keys(data)[0]);
            } else {
                this.createNewSession();
            }
        } catch (err) {
            console.error("Storage Error:", err);
            this.createNewSession();
        }

        this.renderSidebar();
        this.updateQuotaUI();
    },

    bindGlobalEvents() {
        // Auto-resize textarea
        this.ui.input.addEventListener('input', () => {
            this.ui.input.style.height = 'auto';
            this.ui.input.style.height = (this.ui.input.scrollHeight) + 'px';
        });

        // Enter to send
        this.ui.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });
    },
// --- Cập nhật trong phần CORE logic ---

async saveSecureQuota() {
    const data = {
        used: this.state.tokensUsed,
        lastReset: this.state.lastReset // Sử dụng biến state.lastReset thống nhất
    };
    await localforage.setItem('_sys_secure_quota', data);
    console.log("Quota đã được lưu:", data);
},

async loadSecureQuota() {
    const data = await localforage.getItem('_sys_secure_quota');
    if (data) {
        this.state.tokensUsed = data.used || 0;
        this.state.lastReset = data.lastReset || Date.now();
    }
    // Sau khi load, kiểm tra xem đã quá 1 tiếng chưa để reset ngay
    this.checkAutoReset();
},

checkAutoReset() {
    const now = Date.now();
    // Nếu thời gian hiện tại - thời gian reset cuối > 1 giờ (3600000ms)
    if (now - this.state.lastReset > this.config.resetTime) {
        this.state.tokensUsed = 0;
        this.state.lastReset = now;
        this.saveSecureQuota();
        return true; // Đã reset
    }
    return false; // Chưa đến lúc reset
},
    // --- 4. CORE CHAT LOGIC ---
async handleSend() {
    const text = this.ui.input.value.trim();
    const image = this.state.pendingImage;
    
    // Chặn gửi nếu không có nội dung hoặc đang trong quá trình phản hồi
    if ((!text && !image) || this.state.isTyping) return;

    // --- 1. KIỂM TRA & TỰ ĐỘNG RESET QUOTA (HẠN MỨC 1 GIỜ) ---
    const isReset = this.checkAutoReset(); 
    const now = Date.now();

    const inputTokens = this.countTokens(text);
    
    // Kiểm tra xem lượt gửi này có vượt quá 7000 token không
    if (this.state.tokensUsed + inputTokens > 7000) {
        const timeLeft = this.config.resetTime - (now - this.state.lastReset);
        const waitMin = Math.ceil(timeLeft / 60000);
        return this.notifyError(`Hết hạn mức! Vui lòng đợi ${waitMin} phút để reset.`);
    }

    // --- 2. CHUẨN BỊ DỮ LIỆU TIN NHẮN ---
    const session = this.state.sessions[this.state.currentId];
    const userMsg = { 
        role: 'user', 
        timestamp: now, 
        parts: [{ text: text }] 
    };
    
    if (image) {
        userMsg.parts.push({ 
            inline_data: { mime_type: "image/jpeg", data: image.split(',')[1] } 
        });
    }

    // Lưu vào lịch sử tạm thời và hiển thị lên UI
    session.history.push(userMsg);
    this.renderMessage(userMsg);
    this.clearInput();

    // Thiết lập trạng thái loading
    this.state.isTyping = true;
    this.state.isSkipping = false;
    this.state.abortController = new AbortController();
    this.setLoading(true);

    // Bắt đầu đếm thời gian phản hồi
    const startTime = Date.now();
    let timerInterval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const timerTarget = document.getElementById('timer-counter');
        if (timerTarget) timerTarget.innerText = `${elapsed}s`;
    }, 100);

    try {
        // --- 3. GỌI API ---
        const response = await fetch(this.config.api, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: this.state.abortController.signal,
            body: JSON.stringify({ 
                messages: this.prepareHistory(session.history),
                model: document.getElementById('modelSelect')?.value || "gemini-1.5-flash"
            })
        });

        if (!response.ok) throw new Error("Lỗi kết nối API");
        const data = await response.json(); 

        this.setLoading(false);

        // --- 4. TÍNH TOÁN & LƯU TRỮ QUOTA CHÍNH XÁC ---
        const outputTokens = this.countTokens(data.text);
        this.state.tokensUsed += (inputTokens + outputTokens);
        
        // Lưu cả Quota và Session vào Storage ngay lập tức
        await this.saveSecureQuota(); 
        this.save(); 
        
        this.updateQuotaUI(); // Cập nhật thanh tiến trình trên UI

        // --- 5. HIỂN THỊ PHẢN HỒI ---
        const botRow = this.createBotRow();
        const textContainer = botRow.querySelector('.text-content');
        
        // Nút Skip (để hiển thị toàn bộ chữ ngay lập tức)
        const skipBtn = document.createElement('button');
        skipBtn.className = 'skip-btn-ui'; 
        skipBtn.innerHTML = 'Skip';
        skipBtn.onclick = () => { this.state.isSkipping = true; skipBtn.remove(); };
        botRow.querySelector('.bubble').appendChild(skipBtn);

        // Hiệu ứng đánh máy
        await this.typeEffect(textContainer, data.text, data.thought);

        clearInterval(timerInterval);
        skipBtn.remove();
        
        // Lưu tin nhắn của model vào lịch sử phiên
        this.finalizeSession(data.text, data.thought, session);

    } catch (err) {
        clearInterval(timerInterval);
        if (err.name !== 'AbortError') {
            this.notifyError(err.message);
        }
    } finally {
        this.state.isTyping = false;
        this.setLoading(false);
    }
},
/**
 * Chạy đồng hồ đếm ngược dựa trên mốc lastReset trong localforage
 */
async startQuotaCountdown() {
    const countdownElement = document.getElementById('sidebar-reset-timer');
    if (!countdownElement) return;

    setInterval(async () => {
        // 1. Lấy dữ liệu mới nhất từ storage
        const quotaData = await localforage.getItem('_sys_secure_quota');
        if (!quotaData || !quotaData.lastReset) {
            countdownElement.innerText = "Sẵn sàng";
            return;
        }

        const now = Date.now();
        const elapsed = now - quotaData.lastReset;
        const remaining = this.config.resetTime - elapsed;

        if (remaining <= 0) {
            // Đã đến lúc reset
            this.state.tokensUsed = 0;
            this.state.lastReset = now;
            await this.saveSecureQuota();
            this.updateQuotaUI();
            countdownElement.innerText = "Đã reset";
        } else {
            // Tính toán phút và giây
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            countdownElement.innerText = `Reset sau: ${minutes}p ${seconds}s`;
        }
    }, 1000);
},
// Hàm hỗ trợ đóng gói và lưu dữ liệu
/**
 * Kết thúc phiên làm việc, lưu lịch sử và dọn dẹp trạng thái
 */
finalizeSession(content, thinking, session) {
    // Chỉ lưu nếu có nội dung thực tế
    if (content.trim() || thinking.trim()) {
        const modelMsg = {
            role: 'model',
            timestamp: Date.now(),
            parts: [{ 
                text: content, 
                thought: thinking 
            }]
        };

        // Đẩy vào lịch sử phiên hiện tại
        session.history.push(modelMsg);
        
        // LƯU TỨC THÌ VÀO MÁY TÍNH QUA LOCALFORAGE
        this.save(); 
        
        console.log("Hệ thống: Đã lưu bài viết dài vào bộ nhớ trình duyệt.");
    }

    // Cập nhật trạng thái UI
    this.state.isTyping = false;
    this.state.abortController = null;
    this.setLoading(false);
},

stopGeneration() {
    if (this.state.abortController) {
        this.state.abortController.abort(); // Ngắt kết nối fetch
        this.state.isTyping = false;
        this.setLoading(false);
    }
},


    // --- 5. SESSION MANAGEMENT ---
    createNewSession() {
        const id = 'sess_' + Date.now();
        this.state.sessions[id] = {
            id: id,
            title: "Cuộc trò chuyện mới",
            history: [],
            created: Date.now()
        };
        this.switchSession(id);
        this.renderSidebar();
        this.updateQuotaUI();
        this.save();
    },

    switchSession(id) {
        if (!this.state.sessions[id]) return;
        this.state.currentId = id;
        localforage.setItem('last_session_active', id);
        
        this.ui.chat.innerHTML = '';
        if (this.state.sessions[id].history.length === 0) {
            this.ui.chat.innerHTML = `<div id="welcome-screen" class="text-center py-5">
                <h1 class="display-4 fw-bold mt-5" style="background: var(--gemini-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Sẵn sàng trả lời bạn.</h1>
            </div>`;
        } else {
            this.state.sessions[id].history.forEach(msg => this.renderMessage(msg));
        }
        
        this.renderSidebar();
        this.ui.chat.scrollTop = this.ui.chat.scrollHeight;
    },

    async deleteSession(id) {
        const confirm = await Swal.fire({
            title: 'Xóa hội thoại?',
            text: "Dữ liệu này sẽ mất vĩnh viễn.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            background: '#1e1f20', color: '#fff'
        });

        if (confirm.isConfirmed) {
            delete this.state.sessions[id];
            const keys = Object.keys(this.state.sessions);
            if (keys.length === 0) this.createNewSession();
            else this.switchSession(keys[0]);
            this.save();
            this.renderSidebar();
        }
    },
// --- 8. UI RENDERING ENGINE (BỔ SUNG) ---
    
    // Hàm tạo hàng tin nhắn của Bot (có hiệu ứng loading)
createBotRow() {
        const div = document.createElement('div');
        div.className = 'msg-row bot-row';
        div.innerHTML = `
            <div class="bot-name-label mb-2" style="font-size:12px; color:#8e918f; font-weight:600;">AI Engine</div>
            <div class="bubble">
                <div class="text-content"></div> 
            </div>
            <div class="stats-area" style="font-size:10px; color:#555; margin-top:8px"></div>
        `;
        this.ui.chat.appendChild(div);
        return div;
    },

    renderMessage(msg) {
        const container = this.ui.chat;
        const div = document.createElement('div');
        div.className = `msg-row ${msg.role === 'user' ? 'user-row' : 'bot-row'}`;
        
        let textContent = "";
        let thoughtContent = "";
        let imageHTML = "";

        msg.parts.forEach(part => {
            if (part.text) textContent += part.text;
            if (part.thought) thoughtContent += part.thought;
            if (part.inline_data) {
                imageHTML += `<div class="mt-2"><img src="data:${part.inline_data.mime_type};base64,${part.inline_data.data}" style="max-width:250px; border-radius:12px;"></div>`;
            }
        });

        const thinkingHTML = thoughtContent ? 
            `<details class="thinking-block"><summary>Đã suy luận</summary><div class="thinking-content">${thoughtContent}</div></details>` : '';

        const sanitizedBody = DOMPurify.sanitize(marked.parse(textContent));
        const botNameHTML = msg.role === 'model' ? `<div class="bot-name-label mb-2" style="font-size:11px; color:#8e918f;">AI Assistant</div>` : '';
        
        div.innerHTML = `
            ${botNameHTML}
            <div class="bubble">
                ${imageHTML}
                ${thinkingHTML}
                <div class="text-content">${sanitizedBody}</div>
            </div>
        `;
        
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    // Hàm hiển thị thông số (Token, thời gian phản hồi...)
    renderStats(rowElement, data) {
        const statsArea = rowElement.querySelector('.stats-area');
        if (data && statsArea) {
            statsArea.innerHTML = `
                <span>Model: ${data.Model || 'Gemini 1.5 Pro'}</span> | 
                <span>Speed: ${data.ProcessingTime || 'N/A'}ms</span>
            `;
        }
    },

    // Hàm chuẩn bị dữ liệu gửi đi (Fix lỗi parts)
prepareHistory(history) {
        return history.map(m => ({
            role: m.role === 'assistant' ? 'model' : m.role,
            parts: m.parts.map(p => {
                if (p.inline_data) return { inline_data: p.inline_data };
                return { text: p.text || "" };
            })
        })).slice(-this.config.maxHistory);
    },

    // --- 6. EXPORT ALL (NEW FEATURE) ---
    async exportAll() {
        this.notifyInfo("Đang chuẩn bị dữ liệu...");
        
        const fullData = {
            export_date: new Date().toISOString(),
            engine_version: "5.5",
            total_sessions: Object.keys(this.state.sessions).length,
            sessions: this.state.sessions
        };

        const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NoobEngine_Full_Export_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        Swal.fire('Thành công', 'Toàn bộ dữ liệu đã được tải về máy bạn.', 'success');
    },

    // --- 7. MULTIMEDIA & UTILS ---
    handleFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            this.state.pendingImage = ev.target.result;
            this.ui.preview.innerHTML = `<div class="position-relative">
                <img src="${ev.target.result}" class="preview-img">
                <button class="btn btn-sm btn-dark rounded-circle position-absolute top-0 end-0" style="padding:0 5px" onclick="NoobEngine.clearImage()">×</button>
            </div>`;
            this.ui.preview.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    },

    clearImage() {
        this.state.pendingImage = null;
        this.ui.preview.style.display = 'none';
        document.getElementById('fileInput').value = '';
    },

    initVoice() {
        const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (Speech) {
            this.state.recognition = new Speech();
            this.state.recognition.lang = 'vi-VN';
            this.state.recognition.onresult = (e) => {
                this.ui.input.value += e.results[0][0].transcript;
                this.ui.input.dispatchEvent(new Event('input'));
            };
            this.state.recognition.onend = () => {
                this.state.isMicActive = false;
                document.getElementById('micBtn').classList.remove('text-danger');
            };
        }
    },
// 1. Hàm đếm token dựa trên khoảng trắng
countTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.trim().split(/\s+/).length * 1.3);
},

// 2. Hàm cập nhật vòng tròn ở nút Gửi
updateQuotaUI() {
    // Ép kiểu số để tránh lỗi logic
    const used = Number(this.state.tokensUsed) || 0;
    const percent = Math.min(100, (used / 7000) * 100);
    const color = percent > 90 ? '#ea4335' : (percent > 70 ? '#f4b400' : '#8ab4f8');

    // Cập nhật text trong Sidebar
    const textElem = document.getElementById('sidebar-quota-text');
    if (textElem) textElem.innerText = `${used.toLocaleString()} / 7,000`;

    // Cập nhật thanh Bar
    const barElem = document.getElementById('sidebar-quota-bar');
    if (barElem) {
        barElem.style.width = percent + '%';
        barElem.style.background = color;
    }
},

countTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.trim().split(/\s+/).length * 1.3);
},
    
    toggleMic() {
        if (!this.state.recognition) return this.notifyError("Trình duyệt không hỗ trợ Mic");
        if (this.state.isMicActive) {
            this.state.recognition.stop();
        } else {
            this.state.recognition.start();
            this.state.isMicActive = true;
            document.getElementById('micBtn').classList.add('text-danger');
        }
    },

    // --- 8. UI RENDERING ENGINE ---
renderMessage(msg) {
    const container = document.getElementById('chat-scroller');
    const div = document.createElement('div');
    div.className = `msg-row ${msg.role === 'user' ? 'user-row' : 'bot-row'}`;
    
    let combinedContent = "";
    let imageHTML = "";

    // Duyệt qua mảng parts để bóc tách dữ liệu
    if (msg.parts && Array.isArray(msg.parts)) {
        msg.parts.forEach(part => {
            if (part.text) {
                // Nếu là văn bản, chúng ta lọc bỏ phần suy luận nếu cần
                combinedContent += part.text;
            }
            if (part.inline_data) {
                // Nếu có ảnh trong parts (dạng base64)
                imageHTML += `<div class="mt-2"><img src="data:${part.inline_data.mime_type};base64,${part.inline_data.data}" style="max-width:250px; border-radius:12px; border:1px solid var(--outline);"></div>`;
            }
        });
    }

    // Lọc bỏ phần suy luận (Thinking) của AI nếu nó nằm trong cùng một chuỗi text
    // Thường AI sẽ trả về kết quả cuối sau cùng, hoặc trong một định dạng nhất định
    let finalDisplayArea = combinedContent;
    if (msg.role === 'model') {
        finalDisplayArea = this.filterThinkingProcess(combinedContent);
    }

    const sanitizedBody = DOMPurify.sanitize(marked.parse(finalDisplayArea));
    
    div.innerHTML = `
        <div class="bubble">
            ${imageHTML}
            <div class="text-content">${sanitizedBody}</div>
        </div>
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
},
filterThinkingProcess(text) {
    // Nếu AI có trả về phần "Draft:" hoặc câu chốt ở cuối sau các dấu sao phân tích
    // Chúng ta sẽ ưu tiên lấy đoạn sau cùng nếu có quá nhiều bước phân tích.
    if (text.includes("Draft:")) {
        return text.split("Draft:").pop().trim();
    }
    
    // Nếu AI trình bày theo kiểu danh sách phân tích rồi mới chốt, 
    // bạn có thể lọc bỏ các dòng có dấu "*" ở đầu nếu muốn sạch sẽ 100%
    // Nhưng cách an toàn nhất là hướng dẫn System Prompt. 
    // Ở đây ta cứ để Markdown render, nhưng nếu nó quá dài, ta chỉ lấy phần sau cùng.
    return text; 
},
async typeEffect(element, text, thought) {
    if (thought) {
        const thoughtHtml = `<details class="thinking-block" open><summary>Đã suy luận</summary><div class="thinking-content">${thought}</div></details>`;
        element.parentElement.insertAdjacentHTML('afterbegin', thoughtHtml);
    }

    const words = text.split(" ");
    let currentText = "";
    
    for (let i = 0; i < words.length; i++) {
        // KIỂM TRA CỜ SKIP
        if (this.state.isSkipping) {
            element.innerHTML = DOMPurify.sanitize(marked.parse(text));
            this.ui.chat.scrollTop = this.ui.chat.scrollHeight;
            return; // Thoát hàm sớm
        }

        currentText += words[i] + (i < words.length - 1 ? " " : "");
        element.innerHTML = DOMPurify.sanitize(marked.parse(currentText));
        this.ui.chat.scrollTop = this.ui.chat.scrollHeight;
        
        await new Promise(r => setTimeout(r, this.config.typingSpeed * 2));
    }
},

renderSidebar() {
    // 1. Cập nhật danh sách Session vào #sessionlist
    const sessionList = document.getElementById('session-list');
    if (sessionList) {
        sessionList.innerHTML = '';
        Object.values(this.state.sessions)
            .sort((a, b) => b.created - a.created)
            .forEach(sess => {
                const item = document.createElement('div');
                item.className = `session-item ${sess.id === this.state.currentId ? 'active' : ''}`;
                item.innerHTML = `
                    <span class="material-symbols-rounded" style="font-size:18px">chat</span>
                    <span class="text-truncate" style="flex:1">${sess.title}</span>
                    <span class="material-symbols-rounded delete-btn" style="font-size:16px" 
                          onclick="event.stopPropagation(); NoobEngine.deleteSession('${sess.id}')">delete</span>
                `;
                item.onclick = () => this.switchSession(sess.id);
                sessionList.appendChild(item);
            });
    }

    // 2. Cập nhật Quota và Settings vào #tokenquota
    const tokenQuotaArea = document.getElementById('tokenquota');
if (tokenQuotaArea) {
        const percent = Math.min(100, (this.state.tokensUsed / 7000) * 100);
        tokenQuotaArea.className = 'p-3 border-top border-secondary mt-auto';
        tokenQuotaArea.innerHTML = `
            <div class="quota-container mb-3 px-1">
                <div class="d-flex justify-content-between mb-1" style="font-size: 10px; color: #8e918f; font-weight: 500;">
                    <span>HẠN MỨC (1H)</span>
                    <span id="sidebar-quota-text">${this.state.tokensUsed.toLocaleString()} / 7,000</span>
                </div>
                <div class="progress" style="height: 5px; background: #333; border-radius: 10px; overflow: hidden; border: 1px solid #444; margin-bottom: 5px;">
                    <div id="sidebar-quota-bar" class="progress-bar" 
                         style="width: ${percent}%; background: ${percent > 90 ? '#ea4335' : '#8ab4f8'}; transition: 0.6s ease"></div>
                </div>
                <div id="sidebar-reset-timer" style="font-size: 9px; color: #666; text-align: right; font-family: monospace;">
                    Đang tính toán...
                </div>
            </div>
            `;
    }
    
    // Đồng bộ vòng tròn ở nút Gửi
    this.updateQuotaUI();
},

    // --- 9. SYSTEM CORE ---
    save() {
        localforage.setItem(this.config.dbName, this.state.sessions);
    },

    clearInput() {
        this.ui.input.value = '';
        this.ui.input.style.height = 'auto';
        this.clearImage();
    },

setLoading(isLoading) {
    const sendBtn = document.getElementById('sendBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (isLoading) {
        sendBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'flex';
        
        const loader = document.createElement('div');
        loader.id = "temp-loader";
        loader.className = "msg-row bot-row";
        loader.innerHTML = `
            <div class="bubble d-flex align-items-center gap-2">
                <div class="loading-dots"><span>.</span><span>.</span><span>.</span><span>.</span><span>.</span><span>.</span></div>
                <span id="timer-counter" style="font-family:monospace; font-size:12px; color:#8ab4f8; margin-left:5px">0.0s</span>
            </div>`;
        this.ui.chat.appendChild(loader);
    } else {
        sendBtn.style.display = 'flex';
        if (stopBtn) stopBtn.style.display = 'none';
        document.getElementById('temp-loader')?.remove();
    }
},

    prepareHistory(history) {
        // Chỉ gửi text để tối ưu token cho API đơn giản
        return history.map(m => ({
            role: m.role,
            parts: m.parts
        })).slice(-this.config.maxHistory);
    },

    setupMarkdown() {
        marked.setOptions({ breaks: true, gfm: true });
    },

    notifyError(msg) {
        Swal.fire({ title: 'Lỗi', text: msg, icon: 'error', background: '#1e1f20', color: '#fff' });
    },

    notifyInfo(msg) {
        const Toast = Swal.mixin({
            toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
        });
        Toast.fire({ icon: 'info', title: msg });
    }
};

// --- RUN ENGINE ---
window.onload = () => NoobEngine.init();
