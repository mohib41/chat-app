// ✅ main.js

const socket = io();
let currentUser = localStorage.getItem('username');
let currentChatWith = null;
const chatBox = document.getElementById("chat-box");
const toast = document.getElementById("toast");
const privacyToggle = document.getElementById("privacy-toggle");
const notifySound = document.getElementById("notify-sound");

if (document.getElementById("login-btn")) {
  document.getElementById("login-btn").addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) {
      localStorage.setItem('username', username);
      window.location.href = 'chat.html';
    } else {
      document.getElementById("login-error").classList.remove("hidden");
    }
  });
}

if (document.getElementById("chat-form")) {
  document.getElementById("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("message-input");
    const msg = input.value.trim();
    if (msg && currentChatWith) {
      socket.emit("send_message", {
        from: currentUser,
        to: currentChatWith,
        text: msg
      });
      input.value = "";
    }
  });

  document.getElementById("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("file-input").files[0];
    if (!file || !currentChatWith) return;
    const formData = new FormData();
    formData.append("file", file);
  // 🔧 Updated file upload handling
try {
  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();

  if (!data.url) {
    alert("❌ Upload failed on server");
    return;
  }

  socket.emit("share_file", {
    from: currentUser,
    to: currentChatWith,
    filename: file.name,
    url: data.url
  });

  document.getElementById("file-input").value = "";
} catch (err) {
  console.error("Upload error:", err);
  alert("❌ Could not upload file");
}

    document.getElementById("file-input").value = "";
  });

  document.getElementById("delete-all-btn")?.addEventListener("click", async () => {
    if (confirm("Are you sure you want to delete all messages with this user?")) {
      await fetch(`/messages/${currentUser}/${currentChatWith}`, { method: 'DELETE' });
      chatBox.innerHTML = '';
    }
  });

  // 🔧 UPDATED: receive_message — always show toast + sound
  socket.on("receive_message", (data) => {
    const { from, to, text, _id } = data;

    const isCurrent = (from === currentChatWith && to === currentUser) || (from === currentUser && to === currentChatWith);
    if (isCurrent) {
      const div = document.createElement("div");
      div.className = "bg-white p-2 rounded shadow flex justify-between items-center";
      div.innerHTML = `<span><strong class="text-purple-600">${from}</strong>: ${text}</span>` +
        (from === currentUser ? `<button onclick="deleteMessage('${_id}')" class="text-red-500 ml-4">🗑️</button>` : '');
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    // 🔧 ALWAYS show toast + sound if not current user
    if (from !== currentUser) {
      const msg = privacyToggle?.checked ? null : text;
      showToast(from, msg);
      notifySound?.play().catch(() => {});
    }
  });

    // 🔧 UPDATED: file_shared — always show toast + sound
  socket.on("file_shared", ({ from, to, filename, url }) => {
    const isCurrent = (from === currentChatWith && to === currentUser) || (from === currentUser && to === currentChatWith);
    if (isCurrent) {
      const div = document.createElement("div");
      div.className = "bg-white p-2 rounded shadow";
      div.innerHTML = `<strong class="text-purple-600">${from}</strong> sent: <a href="${url}" download class="text-pink-600 underline">${filename}</a>`;
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    // 🔧 ALWAYS notify
    if (from !== currentUser) {
      showToast(from, `📎 ${filename}`);
      notifySound?.play().catch(() => {});
    }
  });

  socket.on("online_users", (users) => {
    const select = document.getElementById("user-select");
    const onlineDiv = document.getElementById("online-users");

    select.innerHTML = users
      .filter(u => u !== currentUser)
      .map(u => `<option value="${u}">${u}</option>`)
      .join('');

    onlineDiv.innerText = `Online: ${users.join(', ')}`;

    if (!currentChatWith && select.options.length > 0) {
      currentChatWith = select.options[0].value;
      socket.emit("join_room", { from: currentUser, to: currentChatWith });
      loadMessages();
    }
  });

  document.getElementById("user-select").addEventListener("change", (e) => {
    currentChatWith = e.target.value;
    socket.emit("join_room", { from: currentUser, to: currentChatWith });
    loadMessages();
  });

  async function loadMessages() {
    const res = await fetch(`/messages/${currentUser}/${currentChatWith}`);
    const msgs = await res.json();
    chatBox.innerHTML = '';
    msgs.forEach(m => {
      const div = document.createElement("div");
      div.className = "bg-white p-2 rounded shadow flex justify-between items-center";
      div.innerHTML = `<span><strong class="text-purple-600">${m.from}</strong>: ${m.text}</span>` +
        (m.from === currentUser ? `<button onclick="deleteMessage('${m._id}')" class="text-red-500 ml-4">🗑️</button>` : '');
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  window.deleteMessage = async function (id) {
    await fetch(`/messages/${id}`, { method: 'DELETE' });
    loadMessages();
  }

  function showToast(title, msg) {
    toast.innerHTML = `<strong>${title}</strong>${msg ? `: ${msg}` : ''}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 4000);
  }

  socket.emit("user_connected", currentUser);
  if (currentChatWith) {
    socket.emit("join_room", { from: currentUser, to: currentChatWith });
  }
}
