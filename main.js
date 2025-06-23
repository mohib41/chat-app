const socket = io();

const loginBtn = document.getElementById("login-btn");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("login-error");
const loginSection = document.getElementById("login-section");
const mainSection = document.getElementById("main-section");
const chatList = document.getElementById("chat-list");
const stories = document.getElementById("stories");
const toast = document.getElementById("toast");
const notifySound = document.getElementById("notify-sound");
const uploadStory = document.getElementById("upload-story");

let nickname = "";

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
    mainSection.classList.remove("hidden");
    socket.emit("user_connected", nickname);
    loadChats();
    loadStories();
  } else {
    loginError.classList.remove("hidden");
  }
});

// ✅ Load chat users (mock for now)
async function loadChats() {
  const res = await fetch('/users');
  const users = await res.json();
  chatList.innerHTML = '';
  users.forEach(user => {
    if (user.username !== nickname) {
      const card = document.createElement('div');
      card.className = 'chat-card flex items-center space-x-4 p-3 rounded bg-[#111]';
      card.innerHTML = `
        <img src="${user.avatar}" class="w-12 h-12 rounded-full object-cover">
        <div>
          <p class="font-semibold">${user.nickname}</p>
          <p class="text-sm text-gray-400">Tap to chat 💬</p>
        </div>
      `;
      card.addEventListener("click", () => {
        showToast(`Coming soon: Chat with ${user.nickname}`);
      });
      chatList.appendChild(card);
    }
  });
}

// ✅ Load stories (mock for now)
async function loadStories() {
  const res = await fetch('/stories');
  const data = await res.json();
  stories.innerHTML = '';
  data.forEach(story => {
    const div = document.createElement("div");
    div.className = "w-14 h-14 rounded-full overflow-hidden border-2 border-[#e50914]";
    div.innerHTML = `<img src="${story.image}" class="w-full h-full object-cover">`;
    div.addEventListener("click", () => {
      showToast(`${story.username}'s story`);
    });
    stories.appendChild(div);
  });
}

// ✅ Upload Story
uploadStory.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("story", file);
  formData.append("username", nickname);

  await fetch('/upload-story', { method: "POST", body: formData });
  loadStories();
});

// ✅ Toast
function showToast(msg) {
  toast.innerText = msg;
  toast.style.display = "block";
  notifySound.play().catch(() => {});
  setTimeout(() => { toast.style.display = "none"; }, 3000);
}
