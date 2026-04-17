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
        resetTime: 3600000, // 1 giờ
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
        disabledModels: {},
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
/**
 * Xử lý gửi tin nhắn - Noob Engine V5.5
 * Tích hợp: Circuit Breaker (khóa model 50s), hiển thị Model Name, Quota Tracking
 */
async handleSend() {
    const modelSelect = document.getElementById('modelSelect');
    const selectedModel = modelSelect?.value || "gemini-1.5-flash";
    const now = Date.now();

    // 1. KIỂM TRA KHÓA MÔ HÌNH (Circuit Breaker)
    if (this.state.disabledModels && this.state.disabledModels[selectedModel] > now) {
        const timeLeft = Math.ceil((this.state.disabledModels[selectedModel] - now) / 1000);
        return this.notifyError(`Mô hình ${selectedModel} đang tạm khóa do lỗi API. Thử lại sau ${timeLeft} giây.`);
    }

    const text = this.ui.input.value.trim();
    const image = this.state.pendingImage;
    if ((!text && !image) || this.state.isTyping) return;

    // 2. CHUẨN BỊ DỮ LIỆU VÀ GIAO DIỆN
    this.checkAutoReset();
    const inputTokens = this.countTokens(text);
    if (this.state.tokensUsed + inputTokens > this.config.maxTokens) {
        return this.notifyError("Bạn đã hết hạn mức Token (7,000). Vui lòng đợi reset hoặc xóa lịch sử.");
    }

    const session = this.state.sessions[this.state.currentId];
    const userMsg = { 
        role: 'user', 
        timestamp: now, 
        parts: [{ text }] 
    };

    if (image) {
        userMsg.parts.push({
            inline_data: { mime_type: "image/jpeg", data: image.split(',')[1] }
        });
    }

    // Hiển thị tin nhắn người dùng
    session.history.push(userMsg);
    this.renderMessage(userMsg);
    this.clearInput();
    this.setLoading(true);

    try {
        // 3. GỌI API WORKER
        this.state.abortController = new AbortController();
        const response = await fetch(this.config.api, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: this.state.abortController.signal,
            body: JSON.stringify({ 
                messages: this.prepareHistory(session.history),
                model: selectedModel 
            })
        });

        if (!response.ok) throw new Error("API_CONNECT_FAIL");

        const data = await response.json();
        if (data.error) throw new Error(data.details || "API_LOGIC_FAIL");

        // 4. CẬP NHẬT HẠN MỨC & HIỂN THỊ PHẢN HỒI
        this.setLoading(false);
        const outputTokens = data.tokens_used || this.countTokens(data.text);
        this.state.tokensUsed += (inputTokens + outputTokens);
        
        await this.saveSecureQuota(); 
        this.updateQuotaUI();

        // Tạo bong bóng chat của bot với tên mô hình cụ thể
        const botRow = this.createBotRow(data.model_display || selectedModel);
        const textContainer = botRow.querySelector('.text-content');

        // Chạy hiệu ứng đánh máy (Type Effect)
        await this.typeEffect(textContainer, data.text, data.thought);

        // 5. LƯU VÀO LỊCH SỬ (Finalize)
        this.finalizeSession(data.text, data.thought, session, data.model_display || selectedModel);

    } catch (err) {
        this.setLoading(false);
        
        if (err.name === 'AbortError') {
            console.log("Đã dừng tạo phản hồi.");
        } else {
            // KÍCH HOẠT KHÓA MÔ HÌNH TRONG 50 GIÂY NẾU LỖI
            if (!this.state.disabledModels) this.state.disabledModels = {};
            this.state.disabledModels[selectedModel] = Date.now() + 50000;
            
            this.notifyError(`Lỗi: ${err.message}. Mô hình này đã bị tạm khóa 50s.`);
            if (typeof this.updateModelDropdownUI === 'function') this.updateModelDropdownUI();
        }
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
/**
 * Lưu trữ phản hồi của AI vào lịch sử phiên (Session History)
 * @param {string} content - Nội dung văn bản AI trả về
 * @param {string} thinking - Nội dung suy luận (nếu có)
 * @param {Object} session - Đối tượng session hiện tại
 * @param {string} modelName - Tên mô hình hiển thị (ví dụ: "Gemini 2.5 Flash")
 */
finalizeSession(content, thinking, session, modelName) {
    // 1. Chỉ lưu nếu có nội dung thực tế để tránh lưu rác
    if (content && content.trim()) {
        const modelMsg = {
            role: 'model',
            timestamp: Date.now(),
            // Quan trọng: Lưu tên mô hình cụ thể đã trả lời tin nhắn này
            modelName: modelName || "AI Assistant",
            parts: [
                { text: content }
            ]
        };

        // 2. Nếu có nội dung suy luận (thinking/thought), lưu vào parts
        if (thinking && thinking.trim()) {
            modelMsg.parts[0].thought = thinking;
        }

        // 3. Đưa vào lịch sử và giới hạn độ dài lịch sử theo config
        session.history.push(modelMsg);
        if (session.history.length > this.config.maxHistory) {
            session.history = session.history.slice(-this.config.maxHistory);
        }

        // 4. Lưu toàn bộ trạng thái vào LocalForage (IndexedDB)
        this.save();
    }

    // 5. Giải phóng trạng thái hệ thống
    this.state.isTyping = false;
    this.state.abortController = null;
    
    // Cập nhật lại thanh cuộn để đảm bảo người dùng thấy dòng cuối cùng
    if (this.ui.chat) {
        this.ui.chat.scrollTop = this.ui.chat.scrollHeight;
    }
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
/**
 * Hiển thị tin nhắn lên giao diện người dùng (UI)
 * @param {Object} msg - Đối tượng tin nhắn từ lịch sử (history)
 */
renderMessage(msg) {
    const container = this.ui.chat;
    const div = document.createElement('div');
    
    // 1. Phân loại Row dựa trên vai trò
    const isModel = msg.role === 'model' || msg.role === 'assistant';
    div.className = `msg-row ${isModel ? 'bot-row' : 'user-row'}`;
    
    // 2. Trích xuất dữ liệu từ Parts
    let textContent = "";
    let thoughtContent = "";
    let imagesHTML = "";

    if (msg.parts) {
        msg.parts.forEach(p => {
            if (p.text) textContent += p.text;
            if (p.thought) thoughtContent += p.thought;
            if (p.inline_data) {
                imagesHTML += `
                    <div class="message-image-container mt-2">
                        <img src="data:${p.inline_data.mime_type};base64,${p.inline_data.data}" 
                             class="img-fluid rounded-3 border border-secondary shadow-sm" 
                             style="max-width: 300px; cursor: pointer;"
                             onclick="window.open(this.src)">
                    </div>`;
            }
        });
    }

    // 3. Xử lý nhãn tên (Model Name hoặc "Bạn")
    const displayName = isModel ? (msg.modelName || "AI Assistant") : "Bạn";
    const nameLabelHTML = `
        <div class="name-label mb-1" style="font-size: 11px; font-weight: 700; color: #9aa0a6; text-transform: uppercase; letter-spacing: 0.5px;">
            ${displayName}
        </div>`;

    // 4. Xử lý khối suy luận (Thinking Block) - Thường dùng cho các model DeepThink
    const thinkingHTML = thoughtContent ? `
        <details class="thinking-block mb-2" style="background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px dashed #444;">
            <summary style="padding: 8px; font-size: 12px; color: #8ab4f8; cursor: pointer; font-weight: 500;">
                <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">psychology</span> Đã suy luận
            </summary>
            <div class="thinking-content p-2 pt-0" style="font-size: 13px; color: #bdc1c6; font-style: italic; line-height: 1.5;">
                ${DOMPurify.sanitize(marked.parse(thoughtContent))}
            </div>
        </details>` : '';

    // 5. Render nội dung chính bằng Markdown
    const mainTextHTML = textContent ? `
        <div class="text-content" style="line-height: 1.6;">
            ${DOMPurify.sanitize(marked.parse(textContent))}
        </div>` : '';

    // 6. Ráp nối vào Bubble
    div.innerHTML = `
        ${nameLabelHTML}
        <div class="bubble p-3 shadow-sm" style="position: relative; max-width: 85%;">
            ${imagesHTML}
            ${thinkingHTML}
            ${mainTextHTML}
            <div class="msg-meta mt-1" style="font-size: 10px; color: #5f6368; text-align: right;">
                ${new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
    `;

    // 7. Đẩy vào UI và cuộn xuống cuối
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Highlight code blocks nếu bạn có sử dụng Prism.js hoặc Highlight.js
    if (window.Prism) Prism.highlightAllUnder(div);
},
    /**
 * Khóa một mô hình cụ thể trong 50 giây khi phát hiện lỗi API
 * @param {string} modelId - ID của mô hình (ví dụ: 'gemini-2.5-flash')
 */
lockModel(modelId) {
    if (!modelId) return;

    // 1. Thiết lập thời điểm mở khóa (Hiện tại + 50,000ms)
    const unlockTime = Date.now() + 50000;
    
    if (!this.state.disabledModels) this.state.disabledModels = {};
    this.state.disabledModels[modelId] = unlockTime;

    // 2. Cập nhật giao diện ngay lập tức
    this.updateModelDropdownUI();

    // 3. Đặt lịch tự động cập nhật lại UI khi hết thời gian khóa
    setTimeout(() => {
        this.updateModelDropdownUI();
    }, 50100); 
    
    console.warn(`[Circuit Breaker] Đã khóa mô hình ${modelId} trong 50s.`);
},
    /**
 * Cập nhật trạng thái hiển thị của Dropdown chọn mô hình
 */
updateModelDropdownUI() {
    const select = document.getElementById('modelSelect');
    if (!select) return;

    const now = Date.now();
    const disabledList = this.state.disabledModels || {};

    Array.from(select.options).forEach(opt => {
        const modelId = opt.value;
        const unlockTime = disabledList[modelId];

        if (unlockTime && unlockTime > now) {
            // TRƯỜNG HỢP: Model đang bị khóa
            const secondsLeft = Math.ceil((unlockTime - now) / 1000);
            
            opt.disabled = true;
            // Hiển thị tên kèm đồng hồ đếm ngược
            const originalName = modelNameMap[modelId] || modelId;
            opt.innerText = `⚠️ ${originalName} (Lỗi - ${secondsLeft}s)`;
            
            // Nếu người dùng đang chọn đúng model này, đổi sang model khác (nếu có)
            if (select.value === modelId) {
                this.switchToFirstAvailableModel(select);
            }
        } else {
            // TRƯỜNG HỢP: Model hoạt động bình thường
            opt.disabled = false;
            opt.innerText = modelNameMap[modelId] || modelId;
            
            // Xóa khỏi danh sách theo dõi nếu đã hết hạn khóa
            if (unlockTime) delete this.state.disabledModels[modelId];
        }
    });
},

/**
 * Hàm phụ trợ: Tự động nhảy sang model khác nếu model hiện tại bị khóa
 */
switchToFirstAvailableModel(selectEl) {
    const availableOpt = Array.from(selectEl.options).find(opt => !opt.disabled);
    if (availableOpt) {
        selectEl.value = availableOpt.value;
    }
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
