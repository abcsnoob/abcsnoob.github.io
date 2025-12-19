(function() {
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

    const init = () => {
        // Tránh chạy init nhiều lần
        if (document.getElementById('master-translate-wrapper')) return;

        const params = new URLSearchParams(window.location.search);
        targetLang = params.get('lang') || localStorage.getItem('user_lang');

        if (!targetLang) {
            const browserLang = navigator.language.split('-')[0];
            targetLang = supportedLangs[browserLang] ? browserLang : 'vi';
        }
        localStorage.setItem('user_lang', targetLang);

        injectDropdown(supportedLangs, targetLang);

        if (targetLang !== 'vi') {
            startMasterProcess();
        }
    };

    const startMasterProcess = async () => {
        showToast(true);
        await translateNewNodes(document.body);
        
        let count = 0;
        const retryTimer = setInterval(() => {
            translateNewNodes(document.body);
            if (++count > 4) {
                clearInterval(retryTimer);
                showToast(false);
            }
        }, 1500);

        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 || node.nodeType === 3) {
                            translateNewNodes(node.nodeType === 3 ? node.parentElement : node);
                        }
                    });
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    };

    async function translateNewNodes(root) {
        if (!root || root.closest?.('.notranslate')) return;
        const textNodes = [];
        const walk = (node) => {
            if (node.classList?.contains('notranslate') || ['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(node.tagName)) return;
            if (node.nodeType === 3 && node.textContent.trim().length > 1 && !node._isTr) {
                if (/[a-zA-Zà-ỹÀ-Ỹ]/.test(node.textContent)) textNodes.push(node);
            } else {
                node.childNodes.forEach(walk);
            }
        };
        walk(root);
        for (const node of textNodes) {
            const original = node.textContent.trim();
            const translated = await fetchTr(original, targetLang);
            if (translated && translated !== original) {
                node.textContent = translated;
                node._isTr = true;
            }
        }
    }

    async function fetchTr(text, target) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        try {
            const res = await fetch(url);
            const json = await res.json();
            return json[0].map(item => item[0]).join('');
        } catch { return text; }
    }

    function injectDropdown(langs, current) {
        const container = document.createElement('div');
        container.id = 'master-translate-wrapper';
        container.className = 'notranslate';
        // Sử dụng z-index cao nhất có thể
        container.style.cssText = "position:fixed; bottom:25px; right:25px; z-index:2147483647; line-height:0;";

        // Tạo Shadow DOM để bảo vệ dropdown khỏi CSS của web gốc
        const shadow = container.attachShadow({mode: 'open'});

        const select = document.createElement('select');
        select.setAttribute('translate', 'no');
        
        // Style trực tiếp trong Shadow DOM
        const style = document.createElement('style');
        style.textContent = `
            select {
                appearance: none;
                background: #ffffff;
                color: #333333;
                border: 2px solid #eeeeee;
                padding: 10px 35px 10px 15px;
                border-radius: 12px;
                font-size: 14px;
                font-family: sans-serif;
                font-weight: 500;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                cursor: pointer;
                outline: none;
                background-image: url("data:image/svg+xml;charset=US-ASCII,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'><path fill='%23666' d='M5 7l5 5 5-5z'/></svg>");
                background-repeat: no-repeat;
                background-position: right 10px center;
                background-size: 18px;
                transition: all 0.2s;
            }
            select:hover { border-color: #007bff; box-shadow: 0 4px 25px rgba(0,123,255,0.2); }
        `;

        for (const [code, name] of Object.entries(langs)) {
            const opt = new Option(name, code);
            if (code === current) opt.selected = true;
            select.add(opt);
        }

        select.onchange = (e) => {
            localStorage.setItem('user_lang', e.target.value);
            const url = new URL(window.location.href);
            url.searchParams.set('lang', e.target.value);
            window.location.href = url.toString();
        };

        shadow.appendChild(style);
        shadow.appendChild(select);
        document.documentElement.appendChild(container); // Chèn vào <html> để chắc chắn nó tồn tại
    }

    function showToast(show) {
        let toast = document.getElementById('tr-toast');
        if (show) {
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'tr-toast';
                toast.className = 'notranslate';
                toast.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#333; color:#fff; padding:10px 20px; border-radius:30px; font-size:13px; z-index:2147483647; font-family:sans-serif; display:flex; align-items:center; gap:10px; transition: 0.3s; opacity:0;";
                toast.innerHTML = `<div style="width:14px; height:14px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:s 0.8s linear infinite;"></div> Translating... <style>@keyframes s{to{transform:rotate(360deg)}}</style>`;
                document.body.appendChild(toast);
                setTimeout(() => toast.style.opacity = "1", 10);
            }
        } else if (toast) {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }
    }

    // Chạy ngay lập tức
    if (document.body) {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
})();
