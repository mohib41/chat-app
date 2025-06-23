const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lovechat');

const storySchema = new mongoose.Schema({
  username: String,
  image: String,
  timestamp: { type: Date, default: Date.now }
});
const Story = mongoose.model('Story', storySchema);

// Fake users (can be extended later)
const USERS = {
  mohib: { password: "zainab", nickname: "💖 My King", avatar: "https://i.pravatar.cc/150?img=3" },
  zainab: { password: "mohib", nickname: "🌸 My Queen", avatar: "https://i.pravatar.cc/150?img=5" },
  alice: { password: "123", nickname: "🎀 Alice", avatar: "https://i.pravatar.cc/150?img=1" },
  bob:   { password: "456", nickname: "🎩 Bob", avatar: "https://i.pravatar.cc/150?img=2" }
};

// ✅ Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (USERS[username]?.password === password) {
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

// ✅ Get all users (for chat list)
app.get('/users', (req, res) => {
  const result = Object.keys(USERS).map(key => ({
    username: key,
    nickname: USERS[key].nickname,
    avatar: USERS[key].avatar
  }));
  res.json(result);
});

// ✅ Get stories
app.get('/stories', async (req, res) => {
  const data = await Story.find().sort({ timestamp: -1 }).limit(20);
  res.json(data);
});

// ✅ Upload stories
const storyStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadStory = multer({ storage: storyStorage });

app.post('/upload-story', uploadStory.single('story'), async (req, res) => {
  const username = req.body.username;
  const image = `/uploads/${req.file.filename}`;
  await new Story({ username, image }).save();
  res.sendStatus(200);
});

// ✅ Socket.IO
io.on('connection', (socket) => {
  socket.on("user_connected", name => {
    console.log(`${name} is online`);
  });
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
