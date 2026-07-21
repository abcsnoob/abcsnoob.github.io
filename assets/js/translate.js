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

    // --- 2. KÍCH HOẠT AI CHAT WIDGET ---
    const chatScript = document.createElement('script');
    chatScript.src = 'https://cdn.jsdelivr.net/npm/aichat-widget-js@1.0.2/dist/aichat-widget-js.min.js';
    chatScript.async = true;
    chatScript.onload = function() {
        if (typeof LiveChatWidget !== 'undefined') {
            LiveChatWidget.init({ tenantId: "e26b24c3-163d-4cad-ac4a-3211176276b1" });
        }
    };
    head.appendChild(chatScript);

    // --- 3. CẤU HÌNH NGÔN NGỮ (CHỈ ANH & VIỆT) ---
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
        injectSupportButton();
        setupTrollCopy();
    };

    // --- 4. HỆ THỐNG BẢO VỆ BẢN QUYỀN (TROLL COPY) ---
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

    // --- 5. NÚT MỞ HỖ TRỢ (THAY THẾ DROPDOWN NGÔN NGỮ) ---
    function injectSupportButton() {
        if (document.getElementById('support-btn-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'support-btn-wrapper';
        wrapper.style.cssText = "position:fixed; bottom:25px; right:25px; z-index:1000000; font-family:sans-serif;";

        const btn = document.createElement('button');
        
        // Nhãn nút dựa theo ngôn ngữ hiện tại
        const buttonLabels = {
            'vi': '💬 Hỗ trợ',
            'en': '💬 Support'
        };
        btn.textContent = buttonLabels[targetLang] || buttonLabels['vi'];

        // CSS cho nút bấm hiện đại, bắt mắt
        btn.style.cssText = `
            background: #6750A4; color: #fff; border: none; 
            padding: 12px 20px; border-radius: 50px; font-size: 14px; 
            font-weight: 600; box-shadow: 0 4px 15px rgba(0,0,0,0.15); 
            cursor: pointer; outline: none; display: flex; align-items: center; gap: 8px;
            transition: transform 0.2s ease, background 0.2s ease;
        `;

        btn.onmouseover = () => { btn.style.background = '#583d91'; btn.style.transform = 'scale(1.05)'; };
        btn.onmouseout = () => { btn.style.background = '#6750A4'; btn.style.transform = 'scale(1)'; };

        // Sự kiện click mở chat widget
        btn.addEventListener('click', function() {
            if (typeof LiveChatWidget !== 'undefined') {
                LiveChatWidget.toggle();
            }
        });

        wrapper.appendChild(btn);
        document.body.appendChild(wrapper);
    }

    // Khởi chạy khi trang sẵn sàng
    if (document.readyState === "complete" || document.readyState === "interactive") {
        init();
    } else {
        window.addEventListener("load", init);
    }
})();
