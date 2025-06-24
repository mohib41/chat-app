const socket = io();
const notifySound = new Audio('/notify.mp3');

let currentUser = "";
let token = "";
let currentChatUser = "";

// Elements
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const otpInput = document.getElementById("otp");

const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const verifyOtpBtn = document.getElementById("verify-otp-btn");

const authSection = document.getElementById("auth-section");
const chatSection = document.getElementById("chat-section");

const userSelect = document.getElementById("user-select");
const chatBox = document.getElementById("chat-box");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");

const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");
const authError = document.getElementById("auth-error");

// ✅ Auth handlers
registerBtn.addEventListener("click", async () => {
  try {
    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.value,
        email: emailInput.value,
        password: passwordInput.value
      })
    });
    if (res.ok) {
      alert("✅ Registered. Now login.");
    }
  } catch (e) {
    authError.classList.remove("hidden");
  }
});

loginBtn.addEventListener("click", async () => {
  try {
    const res = await fetch('/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput.value })
    });
    alert("🔐 OTP sent (check terminal or console)");
  } catch (e) {
    authError.classList.remove("hidden");
  }
});

verifyOtpBtn.addEventListener("click", async () => {
  try {
    const res = await fetch('/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput.value, otp: otpInput.value })
    });
    if (res.ok) {
      // Proceed to actual login
      const loginRes = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.value,
          password: passwordInput.value
        })
      });
      const data = await loginRes.json();
      token = data.token;
      currentUser = usernameInput.value;
      authSection.classList.add("hidden");
      chatSection.classList.remove("hidden");
      loadUsers();
    }
  } catch (e) {
    authError.classList.remove("hidden");
  }
});

// ✅ Load Users
async function loadUsers() {
  const res = await fetch('/users');
  const users = await res.json();
  userSelect.innerHTML = '';
  users
    .filter(u => u.username !== currentUser)
    .forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.innerText = u.username;
      userSelect.appendChild(opt);
    });
  currentChatUser = userSelect.value;
  joinRoom(currentChatUser);
  loadChatHistory(currentChatUser);
}

userSelect.addEventListener("change", () => {
  currentChatUser = userSelect.value;
  chatBox.innerHTML = '';
  joinRoom(currentChatUser);
  loadChatHistory(currentChatUser);
});

function joinRoom(chatPartner) {
  socket.emit("join_room", { from: currentUser, to: chatPartner });
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = messageInput.value.trim();
  if (!msg) return;
  socket.emit("send_message", {
    from: currentUser,
    to: currentChatUser,
    text: msg
  });
  messageInput.value = '';
});

socket.on("receive_message", (msg) => {
  if (msg.from === currentChatUser || msg.to === currentChatUser) {
    appendMessage(msg);
    notifySound.play().catch(() => {});
  }
});

function appendMessage(msg) {
  const div = document.createElement("div");
  div.className = "bg-white p-2 rounded shadow border";
  div.innerHTML = `<strong class="text-purple-600">${msg.from}</strong>: ${msg.text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function loadChatHistory(partner) {
  const res = await fetch(`/messages/${currentUser}/${partner}`);
  const msgs = await res.json();
  msgs.forEach(appendMessage);
}

// ✅ File upload
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();
  socket.emit("share_file", {
    from: currentUser,
    to: currentChatUser,
    filename: file.name,
    url: data.url
  });
  fileInput.value = '';
});

socket.on("file_shared", ({ from, filename, url }) => {
  const div = document.createElement("div");
  div.className = "bg-pink-100 p-2 rounded shadow";
  div.innerHTML = `<strong>${from}</strong> shared: <a href="${url}" target="_blank" class="text-blue-600 underline">${filename}</a>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});
