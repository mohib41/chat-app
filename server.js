const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

require('dotenv').config();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ MongoDB Setup
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lovechat');

// ✅ Schemas
const userSchema = new mongoose.Schema({
  name: String,
  avatarUrl: String,
  password: String
});
const chatSchema = new mongoose.Schema({
  users: [String],
  messages: [{
    sender: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
  }]
});
const storySchema = new mongoose.Schema({
  name: String,
  avatarUrl: String,
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Chat = mongoose.model('Chat', chatSchema);
const Story = mongoose.model('Story', storySchema);

// ✅ Dummy login credentials (replace with DB for real app)
const USERS = {
  mohib: "zainab",
  zainab: "mohib"
};

// ✅ Multer Storage for avatars/stories
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${base}-${unique}${ext}`);
  }
});
const upload = multer({ storage });

// ✅ Routes

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] === password) {
    // save user to DB if not exist
    let user = await User.findOne({ name: username });
    if (!user) {
      user = new User({ name: username, avatarUrl: `/uploads/default.png`, password });
      await user.save();
    }
    return res.sendStatus(200);
  }
  res.sendStatus(401);
});

app.get('/chats', async (req, res) => {
  const chats = await Chat.find();
  const result = chats.map(chat => {
    const lastMessage = chat.messages[chat.messages.length - 1];
    return {
      name: chat.users.find(u => u !== "mohib" && u !== "zainab") || "Unknown",
      lastMessage: lastMessage ? lastMessage.text : "Start chatting"
    };
  });
  res.json(result);
});

app.get('/stories', async (req, res) => {
  const stories = await Story.find().sort({ timestamp: -1 }).limit(10);
  res.json(stories);
});

app.post('/upload-story', upload.single('story'), async (req, res) => {
  const file = req.file;
  const name = req.body.name || "anonymous";
  const avatarUrl = `/uploads/${file.filename}`;
  const story = new Story({ name, avatarUrl });
  await story.save();
  res.sendStatus(200);
});

// ✅ Socket.IO Logic

io.on('connection', socket => {
  console.log('✅ New client connected');

  socket.on("user_connected", async (name) => {
    console.log(name, 'connected');
    socket.join(name); // allow DMs
  });

  socket.on("send_message", async ({ to, from, text }) => {
    // Save chat to DB
    let chat = await Chat.findOne({ users: { $all: [to, from] } });
    if (!chat) {
      chat = new Chat({ users: [to, from], messages: [] });
    }
    chat.messages.push({ sender: from, text });
    await chat.save();

    // Emit to recipient
    io.to(to).emit("receive_message", { name: from, text });
  });
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
