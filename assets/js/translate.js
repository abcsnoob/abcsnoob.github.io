(function() {
    // 1. Danh sách ngôn ngữ đầy đủ
    const supportedLangs = {
        "vi": "Tiếng Việt", "en": "English", "zh": "中文 (Zhōngwén)", "ja": "日本語 (Nihongo)",
        "ko": "한국어 (Hangugeo)", "fr": "Français", "de": "Deutsch", "es": "Español",
        "pt": "Português", "it": "Italiano", "ru": "Русский", "ar": "العربية",
        "hi": "हिन्दी", "th": "ไทย", "id": "Bahasa Indonesia", "ms": "Bahasa Melayu",
        "tr": "Türkçe", "nl": "Nederlands", "pl": "Polski", "sv": "Svenska", "da": "Dansk",
        "fi": "Suomi", "no": "Norsk", "cs": "Čeština", "el": "Ελληνικά", "he": "עברית",
        "ro": "Română", "hu": "Magyar", "uk": "Українська", "bg": "Български", "sk": "Slovenčina",
        "sl": "Slovenščina", "hr": "Hrvatski", "sr": "Српски", "fa": "فارسی", "bn": "বাংলা"
    };

    let targetLang = 'vi';

    // 2. Khởi tạo hệ thống
    const init = async () => {
        const params = new URLSearchParams(window.location.search);
        targetLang = params.get('lang') || localStorage.getItem('user_lang');

        if (!targetLang) {
            const browserLang = navigator.language.split('-')[0];
            targetLang = supportedLangs[browserLang] ? browserLang : 'vi';
        }
        localStorage.setItem('user_lang', targetLang);

        injectProfessionalDropdown(supportedLangs, targetLang);

        if (targetLang !== 'vi') {
            await startMasterProcess();
        }
    };

    // 3. Tiến trình dịch và Theo dõi động
    const startMasterProcess = async () => {
        showTranslateToast(true);
        await translateNewNodes(document.body);
        showTranslateToast(false);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => translateNewNodes(node));
                }
                if (mutation.type === 'characterData') {
                    translateNewNodes(mutation.target.parentElement);
                }
            });
        });

        observer.observe(document.body, { 
            childList: true, 
            subtree: true, 
            characterData: true 
        });
    };

    // 4. Hàm dịch Node với cơ chế Retry
    async function translateNewNodes(rootNode) {
        if (!rootNode || (rootNode.id === 'notranslate')) return;
        
        const textNodes = [];
        const walk = (node) => {
            if (node.id === 'notranslate' || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(node.tagName)) return;
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 1) {
                // Lọc bỏ số/giờ, chỉ dịch khi có chữ cái
                if (/[a-zA-Zà-ỹÀ-Ỹ]/.test(node.textContent)) textNodes.push(node);
            } else {
                node.childNodes.forEach(walk);
            }
        };

        walk(rootNode);

        for (const node of textNodes) {
            const originalText = node.textContent.trim();
            if (!node._isTranslated) {
                const translated = await fetchWithRetry(originalText, targetLang);
                if (translated && translated !== originalText) {
                    node.textContent = node.textContent.replace(originalText, translated);
                    node._isTranslated = true;
                }
            }
        }
    }

    // 5. API Fetch với cơ chế Retry 3 lần
    async function fetchWithRetry(text, target, retries = 3) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error("API Error");
                const json = await res.json();
                return json[0].map(item => item[0]).join('');
            } catch (err) {
                if (i === retries - 1) return text; // Thất bại sau 3 lần
                await new Promise(r => setTimeout(r, 1000)); // Chờ 1s rồi thử lại
            }
        }
    }

    // 6. Giao diện Dropdown Chuyên nghiệp
    function injectProfessionalDropdown(langs, current) {
        const wrapper = document.createElement('div');
        wrapper.id = 'notranslate';
        wrapper.style.cssText = "position:fixed; bottom:25px; right:25px; z-index:1000000;";

        const select = document.createElement('select');
        select.style.cssText = `
            appearance: none; background: #fff; border: 1px solid #ddd;
            padding: 10px 35px 10px 15px; border-radius: 12px; font-size: 14px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1); outline: none; cursor: pointer;
            background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="%23666" d="M5 7l5 5 5-5z"/></svg>');
            background-repeat: no-repeat; background-position: right 10px center; background-size: 18px;
            font-family: sans-serif;
        `;

        for (const [code, name] of Object.entries(langs)) {
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

    // 7. Toast Thông báo
    function showTranslateToast(show) {
        let toast = document.getElementById('translate-toast');
        if (show) {
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'translate-toast';
                toast.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:10px 20px; border-radius:30px; font-size:13px; z-index:1000001; backdrop-filter:blur(5px); transition:opacity 0.4s; display:flex; align-items:center; gap:10px;";
                toast.innerHTML = `<div class="loader"></div> Translating site...`;
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

    // Chạy hệ thống
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
