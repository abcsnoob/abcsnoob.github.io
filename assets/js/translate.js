(function() {
    // 1. Danh sách ngôn ngữ đầy đủ (Endonym)
    const supportedLangs = {
        "vi": "Tiếng Việt",
        "en": "English",
        "zh": "中文 (Zhōngwén)",
        "ja": "日本語 (Nihongo)",
        "ko": "한국어 (Hangugeo)",
        "fr": "Français",
        "de": "Deutsch",
        "es": "Español",
        "pt": "Português",
        "it": "Italiano",
        "ru": "Русский",
        "ar": "العربية",
        "hi": "हिन्दी",
        "th": "ไทย",
        "id": "Bahasa Indonesia",
        "ms": "Bahasa Melayu",
        "tr": "Türkçe",
        "nl": "Nederlands",
        "pl": "Polski",
        "sv": "Svenska",
        "da": "Dansk",
        "fi": "Suomi",
        "no": "Norsk",
        "cs": "Čeština",
        "el": "Ελληνικά",
        "he": "עברית",
        "ro": "Română",
        "hu": "Magyar",
        "uk": "Українська",
        "bg": "Български",
        "sk": "Slovenčina",
        "sl": "Slovenščina",
        "hr": "Hrvatski",
        "sr": "Српски",
        "fa": "فارسی",
        "bn": "বাংলা"
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

        injectProfessionalDropdown(supportedLangs, targetLang);

        // Chỉ chạy tiến trình dịch nếu ngôn ngữ đích khác Tiếng Việt (ngôn ngữ gốc)
        if (targetLang !== 'vi') {
            startMasterProcess();
        }
    };

    const startMasterProcess = async () => {
        showTranslateToast(true);
        
        // Cú hích đầu tiên
        await translateNewNodes(document.body);
        
        // Quét bổ trợ trong vài giây đầu để xử lý nội dung load chậm
        let count = 0;
        const retryTimer = setInterval(() => {
            translateNewNodes(document.body);
            count++;
            if (count > 3) {
                clearInterval(retryTimer);
                showTranslateToast(false);
            }
        }, 1500);

        // Theo dõi thay đổi DOM (AJAX, Single Page App, v.v.)
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
        if (!rootNode || (rootNode.id === 'notranslate') || (rootNode.classList && rootNode.classList.contains('notranslate'))) return;
        
        const getTextNodes = (root) => {
            const textNodes = [];
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: (node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const excludedTags = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'CODE'];
                            const excludedIds = ['notranslate', 'notranslate-picker'];
                            if (excludedTags.includes(node.tagName) || excludedIds.includes(node.id) || node.classList.contains('notranslate')) {
                                return NodeFilter.FILTER_REJECT;
                            }
                            return NodeFilter.FILTER_SKIP;
                        }
                        const content = node.textContent.trim();
                        // Chỉ nhận node có chữ và chưa dịch
                        if (content.length > 1 && /[a-zA-Zà-ỹÀ-Ỹ]/.test(content) && !node._isTranslated) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_REJECT;
                    }
                }
            );

            while (walker.nextNode()) {
                textNodes.push(walker.currentNode);
            }
            return textNodes;
        };

        const nodesToTranslate = getTextNodes(rootNode);

        // Dịch song song để tăng tốc độ load
        await Promise.all(nodesToTranslate.map(async (node) => {
            const originalText = node.textContent.trim();
            const translated = await fetchWithRetry(originalText, targetLang);
            
            if (translated && translated !== originalText) {
                node.textContent = node.textContent.replace(originalText, translated);
                node._isTranslated = true;
            }
        }));
    }

    async function fetchWithRetry(text, target, retries = 3) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error();
                const json = await res.json();
                return json[0].map(item => item[0]).join('');
            } catch (err) {
                if (i === retries - 1) return text;
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    function injectProfessionalDropdown(langs, current) {
        if (document.getElementById('notranslate-picker')) return;
        const wrapper = document.createElement('div');
        wrapper.id = 'notranslate-picker';
        wrapper.className = 'notranslate';
        wrapper.style.cssText = "position:fixed; bottom:25px; right:25px; z-index:1000000;";

        const select = document.createElement('select');
        select.style.cssText = "appearance:none; background:#fff; border:1px solid #ddd; padding:10px 35px 10px 15px; border-radius:12px; font-size:14px; box-shadow:0 4px 15px rgba(0,0,0,0.1); outline:none; cursor:pointer; background-image:url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 20 20\"><path fill=\"%23666\" d=\"M5 7l5 5 5-5z\"/></svg>'); background-repeat:no-repeat; background-position:right 10px center; background-size:18px; font-family:sans-serif;";

        // Sắp xếp ngôn ngữ theo tên để dễ tìm
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
                toast.innerHTML = `<div class="loader"></div> Processing Translation...`;
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
