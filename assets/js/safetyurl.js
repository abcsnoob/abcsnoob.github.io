(function() {
    // 1. Cấu hình
    const REDIRECT_PREFIX = "https://abcsnoob.github.io/go?to=";
    const CURRENT_DOMAIN = window.location.hostname;

    // 2. Hàm xử lý gắn link
    function wrapExternalLinks() {
        // Lấy tất cả các thẻ <a> trên trang
        const links = document.querySelectorAll('a[href]');

        links.forEach(link => {
            const href = link.getAttribute('href');

            try {
                // Tạo một đối tượng URL để kiểm tra
                const targetUrl = new URL(link.href);

                // 3. Điều kiện để chèn tiền tố:
                // - Phải là giao thức http hoặc https
                // - Domain khác với domain hiện tại
                // - Chưa được chèn prefix trước đó
                if (
                    (targetUrl.protocol === "http:" || targetUrl.protocol === "https:") &&
                    targetUrl.hostname !== CURRENT_DOMAIN &&
                    !href.startsWith(REDIRECT_PREFIX)
                ) {
                    // Cập nhật lại thuộc tính href
                    link.href = REDIRECT_PREFIX + encodeURIComponent(link.href);
                    
                    // (Tùy chọn) Mở trong tab mới cho các link ngoài
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                }
            } catch (e) {
                // Bỏ qua nếu link không hợp lệ (ví dụ: href="#", href="javascript:void(0)")
            }
        });
    }

    // 4. Chạy khi trang tải xong
    window.addEventListener('DOMContentLoaded', wrapExternalLinks);

    // 5. (Nâng cao) Theo dõi nếu trang có tải nội dung mới bằng AJAX (ví dụ: cuộn trang tải thêm)
    const observer = new MutationObserver(wrapExternalLinks);
    observer.observe(document.body, { childList: true, subtree: true });
})();
