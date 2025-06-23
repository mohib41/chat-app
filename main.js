const socket = io();

const loginBtn = document.getElementById("login-btn");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginSection = document.getElementById("login-section");
const chatList = document.getElementById("chat-list");
const notifySound = document.getElementById("notify-sound");
const uploadBtn = document.getElementById("upload-btn");
const uploadStoryBtn = document.getElementById("upload-story");
const stories = document.getElementById("stories");

let nickname = "";
const nicknameMap = { mohib: "💖 My King", zainab: "🌸 My Queen" };

// ✅ Login
loginBtn.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    nickname = username;
    loginSection.classList.add("hidden");
    socket.emit("user_connected", nickname);
    loadChats();
    loadStories();
  } else {
    document.getElementById("login-error").classList.remove("hidden");
  }
});

// ✅ Load Chats from server
function loadChats() {
  fetch('/chats')
    .then(res => res.json())
    .then(data => {
      chatList.innerHTML = "";
      data.forEach(chat => {
        const div = document.createElement("div");
        div.className = "chat-card p-3 rounded shadow flex justify-between items-center";
        const displayName = nicknameMap[chat.name] || chat.name;
        div.innerHTML = `
          <div>
            <div class="font-bold text-[#e50914]">${displayName}</div>
            <div class="text-gray-300 text-sm">${chat.lastMessage}</div>
          </div>
          <button onclick="openChat('${chat.name}')" class="text-sm text-[#e50914]">💌</button>
        `;
        chatList.appendChild(div);
      });
    });
}

// ✅ Open chat
function openChat(partner) {
  window.location.href = `/chat.html?user=${partner}`;
}

// ✅ Load stories from server
function loadStories() {
  fetch('/stories')
    .then(res => res.json())
    .then(data => {
      stories.innerHTML = "";
      data.forEach(user => {
        const avatar = document.createElement("img");
        avatar.className = "w-14 h-14 rounded-full border-2 border-[#e50914] object-cover";
        avatar.src = user.avatarUrl;
        avatar.alt = user.name;
        stories.appendChild(avatar);
      });
    });
}

// ✅ Upload Story
uploadStoryBtn.addEventListener("change", async () => {
  const file = uploadStoryBtn.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("story", file);

  const res = await fetch('/upload-story', {
    method: 'POST',
    body: formData
  });

  if (res.ok) {
    loadStories();
  } else {
    alert("Failed to upload story");
  }
});

// ✅ Notification Example
socket.on("receive_message", ({ name, text }) => {
  if (name !== nickname) {
    notifySound.play().catch(() => {});
  }
});
