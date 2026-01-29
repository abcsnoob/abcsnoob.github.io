/**
 * NOOB ENGINE - ULTRA SECURE DEEPMIND EDITION
 * Version: 4.0.0 (Gold)
 * Iterations: 300,000 (PBKDF2)
 * Features: Dynamic Injection, Async Rendering, AES-GCM Crypto
 */

const NoobEngine = {
    // --- 1. CONFIGURATION & STATE ---
    config: {
        magicStart: "STARTABCSNOOBDEEPMINDFILES",
        magicEnd: "ENDABCSNOOBDEEPMINDFILES",
        version: 0x04,
        iterations: 300000,
        renderDelay: 100,
        apiEndpoint: 'https://abcsnoobai.abcsnoob.workers.dev'
    },

    state: {
        currentSessionId: null,
        sessions: {},
        isTyping: false,
        theme: localStorage.getItem('noob_theme') || 'dark',
        sidebarOpen: window.innerWidth > 992
    },

    // --- 2. CRYPTOGRAPHY MODULE (WebCrypto API) ---
    crypto: {
        async getSecretKey(password, salt) {
            const encoder = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                "raw", 
                encoder.encode(password), 
                { name: "PBKDF2" }, 
                false, 
                ["deriveKey"]
            );
            return crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: salt,
                    iterations: NoobEngine.config.iterations,
                    hash: "SHA-256"
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );
        },

        async encryptData(text, password) {
            const encoder = new TextEncoder();
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const key = await this.getSecretKey(password, salt);
            
            const encrypted = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                encoder.encode(text)
            );

            // Gói dữ liệu: [Salt(16)] + [IV(12)] + [Data]
            const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encrypted), salt.length + iv.length);
            return combined;
        },

        async decryptData(combinedData, password) {
            const salt = combinedData.slice(0, 16);
            const iv = combinedData.slice(16, 28);
            const data = combinedData.slice(28);
            
            const key = await this.getSecretKey(password, salt);
            try {
                const decrypted = await crypto.subtle.decrypt(
                    { name: "AES-GCM", iv: iv },
                    key,
                    data
                );
                return new TextDecoder().decode(decrypted);
            } catch (e) {
                throw new Error("Sai mật khẩu hoặc dữ liệu bị hỏng!");
            }
        }
    },

    // --- 3. UI INJECTION & STYLES ---
    styles: {
        inject() {
            const styleTag = document.createElement('style');
            styleTag.textContent = `
                @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Plus+Jakarta+Sans:wght@400;600&display=swap');
                
/* --- 1. HỆ THỐNG BIẾN (CSS VARIABLES) --- */
:root {
    --bg: #0d1117;
    --side: #010409;
    --surface: #161b22;
    --border: #30363d;
    --text: #c9d1d9;
    --text-muted: #8b949e;
    --p: #58a6ff;
    --p-glow: rgba(88, 166, 255, 0.15);
    --user-bubble: #1f6feb;
    --bot-bubble: #21262d;
    --danger: #f85149;
    --success: #3fb950;
    --glass: rgba(255, 255, 255, 0.05);
}

[data-theme="light"] {
    /* Nền và Bề mặt */
    --bg: #ffffff;
    --side: #f1f3f5; /* Xám cực nhẹ để tách biệt sidebar */
    --surface: #ffffff;
    --border: #dcdfe3;
    
    /* Chữ - QUAN TRỌNG NHẤT */
    --text: #1a1d21;       /* Chữ đen sâu, cực kỳ dễ đọc */
    --text-muted: #4a5568; /* Chữ phụ xám đậm hơn */
    
    /* Màu sắc thương hiệu */
    --p: #0061ff;
    --p-glow: rgba(0, 97, 255, 0.1);
    
    /* Bong bóng Chat */
    --user-bubble: #0061ff;
    --bot-bubble: #f8f9fa; /* Màu nền nhẹ cho Bot để tương phản với chữ đen */
    
    --glass: rgba(0, 0, 0, 0.04);
}

/* Ép kiểu bổ sung cho nội dung tin nhắn Bot để đảm bảo không bị mờ */
[data-theme="light"] .bot-row .bubble {
    color: #1a1d21 !important; /* Đảm bảo chữ Bot luôn đen */
    border: 1px solid #e2e8f0;
}

[data-theme="light"] .bot-row .bubble * {
    color: #1a1d21 !important; /* Áp dụng cho cả các tag con bên trong như <p>, <li> */
}

/* --- 2. RESET & BASE STYLES --- */
* { box-sizing: border-box; }
body { 
    margin: 0; 
    background: var(--bg); 
    color: var(--text); 
    font-family: 'Plus Jakarta Sans', sans-serif; 
    overflow: hidden; 
    transition: background 0.3s ease; 
}

#app-container { display: flex; height: 100vh; width: 100vw; }

/* --- 3. SIDEBAR --- */
#sidebar { 
    width: 280px; 
    background: var(--side); 
    border-right: 1px solid var(--border); 
    display: flex; 
    flex-direction: column; 
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}
#sidebar.collapsed { transform: translateX(-280px); width: 0; opacity: 0; }

.brand { 
    padding: 24px; 
    display: flex; 
    align-items: center; 
    gap: 12px; 
    border-bottom: 1px solid var(--border);
}
.brand-logo { 
    width: 28px; height: 28px; 
    background: var(--p); 
    border-radius: 6px; 
    box-shadow: 0 0 15px var(--p-glow); 
}
.brand-name { 
    font-family: 'Space Grotesk'; 
    font-weight: 700; 
    font-size: 18px; 
    color: var(--text);
}

.session-list { flex: 1; overflow-y: auto; padding: 12px; }
.session-item { 
    padding: 10px 14px; 
    border-radius: 8px; 
    margin-bottom: 4px; 
    cursor: pointer; 
    font-size: 14px; 
    display: flex; 
    align-items: center; 
    justify-content: space-between;
    transition: 0.2s;
    color: var(--text-muted);
}
.session-item:hover { background: var(--glass); color: var(--text); }
.session-item.active { background: var(--p-glow); color: var(--p); font-weight: 600; }
.session-item .del-btn { opacity: 0; transition: 0.2s; }
.session-item:hover .del-btn { opacity: 0.6; }

/* --- 4. MAIN STAGE & TOP NAV --- */
#main-stage { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg); }
.top-nav { 
    height: 60px; 
    display: flex; 
    align-items: center; 
    padding: 0 20px; 
    border-bottom: 1px solid var(--border);
    justify-content: space-between;
}

/* --- 5. CHAT AREA --- */
#chat-scroller { 
    flex: 1; 
    overflow-y: auto; 
    padding: 40px 15%; 
    display: flex; 
    flex-direction: column;
}
.welcome { text-align: center; margin: auto; max-width: 400px; }
.welcome i { font-size: 40px; color: var(--p); margin-bottom: 15px; opacity: 0.8; }

.message-row { 
    margin-bottom: 24px; 
    display: flex; 
    flex-direction: column; 
    opacity: 0; 
    transform: translateY(10px); 
    animation: reveal 0.3s forwards ease-out;
}
@keyframes reveal { to { opacity: 1; transform: translateY(0); } }

.bubble { 
    max-width: 85%; 
    padding: 12px 18px; 
    border-radius: 16px; 
    font-size: 15px; 
    line-height: 1.6;
    word-wrap: break-word;
}
.user-row { align-items: flex-end; }
.user-row .bubble { 
    background: var(--user-bubble); 
    color: #ffffff; 
    border-bottom-right-radius: 4px; 
}
.bot-row { align-items: flex-start; }
.bot-row .bubble { 
    background: var(--bot-bubble); 
    border: 1px solid var(--border); 
    border-bottom-left-radius: 4px; 
}

/* --- 6. INPUT ZONE --- */
.composer { padding: 0 15% 30px; }
.input-wrapper { 
    background: var(--surface); 
    border: 1px solid var(--border); 
    border-radius: 12px; 
    padding: 12px; 
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
.input-wrapper:focus-within { border-color: var(--p); }
textarea { 
    width: 100%; background: none; border: none; color: var(--text); 
    outline: none; resize: none; font-size: 15px; max-height: 200px;
}
.action-bar { 
    display: flex; justify-content: space-between; 
    align-items: center; margin-top: 10px; border-top: 1px solid var(--border);
    padding-top: 10px;
}

/* --- 7. BUTTONS & UI ELEMENTS --- */
.cyber-btn { 
    padding: 8px 16px; background: var(--surface); border: 1px solid var(--border); 
    color: var(--text); border-radius: 8px; cursor: pointer; font-weight: 600; 
    font-size: 12px; transition: 0.2s; display: flex; align-items: center; gap: 8px;
}
.cyber-btn:hover { background: var(--glass); border-color: var(--p); color: var(--p); }
.cyber-btn.danger:hover { border-color: var(--danger); color: var(--danger); }

/* --- 8. MODAL & OVERLAY --- */
.overlay { 
    position: fixed; inset: 0; background: rgba(0,0,0,0.4); 
    backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 999; 
}
.modal { 
    background: var(--bg); border: 1px solid var(--border); 
    border-radius: 16px; width: 90%; max-width: 400px; padding: 24px; 
    box-shadow: 0 20px 40px rgba(0,0,0,0.2); animation: modalIn 0.3s ease-out;
}
@keyframes modalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.bubble img {
    max-width: 100%;
    border-radius: 8px;
    margin-top: 8px;
    display: block;
}
/* Custom Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
            `;
            document.head.appendChild(styleTag);
        }
    },

    // --- 4. CORE ENGINE LOGIC ---
async init() {
    await new Promise((resolve) => {
        // Nạp đồng thời cả DOMPurify và SweetAlert2
        const scripts = [
            "https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js",
            "https://cdn.jsdelivr.net/npm/sweetalert2@11"
        ];
        let loaded = 0;
        scripts.forEach(src => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => { if(++loaded === scripts.length) resolve(); };
            document.head.appendChild(s);
        });
    });
        this.styles.inject();
        this.renderBaseUI();
        
        // Load dữ liệu cũ
        const saved = await localforage.getItem('noob_sessions_v4');
        if (saved) this.state.sessions = saved;

        // KIỂM TRA URL PARAMS
        const urlParams = new URLSearchParams(window.location.search);
        const externalFileUrl = urlParams.get('url');

        if (externalFileUrl) {
            await this.importFromUrl(externalFileUrl);
        } else if (Object.keys(this.state.sessions).length > 0) {
            const lastId = Object.keys(this.state.sessions).sort((a,b) => b-a)[0];
            await this.switchSession(lastId);
        } else {
            this.createNewSession();
        }
        
        this.bindGlobalEvents();
    },

    renderBaseUI() {
        const root = document.getElementById('app');
        root.innerHTML = `
            <div id="app-container" data-theme="${this.state.theme}">
                <aside id="sidebar" class="${!this.state.sidebarOpen ? 'collapsed' : ''}">
                    <div class="brand">
                        <div class="brand-logo"></div>
                        <div class="brand-name">Abc's Noob Deep Mind</div>
                    </div>
                    <div class="session-list" id="js-session-list"></div>
                    <div class="p-3" style="border-top: 1px solid var(--border)">
                        <div class="d-flex gap-2 mb-2">
                            <button class="cyber-btn flex-grow-1" id="js-share-btn"><i class="fa-solid fa-paper-plane"></i> Share</button>
                            <button class="cyber-btn" id="js-import-btn"><i class="fa-solid fa-file-import"></i></button>
                        </div>
                        <button class="cyber-btn w-100 mb-2" id="js-new-btn"><i class="fa-solid fa-plus"></i> New Chat</button>
                        <button class="cyber-btn w-100" id="js-settings-btn"><i class="fa-solid fa-gear"></i> Settings</button>
                    </div>
                </aside>

                <main id="main-stage">
                    <nav class="top-nav">
                        <button id="js-toggle-sidebar" style="background:none; border:none; color:inherit; cursor:pointer">
                            <i class="fa-solid fa-bars-staggered"></i>
                        </button>
                        <div style="font-size: 11px; opacity: 0.5; font-weight: bold; letter-spacing: 1px;">DEEPMIND SECURITY V4.0</div>
                    </nav>
                    
                    <div id="chat-scroller"></div>

                    <div class="composer">
                        <div class="input-wrapper">
                            <textarea id="js-input" rows="1" placeholder="Type a secure message..."></textarea>
<div class="action-bar">
    <div class="d-flex gap-2 align-items-center">
        <button class="cyber-btn" id="js-image-btn" title="Upload Image"><i class="fa-solid fa-image"></i></button>
        <div id="js-image-preview" style="display:none; position:relative;">
            <img src="" id="js-preview-img" style="height:32px; border-radius:4px; border:1px solid var(--p)">
            <i class="fa-solid fa-circle-xmark" id="js-remove-img" style="position:absolute; top:-5px; right:-5px; font-size:12px; cursor:pointer; color:var(--danger)"></i>
        </div>
    </div>
    <button class="cyber-btn" id="js-send-btn" style="padding: 6px 20px;">Send</button>
</div>
                        </div>
                    </div>
                </main>
            </div>

            <div class="overlay justify-content-center align-items-center" id="js-modal-overlay">
                <div class="modal" id="js-modal">
                    <h3 style="font-family: 'Space Grotesk'; margin-bottom: 25px;">System Settings</h3>
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <span>Interface Theme</span>
                        <button class="cyber-btn" id="js-theme-toggle" style="width: 100px;">
                            ${this.state.theme === 'dark' ? 'Dark' : 'Light'}
                        </button>
                    </div>
                    <button class="cyber-btn danger w-100 mb-3" id="js-reset-btn">
                        <i class="fa-solid fa-trash-can"></i> Factory Reset
                    </button>
                    <button class="cyber-btn w-100" id="js-close-modal" style="border:none; background:var(--glass)">Close</button>
                </div>
            </div>
            <input type="file" id="js-file-hidden" hidden accept=".abcsnoobai">
            <input type="file" id="js-image-hidden" hidden accept="image/*">
        `;
    },

    async createNewSession() {
        const id = Date.now();
        this.state.sessions[id] = {
            title: "New Conversation",
            history: [],
            created: id
        };
        await this.switchSession(id);
        this.saveState();
    },

async switchSession(id) {
        // Kiểm tra xem ID có tồn tại trong bộ nhớ không
        if (!id || !this.state.sessions[id]) {
            console.warn("Session ID không tồn tại, đang tạo session mới...");
            return this.createNewSession();
        }

        this.state.currentSessionId = id;
        const scroller = document.getElementById('chat-scroller');
        if (!scroller) return; // Bảo vệ nếu DOM chưa sẵn sàng
        
        scroller.innerHTML = '';
        
        // Cứu cánh: Đảm bảo history luôn là một mảng
        const session = this.state.sessions[id];
        const history = Array.isArray(session.history) ? session.history : [];

        if (history.length === 0) {
            scroller.innerHTML = `
                <div class="welcome">
                    <i class="fa-solid fa-terminal"></i>
                    <h2>System Ready</h2>
                    <p>Chào anh bạn, hôm nay có vui không? (Vui lắm)</p>
                </div>
            `;
        } else {
            // Bây giờ loop thoải mái không sợ văng lỗi
            for (const msg of history) {
                // Kiểm tra cấu trúc tin nhắn trước khi render
                if (msg && msg.parts && msg.parts[0]) {
                    await this.appendMessageUI(msg);
                }
            }
        }
        this.renderSessionList();
    },

    appendMessageUI(msg) {
    return new Promise(resolve => {
        setTimeout(() => {
            const scroller = document.getElementById('chat-scroller');
            const row = document.createElement('div');
            row.className = `message-row ${msg.role === 'user' ? 'user-row' : 'bot-row'}`;
            
            let htmlContent = "";
            msg.parts.forEach(part => {
                if (part.text) {
                    // Nếu là Model thì dùng marked, User thì text thuần (hoặc tùy ông giáo)
                    htmlContent += msg.role === 'model' ? marked.parse(part.text) : `<div>${part.text}</div>`;
                }
                if (part.inline_data) {
                    // Hiển thị ảnh trực tiếp từ Base64
                    htmlContent += `<img src="data:${part.inline_data.mime_type};base64,${part.inline_data.data}" 
                                     style="max-width:200px; border-radius:8px; margin-top:5px; display:block;">`;
                }
            });

            const content = DOMPurify.sanitize(htmlContent);
            row.innerHTML = `<div class="bubble">${content}</div>`;
            
            scroller.appendChild(row);
            requestAnimationFrame(() => {
                row.classList.add('reveal');
                scroller.scrollTop = scroller.scrollHeight;
            });
            resolve();
        }, this.config.renderDelay);
    });
},

async generateAutoTitle(sessionId) {
    const session = this.state.sessions[sessionId];
    // Chỉ chạy khi có đúng 2 tin nhắn (User và Model)
    if (!session || session.history.length !== 2) return;

    try {
        const response = await fetch(this.config.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                messages: [
                    ...session.history,
                    { role: 'user', parts: [{ text: "Dựa trên nội dung trên, hãy đặt một tiêu đề ngắn gọn cho cuộc trò chuyện này, tối đa 7 từ. Chỉ trả về text tiêu đề, không thêm gì khác." }] }
                ] 
            })
        });

        if (response.ok) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullTitle = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const jsonStr = line.replace("data: ", "");
                        if (jsonStr === "[DONE]") break;
                        try {
                            const data = JSON.parse(jsonStr);
                            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (text) fullTitle += text;
                        } catch(e) {}
                    }
                }
            }
            
            if (fullTitle) {
                session.title = fullTitle.replace(/["']/g, '').trim();
                this.renderSessionList();
                this.saveState();
            }
        }
    } catch (e) {
        console.error("Lỗi đặt tiêu đề tự động:", e);
    }
},

async handleSend() {
    const input = document.getElementById('js-input');
    const text = input.value.trim();
    const imageBase64 = this.state.pendingImage;
    
    if ((!text && !imageBase64) || this.state.isTyping) return;

    this.state.isTyping = true;
    const session = this.state.sessions[this.state.currentSessionId];
    
    const welcome = document.querySelector('.welcome');
    if (welcome) welcome.remove();

    const userMsgParts = [];
    if (text) userMsgParts.push({ text: text });
    if (imageBase64) {
        const [mimeInfo, base64Data] = imageBase64.split(',');
        const mimeType = mimeInfo.match(/:(.*?);/)[1];
        userMsgParts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    }

    const userMsg = { role: 'user', parts: userMsgParts };
    session.history.push(userMsg);
    await this.appendMessageUI(userMsg);
    
    input.value = '';
    input.style.height = 'auto';
    this.state.pendingImage = null;
    document.getElementById('js-image-preview').style.display = 'none';

    const scroller = document.getElementById('chat-scroller');
    const row = document.createElement('div');
    row.className = 'message-row bot-row reveal typing';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    row.appendChild(bubble);
    scroller.appendChild(row);

    let fullText = "";
    let buffer = ""; 

    try {
        const response = await fetch(this.config.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: session.history })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let lines = buffer.split("\n");
            buffer = lines.pop(); 

            for (const line of lines) {
                if (!line.trim().startsWith("data: ")) continue;
                const jsonStr = line.replace("data: ", "");
                if (jsonStr === "[DONE]") break;
                try {
                    const data = JSON.parse(jsonStr);
                    const contentPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (contentPart) {
                        fullText += contentPart;
                        bubble.innerHTML = DOMPurify.sanitize(marked.parse(fullText));
                        scroller.scrollTop = scroller.scrollHeight;
                    }
                } catch (e) {}
            }
        }
        session.history.push({ role: 'model', parts: [{ text: fullText }] });
    } catch (err) {
        bubble.innerHTML = `<span style="color:var(--danger)">⚠️ Lỗi: ${err.message}</span>`;
    } finally {
        row.classList.remove('typing');
        this.state.isTyping = false;
        this.saveState();
        // Tự động kích hoạt tạo tiêu đề sau khi Bot trả lời xong tin đầu tiên
        if (session.history.length === 2) {
            this.generateAutoTitle(this.state.currentSessionId);
        }
    }
},
async exportSecure() {
    const session = this.state.sessions[this.state.currentSessionId];
    if (!session || !session.history.length) {
        Swal.fire({ icon: 'warning', title: 'Trống rỗng', text: 'Chưa có nội dung gì để share!', background: 'var(--bg)', color: 'var(--text)' });
        return;
    }

    const { value: pass } = await Swal.fire({
        title: 'Mã hóa cuộc trò chuyện',
        input: 'password',
        inputLabel: 'Đặt mật khẩu (Để trống nếu dùng mặc định)',
        inputPlaceholder: 'Nhập mật khẩu...',
        showCancelButton: true,
        confirmButtonColor: 'var(--p)',
        background: 'var(--bg)',
        color: 'var(--text)'
    });

    if (pass === undefined) return; 
    const finalPass = pass.trim() === "" ? "default" : pass;

    const shareBtn = document.getElementById('js-share-btn');
    const originalText = shareBtn.innerHTML;

    try {
        const payload = { t: session.title, h: session.history };
        const jsonStr = JSON.stringify(payload);
        const encryptedData = await this.crypto.encryptData(jsonStr, finalPass);

        const encoder = new TextEncoder();
        const mStart = encoder.encode(this.config.magicStart);
        const mEnd = encoder.encode(this.config.magicEnd);
        const version = new Uint8Array([this.config.version]);

        const finalFile = new Uint8Array(mStart.length + version.length + encryptedData.length + mEnd.length);
        finalFile.set(mStart, 0);
        finalFile.set(version, mStart.length);
        finalFile.set(encryptedData, mStart.length + version.length);
        finalFile.set(mEnd, mStart.length + version.length + encryptedData.length);

        const fileName = `NoobChat_${Date.now()}.abcsnoobai`;
        const fileBlob = new Blob([finalFile], { type: 'application/octet-stream' });

        // --- BẮT ĐẦU: TỰ ĐỘNG TẢI FILE VỀ MÁY ---
        const downloadUrl = URL.createObjectURL(fileBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl); // Giải phóng bộ nhớ
        // --- KẾT THÚC: TẢI FILE ---

        shareBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
        shareBtn.disabled = true;

        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', fileBlob, fileName);

        const response = await fetch(`${this.config.apiEndpoint}/upload-catbox`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error("Upload thất bại!");

        const catboxUrl = await response.text();
        const fileCode = catboxUrl.split('/').pop().replace('.abcsnoobai', '');
        const shareLink = `${window.location.origin}${window.location.pathname}?url=${encodeURIComponent(catboxUrl.trim())}`;

        const scroller = document.getElementById('chat-scroller');
        const row = document.createElement('div');
        row.className = 'message-row bot-row reveal';
        row.innerHTML = `
        <div class="bubble" style="width: 100%; max-width: 400px;">
            <div style="background:var(--surface); border:1px solid var(--p); border-radius:12px; padding:16px;">
                <h4 style="color:var(--p); margin:0 0 10px 0;">Xuất dữ liệu thành công!</h4>
                <div style="font-size:12px; margin-bottom:10px; color:var(--text-muted);">
                    <i class="fa-solid fa-file-download"></i> File đã được tải về máy của bạn.
                </div>
                <div style="font-size:12px; margin-bottom:10px;">Mã Code Cloud: <b>${fileCode}</b></div>
                <input type="text" value="${shareLink}" readonly style="width:100%; background:var(--bg); color:var(--text); border:1px solid var(--border); padding:5px; border-radius:4px; font-size:11px; margin-bottom:10px;">
                <button onclick="window.open('${catboxUrl.trim()}', '_blank')" style="width:100%; padding:8px; border-radius:6px; background:var(--p); color:#fff; border:none; cursor:pointer; font-size:12px;">
                    <i class="fa-solid fa-cloud-download"></i> Tải lại từ Cloud
                </button>
            </div>
        </div>`;
        scroller.appendChild(row);
        scroller.scrollTop = scroller.scrollHeight;

    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Lỗi', text: err.message, background: 'var(--bg)', color: 'var(--text)' });
    } finally {
        shareBtn.innerHTML = originalText;
        shareBtn.disabled = false;
    }
},

    // Hàm bổ trợ để copy nhanh
    copyToClipboard(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            const icon = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check" style="color: var(--success)"></i>';
            setTimeout(() => { btn.innerHTML = icon; }, 2000);
        });
    },

async importSecure(directSource = null) {
        // Nếu chọn file từ máy, xử lý luôn không hiện Modal
        if (directSource instanceof File) {
            return await this.processImport(directSource);
        }

        // Xóa cái modal cũ nếu lỡ nó còn tồn tại
        const oldModal = document.getElementById('js-noob-import-portal');
        if (oldModal) oldModal.remove();

        const modalHTML = `
            <div id="js-noob-import-portal" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; z-index:99999;">
                <div style="width:90%; max-width:380px; background:var(--bg); border:1px solid var(--p); padding:24px; border-radius:16px; box-shadow: 0 0 30px var(--p-glow); display:block !important;">
                    <h3 style="margin-top:0; font-family:'Space Grotesk'; color:var(--p); display:flex; align-items:center; gap:10px;">
                        <i class="fa-solid fa-file-import"></i> Cổng Nhập Dữ Liệu
                    </h3>
                    
                    <div style="margin-bottom:20px;">
                        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:8px; letter-spacing:1px; font-weight:bold;">NHẬP MÃ CODE CATBOX</label>
                        <div style="display:flex; gap:8px;">
                            <input type="text" id="js-import-code-input" placeholder="Ví dụ: abcxyz" 
                                   style="flex:1; background:var(--surface); border:1px solid var(--border); color:var(--text); padding:10px; border-radius:8px; outline:none; font-size:13px;">
                            <button class="cyber-btn" id="js-submit-code-btn" style="white-space:nowrap;">Kéo về</button>
                        </div>
                    </div>

                    <div style="text-align:center; margin-bottom:20px; position:relative;">
                        <hr style="border:0; border-top:1px solid var(--border);">
                        <span style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:var(--bg); padding:0 10px; color:var(--text-muted); font-size:11px;">HOẶC</span>
                    </div>

                    <button class="cyber-btn w-100" id="js-import-local-btn" style="justify-content:center; padding:12px; background:var(--p-glow); margin-bottom:12px;">
                        <i class="fa-solid fa-hard-drive"></i> Chọn file từ máy tính
                    </button>

                    <button class="cyber-btn w-100" style="border:none; background:transparent; color:var(--text-muted); justify-content:center;" 
                            onclick="document.getElementById('js-noob-import-portal').remove()">Hủy bỏ</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // BIND EVENT CHO MODAL
        const localBtn = document.getElementById('js-import-local-btn');
        const fileInput = document.getElementById('js-file-hidden');

        if (localBtn && fileInput) {
            localBtn.onclick = () => fileInput.click();
        }

        // Xử lý nút "Kéo về"
        document.getElementById('js-submit-code-btn').onclick = () => {
            let code = document.getElementById('js-import-code-input').value.trim();
            if (!code) return alert("Nhập code Catbox đi ông giáo!");

            // Tự động thêm đuôi nếu người dùng chỉ nhập code
            if (!code.endsWith('.abcsnoobai')) code += '.abcsnoobai';

            const catboxUrl = `https://files.catbox.moe/${code}`;
            const redirectUrl = `https://abcsnoob.github.io/chat/chat-iframe.html?url=${encodeURIComponent(catboxUrl)}`;

            // Chuyển hướng hoặc xử lý trực tiếp tùy logic của bạn
            window.location.href = redirectUrl;
        };
    }, // Đã thêm dấu đóng ngoặc và phẩy ở đây

async processImport(source) {
    let buffer;
    try {
        if (source instanceof File) {
            buffer = await source.arrayBuffer();
        } else if (typeof source === 'string' && source.trim() !== "") {
            let targetUrl = source.trim();
            if (!targetUrl.startsWith('http')) {
                if (!targetUrl.endsWith('.abcsnoobai')) targetUrl += '.abcsnoobai';
                targetUrl = `https://files.catbox.moe/${targetUrl}`;
            }
            const response = await fetch(`${this.config.apiEndpoint}/upload-catbox?get=${encodeURIComponent(targetUrl)}`);
            if (!response.ok) throw new Error("Mã code sai hoặc file không tồn tại.");
            buffer = await response.arrayBuffer();
        } else { return; }

        const data = new Uint8Array(buffer);
        const textDecoder = new TextDecoder();
        const mStartLen = new TextEncoder().encode(this.config.magicStart).length;
        const mEndLen = new TextEncoder().encode(this.config.magicEnd).length;

        if (textDecoder.decode(data.slice(0, mStartLen)) !== this.config.magicStart) {
            throw new Error("File không đúng định dạng NoobEngine!");
        }

        // --- BẮT ĐẦU: HIỂN THỊ Ô NHẬP PASSWORD CÓ NÚT SHOW/HIDE ---
        const { value: pass } = await Swal.fire({
            title: 'Mở khóa dữ liệu',
            input: 'password',
            inputLabel: 'Nhập mật khẩu để giải mã',
            inputPlaceholder: 'Mật khẩu...',
            showCancelButton: true,
            confirmButtonColor: 'var(--p)',
            background: 'var(--bg)',
            color: 'var(--text)',
            confirmButtonText: 'Giải mã',
            cancelButtonText: 'Hủy',
            // Thêm nút con mắt để xem mật khẩu
            didOpen: () => {
                const input = Swal.getInput();
                const container = input.parentElement;
                container.style.position = 'relative';
                
                const eye = document.createElement('i');
                eye.className = 'fa-solid fa-eye';
                eye.style.cssText = `
                    position: absolute; right: 15px; top: 50%; 
                    transform: translateY(-50%); cursor: pointer; 
                    color: var(--p); z-index: 10;
                `;
                
                eye.onclick = () => {
                    if (input.type === 'password') {
                        input.type = 'text';
                        eye.className = 'fa-solid fa-eye-slash';
                    } else {
                        input.type = 'password';
                        eye.className = 'fa-solid fa-eye';
                    }
                };
                container.appendChild(eye);
            }
        });

        if (pass === undefined) return;
        const finalPass = pass.trim() === "" ? "default" : pass;

        const encryptedPart = data.slice(mStartLen + 1, data.length - mEndLen);
        const decryptedJSON = await this.crypto.decryptData(encryptedPart, finalPass);
        
        const payload = JSON.parse(decryptedJSON);
        const history = payload.h ? payload.h : (Array.isArray(payload) ? payload : []);
        const title = payload.t ? payload.t : "Imported Chat";

        const newId = Date.now().toString();
        this.state.sessions[newId] = { title, history, created: newId };
        
        await this.switchSession(newId);
        this.saveState();

        if (document.getElementById('js-noob-import-portal')) {
            document.getElementById('js-noob-import-portal').remove();
        }

        // --- HIỂN THỊ THÔNG BÁO THÀNH CÔNG VỚI NÚT OK ---
        Swal.fire({ 
            icon: 'success', 
            title: 'Thành công', 
            text: `Đã mở cuộc trò chuyện: ${title}`, 
            showConfirmButton: true, // Hiện nút OK
            confirmButtonText: 'Tuyệt vời',
            confirmButtonColor: 'var(--p)',
            background: 'var(--bg)', 
            color: 'var(--text)' 
        });

    } catch (err) {
        Swal.fire({ 
            icon: 'error', 
            title: 'Lỗi giải mã', 
            text: err.message.includes("decryption") || err.message.includes("Padding") ? "Mật khẩu không chính xác!" : err.message,
            background: 'var(--bg)',
            color: 'var(--text)'
        });
    }
},

async importFromUrl(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Không thể tải file từ URL.");
            const blob = await response.blob();
            const file = new File([blob], "shared_chat.abcsnoobai");
            
            // Gọi lại hàm giải mã có sẵn
            await this.importSecure(file);
            
            // Xóa tham số trên thanh địa chỉ để tránh lặp lại khi F5
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
            console.error("Lỗi tải file:", err);
            alert("Không thể tự động nhập file: " + err.message);
            this.createNewSession();
        }
    },

    // --- 6. DOM EVENTS ---
    bindGlobalEvents() {
        // Toggle Sidebar
        document.getElementById('js-toggle-sidebar').onclick = () => {
            this.state.sidebarOpen = !this.state.sidebarOpen;
            document.getElementById('sidebar').classList.toggle('collapsed');
        };

        // Send Msg
        document.getElementById('js-send-btn').onclick = () => this.handleSend();
        document.getElementById('js-input').onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        };
        // Xử lý chọn ảnh
document.getElementById('js-image-btn').onclick = () => document.getElementById('js-image-hidden').click();

document.getElementById('js-image-hidden').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (f) => {
            document.getElementById('js-preview-img').src = f.target.result;
            document.getElementById('js-image-preview').style.display = 'block';
            this.state.pendingImage = f.target.result; // Lưu vào state tạm thời
        };
        reader.readAsDataURL(file);
    }
};

document.getElementById('js-remove-img').onclick = () => {
    this.state.pendingImage = null;
    document.getElementById('js-image-preview').style.display = 'none';
    document.getElementById('js-image-hidden').value = '';
};
        // Auto resize textarea
        document.getElementById('js-input').oninput = (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
            if (/gemini/i.test(e.target.value)) document.body.classList.add('gemini-mode');
        };

        // Actions
        document.getElementById('js-new-btn').onclick = () => this.createNewSession();
        document.getElementById('js-share-btn').onclick = () => {
    NoobEngine.exportSecure();
};

       document.getElementById('js-import-btn').onclick = () => this.importSecure();
        document.getElementById('js-file-hidden').onchange = (e) => this.importSecure(e.target.files[0]);

        // Settings Modal
        document.getElementById('js-settings-btn').onclick = () => {
            document.getElementById('js-modal-overlay').style.display = 'flex';
            document.getElementById('js-modal').style.display = 'block';
        };
        document.getElementById('js-close-modal').onclick = () => {
            document.getElementById('js-modal-overlay').style.display = 'none';
            document.getElementById('js-modal').style.display = 'none';
        };

        document.getElementById('js-theme-toggle').onclick = (e) => {
            this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
            document.getElementById('app-container').setAttribute('data-theme', this.state.theme);
            e.target.innerText = this.state.theme === 'dark' ? 'Dark' : 'Light';
            localStorage.setItem('noob_theme', this.state.theme);
        };

document.getElementById('js-reset-btn').onclick = async () => {
    const result = await Swal.fire({
        title: 'Xóa sạch bách?',
        text: "Mọi hội thoại và cài đặt sẽ bị xóa sạch!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f85149',
        confirmButtonText: 'Reset toàn bộ',
        background: 'var(--bg)',
        color: 'var(--text)'
    });
    if (result.isConfirmed) {
        localforage.clear().then(() => location.reload());
    }
};
    },

    renderSessionList() {
        const container = document.getElementById('js-session-list');
        container.innerHTML = '';
        
        Object.keys(this.state.sessions).sort((a,b) => b-a).forEach(id => {
            const sess = this.state.sessions[id];
            const div = document.createElement('div');
            div.className = `session-item ${id == this.state.currentSessionId ? 'active' : ''}`;
            div.innerHTML = `
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80%">
                    <i class="fa-regular fa-comment-dots me-2"></i> ${sess.title}
                </span>
                <i class="fa-solid fa-xmark del-btn" data-id="${id}"></i>
            `;
            
            div.onclick = (e) => {
                if (e.target.classList.contains('del-btn')) {
                    this.deleteSession(id);
                } else {
                    this.switchSession(id);
                }
            };
            container.appendChild(div);
        });
    },

async deleteSession(id) {
    const result = await Swal.fire({
        title: 'Xóa hội thoại?',
        text: "Dữ liệu này sẽ biến mất mãi mãi!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--danger)',
        confirmButtonText: 'Xóa ngay',
        cancelButtonText: 'Hủy',
        background: 'var(--bg)',
        color: 'var(--text)'
    });
    if (result.isConfirmed) {
        delete this.state.sessions[id];
        const remaining = Object.keys(this.state.sessions);
        if (remaining.length) {
            this.switchSession(remaining[0]);
        } else {
            this.createNewSession();
        }
        this.saveState();
    }
},

    saveState() {
        localforage.setItem('noob_sessions_v4', this.state.sessions);
    }
};

// Khởi chạy khi Window Load
window.addEventListener('DOMContentLoaded', () => NoobEngine.init());





