// ✅ main.js

const socket = io();
let currentUser = localStorage.getItem('username');
let currentChatWith = null;
const chatBox = document.getElementById("chat-box");
const toast = document.getElementById("toast");
const privacyToggle = document.getElementById("privacy-toggle");
const notifySound = document.getElementById("notify-sound");
const typingIndicator = document.getElementById("typing-indicator");

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
      socket.emit("typing", { from: currentUser, to: currentChatWith, typing: false });
    }
  });

  document.getElementById("message-input").addEventListener("input", () => {
    socket.emit("typing", {
      from: currentUser,
      to: currentChatWith,
      typing: true
    });
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      socket.emit("typing", {
        from: currentUser,
        to: currentChatWith,
        typing: false
      });
    }, 1000);
  });

  document.getElementById("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.getElementById("file-input").files[0];
    if (!file || !currentChatWith) return;
    const formData = new FormData();
    formData.append("file", file);

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
  });

  document.getElementById("delete-all-btn")?.addEventListener("click", async () => {
    if (confirm("Are you sure you want to delete all messages with this user?")) {
      await fetch(`/messages/${currentUser}/${currentChatWith}`, { method: 'DELETE' });
      chatBox.innerHTML = '';
    }
  });

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

    if (from !== currentUser) {
      const msg = privacyToggle?.checked ? null : text;
      showToast(from, msg);
      notifySound?.play().catch(() => {});
    }
  });

  socket.on("file_shared", ({ from, to, filename, url }) => {
    const isCurrent = (from === currentChatWith && to === currentUser) || (from === currentUser && to === currentChatWith);
    if (isCurrent) {
      const div = document.createElement("div");
      div.className = "bg-white p-2 rounded shadow";
      div.innerHTML = `<strong class="text-purple-600">${from}</strong> sent: <a href="${url}" download class="text-pink-600 underline">${filename}</a>`;
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    if (from !== currentUser) {
      showToast(from, `📎 ${filename}`);
      notifySound?.play().catch(() => {});
    }
  });

  socket.on("typing", ({ from, typing }) => {
    if (from === currentChatWith && typing) {
      typingIndicator.innerText = `${from} is typing...`;
    } else if (from === currentChatWith && !typing) {
      typingIndicator.innerText = '';
    }
  });

  socket.on("online_users", async (users) => {
    const select = document.getElementById("user-select");
    const onlineDiv = document.getElementById("online-users");
    const res = await fetch(`/friends/${currentUser}`);
    const friends = await res.json();

    select.innerHTML = friends
      .filter(f => f !== currentUser)
      .map(f => `<option value="${f}">${f}</option>`)
      .join('');

    const onlineFriends = users.filter(u => friends.includes(u));
    onlineDiv.innerText = `Online: ${onlineFriends.join(', ')}`;

    if (!currentChatWith && select.options.length > 0) {
      currentChatWith = select.options[0].value;
      socket.emit("join_room", { from: currentUser, to: currentChatWith });
      loadMessages();
    }

    joinAllRooms(users);
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

  function joinAllRooms(users) {
    users.forEach(user => {
      if (user !== currentUser) {
        socket.emit("join_room", { from: currentUser, to: user });
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const addFriendBtn = document.getElementById("add-friend-btn");
  const friendInput = document.getElementById("add-friend-username");
  const statusMsg = document.getElementById("add-friend-status");

  if (addFriendBtn) {
    addFriendBtn.addEventListener("click", async () => {
      const friend = friendInput.value.trim();
      if (!friend) return;

      const res = await fetch('/send-friend-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: currentUser, to: friend })
      });

      const data = await res.json();

      if (res.ok) {
        statusMsg.textContent = "✅ Request sent!";
        socket.emit("friend_request_sent", { from: currentUser, to: friend });
        friendInput.value = "";
      } else {
        statusMsg.textContent = `❌ ${data.error || "Failed to send request"}`;
      }

      statusMsg.classList.remove("hidden");
      setTimeout(() => statusMsg.classList.add("hidden"), 3000);
    });
  }
});

// ✅ Friend Request Notification Handlers (Toast with buttons)
socket.on("friend_request_received", ({ from }) => {
  toast.innerHTML = `
    <div class="space-y-2">
      <div><strong>${from}</strong> sent you a friend request 💌</div>
      <div class="flex gap-2">
        <button id="accept-btn" class="bg-green-500 text-white px-2 py-1 rounded text-sm">Accept</button>
        <button id="reject-btn" class="bg-gray-400 text-white px-2 py-1 rounded text-sm">Reject</button>
      </div>
    </div>
  `;
  toast.classList.remove("hidden");
  notifySound?.play().catch(() => {});

  document.getElementById("accept-btn").onclick = async () => {
    const res = await fetch("/accept-friend-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser, from })
    });
    if (res.ok) {
      showToast(`You are now friends with ${from}`);
      socket.emit("friend_request_accepted", { from: currentUser, to: from });
      toast.classList.add("hidden");
    }
  };

  document.getElementById("reject-btn").onclick = () => {
    toast.classList.add("hidden");
  };
});

socket.on("friend_request_accepted", ({ from }) => {
  showToast("✅ Friend Accepted", `${from} accepted your request`);
  notifySound?.play().catch(() => {});
});
