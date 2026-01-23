const NoobEngine = {
    state: {
        history: [],
        isTyping: false,
        theme: localStorage.getItem('noob_theme') || 'dark',
        sidebarOpen: window.innerWidth > 992,
    },

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --bg: #05070a; --side: #0d1117; --p: #00d2ff; --text: #e1e6ed;
                --text-dim: #8b949e; --border: rgba(255, 255, 255, 0.1);
                --glass: rgba(255, 255, 255, 0.05); --input-bg: #0d1117;
                --shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            }
            [data-theme="light"] {
                --bg: #ffffff; --side: #f1f3f5; --p: #007aff; --text: #1a1a1a;
                --text-dim: #4a4a4a; --border: #d1d5da; --glass: #e9ecef;
                --input-bg: #ffffff; --shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            }
            body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; transition: 0.3s; overflow: hidden; }
            #app { display: flex; height: 100vh; width: 100vw; background: var(--bg); }

            /* --- SIDEBAR --- */
            #sidebar { width: 300px; background: var(--side); border-right: 1px solid var(--border); display: flex; flex-direction: column; transition: 0.3s; z-index: 1000; }
            #sidebar.collapsed { transform: translateX(-300px); position: absolute; height: 100%; }
            .sidebar-header { padding: 30px 20px; text-align: center; }
            .sidebar-header h4 { color: var(--text) !important; }
            .logo-badge { background: var(--p); color: white; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px; display: inline-block; margin-top: 5px; }

            .sidebar-content { padding: 0 15px; display: flex; flex-direction: column; gap: 10px; }
            .btn-main { padding: 12px; border-radius: 12px; font-weight: 700; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
            .btn-new { background: var(--p); color: white; }
            .btn-delete { background: rgba(255, 69, 58, 0.1) !important; color: #ff453a !important; border: 1px solid rgba(255, 69, 58, 0.2) !important; }
            
            .sidebar-footer { margin-top: auto; padding: 20px; display: flex; gap: 10px; border-top: 1px solid var(--border); }
            .btn-action-small { flex: 1; background: var(--glass); border: 1px solid var(--border); color: var(--text); padding: 12px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }

            /* --- CHAT AREA --- */
            #main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg); position: relative; }
            .header { height: 60px; padding: 0 25px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); background: var(--bg); }
            #chat-window { flex: 1; overflow-y: auto; padding: 40px 15%; background: var(--bg); }
            
            .bubble { max-width: 85%; padding: 14px 20px; border-radius: 18px; line-height: 1.6; border: 1px solid var(--border); transition: 0.3s; word-wrap: break-word; }
            /* Markdown Styles */
            .bubble pre { background: #1e1e1e; padding: 10px; border-radius: 8px; overflow-x: auto; color: #fff; }
            .bubble code { font-family: monospace; background: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 4px; }
            
            .user .bubble { background: var(--p); color: white !important; border: none; }
            .bot .bubble { background: var(--glass); color: var(--text) !important; }
            .msg { margin-bottom: 25px; display: flex; flex-direction: column; animation: fadeInUp 0.4s ease forwards; }
            .msg.user { align-items: flex-end; }

            /* --- INPUT --- */
            .input-zone { padding: 20px 15% 40px; background: var(--bg); }
            .input-box { background: var(--input-bg); border: 2px solid var(--border); border-radius: 24px; padding: 12px 20px; display: flex; align-items: flex-end; gap: 15px; box-shadow: var(--shadow); }
            textarea { flex: 1; background: transparent; border: none; color: var(--text); outline: none; resize: none; font-size: 16px; padding: 8px 0; max-height: 200px; }

            /* --- ANIMATIONS & EGGS --- */
            #drop-overlay { position: absolute; inset: 0; background: rgba(0, 210, 255, 0.1); border: 4px dashed var(--p); z-index: 9999; display: none; align-items: center; justify-content: center; backdrop-filter: blur(8px); font-size: 20px; font-weight: 800; color: var(--p); pointer-events: none; }
            .java-jumpscare { position: fixed; inset: 0; background: url('https://dev.java/assets/images/java-logo-vert-dark.png') center/contain no-repeat, #000; z-index: 10000; display: flex; align-items: center; justify-content: center; animation: shake 0.1s infinite; }
            @keyframes shake { 0% { transform: translate(5px, 5px); } 50% { transform: translate(-5px, -5px); } 100% { transform: translate(0, 0); } }
            .gemini-mode { animation: rainbow 2s linear infinite !important; }
            @keyframes rainbow { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        `;
        document.head.appendChild(style);
    },

    render() {
        const root = document.getElementById('app');
        root.setAttribute('data-theme', this.state.theme);
        root.innerHTML = `
            <aside id="sidebar" class="${!this.state.sidebarOpen ? 'collapsed' : ''}">
                <div class="sidebar-header">
                    <h4 class="fw-bold m-0">NOOB <span style="color:var(--p)">AI</span></h4>
                    <div class="logo-badge">PRO WORKSPACE</div>
                </div>
                <div class="sidebar-content">
                    <button class="btn-main btn-new" onclick="location.reload()"><i class="fa-solid fa-plus"></i> NEW CHAT</button>
                    <button class="btn-main btn-delete" onclick="NoobEngine.clearChat()"><i class="fa-solid fa-trash-can"></i> CLEAR CHAT</button>
                </div>
                <div class="flex-grow-1 overflow-auto p-2" id="chat-list"></div>
                <div class="sidebar-footer">
                    <button class="btn-action-small" onclick="NoobEngine.toggleTheme()"><i class="fa-solid fa-circle-half-stroke"></i></button>
                    <button class="btn-action-small" onclick="NoobEngine.exportHistory()"><i class="fa-solid fa-file-export"></i></button>
                </div>
            </aside>
            <main id="main">
                <div id="drop-overlay">THẢ FILE ĐỂ LOAD DATA 📥</div>
                <header class="header">
                    <button class="btn-action-small" style="width:40px" onclick="NoobEngine.toggleSidebar()"><i class="fa-solid fa-bars-staggered"></i></button>
                    <div class="d-flex align-items-center gap-2">
                        <small id="model-status" class="opacity-50">System Stable</small>
                        <div id="status-indicator" style="width:10px; height:10px; background:#00ff88; border-radius:50%"></div>
                    </div>
                </header>
                <div id="chat-window">
                    <div class="welcome-msg text-center mt-5">
                        <h1 class="display-4 fw-bold">Noob <span style="color:var(--p)">AI</span></h1>
                        <p class="opacity-50">Code mượt như Sunsilk. Trứng phục sinh đang chờ ông giáo...</p>
                    </div>
                </div>
                <div class="input-zone">
                    <div class="input-box">
                        <button class="btn-action-small" style="background:none; border:none" onclick="document.getElementById('file-up').click()"><i class="fa-solid fa-paperclip"></i></button>
                        <input type="file" id="file-up" hidden onchange="NoobEngine.handleFileSelect(event)">
                        <textarea id="user-input" rows="1" placeholder="Nhập tin nhắn..."></textarea>
                        <button id="send-btn" class="btn-action-small" style="background:none; border:none"><i class="fa-solid fa-paper-plane fs-4 text-primary"></i></button>
                    </div>
                </div>
            </main>
        `;
    },

    bindEvents() {
        const input = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');

        input.addEventListener('input', (e) => {
            let val = e.target.value;
            let lowVal = val.toLowerCase();

            // --- 🥚 EASTER EGGS LOGIC (CHỨA TỪ) ---
            if (lowVal.includes('gemini')) document.body.classList.add('gemini-mode');
            
            if (lowVal.includes('never')) input.value = "Never gonna give you up, never gonna let you down";
            
            if (lowVal.includes('youtube')) input.value = "YouTube: Broadcast Yourself";
            
            if (lowVal.includes('roblox')) {
                input.value = Math.random() < 0.6 ? "Roblox: Powering Imagination" : "Roblox: Your safety is not our problem";
            }
            
            if (lowVal.includes('java')) {
                const scare = document.createElement('div');
                scare.className = 'java-jumpscare';
                scare.innerHTML = '<h1 style="color:white; font-size:8vw;">JAVA UPDATE AVAILABLE!!!</h1>';
                document.body.appendChild(scare);
                setTimeout(() => scare.remove(), 2000);
                input.value = '';
            }

            if (lowVal.includes('matrix')) {
                document.body.style.filter = 'contrast(1.2) brightness(1.1) sepia(1) hue-rotate(60deg)';
                document.body.style.fontFamily = '"Courier New", monospace';
                input.value = "Follow the white rabbit...";
            }

            if (lowVal.includes('gravity')) {
                const main = document.getElementById('main');
                main.style.transition = 'transform 1s cubic-bezier(0.47, 0, 0.745, 0.715)';
                main.style.transform = 'translateY(100vh) rotate(10deg)';
                setTimeout(() => {
                    alert("Toang! Giao diện sập rồi ông giáo.");
                    main.style.transform = 'none';
                }, 2000);
                input.value = '';
            }

            if (lowVal.includes('thanos')) {
                const bubbles = document.querySelectorAll('.bubble');
                bubbles.forEach((b, i) => {
                    setTimeout(() => {
                        b.style.transition = '2s';
                        b.style.opacity = '0';
                        b.style.filter = 'blur(10px)';
                        b.style.transform = 'translateY(-20px) rotate(5deg)';
                    }, i * 100);
                });
                input.value = "I don't feel so good...";
            }

            if (lowVal.includes('roll')) {
                document.body.style.transition = '2s';
                document.body.style.transform = 'rotate(360deg)';
                setTimeout(() => { document.body.style.transform = 'none'; }, 2000);
                input.value = '';
            }

            if (lowVal.includes('rickroll')) {
                window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank');
                input.value = "You've been Rickrolled!";
            }

            if (lowVal.includes('backrooms') || lowVal.includes('bkr')) {
                const overlay = document.createElement('div');
                overlay.style = `position: fixed; inset: 0; z-index: 99999; background: url('https://i.imgur.com/39D6JzS.jpeg') center/cover; filter: sepia(0.5) contrast(1.2) brightness(0.8); display: flex; align-items: center; justify-content: center; flex-direction: column; color: #222; font-family: 'serif'; text-shadow: 0 0 10px rgba(0,0,0,0.5);`;
                overlay.innerHTML = `<div style="background: rgba(255,255,255,0.1); padding: 20px; backdrop-filter: blur(5px); text-align:center;"><h1 style="font-size: 3rem; margin:0;">LEVEL 0</h1><p style="font-weight: bold;">If you're not careful and you noclip out of reality...</p></div><audio autoplay loop><source src="https://www.soundboard.com/handler/Downloadaudio.ashx?id=614332" type="audio/mpeg"></audio>`;
                document.body.appendChild(overlay);
                setTimeout(() => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 1000); }, 5000);
                input.value = '';
            }

            if (lowVal.includes('jerry')) {
                for (let i = 0; i < 15; i++) {
                    const bird = document.createElement('div');
                    bird.innerHTML = '🐦';
                    bird.style = `position: fixed; bottom: -50px; left: ${Math.random() * 100}vw; font-size: 30px; z-index: 10001; transition: 3s linear; pointer-events: none; transform: rotate(${Math.random() * 360}deg);`;
                    document.body.appendChild(bird);
                    setTimeout(() => {
                        bird.style.transform = `translateY(-110vh) translateX(${Math.random() * 200 - 100}px) rotate(720deg)`;
                        setTimeout(() => bird.remove(), 3000);
                    }, 100);
                }
                input.value = "Jerry is everything. Jerry is all.";
                const status = document.getElementById('model-status');
                status.innerText = "Praise Jerry 🛐"; status.style.color = "#00acee";
            }

            if (lowVal.includes('nyan')) {
                const nyan = document.createElement('img');
                nyan.src = 'https://static.wikia.nocookie.net/nyancat/images/b/b1/Acb1f0fd64578c46239226a06fd0b13e.gif';
                nyan.style = `position: fixed; left: -200px; top: ${Math.random() * 80}vh; z-index: 10001; width: 150px; transition: 4s linear;`;
                document.body.appendChild(nyan);
                setTimeout(() => { nyan.style.left = '110vw'; setTimeout(() => nyan.remove(), 4000); }, 100);
                input.value = "Nyan nyan nyan nyan...";
            }

            if (lowVal.includes('overclock')) {
                document.body.style.animation = 'shake 0.1s infinite';
                document.getElementById('model-status').innerText = "CRITICAL: CPU 105°C 🔥";
                document.getElementById('status-indicator').style.background = "#ff0000";
                setTimeout(() => {
                    document.body.style.animation = 'none';
                    document.getElementById('model-status').innerText = "System Cooled Down";
                    document.getElementById('status-indicator').style.background = "#00ff88";
                }, 3000);
                input.value = '';
            }

            if (lowVal.includes('peter') || lowVal.includes('spidey')) {
                const main = document.getElementById('main');
                main.style.transition = 'transform 1s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                main.style.transformOrigin = 'top center';
                main.style.transform = 'rotate(180deg)';
                input.value = "With great power comes great responsibility.";
                setTimeout(() => { main.style.transform = 'none'; }, 5000);
            }

            if (lowVal.includes('vanish')) {
                const bubbles = document.querySelectorAll('.bubble');
                bubbles.forEach(b => {
                    b.style.transition = '0.5s'; b.style.transform = 'scale(0)'; b.style.opacity = '0';
                });
                input.value = "Phù... Biến mất hết rồi!";
                setTimeout(() => { bubbles.forEach(b => { b.style.transform = 'scale(1)'; b.style.opacity = '1'; }); }, 3000);
            }

            if (lowVal.includes('donate') || lowVal.includes('money')) {
                input.value = "Đang quét ví Momo của ông giáo... Đùa thôi, cho Noob AI xin cốc cafe nhé! ☕";
                const btn = document.querySelector('.btn-new');
                btn.innerText = "☕ BUY COFFEE"; btn.style.background = "#ffdd00"; btn.style.color = "#000";
                setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-plus"></i> NEW CHAT'; btn.style = ""; }, 5000);
            }

            if (lowVal.includes('windows') || lowVal.includes('bsod') || lowVal.includes('error')) {
                const bsod = document.createElement('div');
                bsod.style = `position: fixed; inset: 0; z-index: 999999; background: #0078d7; color: white; font-family: 'Segoe UI', Tahoma, sans-serif; padding: 10% 15%; cursor: none;`;
                bsod.innerHTML = `<div style="font-size: 120px; line-height: 1;">:(</div><h2 style="font-weight: 300; margin-top: 30px; font-size: 30px;">Your PC ran into a problem and needs to restart.</h2><div style="font-size: 25px; margin-top: 20px;"><span id="progress-val">0</span>% complete</div>`;
                document.body.appendChild(bsod);
                let prog = 0;
                const interval = setInterval(() => {
                    prog += Math.floor(Math.random() * 15);
                    if (prog >= 100) { prog = 100; clearInterval(interval); setTimeout(() => bsod.remove(), 1000); }
                    document.getElementById('progress-val').innerText = prog;
                }, 400);
                input.value = '';
            }

            if (lowVal.includes('duo') || lowVal.includes('duolingo')) {
                const duo = document.createElement('div');
                duo.style = `position: fixed; bottom: -300px; right: 20px; z-index: 10002; transition: 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor: pointer;`;
                duo.innerHTML = `<img src="https://ih1.redbubble.net/image.5720296720.6258/flat,750x,075,f-pad,750x1000,f8f8f8.webp" style="width: 200px;"><div id="duo-bubble" style="position: absolute; top: -40px; left: -50px; background: white; color: black; padding: 10px; border-radius: 15px; border: 2px solid #58cc02; font-weight: bold; opacity:0;">Học bài đi! 🔪</div>`;
                document.body.appendChild(duo);
                setTimeout(() => { duo.style.bottom = '20px'; setTimeout(() => document.getElementById('duo-bubble').style.opacity='1', 800); }, 100);
                duo.onclick = () => { duo.style.transform = 'scale(0)'; setTimeout(() => duo.remove(), 500); };
                input.value = "Spanish or Vanish?";
            }

            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        });

        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend(); } });
        sendBtn.onclick = () => this.handleSend();
    },

    async handleSend() {
        const input = document.getElementById('user-input');
        const text = input.value.trim();
        if (!text || this.state.isTyping) return;

        this.state.isTyping = true;
        document.querySelector('.welcome-msg')?.remove();
        
        const userMsg = { role: 'user', parts: [{text}], time: new Date().toLocaleTimeString() };
        this.state.history.push(userMsg);
        this.renderMessage(userMsg);
        
        input.value = ''; input.style.height = 'auto';

        const botMsg = { role: 'model', parts: [{text: ''}], time: new Date().toLocaleTimeString() };
        const botDiv = this.renderMessage(botMsg);
        const bubble = botDiv.querySelector('.bubble');

        try {
            const response = await fetch('https://abcsnoobai.abcsnoob.workers.dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: this.state.history.slice(-15) })
            });
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '', buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.trim().startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.replace('data: ', ''));
                        fullText += data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        // SỬ DỤNG MARKED TẠI ĐÂY
                        bubble.innerHTML = marked.parse(fullText);
                        document.getElementById('chat-window').scrollTop = 999999;
                    } catch (e) {}
                }
            }
            botMsg.parts[0].text = fullText;
            this.state.history.push(botMsg);
            await localforage.setItem('noob_chat_history', this.state.history);
        } catch (err) { bubble.innerText = "Lỗi kết nối rồi ông giáo!"; }
        finally { this.state.isTyping = false; }
    },

    renderMessage(msg) {
        const win = document.getElementById('chat-window');
        const div = document.createElement('div');
        div.className = `msg ${msg.role === 'model' ? 'bot' : 'user'}`;
        
        // Render Markdown cho tin nhắn cũ từ history
        const content = msg.role === 'model' ? marked.parse(msg.parts[0].text) : msg.parts[0].text;
        
        div.innerHTML = `<div class="bubble">${content}</div><small style="opacity:0.3; font-size:10px; margin-top:5px">${msg.time}</small>`;
        win.appendChild(div);
        win.scrollTop = win.scrollHeight;
        return div;
    },

    toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); },
    toggleTheme() { 
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        document.getElementById('app').setAttribute('data-theme', this.state.theme);
        localStorage.setItem('noob_theme', this.state.theme);
    },
    async clearChat() { if (confirm("Xóa hết nhé?")) { await localforage.removeItem('noob_chat_history'); location.reload(); } },
    async init() { 
        this.injectStyles(); 
        this.render(); 
        this.bindEvents(); 
        const saved = await localforage.getItem('noob_chat_history'); 
        if (saved) { 
            this.state.history = saved; 
            document.querySelector('.welcome-msg')?.remove(); 
            saved.forEach(m => this.renderMessage(m)); 
        } 
    }
};

// Đảm bảo thư viện marked đã được load trước khi chạy
NoobEngine.init();
