(function() {
    // 1. Cấu hình ngôn ngữ
    const supportedLangs = {
        "vi": "Tiếng Việt", "en": "English", "zh": "中文 (Zhōngwén)", "ja": "日本語 (Nihongo)",
        "ko": "한국어 (Hangugeo)", "fr": "Français", "de": "Deutsch", "es": "Español",
        "pt": "Português", "it": "Italiano", "ru": "Русский", "ar": "العربية",
        "hi": "हिन्दी", "th": "ไทย", "id": "Bahasa Indonesia", "ms": "Bahasa Melayu",
        "tr": "Türkçe", "nl": "Nederlands", "pl": "Polski", "sv": "Svenska",
        "da": "Dansk", "fi": "Suomi", "no": "Norsk", "cs": "Čeština",
        "el": "Ελληνικά", "he": "עبری", "ro": "Română", "hu": "Magyar",
        "uk": "Українська", "bg": "Български", "sk": "Slovenčina",
        "sl": "Slovenščina", "hr": "Hrvatski", "sr": "Српски", "fa": "فارسی", "bn": "বাংলা"
    };

    let targetLang = 'vi';

    const init = async () => {
        const params = new URLSearchParams(window.location.search);
        // Ưu tiên tham số URL rồi đến localStorage
        targetLang = params.get('lang') || localStorage.getItem('user_lang');

        if (!targetLang || !supportedLangs[targetLang]) {
            const browserLang = navigator.language.split('-')[0];
            targetLang = supportedLangs[browserLang] ? browserLang : 'vi';
        }
        localStorage.setItem('user_lang', targetLang);

        injectProfessionalDropdown(supportedLangs, targetLang);
        injectAIButton();
        setupTrollCopy(); // Kích hoạt hệ thống bảo vệ bản quyền Apple Style

        if (targetLang !== 'vi') {
            startMasterProcess();
        }
    };

    // --- HỆ THỐNG BẢO VỆ BẢN QUYỀN (TROLL COPY) ---
const setupTrollCopy = () => {
    document.addEventListener('copy', async (event) => {
        event.preventDefault(); // Chặn đứng hành động copy gốc

        // 1. Chuẩn bị thông điệp Troll cho Clipboard
        const clipTroll = "Hệ thống bảo vệ: Nội dung này thuộc bản quyền của Abc's Noob. Vui lòng xem bản gốc tại https://abcsnoob.github.io. :)";
        
        // 2. Chuẩn bị thông điệp cảnh báo cho Console
        const consoleTroll = "Phát hiện hành vi sao chép trái phép từ DevTools! Clipboard của bạn đã bị thay thế bởi thông tin bản quyền của Abc's Noob.";
        const heyWait = "嘿等等！ (Hey Wait!)";

        let finalClip = clipTroll;
        let finalConsole = consoleTroll;
        let finalHey = heyWait;

        // Tự động dịch cả 3 thông điệp bằng bộ máy fetchWithRetry của bạn
        if (targetLang !== 'vi') {
            [finalClip, finalConsole, finalHey] = await Promise.all([
                fetchWithRetry(clipTroll, targetLang),
                fetchWithRetry(consoleTroll, targetLang),
                fetchWithRetry(heyWait, targetLang)
            ]);
        }

        // 3. Ghi đè Clipboard
        if (event.clipboardData) {
            event.clipboardData.setData('text/plain', `⚠️ ${finalClip}`);
        }

        // 4. "Vả mặt" trong Console bằng ngôn ngữ đã dịch
        console.clear();
        console.log(`%c${finalHey}`, "color: red; font-size: 30px; font-weight: bold; text-shadow: 2px 2px black;");
        console.warn(finalConsole);
    });
};
    // --- LOGIC DỊCH THUẬT TỐI ƯU (GIỮ NGUYÊN BẢN GỐC CỦA BẠN) ---
    const startMasterProcess = async () => {
        showTranslateToast(true);
        await translateNewNodes(document.body);
        
        let count = 0;
        const retryTimer = setInterval(() => {
            translateNewNodes(document.body);
            count++;
            if (count > 3) { clearInterval(retryTimer); showTranslateToast(false); }
        }, 1500);

        const observer = new MutationObserver((mutations) => {
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
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };

    async function translateNewNodes(rootNode) {
        if (!rootNode || isExcluded(rootNode)) return;

        const getTextNodes = (root) => {
            const textNodes = [];
            const walker = document.createTreeWalker(
                root, 
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: (node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const excludedTags = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'CODE', 'PRE'];
                            if (excludedTags.includes(node.tagName) || isExcluded(node)) {
                                return NodeFilter.FILTER_REJECT;
                            }
                            return NodeFilter.FILTER_SKIP;
                        }
                        const content = node.textContent.trim();
                        if (content.length > 1 && /[a-zA-Zà-ỹÀ-Ỹ]/.test(content) && !node._isTranslated) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_REJECT;
                    }
                }
            );
            while (walker.nextNode()) textNodes.push(walker.currentNode);
            return textNodes;
        };

        const nodesToTranslate = getTextNodes(rootNode);
        await Promise.all(nodesToTranslate.map(async (node) => {
            const originalText = node.textContent.trim();
            const translated = await fetchWithRetry(originalText, targetLang);
            if (translated && translated !== originalText) {
                node.textContent = node.textContent.replace(originalText, translated);
                node._isTranslated = true;
            }
        }));
    }

    function isExcluded(node) {
        if (!node || node.nodeType !== 1) return false;
        return (
            node.id === 'notranslate' || 
            node.id === 'notranslate-picker' || 
            node.id === 'ai-sidebar' ||
            node.classList.contains('notranslate') ||
            node.getAttribute('translate') === 'no' ||
            node.closest?.('#notranslate') || 
            node.closest?.('.notranslate')
        );
    }

    async function fetchWithRetry(text, target, retries = 3) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url);
                const json = await res.json();
                return json[0].map(item => item[0]).join('');
            } catch (err) {
                if (i === retries - 1) return text;
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    // --- GIAO DIỆN (UI) ---
    function injectAIButton() {
        if (document.getElementById('ai-sidebar')) return;
        const style = document.createElement('style');
        style.innerHTML = `
            #ai-sidebar { position: fixed; top: 0; right: -450px; width: 400px; height: 100%; background: #fff; box-shadow: -5px 0 15px rgba(0,0,0,0.1); z-index: 1000002; transition: right 0.3s ease; border-left: 1px solid #eee; display: flex; flex-direction: column; }
            #ai-sidebar.open { right: 0; }
            #ai-btn { position: fixed; bottom: 25px; right: 200px; z-index: 1000000; background: #0078d4; color: white; border: none; padding: 10px 20px; border-radius: 12px; cursor: pointer; font-family: sans-serif; font-weight: 600; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(0,120,212,0.3); transition: all 0.2s; }
            #ai-btn:hover { background: #005a9e; transform: translateY(-2px); }
            #ai-header { padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            #ai-iframe { border: none; flex-grow: 1; width: 100%; height: 100%; }
        `;
        document.head.appendChild(style);

        const sidebar = document.createElement('div');
        sidebar.id = 'ai-sidebar';
        sidebar.className = 'notranslate';
        sidebar.setAttribute('translate', 'no');
        sidebar.innerHTML = `
            <div id="ai-header">
                <span style="font-weight:bold; font-family:sans-serif;"></span>
                <button onclick="document.getElementById('ai-sidebar').classList.remove('open')" style="border:none; background:none; cursor:pointer; font-size:20px;">×</button>
            </div>
            <iframe id="ai-iframe" src="/chat/chat-iframe.html"></iframe>
        `;

        const btn = document.createElement('button');
        btn.id = 'ai-btn';
        btn.className = 'notranslate';
        btn.setAttribute('translate', 'no');
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.61.38 3.12 1.05 4.47L2 22l5.53-1.05C8.88 21.62 10.39 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg> Hỗ trợ AI`;
        btn.onclick = () => sidebar.classList.toggle('open');

        document.body.appendChild(sidebar);
        document.body.appendChild(btn);
    }

    function injectProfessionalDropdown(langs, current) {
        if (document.getElementById('notranslate-picker')) return;
        const wrapper = document.createElement('div');
        wrapper.id = 'notranslate-picker';
        wrapper.className = 'notranslate';
        wrapper.setAttribute('translate', 'no');
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
                toast.setAttribute('translate', 'no');
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

    if (document.readyState === "complete" || document.readyState === "interactive") {
        init();
    } else {
        window.addEventListener("load", init);
    }
})();
