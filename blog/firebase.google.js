// ==========================================
// 1. IMPORT FIREBASE SDK
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, 
    FacebookAuthProvider, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, updateDoc, doc, getDoc,
    arrayUnion, arrayRemove, query, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 2. CONFIGURATION
// ==========================================
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
// 3. AUTHENTICATION & SPINNER TRẠNG THÁI
// ==========================================
// Hiện spinner ngay khi web mới load để check login
document.getElementById("auth-status").innerHTML = `<div class="spinner-border spinner-border-sm text-secondary"></div>`;

window.login = async (providerType) => {
    let provider;
    if (providerType === 'google') provider = new GoogleAuthProvider();
    else if (providerType === 'github') provider = new GithubAuthProvider();
    
    try {
        await signInWithPopup(auth, provider);
    } catch (e) { console.error(e); }
};

window.logout = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, (user) => {
    const adminArea = document.getElementById("admin-area");
    const authStatus = document.getElementById("auth-status");

    if (user) {
        authStatus.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <img src="${user.photoURL}" width="32" class="rounded-circle shadow-sm">
                <button onclick="logout()" class="btn btn-sm btn-outline-danger rounded-pill">Thoát</button>
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
// 4. CHỨC NĂNG CHÍNH (POST, REACTION, COMMENT, SHARE)
// ==========================================

// Đăng bài (Admin)
window.createPost = async (title, content) => {
    const user = auth.currentUser;
    if (!user || user.email !== ADMIN_EMAIL) return;
    await addDoc(collection(db, "posts"), {
        title, content, author: user.displayName,
        createdAt: serverTimestamp(),
        reactions: { like: [], heart: [] },
        comments: []
    });
};

// Reaction chống spam (Array based)
window.addReaction = async (postId, type) => {
    const user = auth.currentUser;
    if (!user) return alert("Đăng nhập để thả tim!");

    const btn = event.currentTarget;
    btn.disabled = true; // Khóa nút chống spam click

    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);
    const data = postSnap.data();
    
    // Đảm bảo dữ liệu cũ là Array (Fix lỗi Number cũ)
    let list = Array.isArray(data.reactions?.[type]) ? data.reactions[type] : [];

    if (list.includes(user.uid)) {
        await updateDoc(postRef, { [`reactions.${type}`]: arrayRemove(user.uid) });
    } else {
        await updateDoc(postRef, { [`reactions.${type}`]: arrayUnion(user.uid) });
    }
    btn.disabled = false;
};

// Gửi bình luận
window.sendComment = async (postId) => {
    const user = auth.currentUser;
    const input = document.getElementById(`in-${postId}`);
    if (!user) return alert("Cần đăng nhập!");
    if (!input.value.trim()) return;

    const btn = event.currentTarget;
    btn.disabled = true;

    await updateDoc(doc(db, "posts", postId), {
        comments: arrayUnion({
            userName: user.displayName,
            text: input.value,
            date: new Date().toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' })
        })
    });
    input.value = "";
    btn.disabled = false;
};

// Share bài viết
window.sharePost = (id, title) => {
    const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
    if (navigator.share) {
        navigator.share({ title, url });
    } else {
        navigator.clipboard.writeText(url);
        alert("Đã copy link bài viết!");
    }
};

// ==========================================
// 5. RENDER REALTIME + BLOG SPINNER
// ==========================================
// Hiện spinner lúc đợi bài viết tải về
document.getElementById("blog-container").innerHTML = `
    <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-2 text-muted small">Đang tải bài viết...</p>
    </div>`;

onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (snapshot) => {
    const container = document.getElementById("blog-container");
    if (!container) return;

    const activeId = new URLSearchParams(window.location.search).get('id');
    const user = auth.currentUser;

    if (snapshot.empty) {
        container.innerHTML = `<div class="text-center py-5 text-muted small">Chưa có bài viết nào.</div>`;
        return;
    }

    container.innerHTML = "";
    snapshot.forEach((doc) => {
        const post = doc.data();
        const id = doc.id;
        const isExp = (id === activeId);

        // Xử lý Reaction counts và States
        const likes = Array.isArray(post.reactions?.like) ? post.reactions.like : [];
        const hearts = Array.isArray(post.reactions?.heart) ? post.reactions.heart : [];
        const liked = likes.includes(user?.uid);
        const hearted = hearts.includes(user?.uid);

        const time = post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleString('vi-VN') : "Đang xử lý...";

        container.innerHTML += `
            <div class="card border-0 shadow-sm rounded-4 mb-4 ${isExp ? 'border-start border-primary border-4 shadow' : ''}">
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between align-items-center mb-2 small text-muted">
                        <span><i class="fa-regular fa-clock me-1"></i>${time}</span>
                        <button class="btn btn-sm text-primary p-0 shadow-none" onclick="sharePost('${id}', '${post.title}')">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                    </div>

                    <h3 class="fw-bold mb-3">${post.title}</h3>
                    <div class="post-text ${isExp ? '' : 'text-truncate-3'}" style="white-space: pre-wrap; line-height: 1.7;">${post.content}</div>

                    ${isExp ? `
                        <div class="mt-4 pt-4 border-top">
                            <div class="d-flex gap-2 mb-4">
                                <button class="btn ${liked ? 'btn-primary' : 'btn-outline-primary'} rounded-pill px-4 shadow-sm fw-bold" onclick="addReaction('${id}', 'like')">👍 ${likes.length}</button>
                                <button class="btn ${hearted ? 'btn-danger' : 'btn-outline-danger'} rounded-pill px-4 shadow-sm fw-bold" onclick="addReaction('${id}', 'heart')">❤️ ${hearts.length}</button>
                            </div>

                            <div class="p-3 bg-light rounded-4">
                                <h6 class="fw-bold mb-3"><i class="fa-solid fa-comments me-2"></i>Bình luận (${post.comments?.length || 0})</h6>
                                <div class="d-grid gap-2 mb-3">
                                    ${post.comments?.map(c => `
                                        <div class="bg-white p-2 px-3 rounded-3 shadow-sm border-0">
                                            <div class="d-flex justify-content-between small">
                                                <b class="text-primary" style="font-size:0.8rem">${c.userName}</b>
                                                <span class="text-muted" style="font-size:0.7rem">${c.date}</span>
                                            </div>
                                            <div class="mt-1 small" style="white-space: pre-wrap;">${c.text}</div>
                                        </div>
                                    `).join('') || '<p class="text-muted small text-center">Hãy là người đầu tiên bình luận!</p>'}
                                </div>
                                <div class="input-group bg-white rounded-pill p-1 border shadow-sm">
                                    <input type="text" id="in-${id}" class="form-control border-0 bg-transparent ps-3 shadow-none" placeholder="Viết bình luận...">
                                    <button class="btn btn-primary rounded-pill px-4" onclick="sendComment('${id}')"><i class="fa-solid fa-paper-plane"></i></button>
                                </div>
                            </div>
                            <div class="text-center mt-3"><a href="?" class="text-muted small text-decoration-none">← Thu gọn bài viết</a></div>
                        </div>
                    ` : `
                        <div class="mt-3"><a href="?id=${id}" class="btn btn-dark btn-sm rounded-pill px-4 fw-bold shadow-sm">Đọc chi tiết</a></div>
                    `}
                </div>
            </div>`;
    });
});