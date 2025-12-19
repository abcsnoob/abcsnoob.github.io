document.addEventListener("DOMContentLoaded", async () => {
    // 1. Danh sách ngôn ngữ (Có thể mở rộng thêm)
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
    "ar": "العربية (Al-ʻarabiyyah)",
    "hi": "हिन्दी (Hindī)",
    "th": "ไทย (Thai)",
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

    // 2. Logic xác định ngôn ngữ cần hiển thị
    const params = new URLSearchParams(window.location.search);
    let lang = params.get('lang'); // Ưu tiên 1: Tham số trên URL

    if (!lang) {
        lang = localStorage.getItem('user_lang'); // Ưu tiên 2: Local Storage
    }

    if (!lang) {
        // Ưu tiên 3: Tự động nhận diện ngôn ngữ trình duyệt (lấy 2 ký tự đầu, ví dụ 'en-US' -> 'en')
        const browserLang = navigator.language.split('-')[0];
        lang = supportedLangs[browserLang] ? browserLang : 'vi'; 
    }

    // Lưu lại lựa chọn vào LocalStorage
    localStorage.setItem('user_lang', lang);

    // 3. Hiển thị Dropdown
    injectLanguageDropdown(supportedLangs, lang);

    // 4. Tiến hành dịch nếu ngôn ngữ không phải Tiếng Việt
    if (lang !== 'vi') {
        document.body.classList.add('translating');
        await startTranslationProcess(document.body, lang, 'vi');
        document.body.classList.remove('translating');
    }
});

/**
 * Tạo Dropdown và đồng bộ hóa với LocalStorage
 */
function injectLanguageDropdown(langs, currentLang) {
    const container = document.createElement('div');
    container.id = 'notranslate';
    container.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 99999;
        background: white; padding: 10px; border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.15); font-family: sans-serif;
    `;

    let optionsHtml = '';
    for (const [code, name] of Object.entries(langs)) {
        optionsHtml += `<option value="${code}" ${currentLang === code ? 'selected' : ''}>${name}</option>`;
    }

    container.innerHTML = `
        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 5px;">Ngôn ngữ / Language:</label>
        <select id="lang-select" style="padding: 5px; border-radius: 5px; border: 1px solid #ccc; outline: none; cursor: pointer;">
            ${optionsHtml}
        </select>
    `;
    document.body.appendChild(container);

    document.getElementById('lang-select').addEventListener('change', function() {
        const newLang = this.value;
        // Lưu vào LocalStorage ngay khi người dùng thay đổi
        localStorage.setItem('user_lang', newLang);
        
        // Cập nhật URL và tải lại trang
        const newParams = new URLSearchParams(window.location.search);
        newParams.set('lang', newLang);
        window.location.search = newParams.toString();
    });
}

/**
 * Tiến trình dịch thuật
 */
async function startTranslationProcess(rootNode, target, source) {
    const textNodes = [];
    function walk(node) {
        if (node.id === 'notranslate' || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(node.tagName)) return;
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 1) {
            textNodes.push(node);
        } else {
            node.childNodes.forEach(walk);
        }
    }
    walk(rootNode);

    // Toast thông báo
    const toast = document.createElement('div');
    toast.id = 'notranslate';
    toast.innerText = 'Auto-translating page...';
    toast.style.cssText = "position:fixed; top:10px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:8px 20px; border-radius:20px; font-size:13px; z-index:100000;";
    document.body.appendChild(toast);

    // Dịch các cụm văn bản
    for (const node of textNodes) {
        const originalText = node.textContent.trim();
        const translatedText = await fetchTranslation(originalText, target, source);
        node.textContent = node.textContent.replace(originalText, translatedText);
    }
    toast.remove();
}

async function fetchTranslation(text, target, source) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const json = await res.json();
        return json[0].map(item => item[0]).join('');
    } catch (err) {
        return text;
    }
}
