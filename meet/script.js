const LK = window.LivekitClient;
const { Room, RoomEvent, Track } = LK;

// CONFIG
const WORKER_URL = 'https://livekit.abcsnoob.workers.dev';
const LIVEKIT_WSS = 'wss://abcsnoob-l5aam0b3.livekit.cloud';

const room = new Room({ adaptiveStream: true, dynacast: true });

// DOM
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const videoGrid = document.getElementById('video-grid');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');
const shareBtn = document.getElementById('share-btn');
const callBtn = document.getElementById('call-btn');

let joined = false;

// ---------------- AUTH ----------------
async function handleAuth(type) {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password)
        return Swal.fire('Lỗi', 'Nhập đủ tài khoản/mật khẩu', 'warning');

    NProgress.start();
    try {
        const path = type === 'reg' ? '/register' : '/auth';
        const res = await fetch(`${WORKER_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (type === 'reg') {
            NProgress.done();
            Swal.fire('OK', 'Đã tạo tài khoản, đăng nhập lại', 'success');
        } else {
            await connectToSFU(data.token, username);
        }
    } catch (e) {
        NProgress.done();
        Swal.fire('Auth Error', e.message, 'error');
    }
}

document.getElementById('auth-btn').onclick = () => handleAuth('login');
document.getElementById('reg-btn').onclick = () => handleAuth('reg');

// ---------------- CONNECT ----------------
async function connectToSFU(token, username) {
    try {
        await room.connect(LIVEKIT_WSS, token);
        
        // --- THÊM ĐOẠN NÀY ---
        // Kích hoạt âm thanh ngay khi kết nối thành công
        room.startAudio().then(() => {
            console.log("Audio playback started");
        }).catch(e => {
            console.warn("Chưa thể phát âm thanh, chờ tương tác người dùng", e);
        });
        // ---------------------

        loginScreen.classList.add('d-none');
        mainApp.classList.remove('d-none');

        NProgress.done();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Chào ${username}`,
            showConfirmButton: false,
            timer: 2000
        });

    } catch (e) {
        NProgress.done();
        Swal.fire('SFU Error', e.message, 'error');
    }
}

// ---------------- JOIN CALL ----------------
callBtn.onclick = async () => {
    if (joined) return;

    try {
        await room.localParticipant.enableCameraAndMicrophone();

        setTimeout(renderLocalVideo, 150);

        micBtn.disabled = false;
        camBtn.disabled = false;
        shareBtn.disabled = false;

        callBtn.className = 'btn btn-secondary px-4';
        callBtn.innerHTML = '<i class="bi bi-telephone-x-fill"></i> Đang trong cuộc gọi';

        joined = true;
    } catch (e) {
        Swal.fire('Lỗi thiết bị', e.message, 'error');
    }
};

// ---------------- RENDER LOCAL VIDEO ----------------
function renderLocalVideo() {
    const pubs = Array.from(room.localParticipant.tracks.values());

    const videoPub = pubs.find(p =>
        p.track &&
        p.track.kind === Track.Kind.Video &&
        p.source === Track.Source.Camera
    );

    if (!videoPub) return;
    if (document.getElementById("local-video")) return;

    const wrapper = document.createElement('div');
    wrapper.className = "video-wrapper";
    wrapper.id = "local-video";

    const video = videoPub.track.attach();
    video.muted = true;

    const label = document.createElement('div');
    label.className = "username-label";
    label.innerText = "Bạn";

    wrapper.append(video, label);
    videoGrid.appendChild(wrapper);

    adjustLayout();
}

function renderLocalScreen() {
    const pubs = Array.from(room.localParticipant.tracks.values());

    const screenPub = pubs.find(p =>
        p.track && p.source === Track.Source.ScreenShare
    );

    if (!screenPub) return;
    if (document.getElementById("local-screen")) return;

    const wrapper = document.createElement('div');
    wrapper.className = "video-wrapper screen-share-video";
    wrapper.id = "local-screen";

    const video = screenPub.track.attach();

    const label = document.createElement('div');
    label.className = "username-label";
    label.innerText = "Bạn (Đang chia sẻ)";

    wrapper.append(video, label);
    videoGrid.prepend(wrapper);

    adjustLayout();
}
// ---------------- REMOTE TRACKS ----------------
room.on(RoomEvent.TrackSubscribed, async (track, publication, participant) => {
    // 1. XỬ LÝ AUDIO (Microphone hoặc System Audio từ Screen Share)
    if (track.kind === Track.Kind.Audio) {
        // Tạo element audio
        const audioEl = track.attach();
        audioEl.setAttribute('data-participant', participant.identity);
        audioEl.setAttribute('data-source', track.source);
        document.body.appendChild(audioEl);

        // QUAN TRỌNG: Kích hoạt âm thanh (vượt rào cản Autoplay của trình duyệt)
        try {
            await room.startAudio();
            console.log(`Đã phát âm thanh từ: ${participant.identity} (${track.source})`);
        } catch (error) {
            console.error("Trình duyệt chặn tự động phát âm thanh:", error);
            // Có thể hiển thị một nút "Bật âm thanh" nhỏ nếu cần
        }
        return; 
    }

    // 2. XỬ LÝ VIDEO (Camera hoặc Screen Share)
    if (track.kind === Track.Kind.Video) {
        // Kiểm tra xem đã có wrapper cho track này chưa để tránh bị lặp
        const existingWrapper = document.getElementById(`wrap-${participant.identity}-${track.source}`);
        if (existingWrapper) return;

        const wrapper = document.createElement('div');
        wrapper.className = "video-wrapper";
        wrapper.id = `wrap-${participant.identity}-${track.source}`;

        // Nếu là chia sẻ màn hình, thêm class đặc biệt để làm to màn hình
        if (track.source === Track.Source.ScreenShare) {
            wrapper.classList.add("screen-share-video");
        }

        const video = track.attach();
        
        // Gán nhãn tên người dùng
        const label = document.createElement('div');
        label.className = "username-label";
        const sourceText = track.source === Track.Source.ScreenShare ? " (Đang chia sẻ)" : "";
        label.innerText = `${participant.identity}${sourceText}`;

        wrapper.append(video, label);

        // Thứ tự hiển thị: Screen Share lên đầu, Camera sau
        if (track.source === Track.Source.ScreenShare) {
            videoGrid.prepend(wrapper);
        } else {
            videoGrid.appendChild(wrapper);
        }

        adjustLayout();
    }
});

room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
    track.detach().forEach(el => el.remove());
    if (track.kind === Track.Kind.Video) {
        document.getElementById(`wrap-${participant.identity}-${track.source}`)?.remove();
        adjustLayout();
    }
});

// ---------------- CHAT ----------------
function sendMsg() {
    const text = chatInput.value.trim();
    if (!text) return;

    const payload = new TextEncoder().encode(JSON.stringify({ message: text }));
    room.localParticipant.publishData(payload, { reliable: true });

    appendChat("Bạn", text, "text-info");
    chatInput.value = "";
}

room.on(RoomEvent.DataReceived, (payload, participant) => {
    const data = JSON.parse(new TextDecoder().decode(payload));
    appendChat(participant.identity, data.message, "text-warning");
});

function appendChat(user, msg, color) {
    const div = document.createElement('div');
    div.innerHTML = `<span class="${color} fw-bold">${user}:</span> ${msg}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.getElementById('send-btn').onclick = sendMsg;
chatInput.onkeypress = e => e.key === 'Enter' && sendMsg();

// ---------------- CONTROLS ----------------
micBtn.onclick = async () => {
    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    micBtn.className = !enabled ? "btn btn-secondary rounded-circle" : "btn btn-danger rounded-circle";
};
let cameraEnabled = true;

const camIcon = camBtn.querySelector("i");

camBtn.onclick = async () => {
    if (!room || room.state !== "connected") return;

    const enabled = room.localParticipant.isCameraEnabled;

    await room.localParticipant.setCameraEnabled(!enabled);

    camIcon.className = !enabled
        ? "bi bi-camera-video-fill"
        : "bi bi-camera-video-off-fill";

    camBtn.classList.toggle("btn-secondary", !enabled);
    camBtn.classList.toggle("btn-danger", enabled);

    if (!enabled) {
        setTimeout(renderLocalVideo, 120);
    } else {
        document.getElementById("local-video")?.remove();
    }
};
callBtn.onclick = async () => {
    if (joined) return;

    try {
        NProgress.start();

        await room.localParticipant.enableCameraAndMicrophone();

        // đợi track khởi tạo xong
        setTimeout(renderLocalVideo, 100);

        micBtn.disabled = false;
        camBtn.disabled = false;
        shareBtn.disabled = false;

        callBtn.className = 'btn btn-secondary px-4';
        callBtn.innerHTML = '<i class="bi bi-telephone-x-fill"></i> Đang trong cuộc gọi';

        joined = true;
        NProgress.done();

    } catch (e) {
        NProgress.done();
        Swal.fire('Thiết bị lỗi', e.message, 'error');
    }
};

shareBtn.onclick = async () => {
    const enabled = room.localParticipant.isScreenShareEnabled;

    if (!enabled) {
        await room.localParticipant.setScreenShareEnabled(true, {
            audio: true,
            resolution: { width: 1920, height: 1080 },
            frameRate: 30,
            bitrate: 4_000_000,
        });

        setTimeout(renderLocalScreen, 200);

    } else {
        await room.localParticipant.setScreenShareEnabled(false);
        document.getElementById("local-screen")?.remove();
        adjustLayout();
    }
};

document.getElementById('leave-btn').onclick = () => location.reload();
function adjustLayout() {
    const hasScreen = document.querySelector('.screen-share-video');
    const cams = document.querySelectorAll('.video-wrapper:not(.screen-share-video)');

    cams.forEach(el => {
        el.style.height = hasScreen ? "160px" : "250px";
    });
}
// ---------------- PING ----------------
setInterval(async () => {
    const iconEl = document.getElementById("ping-icon");
    const textEl = document.getElementById("ping-value");

    // 1. Kiểm tra kết nối Room
    if (!room || room.state !== "connected") {
        if (iconEl) iconEl.className = "bi bi-reception-4 text-secondary ping-icon";
        if (textEl) textEl.innerText = "--";
        return;
    }

    const PING_URL = "https://abcsnoob-l5aam0b3.livekit.cloud";

    try {
        const startTime = performance.now();
        NProgress.start();

        await fetch(PING_URL, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-cache'
        });

        const endTime = performance.now();
        NProgress.done();

        const pingValue = Math.round((endTime - startTime) / 2);
        if (textEl) textEl.innerText = `${pingValue}`;

        // 2. Logic đổi Class tại ID ping-icon
        if (iconEl) {
            let colorClass = "";
            if (pingValue <= 50) {
                colorClass = "text-success"; // 0-50ms: Xanh
            } else if (pingValue <= 120) {
                colorClass = "text-warning"; // 51-120ms: Vàng
            } else {
                colorClass = "text-danger";  // 120ms+: Đỏ
            }
            iconEl.className = `bi bi-reception-4 ${colorClass} ping-icon`;
        }

        // 3. Cảnh báo Swal nếu Ping quá cao (> 500ms)
        if (pingValue > 500) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: `Mạng của bạn không ổn định. Vui lòng kiểm tra lại mạng của bạn.`,
                showConfirmButton: false,
                timer: 5000
            });
        }

    } catch (error) {
        NProgress.done();
        if (iconEl) iconEl.className = "bi bi-reception-4 text-danger ping-icon";
        if (textEl) textEl.innerText = "Err";
    }
}, 3000); // 10 giây check một lần
// ---------------- TOGGLE CHAT ----------------
const toggleChatBtn = document.getElementById('toggle-chat');
const chatSidebar = document.getElementById('chat-sidebar');

toggleChatBtn.onclick = () => {
    chatSidebar.classList.toggle('chat-closed');
    
    // Đổi icon để người dùng biết trạng thái
    const icon = toggleChatBtn.querySelector('i');
    if (chatSidebar.classList.contains('chat-closed')) {
        icon.className = 'bi bi-layout-sidebar fs-5'; // Icon đóng
    } else {
        icon.className = 'bi bi-layout-sidebar-reverse fs-5'; // Icon mở
    }

    // Sau khi đóng/mở chat, cần gọi lại hàm adjustLayout (nếu có) 
    // để video căn chỉnh lại diện tích mới
    if (typeof adjustLayout === 'function') {
        setTimeout(adjustLayout, 300); 
    }
};
