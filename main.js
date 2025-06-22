const socket = io(); // ✅ Automatically connects to current domain

const loginBtn = document.getElementById("login-btn");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const chatBox = document.getElementById("chat-box");
const fileForm = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");
const deleteAllBtn = document.getElementById("delete-all-btn");

let nickname = "";

// 💕 Nickname Mapping
const nicknameMap = {
  mohib: "💖 My King",
  zainab: "🌸 My Queen"
};

// ✅ Handle login
loginBtn.addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    nickname = username;
    document.getElementById("login-section").classList.add("hidden");
    document.getElementById("chat-section").classList.remove("hidden");

    socket.emit("user_connected", nickname);
    loadChatHistory();
  } else {
    document.getElementById("login-error").classList.remove("hidden");
  }
});

// ✅ Add message to chat
function appendMessage(id, name, text) {
  const div = document.createElement("div");
  div.className = "bg-white rounded-lg p-2 shadow border border-purple-300 flex justify-between items-center";

  const displayName = nicknameMap[name] || name;

  div.innerHTML = `
    <span><strong class="text-purple-600">${displayName}</strong>: ${text}</span>
    ${nickname === name ? `<button onclick="deleteMessage('${id}')" class="text-red-500 text-sm ml-4">🗑️</button>` : ''}
  `;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ✅ Add shared file to chat
function appendFile(name, filename, url) {
  const div = document.createElement("div");
  div.className = "bg-white rounded-lg p-2 shadow border border-pink-300";

  const displayName = nicknameMap[name] || name;

  div.innerHTML = `<strong class="text-purple-600">${displayName}</strong> sent: <a href="${url}" download class="text-pink-600 underline">${filename}</a>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ✅ Listen for messages
socket.on("receive_message", ({ _id, name, text }) => {
  appendMessage(_id, name, text);
});

// ✅ Listen for shared files
socket.on("file_shared", ({ name, filename, url }) => {
  appendFile(name, filename, url);
});

// ✅ Send message
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = messageInput.value.trim();
  if (msg !== "") {
    socket.emit("send_message", { name: nickname, text: msg });
    messageInput.value = "";
  }
});

// ✅ Upload and share file
fileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch('/upload', { method: "POST", body: formData });
  const data = await res.json();

  socket.emit("share_file", {
    name: nickname,
    filename: file.name,
    url: data.url
  });

  fileInput.value = "";
});

// ✅ Delete All Messages
deleteAllBtn?.addEventListener("click", async () => {
  if (confirm("Are you sure you want to delete all messages?")) {
    await fetch('/messages', { method: "DELETE" });
    chatBox.innerHTML = '';
  }
});

// ✅ Delete Single Message
async function deleteMessage(id) {
  await fetch(`/messages/${id}`, { method: "DELETE" });
  chatBox.innerHTML = '';
  loadChatHistory();
}

// ✅ Load message history
async function loadChatHistory() {
  try {
    const res = await fetch('/messages');
    const messages = await res.json();
    messages.forEach(msg => appendMessage(msg._id, msg.name, msg.text));
  } catch (err) {
    console.error("Failed to load messages", err);
  }
}

// ✅ Debugging
socket.on("connect", () => {
  console.log("✅ Connected to Socket.IO:", socket.id);
});
