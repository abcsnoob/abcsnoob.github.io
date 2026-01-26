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
        this.styles.inject();
        this.renderBaseUI();
        
        // Load data from LocalForage
        const saved = await localforage.getItem('noob_sessions_v4');
        if (saved) {
            this.state.sessions = saved;
            const lastId = Object.keys(saved).sort((a,b) => b-a)[0];
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
                                <span style="font-size: 11px; opacity: 0.4;"><i class="fa-solid fa-lock"></i> AES-GCM 256-BIT</span>
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
                
                const content = msg.role === 'model' ? marked.parse(msg.parts[0].text) : msg.parts[0].text;
                row.innerHTML = `<div class="bubble">${content}</div>`;
                
                scroller.appendChild(row);
                
                // Trigger animation
                requestAnimationFrame(() => {
                    row.classList.add('reveal');
                    scroller.scrollTop = scroller.scrollHeight;
                });
                
                resolve();
            }, this.config.renderDelay);
        });
    },

async handleSend() {
    const input = document.getElementById('js-input');
    const text = input.value.trim();
    
    // Chặn nếu đang gửi hoặc không có chữ
    if (!text || this.state.isTyping) return;

    this.state.isTyping = true;
    const session = this.state.sessions[this.state.currentSessionId];
    
    // Xóa màn hình chào nếu đây là tin nhắn đầu tiên
    const welcome = document.querySelector('.welcome');
    if (welcome) welcome.remove();

    // 1. Đẩy tin nhắn của User lên UI
    const userMsg = { role: 'user', parts: [{ text }] };
    session.history.push(userMsg);
    await this.appendMessageUI(userMsg);
    
    // Reset ô input
    input.value = '';
    input.style.height = 'auto';

    // 2. Tạo khung chứa cho Bot (với hiệu ứng typing)
    const scroller = document.getElementById('chat-scroller');
    const row = document.createElement('div');
    row.className = 'message-row bot-row reveal typing'; // Thêm class typing để hiện con trỏ
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    row.appendChild(bubble);
    scroller.appendChild(row);

    let fullText = "";

    try {
        const response = await fetch(this.config.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                messages: session.history // Gửi kèm lịch sử để Bot nhớ persona
            })
        });

        if (!response.ok) throw new Error("Server Noob đang bận PvP, thử lại sau nhé!");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // 3. Vòng lặp đọc Stream cực mạnh
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Giải mã chunk nhận được
            const chunk = decoder.decode(value, { stream: true });
            
            // Tách các dòng bắt đầu bằng "data: "
            const lines = chunk.split("\n");
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

                const jsonStr = trimmedLine.replace("data: ", "");
                if (jsonStr === "[DONE]") break;

                try {
                    const data = JSON.parse(jsonStr);
                    // Truy xuất text từ cấu trúc của Gemini API
                    if (data.candidates && data.candidates[0].content.parts[0].text) {
                        const newText = data.candidates[0].content.parts[0].text;
                        fullText += newText;

                        // Render Markdown và cuộn xuống
                        bubble.innerHTML = marked.parse(fullText);
                        scroller.scrollTop = scroller.scrollHeight;
                    }
                } catch (e) {
                    console.error("Lỗi parse gói tin:", e);
                }
            }
        }

        // Lưu tin nhắn Bot vào lịch sử sau khi stream xong
        session.history.push({ role: 'model', parts: [{ text: fullText }] });

    } catch (err) {
        bubble.innerHTML = `<span style="color:var(--danger)">⚠️ Lỗi hệ thống: ${err.message}</span>`;
    } finally {
        row.classList.remove('typing'); // Tắt con trỏ nhấp nháy
        this.state.isTyping = false;
        this.saveState();
    }
},
    // --- 5. EXPORT/IMPORT WITH 300K HASHING ---
async exportSecure() {
    const pass = prompt("Nhập mật khẩu khóa file (300k iterations):");
    if (!pass) return;

    const session = this.state.sessions[this.state.currentSessionId];
    const plainText = JSON.stringify(session.history);
    
    try {
        const encrypted = await this.crypto.encryptData(plainText, pass); //
        const encoder = new TextEncoder();
        const mStart = encoder.encode(this.config.magicStart);
        const mEnd = encoder.encode(this.config.magicEnd);
        const version = new Uint8Array([this.config.version]);

        // Đóng gói chuẩn xác: Start + Version + Data + End
        const fileBlob = new Blob([mStart, version, encrypted, mEnd], { type: 'application/octet-stream' });

        const url = URL.createObjectURL(fileBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `secure_chat_${Date.now()}.abcsnoobai`;
        link.click();
        alert("Đã xuất file! Lần sau nhớ nhập đúng '12345' nhé 🐧");
    } catch (e) {
        alert("Export lỗi rồi ông giáo ạ!");
    }
},

async importSecure(file) {
    const pass = prompt("Nhập mật khẩu giải mã:");
    if (!pass) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const buffer = new Uint8Array(e.target.result);
            const decoder = new TextDecoder();
            const encoder = new TextEncoder();
            
            const mStartLen = encoder.encode(this.config.magicStart).length;
            const mEndLen = encoder.encode(this.config.magicEnd).length;

            // Kiểm tra Magic Bytes đầu file
            const mCheck = decoder.decode(buffer.slice(0, mStartLen));
            if (mCheck !== this.config.magicStart) throw new Error("File không đúng định dạng Noob Engine!");

            // Cắt phần Encrypted chính xác tuyệt đối
            // Vị trí: Bỏ qua Start (mStartLen) và Version (1 byte)
            const encryptedPart = buffer.slice(mStartLen + 1, buffer.length - mEndLen);

            // Giải mã với 300k vòng băm
            const decryptedJSON = await this.crypto.decryptData(encryptedPart, pass);
            const history = JSON.parse(decryptedJSON);

            const id = Date.now();
            this.state.sessions[id] = {
                title: "📥 Đã khôi phục " + new Date().toLocaleTimeString(),
                history: history,
                created: id
            };
            
            await this.switchSession(id);
            this.saveState();
            alert("Giải mã thành công! Hú hồn chưa?");
        } catch (err) {
            console.error(err);
            alert("Lỗi: Sai mật khẩu hoặc file đã bị 'gank' (hỏng)!");
        }
    };
    reader.readAsArrayBuffer(file);
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
        
        // Auto resize textarea
        document.getElementById('js-input').oninput = (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
            if (/gemini/i.test(e.target.value)) document.body.classList.add('gemini-mode');
        };

        // Actions
        document.getElementById('js-new-btn').onclick = () => this.createNewSession();
        document.getElementById('js-share-btn').onclick = () => this.exportSecure();
        document.getElementById('js-import-btn').onclick = () => document.getElementById('js-file-hidden').click();
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

        document.getElementById('js-reset-btn').onclick = () => {
            if (confirm("Mọi dữ liệu sẽ bị bốc hơi. Chắc chứ?")) {
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

    deleteSession(id) {
        if (confirm("Xóa đoạn hội thoại này?")) {
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
