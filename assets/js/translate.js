(function() {
    // --- 1. KÍCH HOẠT COOKIEBOT (CHÈN VÀO ĐẦU TRANG) ---
    const cbScript = document.createElement('script');
    cbScript.id = 'Cookiebot';
    cbScript.src = 'https://consent.cookiebot.com/uc.js';
    cbScript.setAttribute('data-cbid', '73a8d753-ab31-47b9-9551-1ca15db54bef');
    cbScript.setAttribute('data-blockingmode', 'auto');
    cbScript.type = 'text/javascript';
    
    const head = document.head || document.getElementsByTagName('head')[0];
    if (head.firstChild) {
        head.insertBefore(cbScript, head.firstChild);
    } else {
        head.appendChild(cbScript);
    }

    // --- 1.5. KÍCH HOẠT AI CHAT WIDGET ---
    const chatScript = document.createElement('script');
    chatScript.src = 'https://cdn.jsdelivr.net/npm/aichat-widget-js@1.0.0/dist/livechat-widget-js.min.js';
    chatScript.async = true;
    chatScript.onload = function() {
        if (typeof LiveChatWidget !== 'undefined') {
            LiveChatWidget.init({ tenantId: "e26b24c3-163d-4cad-ac4a-3211176276b1" });
        }
    };
    head.appendChild(chatScript);

    // --- 2. CẤU HÌNH NGÔN NGỮ (CHỈ ANH & VIỆT) ---
    const supportedLangs = {
        "vi": "Tiếng Việt",
        "en": "English"
    };

    let targetLang = 'vi';

    const init = () => {
        const params = new URLSearchParams(window.location.search);
        targetLang = params.get('lang') || localStorage.getItem('user_lang');

        // Nếu không có hoặc không thuộc 2 ngôn ngữ trên, mặc định là Tiếng Việt
        if (!targetLang || !supportedLangs[targetLang]) {
            const browserLang = navigator.language.split('-')[0];
            targetLang = (browserLang === 'en') ? 'en' : 'vi';
        }
        
        localStorage.setItem('user_lang', targetLang);
        
        // Cập nhật thuộc tính lang cho HTML để SEO và Accessibility tốt hơn
        document.documentElement.lang = targetLang;

        // Kích hoạt UI và Tính năng
        injectLanguagePicker(supportedLangs, targetLang);
        setupTrollCopy();
    };

    // --- 3. HỆ THỐNG BẢO VỆ BẢN QUYỀN (TROLL COPY) ---
    const setupTrollCopy = () => {
        document.addEventListener('copy', (event) => {
            event.preventDefault();
            
            // Nội dung thông báo dựa trên ngôn ngữ hiện tại
            const msg = {
                'vi': "Hệ thống bảo vệ: Nội dung này thuộc bản quyền của Abc's Noob. Vui lòng xem bản gốc tại https://abcsnoob.github.io. :)",
                'en': "Protection System: This content is copyrighted by Abc's Noob. Please view the original at https://abcsnoob.github.io. :)"
            };

            const finalClip = msg[targetLang] || msg['vi'];

            if (event.clipboardData) {
                event.clipboardData.setData('text/plain', `⚠️ ${finalClip}`);
            }
        });
    };

    // --- 4. GIAO DIỆN CHỌN NGÔN NGỮ (DROPDOWN) ---
    function injectLanguagePicker(langs, current) {
        if (document.getElementById('lang-picker-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'lang-picker-wrapper';
        wrapper.style.cssText = "position:fixed; bottom:25px; right:25px; z-index:1000000;";

        const select = document.createElement('select');
        // CSS cho Dropdown gọn gàng, hiện đại
        select.style.cssText = `
            appearance:none; background:#fff; border:1px solid #ddd; 
            padding:10px 35px 10px 15px; border-radius:12px; font-size:14px; 
            box-shadow:0 4px 15px rgba(0,0,0,0.1); outline:none; cursor:pointer; 
            background-image:url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path fill="%23666" d="M5 7l5 5 5-5z"/></svg>'); 
            background-repeat:no-repeat; background-position:right 10px center; 
            background-size:18px; font-family:sans-serif;
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

    // Khởi chạy khi trang sẵn sàng
    if (document.readyState === "complete" || document.readyState === "interactive") {
        init();
    } else {
        window.addEventListener("load", init);
    }
})();
