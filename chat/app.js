// === Firebase setup ===
const firebaseConfig = {
  apiKey: "AIzaSyDtcs0XkNhf7yFRTzPY-A9WYet35YjQVT8",
  authDomain: "abc-s-noob.firebaseapp.com",
  projectId: "abc-s-noob",
  storageBucket: "abc-s-noob.firebasestorage.app",
  messagingSenderId: "196660846002",
  appId: "1:196660846002:web:ce129820f388cc838658ab",
  measurementId: "G-LG5SWH89MG"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// === Global Variables ===
let localStream = null;
let peers = {}; // { uid: RTCPeerConnection }
let user = null;
let groupId = null;

// === Login Google ===
document.getElementById("loginBtn").onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then(result => {
    user = result.user;
    document.getElementById("mainUI").classList.remove("hidden");
  });
};

// === Join Group ===
document.getElementById("joinBtn").onclick = async () => {
  groupId = document.getElementById("groupInput").value.trim();
  if (!groupId) return;

  await db.collection("groups").doc(groupId).set({}, { merge: true });
  const membersRef = db.collection("groups").doc(groupId).collection("members");
  await membersRef.doc(user.uid).set({ name: user.displayName });

  // Listen to members
  membersRef.onSnapshot(snapshot => {
    document.getElementById("memberList").innerHTML = "";
    snapshot.forEach(doc => {
      const li = document.createElement("li");
      li.textContent = doc.data().name;
      document.getElementById("memberList").appendChild(li);
    });
  });

  // Listen to signaling
  db.collection("groups").doc(groupId).collection("signals")
    .where("to", "==", user.uid)
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        if (data.type === "offer") handleOffer(data);
        if (data.type === "answer") handleAnswer(data);
        if (data.type === "ice") handleIce(data);
      });
    });
};

// === Start Call ===
document.getElementById("startCallBtn").onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const membersRef = db.collection("groups").doc(groupId).collection("members");
  const members = await membersRef.get();

  members.forEach(async doc => {
    const remoteUid = doc.id;
    if (remoteUid === user.uid) return;

    const pc = createPeerConnection(remoteUid);
    peers[remoteUid] = pc;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendSignal({
      from: user.uid,
      to: remoteUid,
      type: "offer",
      sdp: offer
    });
  });
};

// === Create PeerConnection ===
function createPeerConnection(remoteUid) {
  const pc = new RTCPeerConnection();

  pc.onicecandidate = event => {
    if (event.candidate) {
      sendSignal({
        from: user.uid,
        to: remoteUid,
        type: "ice",
        candidate: event.candidate
      });
    }
  };

  pc.ontrack = event => {
    const audio = new Audio();
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  return pc;
}

// === Send signal ===
async function sendSignal(data) {
  await db.collection("groups").doc(groupId)
    .collection("signals").add(data);
}

// === Handle Offer ===
async function handleOffer(data) {
  const pc = createPeerConnection(data.from);
  peers[data.from] = pc;

  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  sendSignal({
    from: user.uid,
    to: data.from,
    type: "answer",
    sdp: answer
  });
}

// === Handle Answer ===
async function handleAnswer(data) {
  const pc = peers[data.from];
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
}

// === Handle ICE ===
async function handleIce(data) {
  const pc = peers[data.from];
  if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
}

// === Hang up ===
document.getElementById("hangupBtn").onclick = () => {
  for (let uid in peers) peers[uid].close();
  peers = {};
};
