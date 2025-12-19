import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, 
    onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, updateDoc, doc, getDoc,
    arrayUnion, arrayRemove, query, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDtcs0XkNhf7yFRTzPY-A9WYet35YjQVT8",
    authDomain: "abc-s-noob.firebaseapp.com",
    projectId: "abc-s-noob",
    storageBucket: "abc-s-noob.firebasestorage.app",
    messagingSenderId: "196660846002",
    appId: "1:196660846002:web:ce129820f388cc838658ab"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ADMIN_EMAIL = "abcsspprt@gmail.com";

// ==========================================
// AUTH & SPINNER TẢI TÀI KHOẢN
// ==========================================
const authStatus = document.getElementById("auth-status");
authStatus.innerHTML = `<div class="spinner-border spinner-border-sm text-primary"></div> <span class="ms-1 small text-muted">Đang check...</span>`;

window.login = async (providerType) => {
    let provider = providerType === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();
    try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); }
};
window.logout = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, (user) => {
    const adminArea = document.getElementById("admin-area");
    if (user) {
        authStatus.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <img src="${user.photoURL}" width="30" class="rounded-circle border">
                <button onclick="logout()" class="btn btn-sm btn-outline-danger rounded-pill px-3">Thoát</button>
            </div>`;
        if (user.email === ADMIN_EMAIL && adminArea) adminArea.style.display = "block";
    } else {
        authStatus.innerHTML = `
            <div class="btn-group border rounded-pill overflow-hidden shadow-sm">
                <button onclick="login('google')" class="btn btn-sm btn-light px-3 border-end">Google</button>
                <button onclick="login('github')" class="btn btn-sm btn-light px-3">Github</button>
            </div>`;
        if (adminArea) adminArea.style.display = "none";
    }
});

// ==========================================
// ACTIONS (REACT, COMMENT, SHARE)
// ==========================================
window.addReaction = async (postId, type) => {
    const user = auth.currentUser;
    if (!user) return alert("Đăng nhập đi ông cháu!");
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);
    const data = postSnap.data();
    let list = Array.isArray(data.reactions?.[type]) ? data.reactions[type] : [];
    await updateDoc(postRef, { [`reactions.${type}`]: list.includes(user.uid) ? arrayRemove(user.uid) : arrayUnion(user.uid) });
};

window.sendComment = async (postId) => {
    const user = auth.currentUser;
    const input = document.getElementById(`in-${postId}`);
    if (!user || !input.value.trim()) return;
    await updateDoc(doc(db, "posts", postId), {
        comments: arrayUnion({
            userName: user.displayName,
            text: input.value,
            date: new Date().toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' })
        })
    });
    input.value = "";
};

window.sharePost = (id, title) => {
    const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
    if (navigator.share) navigator.share({ title, url });
    else { navigator.clipboard.writeText(url); alert("Đã copy link!"); }
};

// ==========================================
// RENDER REALTIME + XỬ LÝ ID KHÔNG TỒN TẠI
// ==========================================
onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snapshot) => {
    const container = document.getElementById("blog-container");
    const activeId = new URLSearchParams(window.location.search).get('id');
    const user = auth.currentUser;

    if (snapshot.empty) {
        container.innerHTML = `<div class="text-center py-5 text-muted small">Chưa có bài viết nào.</div>`;
        return;
    }

    // Biến kiểm tra xem có tìm thấy bài viết khớp với ID không
    let postFound = false;
    let htmlContent = "";

    snapshot.forEach((doc) => {
        const post = doc.data();
        const id = doc.id;

        // Logic lọc ID
        if (activeId && id !== activeId) return;
        if (activeId && id === activeId) postFound = true;

        const isExp = (id === activeId);
        const r = post.reactions || {};
        const hasReacted = (type) => (r[type] || []).includes(user?.uid);
        const getCount = (type) => (r[type] || []).length;
        const time = post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleString('vi-VN') : "...";

        htmlContent += `
            <div class="card border-0 shadow-sm rounded-4 mb-4 ${isExp ? 'border-start border-primary border-4 shadow-lg' : ''}">
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between align-items-center mb-2 small text-muted">
                        <span><i class="fa-regular fa-clock me-1"></i>${time}</span>
                        <button class="btn btn-sm text-primary p-0 shadow-none" onclick="sharePost('${id}', '${post.title}')">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                    </div>
                    <h3 class="fw-bold mb-3">${post.title}</h3>
                    <div class="post-main-wrapper position-relative ${isExp ? 'is-expanded' : 'is-truncated'}">
                        <div style="white-space: pre-wrap; line-height: 1.7;">${post.content}</div>
                        ${!isExp ? `<div class="read-more-overlay"><a href="?id=${id}" class="btn btn-dark btn-sm rounded-pill px-4 shadow fw-bold">Xem thêm...</a></div>` : ''}
                    </div>
                    ${isExp ? `
                        <div class="mt-4 pt-4 border-top">
                            <div class="d-flex flex-wrap gap-2 mb-4">
                                <button class="btn ${hasReacted('like') ? 'btn-primary' : 'btn-outline-primary'} btn-sm rounded-pill px-3 shadow-sm" onclick="addReaction('${id}', 'like')">👍 ${getCount('like')}</button>
                                <button class="btn ${hasReacted('heart') ? 'btn-danger' : 'btn-outline-danger'} btn-sm rounded-pill px-3 shadow-sm" onclick="addReaction('${id}', 'heart')">❤️ ${getCount('heart')}</button>
                                <button class="btn ${hasReacted('love') ? 'btn-warning text-white' : 'btn-outline-warning'} btn-sm rounded-pill px-3 shadow-sm" onclick="addReaction('${id}', 'love')">🥰 ${getCount('love')}</button>
                                <button class="btn ${hasReacted('haha') ? 'btn-info text-white' : 'btn-outline-info'} btn-sm rounded-pill px-3 shadow-sm" onclick="addReaction('${id}', 'haha')">😆 ${getCount('haha')}</button>
                                <button class="btn ${hasReacted('cry') ? 'btn-secondary' : 'btn-outline-secondary'} btn-sm rounded-pill px-3 shadow-sm" onclick="addReaction('${id}', 'cry')">😭 ${getCount('cry')}</button>
                                <button class="btn ${hasReacted('angry') ? 'btn-dark' : 'btn-outline-dark'} btn-sm rounded-pill px-3 shadow-sm" onclick="addReaction('${id}', 'angry')">😡 ${getCount('angry')}</button>
                            </div>
                            <div class="p-3 bg-light rounded-4">
                                <h6 class="fw-bold mb-3 small">Bình luận (${post.comments?.length || 0})</h6>
                                <div class="d-grid gap-2 mb-3">
                                    ${post.comments?.map(c => `
                                        <div class="bg-white p-2 px-3 rounded-3 shadow-sm border-0 small">
                                            <div class="d-flex justify-content-between"><b class="text-primary" style="font-size:0.75rem">${c.userName}</b><span class="text-muted" style="font-size:0.65rem">${c.date}</span></div>
                                            <div class="mt-1">${c.text}</div>
                                        </div>`).join('') || '<p class="text-muted small text-center">Hãy là người đầu tiên bình luận!</p>'}
                                </div>
                                <div class="input-group bg-white rounded-pill p-1 border shadow-sm">
                                    <input type="text" id="in-${id}" class="form-control border-0 bg-transparent ps-3 shadow-none small" placeholder="Viết bình luận...">
                                    <button class="btn btn-primary rounded-pill px-4 btn-sm" onclick="sendComment('${id}')"><i class="fa-solid fa-paper-plane"></i></button>
                                </div>
                            </div>
                            <div class="text-center mt-3"><a href="?" class="text-muted small text-decoration-none">← Quay lại danh sách</a></div>
                        </div>` : ''}
                </div>
            </div>`;
    });

    // HIỂN THỊ LỖI KHI ID KHÔNG TỒN TẠI
    if (activeId && !postFound) {
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="display-1 text-muted mb-3"><i class="fa-solid fa-face-frown-open"></i></div>
                <h2 class="fw-bold">404 - Post Đếch Tồn Tại</h2>
                <p class="text-muted">ID này bị sai hoặc bài viết đã bị Admin "bay màu".</p>
                <a href="?" class="btn btn-dark rounded-pill px-5 mt-3 shadow">Quay về trang chủ</a>
            </div>`;
    } else {
        container.innerHTML = htmlContent;
        if (activeId) window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});
