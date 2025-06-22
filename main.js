const socket = io(); // ✅ Automatically connects to current domain

const loginBtn = document.getElementById("login-btn");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const chatBox = document.getElementById("chat-box");
const fileForm = document.getElementById("upload-form");
const fileInput = document.getElementById("file-input");

let nickname = "";

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

    // Notify server user has connected
    socket.emit("user_connected", nickname);

    // Load chat history
    loadChatHistory();
  } else {
    document.getElementById("login-error").classList.remove("hidden");
  }
});

// ✅ Add message to chat
function appendMessage(name, text) {
  const div = document.createElement("div");
  div.className = "bg-white rounded-lg p-2 shadow border border-purple-300";
  div.innerHTML = `<strong class="text-purple-600">${name}</strong>: ${text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ✅ Add shared file to chat
function appendFile(name, filename, url) {
  const div = document.createElement("div");
  div.className = "bg-white rounded-lg p-2 shadow border border-pink-300";
  div.innerHTML = `<strong class="text-purple-600">${name}</strong> sent: <a href="${url}" download class="text-pink-600 underline">${filename}</a>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ✅ Listen for incoming messages
socket.on("receive_message", ({ name, text }) => {
  appendMessage(name, text);
});

// ✅ Listen for shared files
socket.on("file_shared", ({ name, filename, url }) => {
  appendFile(name, filename, url);
});

// ✅ Send a message
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = messageInput.value.trim();
  if (msg !== "") {
    socket.emit("send_message", { name: nickname, text: msg });
    messageInput.value = "";
  }
});

// ✅ Upload and share a file
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

// ✅ Load old messages from server
async function loadChatHistory() {
  try {
    const res = await fetch('/messages');
    const messages = await res.json();
    messages.forEach(msg => appendMessage(msg.name, msg.text));
  } catch (err) {
    console.error("Failed to load messages", err);
  }
}

// ✅ Debug socket connection (Optional)
socket.on("connect", () => {
  console.log("✅ Connected to Socket.IO:", socket.id);
});
