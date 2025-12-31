(function() {
    // 1. CẤU HÌNH HỆ THỐNG
    const REDIRECT_PREFIX = "https://abcsnoob.github.io/go?to=";
    const CURRENT_DOMAIN = window.location.hostname;
    
    const supportedLangs = {
        "vi": "Tiếng Việt", "en": "English", "zh": "中文 (Zhōngwén)", "ja": "日本語 (Nihongo)",
        "ko": "한국어 (Hangugeo)", "fr": "Français", "de": "Deutsch", "es": "Español",
        "pt": "Português", "it": "Italiano", "ru": "Русский", "ar": "العربية",
        "hi": "हिन्दी", "th": "ไทย", "id": "Bahasa Indonesia", "ms": "Bahasa Melayu",
        "tr": "Türkçe", "nl": "Nederlands", "pl": "Polski", "sv": "Svenska",
        "da": "Dansk", "fi": "Suomi", "no": "Norsk", "cs": "Čeština",
        "el": "Ελληνικά", "he": "עبری", "ro": "Română", "hu": "Magyar",
        "uk": "Українська", "bg": "Български", "sk": "Slovenčina",
        "sl": "Slovenščina", "hr": "Hrvatski", "sr": "Српски", "fa": "فارسi", "bn": "বাংলা"
    };

    let targetLang = 'vi';

    const init = async () => {
        const params = new URLSearchParams(window.location.search);
        targetLang = params.get('lang') || localStorage.getItem('user_lang');

        if (!targetLang || !supportedLangs[targetLang]) {
            const browserLang = navigator.language.split('-')[0];
            targetLang = supportedLangs[browserLang] ? browserLang : 'vi';
        }
        localStorage.setItem('user_lang', targetLang);

        // Kích hoạt UI
        injectProfessionalDropdown(supportedLangs, targetLang);
        injectAIButton();
        setupTrollCopy(); 
        
        // Quét link ngay lập tức
        wrapExternalLinks();

        // Kích hoạt bộ máy quan sát (Observer)
        startMasterProcess();
    };

    // --- 2. LOGIC SAFETY URL (CHÈN TIỀN TỐ CHO LINK NGOÀI) ---
    function wrapExternalLinks() {
        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

            try {
                const targetUrl = new URL(link.href, window.location.origin);
                if (
                    (targetUrl.protocol === "http:" || targetUrl.protocol === "https:") &&
                    targetUrl.hostname !== CURRENT_DOMAIN &&
                    !href.startsWith(REDIRECT_PREFIX)
                ) {
                    link.href = REDIRECT_PREFIX + encodeURIComponent(link.href);
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                }
            } catch (e) {}
        });
    }

    // --- 3. LOGIC DỊCH THUẬT & QUAN SÁT THAY ĐỔI (OBSERVER) ---
    const startMasterProcess = async () => {
        if (targetLang !== 'vi') showTranslateToast(true);
        
        // Dịch toàn bộ trang hiện tại
        if (targetLang !== 'vi') await translateNewNodes(document.body);
        
        const observer = new MutationObserver((mutations) => {
            // Mỗi khi có nội dung mới: Cập nhật link an toàn & dịch text
            wrapExternalLinks(); 
            
            if (targetLang !== 'vi') {
                mutations.forEach(mutation => {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1 || node.nodeType === 3) {
                                translateNewNodes(node.parentElement || node);
                            }
                        });
                    }
                    if (mutation.type === 'characterData') {
                        translateNewNodes(mutation.target.parentElement);
                    }
                });
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        if (targetLang !== 'vi') setTimeout(() => showTranslateToast(false), 2500);
    };

    async function translateNewNodes(rootNode) {
        if (!rootNode || isExcluded(rootNode)) return;

        const walker = document.createTreeWalker(
            rootNode, 
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (!parent || isExcluded(parent)) return NodeFilter.FILTER_REJECT;
                    const content = node.textContent.trim();
                    if (content.length > 1 && /[a-zA-Zà-ỹÀ-Ỹ]/.test(content) && !node._isTranslated) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );

        const nodes = [];
        let currentNode;
        while(currentNode = walker.nextNode()) nodes.push(currentNode);

        await Promise.all(nodes.map(async (node) => {
            const originalText = node.textContent.trim();
            const translated = await fetchWithRetry(originalText, targetLang);
            if (translated && translated !== originalText) {
                node.textContent = node.textContent.replace(originalText, translated);
                node._isTranslated = true;
            }
        }));
    }

    function isExcluded(node) {
        const excludedTags = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'CODE', 'PRE'];
        return (
            excludedTags.includes(node.tagName) ||
            node.id === 'notranslate' || 
            node.classList.contains('notranslate') ||
            node.getAttribute('translate') === 'no' ||
            node.closest?.('.notranslate')
        );
    }

    async function fetchWithRetry(text, target, retries = 2) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url);
                const json = await res.json();
                return json[0].map(item => item[0]).join('');
            } catch (err) {
                if (i === retries - 1) return text;
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }

    // --- 4. HỆ THỐNG BẢO VỆ BẢN QUYỀN (TROLL COPY) ---
    const setupTrollCopy = () => {
        document.addEventListener('copy', async (event) => {
            event.preventDefault(); 
            const clipTroll = "Hệ thống bảo vệ: Nội dung này thuộc bản quyền của Abc's Noob. Vui lòng xem bản gốc tại https://abcsnoob.github.io. :)";
            let finalClip = clipTroll;

            if (targetLang !== 'vi') {
                finalClip = await fetchWithRetry(clipTroll, targetLang);
            }

            if (event.clipboardData) {
                event.clipboardData.setData('text/plain', `⚠️ ${finalClip}`);
            }
            console.warn("Copyright protected.");
        });
    };

    // --- 5. GIAO DIỆN (UI INJECTION) ---
function injectAIButton() {
        if (document.getElementById('ai-sidebar')) return;
        const style = document.createElement('style');
        style.innerHTML = `
            /* Sidebar mặc định: Rộng 500px trên máy tính, 100% trên điện thoại */
            #ai-sidebar { 
                position: fixed; top: 0; right: -100%; 
                width: 500px; max-width: 100%; height: 100%; 
                background: #fff; box-shadow: -5px 0 15px rgba(0,0,0,0.1); 
                z-index: 1000002; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                border-left: 1px solid #eee; display: flex; flex-direction: column; 
            }
            #ai-sidebar.open { right: 0; }
            
            /* Chế độ mở rộng toàn màn hình */
            #ai-sidebar.expanded { width: 85vw !important; }

            #ai-header { 
                padding: 12px 15px; border-bottom: 1px solid #eee; 
                display: flex; justify-content: space-between; align-items: center;
                background: #f8f9fa;
            }

            .ai-controls { display: flex; gap: 10px; align-items: center; }
            
            .ai-ctrl-btn { 
                border: none; background: none; cursor: pointer; 
                font-size: 18px; color: #666; padding: 5px; 
                display: flex; align-items: center; justify-content: center;
                transition: color 0.2s;
            }
            .ai-ctrl-btn:hover { color: #0078d4; }

            #ai-btn { 
                position: fixed; bottom: 25px; right: 200px; z-index: 1000000; 
                background: #0078d4; color: white; border: none; padding: 10px 20px; 
                border-radius: 12px; cursor: pointer; font-family: sans-serif; 
                font-weight: 600; display: flex; align-items: center; gap: 8px; 
                box-shadow: 0 4px 15px rgba(0,120,212,0.3); transition: all 0.2s; 
            }
            #ai-btn:hover { background: #005a9e; transform: translateY(-2px); }
            #ai-iframe { border: none; flex-grow: 1; width: 100%; height: 100%; }

            /* Mobile optimization */
            @media (max-width: 600px) {
                #ai-sidebar { width: 100% !important; }
                #ai-btn { right: 80px; bottom: 20px; padding: 10px; }
                #ai-btn span { display: none; } /* Ẩn chữ AI chỉ hiện icon trên mobile */
            }
        `;
        document.head.appendChild(style);

        const sidebar = document.createElement('div');
        sidebar.id = 'ai-sidebar';
        sidebar.className = 'notranslate';
        sidebar.innerHTML = `
            <div id="ai-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="width:10px; height:10px; background:#00ff00; border-radius:50%;"></div>
                    <span style="font-weight:bold; font-family:sans-serif; color:#333;">Noob AI Assistant</span>
                </div>
                <div class="ai-controls">
                    <button title="Phóng to/Thu nhỏ" class="ai-ctrl-btn" onclick="document.getElementById('ai-sidebar').classList.toggle('expanded')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    </button>
                    <button title="Đóng" class="ai-ctrl-btn" onclick="document.getElementById('ai-sidebar').classList.remove('open')" style="font-size:24px;">×</button>
                </div>
            </div>
            <iframe id="ai-iframe" src="/chat/chat-iframe.html"></iframe>
        `;

        const btn = document.createElement('button');
        btn.id = 'ai-btn';
        btn.className = 'notranslate';
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.61.38 3.12 1.05 4.47L2 22l5.53-1.05C8.88 21.62 10.39 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <span>Chat với Noob AI</span>
        `;
        btn.onclick = () => sidebar.classList.toggle('open');

        document.body.appendChild(sidebar);
        document.body.appendChild(btn);
    }

    function injectProfessionalDropdown(langs, current) {
        if (document.getElementById('notranslate-picker')) return;
        const wrapper = document.createElement('div');
        wrapper.id = 'notranslate-picker';
        wrapper.className = 'notranslate';
        wrapper.style.cssText = "position:fixed; bottom:25px; right:25px; z-index:1000000;";

        const select = document.createElement('select');
        select.style.cssText = "appearance:none; background:#fff; border:1px solid #ddd; padding:10px 35px 10px 15px; border-radius:12px; font-size:14px; box-shadow:0 4px 15px rgba(0,0,0,0.1); outline:none; cursor:pointer; background-image:url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 20 20\"><path fill=\"%23666\" d=\"M5 7l5 5 5-5z\"/></svg>'); background-repeat:no-repeat; background-position:right 10px center; background-size:18px; font-family:sans-serif;";

        const sortedLangs = Object.entries(langs).sort((a, b) => a[1].localeCompare(b[1]));
        for (const [code, name] of sortedLangs) {
            const opt = new Option(name, code);
            if (code === current) opt.selected = true;
            select.add(opt);
        }

        select.addEventListener('change', function() {
            localStorage.setItem('user_lang', this.value);
            const url = new URL(window.location.href);
            url.searchParams.set('lang', this.value);
            window.location.href = url.toString();
        });

        wrapper.appendChild(select);
        document.body.appendChild(wrapper);
    }

    function showTranslateToast(show) {
        let toast = document.getElementById('translate-toast');
        if (show) {
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'translate-toast';
                toast.className = 'notranslate';
                toast.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:10px 20px; border-radius:30px; font-size:13px; z-index:1000001; backdrop-filter:blur(5px); transition:opacity 0.4s; display:flex; align-items:center; gap:10px; pointer-events:none; font-family:sans-serif;";
                toast.innerHTML = `<div class="loader"></div> Processing...`;
                const s = document.createElement('style');
                s.innerHTML = ".loader{width:14px; height:14px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite;} @keyframes spin{to{transform:rotate(360deg)}}";
                document.head.appendChild(s);
                document.body.appendChild(toast);
            }
            toast.style.opacity = "1";
        } else if (toast) {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 400);
        }
    }

    // KHỞI CHẠY
    if (document.readyState === "complete" || document.readyState === "interactive") {
        init();
    } else {
        window.addEventListener("load", init);
    }
})();



(function() {
    // 1. Thêm CSS cho văn bản siêu đẹp và hiệu ứng
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes glow {
            0% { text-shadow: 0 0 10px #fff, 0 0 20px #ff0000; }
            50% { text-shadow: 0 0 20px #fff, 0 0 40px #ffcc00; }
            100% { text-shadow: 0 0 10px #fff, 0 0 20px #ff0000; }
        }
        .luxury-text-active {
            font-family: 'Arial Black', sans-serif;
            background: linear-gradient(to bottom, #fff, #ffd700, #ff4500);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: glow 1.5s infinite alternate;
            font-weight: 900;
            text-transform: uppercase;
            text-align: center;
        }
    `;
    document.head.appendChild(style);

    // 2. Tạo thanh đếm ngược (Đẩy nội dung trang xuống)
    const countdownWrapper = document.createElement('div');
    countdownWrapper.id = 'new-year-wrapper';
    Object.assign(countdownWrapper.style, {
        width: '100%',
        backgroundColor: '#1a1a1a',
        borderBottom: '3px solid #ffd700',
        padding: '15px 0',
        display: 'block' // Đảm bảo chiếm diện tích để đẩy navbar xuống
    });

    const countdownContent = document.createElement('div');
    countdownContent.className = 'luxury-text-active';
    countdownContent.style.fontSize = '24px';
    countdownWrapper.appendChild(countdownContent);

    // Chèn vào vị trí tuyệt đối đầu tiên của body
    document.body.prepend(countdownWrapper);

    function updateCountdown() {
        const now = new Date();
        const target = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0);
        const diff = target - now;

        if (diff <= 0) {
            countdownWrapper.remove();
            executeNewYearOverload();
            return;
        }

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff / 3600000) % 24);
        const m = Math.floor((diff / 60000) % 60);
        const s = Math.floor((diff / 1000) % 60);

        countdownContent.innerText = `🧧 CHỈ CÒN: ${d}N ${h}H ${m}P ${s}S LÀ ĐẾN NĂM MỚI 🧧`;
        setTimeout(updateCountdown, 1000);
    }

    function executeNewYearOverload() {
        // Ghi đè toàn bộ trang
        document.body.innerHTML = '';
        document.body.style.cssText = `
            background: #000; height: 100vh; margin: 0;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden; transition: opacity 2s ease;
        `;

        const finalMsg = document.createElement('h1');
        finalMsg.className = 'luxury-text-active';
        finalMsg.style.fontSize = '10vw';
        finalMsg.innerText = "HAPPY NEW YEAR 2026";
        document.body.appendChild(finalMsg);

        // Sau 1 phút tự động ẩn
        setTimeout(() => {
            document.body.style.opacity = '0';
            setTimeout(() => { document.body.innerHTML = ''; }, 2000);
        }, 60000);
    }

    updateCountdown();
})();
