const socket = io();

const loginBtn = document.getElementById("login-btn");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const chatBox = document.getElementById("chat-box");
const fileForm = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");
const deleteAllBtn = document.getElementById("delete-all-btn");
const notificationSound = document.getElementById("notification-sound");
const onlineUsersDiv = document.getElementById("online-users");

let nickname = "";

// ✅ Nickname display customization
const nicknameMap = {
  mohib: "💖 My King",
  zainab: "🌸 My Queen"
};

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

function appendMessage(id, name, text) {
  const div = document.createElement("div");
  div.className = "bg-white rounded-lg p-2 shadow border border-purple-300 flex justify-between items-center";

  const displayName = nicknameMap[name] || name;
  div.innerHTML = `<span><strong class="text-purple-600">${displayName}</strong>: ${text}</span>
  ${nickname === name ? `<button onclick="deleteMessage('${id}')" class="text-red-500 text-sm ml-4">🗑️</button>` : ''}`;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  if (name !== nickname) notificationSound.play();
}

function appendFile(name, filename, url) {
  const div = document.createElement("div");
  div.className = "bg-white rounded-lg p-2 shadow border border-pink-300";

  const displayName = nicknameMap[name] || name;
  div.innerHTML = `<strong class="text-purple-600">${displayName}</strong> sent: <a href="${url}" download class="text-pink-600 underline">${filename}</a>`;

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  if (name !== nickname) notificationSound.play();
}

socket.on("receive_message", ({ _id, name, text }) => {
  appendMessage(_id, name, text);
});

socket.on("file_shared", ({ name, filename, url }) => {
  appendFile(name, filename, url);
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = messageInput.value.trim();
  if (msg !== "") {
    socket.emit("send_message", { name: nickname, text: msg });
    messageInput.value = "";
  }
});

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

deleteAllBtn?.addEventListener("click", async () => {
  if (confirm("Are you sure you want to delete all messages?")) {
    await fetch('/messages', { method: "DELETE" });
    chatBox.innerHTML = '';
  }
});

async function deleteMessage(id) {
  await fetch(`/messages/${id}`, { method: "DELETE" });
  chatBox.innerHTML = '';
  loadChatHistory();
}

async function loadChatHistory() {
  try {
    const res = await fetch('/messages');
    const messages = await res.json();
    messages.forEach(msg => appendMessage(msg._id, msg.name, msg.text));
  } catch (err) {
    console.error("Failed to load messages", err);
  }
}

// Online users update
socket.on("update_online_users", (users) => {
  onlineUsersDiv.innerHTML = `Online: ${users.join(", ")}`;
});

socket.on("connect", () => {
  console.log("✅ Connected to Socket.IO:", socket.id);
});
