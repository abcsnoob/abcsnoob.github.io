document.addEventListener("DOMContentLoaded", async () => {
    // 1. Danh sách ngôn ngữ đầy đủ
    const supportedLangs = {
        "vi": "Tiếng Việt", "en": "English", "zh": "中文 (Zhōngwén)", "ja": "日本語 (Nihongo)",
        "ko": "한국어 (Hangugeo)", "fr": "Français", "de": "Deutsch", "es": "Español",
        "pt": "Português", "it": "Italiano", "ru": "Русский", "ar": "العربية (Al-ʻarabiyyah)",
        "hi": "हिन्दी (Hindī)", "th": "ไทย (Thai)", "id": "Bahasa Indonesia", "ms": "Bahasa Melayu",
        "tr": "Türkçe", "nl": "Nederlands", "pl": "Polski", "sv": "Svenska", "da": "Dansk",
        "fi": "Suomi", "no": "Norsk", "cs": "Čeština", "el": "Ελληνικά", "he": "עبری",
        "ro": "Română", "hu": "Magyar", "uk": "Українська", "bg": "Български", "sk": "Slovenčina",
        "sl": "Slovenščina", "hr": "Hrvatski", "sr": "Српски", "fa": "فارسی", "bn": "বাংলা"
    };

    // 2. Xác định ngôn ngữ
    const params = new URLSearchParams(window.location.search);
    let lang = params.get('lang') || localStorage.getItem('user_lang');

    if (!lang) {
        const browserLang = navigator.language.split('-')[0];
        lang = supportedLangs[browserLang] ? browserLang : 'vi';
    }
    localStorage.setItem('user_lang', lang);

    // 3. Hiển thị Giao diện Dropdown Chuyên nghiệp
    injectProfessionalDropdown(supportedLangs, lang);

    // 4. Tiến hành dịch nếu ngôn ngữ không phải Tiếng Việt
    if (lang !== 'vi') {
        showTranslateToast(true); // Hiện thông báo "Translating site..."
        
        await translateNewNodes(document.body, lang, 'vi');
        
        showTranslateToast(false); // Ẩn sau khi dịch xong đợt đầu

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => translateNewNodes(node, lang, 'vi'));
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
});

/**
 * Hiển thị Toast thông báo dịch
 */
function showTranslateToast(show) {
    let toast = document.getElementById('translate-toast');
    if (show) {
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'translate-toast';
            toast.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.75); color: #fff; padding: 10px 20px;
                border-radius: 30px; font-family: sans-serif; font-size: 13px;
                z-index: 1000001; backdrop-filter: blur(5px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2); pointer-events: none;
                transition: opacity 0.4s ease; display: flex; align-items: center; gap: 8px;
            `;
            toast.innerHTML = `<span class="spinner"></span> Translating site...`;
            
            // CSS cho vòng xoay loading
            const style = document.createElement('style');
            style.innerHTML = `
                @keyframes spin { to { transform: rotate(360deg); } }
                .spinner { width: 14px; height: 14px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
            `;
            document.head.appendChild(style);
            document.body.appendChild(toast);
        }
        toast.style.opacity = "1";
    } else if (toast) {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
    }
}

/**
 * Tạo Dropdown với giao diện hiện đại
 */
function injectProfessionalDropdown(langs, currentLang) {
    const wrapper = document.createElement('div');
    wrapper.id = 'notranslate';
    wrapper.style.cssText = `
        position: fixed; bottom: 25px; right: 25px; z-index: 1000000;
        display: flex; flex-direction: column; align-items: flex-end;
    `;

    const select = document.createElement('select');
    select.id = 'lang-select-ui';
    select.style.cssText = `
        appearance: none; background: #ffffff; border: 1px solid #e0e0e0;
        padding: 10px 35px 10px 15px; border-radius: 12px; font-size: 14px;
        color: #333; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="%23666" d="M5 7l5 5 5-5z"/></svg>');
        background-repeat: no-repeat; background-position: right 10px center;
        background-size: 18px; outline: none; transition: all 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    for (const [code, name] of Object.entries(langs)) {
        const opt = new Option(name, code);
        if (code === currentLang) opt.selected = true;
        select.add(opt);
    }

    select.onmouseover = () => select.style.borderColor = "#007bff";
    select.onmouseout = () => select.style.borderColor = "#e0e0e0";

    select.addEventListener('change', function() {
        const newLang = this.value;
        localStorage.setItem('user_lang', newLang);
        const newParams = new URLSearchParams(window.location.search);
        newParams.set('lang', newLang);
        window.location.search = newParams.toString();
    });

    wrapper.appendChild(select);
    document.body.appendChild(wrapper);
}

/**
 * Hàm dịch thuật lõi (đã tối ưu)
 */
async function translateNewNodes(rootNode, target, source) {
    if (!rootNode || rootNode.id === 'notranslate') return;
    
    const textNodes = [];
    const walk = (node) => {
        if (node.id === 'notranslate' || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(node.tagName)) return;
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 1) {
            if (/[a-zA-Zà-ỹÀ-Ỹ]/.test(node.textContent)) textNodes.push(node);
        } else {
            node.childNodes.forEach(walk);
        }
    };

    walk(rootNode);

    for (const node of textNodes) {
        const originalText = node.textContent.trim();
        if (!node._isTranslated) {
            const translatedText = await fetchTranslation(originalText, target, source);
            if (translatedText !== originalText) {
                node.textContent = translatedText;
                node._isTranslated = true; 
            }
        }
    }
}

async function fetchTranslation(text, target, source) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const json = await res.json();
        return json[0].map(item => item[0]).join('');
    } catch (err) { return text; }
}
