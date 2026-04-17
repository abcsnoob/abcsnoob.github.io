/**
 * NOOB ENGINE V5.5 - CORE SCRIPT
 * Developed by AbcsNoob.ai
 * Features: Auto-save, Multi-session, Voice-to-Text, Vision, Data Export.
 */

// [FIX] Định nghĩa modelNameMap ở phạm vi module để dùng trong updateModelDropdownUI
const modelNameMap = {
    "gemini-2.5-flash":           "Gemini 2.5 Flash (Mặc định)",
    "gemini-3-flash-preview":     "Gemini 3 Flash",
    "gemini-3.1-flash-lite-preview": "Gemini 3.1 Flash Lite",
    "gpt-oss-20b":                "GPT OSS 20B",
    "gemma-4-31b-it":             "Gemma 4 31B",
    "gemma-4-26b-it":             "Gemma 4 26B",
    "gemma-3-27b-it":             "Gemma 3 27B",
    "gemma-3-12b-it":             "Gemma 3 12B",
    "gemma-3-4b-it":              "Gemma 3 4B",
};

const NoobEngine = {
    // --- 1. CONFIGURATION & CONSTANTS ---
    config: {
        api: 'https://abcsnoobai.abcsnoob.workers.dev',
        typingSpeed: 12,
        maxHistory: 30,
        dbName: 'noob_engine_v55',
        theme: 'material_dark',
        maxTokens: 7000000,
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
            const char = this.state.typeQueue.charAt(0);
            this.state.typeQueue = this.state.typeQueue.substring(1);

            sessionHistoryObj.text += char;
            element.innerHTML = DOMPurify.sanitize(marked.parse(sessionHistoryObj.text));

            this.ui.chat.scrollTop = this.ui.chat.scrollHeight;
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
            list:    document.getElementById('session-list'),
            chat:    document.getElementById('chat-scroller'),
            input:   document.getElementById('userInput'),
            preview: document.getElementById('imagePreview'), // Sẽ là null nếu element không tồn tại - các hàm đã guard
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
        this.startQuotaCountdown(); // [FIX] Gọi countdown sau khi init xong
    },

    bindGlobalEvents() {
        this.ui.input.addEventListener('input', () => {
            this.ui.input.style.height = 'auto';
            this.ui.input.style.height = (this.ui.input.scrollHeight) + 'px';
        });

        this.ui.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });
    },

    // --- QUOTA MANAGEMENT ---
    async saveSecureQuota() {
        const data = {
            used: this.state.tokensUsed,
            lastReset: this.state.lastReset
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
        this.checkAutoReset();
    },

    checkAutoReset() {
        const now = Date.now();
        if (now - this.state.lastReset > this.config.resetTime) {
            this.state.tokensUsed = 0;
            this.state.lastReset = now;
            this.saveSecureQuota();
            return true;
        }
        return false;
    },

    // --- 4. CORE CHAT LOGIC ---
    /**
     * Xử lý gửi tin nhắn - Noob Engine V5.5
     * Tích hợp: Circuit Breaker (khóa model 50s), hiển thị Model Name, Quota Tracking
     */
/**
     * Xử lý gửi tin nhắn - Noob Engine V5.5 (Updated with Thought Tag Support)
     */
    async handleSend() {
        const modelSelect = document.getElementById('modelSelect');
        const selectedModel = modelSelect?.value || "gemini-2.5-flash";
        const now = Date.now();

        // 1. KIỂM TRA KHÓA MÔ HÌNH (Circuit Breaker)
        if (this.state.disabledModels && this.state.disabledModels[selectedModel] > now) {
            const timeLeft = Math.ceil((this.state.disabledModels[selectedModel] - now) / 1000);
            return this.notifyError(`Mô hình ${selectedModel} đang tạm khóa do lỗi API. Thử lại sau ${timeLeft} giây.`);
        }

        const text = this.ui.input.value.trim();
        const image = this.state.pendingImage;
        if ((!text && !image) || this.state.isTyping) return;

        // 2. CHUẨN BỊ DỮ LIỆU
        this.checkAutoReset();
        const inputTokens = this.countTokens(text);
        if (this.state.tokensUsed + inputTokens > this.config.maxTokens) {
            return this.notifyError("Bạn đã hết hạn mức Token (7.000.000). Vui lòng đợi reset hoặc xóa lịch sử.");
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

            this.setLoading(false);

            // --- [NEW LOGIC] XỬ LÝ THẺ [/Though] ---
            const processed = this.filterThinkingProcess(data.text);
            const finalContent = processed.cleanText;
            const finalThought = processed.thought || data.thought; 
            // ---------------------------------------

            const outputTokens = data.tokens_used || this.countTokens(data.text);
            this.state.tokensUsed += (inputTokens + outputTokens);

            await this.saveSecureQuota();
            this.updateQuotaUI();

            const botRow = this.createBotRow(data.model_display || selectedModel);
            const textContainer = botRow.querySelector('.text-content');

            // Sử dụng nội dung đã lọc sạch để chạy hiệu ứng đánh máy
            await this.typeEffect(textContainer, finalContent, finalThought);

            // Lưu vào session với dữ liệu đã tách biệt
            this.finalizeSession(finalContent, finalThought, session, data.model_display || selectedModel);

        } catch (err) {
            this.setLoading(false);
            if (err.name === 'AbortError') {
                console.log("Đã dừng tạo phản hồi.");
            } else {
                if (!this.state.disabledModels) this.state.disabledModels = {};
                this.state.disabledModels[selectedModel] = Date.now() + 50000;
                this.notifyError(`Lỗi: ${err.message}. Mô hình này đã bị tạm khóa 50s.`);
                if (typeof this.updateModelDropdownUI === 'function') this.updateModelDropdownUI();
            }
        }
    },

    /**
     * Chạy đồng hồ đếm ngược dựa trên mốc lastReset
     */
    async startQuotaCountdown() {
        const tick = async () => {
            const countdownElement = document.getElementById('sidebar-reset-timer');
            if (!countdownElement) return;

            const quotaData = await localforage.getItem('_sys_secure_quota');
            if (!quotaData || !quotaData.lastReset) {
                countdownElement.innerText = "Sẵn sàng";
                return;
            }

            const now = Date.now();
            const elapsed = now - quotaData.lastReset;
            const remaining = this.config.resetTime - elapsed;

            if (remaining <= 0) {
                this.state.tokensUsed = 0;
                this.state.lastReset = now;
                await this.saveSecureQuota();
                this.updateQuotaUI();
                countdownElement.innerText = "Đã reset";
            } else {
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                countdownElement.innerText = `Reset sau: ${minutes}p ${seconds}s`;
            }
        };

        setInterval(tick, 1000);
    },

    /**
     * Lưu trữ phản hồi của AI vào lịch sử phiên
     */
    finalizeSession(content, thinking, session, modelName) {
        if (content && content.trim()) {
            const modelMsg = {
                role: 'model',
                timestamp: Date.now(),
                modelName: modelName || "AI Assistant",
                parts: [{ text: content }]
            };

            if (thinking && thinking.trim()) {
                modelMsg.parts[0].thought = thinking;
            }

            session.history.push(modelMsg);
            if (session.history.length > this.config.maxHistory) {
                session.history = session.history.slice(-this.config.maxHistory);
            }

            this.save();
        }

        this.state.isTyping = false;
        this.state.abortController = null;

        if (this.ui.chat) {
            this.ui.chat.scrollTop = this.ui.chat.scrollHeight;
        }
    },

    stopGeneration() {
        if (this.state.abortController) {
            this.state.abortController.abort();
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

    // --- 6. EXPORT ALL ---
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
            // [FIX] Guard null check cho ui.preview
            if (this.ui.preview) {
                this.ui.preview.innerHTML = `<div class="position-relative">
                    <img src="${ev.target.result}" class="preview-img">
                    <button class="btn btn-sm btn-dark rounded-circle position-absolute top-0 end-0" style="padding:0 5px" onclick="NoobEngine.clearImage()">×</button>
                </div>`;
                this.ui.preview.style.display = 'flex';
            }
        };
        reader.readAsDataURL(file);
    },

    clearImage() {
        this.state.pendingImage = null;
        // [FIX] Guard null check
        if (this.ui.preview) {
            this.ui.preview.style.display = 'none';
        }
        const fi = document.getElementById('fileInput');
        if (fi) fi.value = '';
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
                const micBtn = document.getElementById('micBtn');
                if (micBtn) micBtn.classList.remove('text-danger');
            };
        }
    },

    // [FIX] Chỉ còn 1 định nghĩa countTokens
countTokens(text) {
    if (!text) return 0;

    // 1. Loại bỏ các khối suy nghĩ [THOUGHT]...[/THOUGHT] hoặc [/Though]...[Though/]
    // Chúng ta dùng Regex tương tự như lúc bóc tách để đảm bảo đồng bộ
    const thoughtRegex = /\[(?:\/)?(?:THOUGHT|Though)\]([\s\S]*?)\[(?:\/)?(?:THOUGHT|Though)\/?\]/gi;
    const orphanRegex = /\[(?:\/)?(?:THOUGHT|Though)\]([\s\S]*)$/i;

    let cleanText = text.replace(thoughtRegex, "");
    cleanText = cleanText.replace(orphanRegex, ""); // Loại bỏ cả thẻ mở dở dang

    // 2. Thuật toán đếm token xấp xỉ cho tiếng Việt
    // Quy tắc: 1 token ≈ 1.5 ký tự (tiếng Việt nhiều dấu) hoặc ~0.75 từ
    const words = cleanText.trim().split(/\s+/).length;
    const chars = cleanText.length;
    
    // Lấy giá trị lớn hơn giữa (từ * 1.3) và (ký tự / 3) để ra con số an toàn
    return Math.max(Math.ceil(words * 1.3), Math.ceil(chars / 3));
},

    // [FIX] Chỉ còn 1 định nghĩa updateQuotaUI
    updateQuotaUI() {
        const used = Number(this.state.tokensUsed) || 0;
        const percent = Math.min(100, (used / 7000000) * 100);
        const color = percent > 90 ? '#ea4335' : (percent > 70 ? '#f4b400' : '#8ab4f8');

        const textElem = document.getElementById('sidebar-quota-text');
        if (textElem) textElem.innerText = `${used.toLocaleString()} / 7.000.000`;

        const barElem = document.getElementById('sidebar-quota-bar');
        if (barElem) {
            barElem.style.width = percent + '%';
            barElem.style.background = color;
        }
    },

    toggleMic() {
        if (!this.state.recognition) return this.notifyError("Trình duyệt không hỗ trợ Mic");
        if (this.state.isMicActive) {
            this.state.recognition.stop();
        } else {
            this.state.recognition.start();
            this.state.isMicActive = true;
            const micBtn = document.getElementById('micBtn');
            if (micBtn) micBtn.classList.add('text-danger');
        }
    },

    // --- 8. UI RENDERING ENGINE ---
    /**
     * [FIX] Nhận tham số modelName để hiển thị đúng tên model
     */
    createBotRow(modelName) {
        const div = document.createElement('div');
        div.className = 'msg-row bot-row';
        div.innerHTML = `
            <div class="name-label mb-1" style="font-size: 11px; font-weight: 700; color: #9aa0a6; text-transform: uppercase; letter-spacing: 0.5px;">
                ${modelName || 'AI Engine'}
            </div>
            <div class="bubble">
                <div class="text-content"></div>
            </div>
            <div class="stats-area" style="font-size:10px; color:#555; margin-top:8px"></div>
        `;
        this.ui.chat.appendChild(div);
        return div;
    },

    /**
     * [FIX] Chỉ còn 1 định nghĩa renderMessage - dùng phiên bản đầy đủ nhất
     */
    renderMessage(msg) {
        const container = this.ui.chat;
        const div = document.createElement('div');

        const isModel = msg.role === 'model' || msg.role === 'assistant';
        div.className = `msg-row ${isModel ? 'bot-row' : 'user-row'}`;

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

        const displayName = isModel ? (msg.modelName || "AI Assistant") : "Bạn";
        const nameLabelHTML = `
            <div class="name-label mb-1" style="font-size: 11px; font-weight: 700; color: #9aa0a6; text-transform: uppercase; letter-spacing: 0.5px;">
                ${displayName}
            </div>`;

        const thinkingHTML = thoughtContent ? `
            <details class="thinking-block mb-2" style="background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px dashed #444;">
                <summary style="padding: 8px; font-size: 12px; color: #8ab4f8; cursor: pointer; font-weight: 500;">
                    <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">psychology</span> Đã suy luận
                </summary>
                <div class="thinking-content p-2 pt-0" style="font-size: 13px; color: #bdc1c6; font-style: italic; line-height: 1.5;">
                    ${DOMPurify.sanitize(marked.parse(thoughtContent))}
                </div>
            </details>` : '';

        const mainTextHTML = textContent ? `
            <div class="text-content" style="line-height: 1.6;">
                ${DOMPurify.sanitize(marked.parse(textContent))}
            </div>` : '';

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

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    renderStats(rowElement, data) {
        const statsArea = rowElement.querySelector('.stats-area');
        if (data && statsArea) {
            statsArea.innerHTML = `
                <span>Model: ${data.Model || 'Gemini'}</span> |
                <span>Speed: ${data.ProcessingTime || 'N/A'}ms</span>
            `;
        }
    },

    renderSidebar() {
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

        const tokenQuotaArea = document.getElementById('tokenquota');
        if (tokenQuotaArea) {
            const percent = Math.min(100, (this.state.tokensUsed / 7000000) * 100);
            tokenQuotaArea.className = 'p-3 border-top border-secondary mt-auto';
            tokenQuotaArea.innerHTML = `
                <div class="quota-container mb-3 px-1">
                    <div class="d-flex justify-content-between mb-1" style="font-size: 10px; color: #8e918f; font-weight: 500;">
                        <span>HẠN MỨC (1H)</span>
                        <span id="sidebar-quota-text">${this.state.tokensUsed.toLocaleString()} / 7.000.000</span>
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

        this.updateQuotaUI();
    },

    // [FIX] Chỉ còn 1 định nghĩa prepareHistory - dùng phiên bản đúng
    prepareHistory(history) {
        return history.map(m => ({
            role: m.role === 'assistant' ? 'model' : m.role,
            parts: m.parts.map(p => {
                if (p.inline_data) return { inline_data: p.inline_data };
                return { text: p.text || "" };
            })
        })).slice(-this.config.maxHistory);
    },

/* Tìm và thay thế hàm cũ trong script.js */
filterThinkingProcess(text) {
    const thoughtRegex = /\[\/Though\]([\s\S]*?)\[Though\/\]/g;
    let match;
    let thoughts = [];
    let cleanText = text;

    // Trích xuất tất cả nội dung nằm giữa các thẻ suy nghĩ
    while ((match = thoughtRegex.exec(text)) !== null) {
        thoughts.push(match[1].trim());
    }

    // Xóa bỏ các thẻ và nội dung suy nghĩ khỏi văn bản hiển thị chính
    cleanText = text.replace(thoughtRegex, '').trim();

    return {
        cleanText: cleanText,
        thought: thoughts.join('\n---\n') // Gộp các block suy nghĩ nếu có nhiều
    };
},

    async typeEffect(element, text, thought) {
        if (thought) {
            const thoughtHtml = `<details class="thinking-block" open><summary>Đã suy luận</summary><div class="thinking-content">${DOMPurify.sanitize(marked.parse(thought))}</div></details>`;
            element.parentElement.insertAdjacentHTML('afterbegin', thoughtHtml);
        }

        const words = text.split(" ");
        let currentText = "";

        for (let i = 0; i < words.length; i++) {
            if (this.state.isSkipping) {
                element.innerHTML = DOMPurify.sanitize(marked.parse(text));
                this.ui.chat.scrollTop = this.ui.chat.scrollHeight;
                return;
            }

            currentText += words[i] + (i < words.length - 1 ? " " : "");
            element.innerHTML = DOMPurify.sanitize(marked.parse(currentText));
            this.ui.chat.scrollTop = this.ui.chat.scrollHeight;

            await new Promise(r => setTimeout(r, this.config.typingSpeed * 2));
        }
    },

    // --- CIRCUIT BREAKER ---
    lockModel(modelId) {
        if (!modelId) return;

        const unlockTime = Date.now() + 50000;
        if (!this.state.disabledModels) this.state.disabledModels = {};
        this.state.disabledModels[modelId] = unlockTime;

        this.updateModelDropdownUI();

        setTimeout(() => {
            this.updateModelDropdownUI();
        }, 50100);

        console.warn(`[Circuit Breaker] Đã khóa mô hình ${modelId} trong 50s.`);
    },

    updateModelDropdownUI() {
        const select = document.getElementById('modelSelect');
        if (!select) return;

        const now = Date.now();
        const disabledList = this.state.disabledModels || {};

        Array.from(select.options).forEach(opt => {
            const modelId = opt.value;
            const unlockTime = disabledList[modelId];

            if (unlockTime && unlockTime > now) {
                const secondsLeft = Math.ceil((unlockTime - now) / 1000);
                opt.disabled = true;
                const originalName = modelNameMap[modelId] || modelId;
                opt.innerText = `⚠️ ${originalName} (Lỗi - ${secondsLeft}s)`;

                if (select.value === modelId) {
                    this.switchToFirstAvailableModel(select);
                }
            } else {
                opt.disabled = false;
                opt.innerText = modelNameMap[modelId] || modelId;
                if (unlockTime) delete this.state.disabledModels[modelId];
            }
        });
    },

    switchToFirstAvailableModel(selectEl) {
        const availableOpt = Array.from(selectEl.options).find(opt => !opt.disabled);
        if (availableOpt) {
            selectEl.value = availableOpt.value;
        }
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
