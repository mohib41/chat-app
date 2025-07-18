// ✅ server.js

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { User, Message } = require('./models');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs'); // for deleting files
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

mongoose.connect(process.env.MONGO_URI);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public'))); // ✅ Serve /public folder

// ✅ [NEW] Setup multer for file uploads
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads/'),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// ========== Auth ==========
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, email, passwordHash });
    await user.save();

    res.sendStatus(201);
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET);
  res.json({ token });
});

app.post('/send-otp', async (req, res) => {
  const { username } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
  await User.findOneAndUpdate({ username }, { otp, otpExpiry });
  console.log(`OTP for ${username}: ${otp}`);
  res.sendStatus(200);
});

app.post('/verify-otp', async (req, res) => {
  const { username, otp } = req.body;
  const user = await User.findOne({ username });
  if (user && user.otp === otp && new Date() < user.otpExpiry) {
    return res.sendStatus(200);
  }
  return res.status(401).json({ error: 'Invalid or expired OTP' });
});

app.get('/users', async (req, res) => {
  const users = await User.find({}, 'username');
  res.json(users);
});

// ✅ Add this route to server.js
app.post('/add-friend', async (req, res) => {
  const { user, friend } = req.body;

  if (user === friend) return res.status(400).json({ error: "Cannot add yourself." });

  const targetUser = await User.findOne({ username: friend });
  if (!targetUser) return res.status(404).json({ error: "User not found" });

  await User.updateOne({ username: user }, { $addToSet: { friends: friend } });
  res.sendStatus(200);
});

// ✅ Get your friends
app.get('/friends/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user.friends);
});

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const inputPath = req.file.path; // e.g. uploads/12345-voice.webm
  const isVoice = req.file.originalname.includes('voice');

  // If not voice, return as-is
  if (!isVoice) {
    return res.json({ url: `/uploads/${req.file.filename}` });
  }

  // Convert to MP3
  const mp3Filename = req.file.filename.replace(/\.\w+$/, '.mp3');
  const mp3Path = `uploads/${mp3Filename}`;

  ffmpeg(inputPath)
    .toFormat('mp3')
    .save(mp3Path)
    .on('end', () => {
      // Optional: delete original file
      fs.unlinkSync(inputPath);
      res.json({ url: `/uploads/${mp3Filename}` });
    })
    .on('error', err => {
      console.error('FFmpeg error:', err);
      res.status(500).json({ error: 'Failed to convert voice file' });
    });
});


// ✅ Friend Request System
app.post('/send-friend-request', async (req, res) => {
  const { from, to } = req.body;
  if (from === to) return res.status(400).json({ error: 'Cannot request yourself' });

  const recipient = await User.findOne({ username: to });
  if (!recipient) return res.status(404).json({ error: 'User not found' });

  if (recipient.friends?.includes(from)) return res.status(400).json({ error: 'Already friends' });

  if (recipient.friendRequests?.includes(from)) return res.status(400).json({ error: 'Request already sent' });

  await User.updateOne({ username: to }, { $addToSet: { friendRequests: from } });
  io.to(to).emit('friend_request_received', { from });
  res.sendStatus(200);
});

app.post('/accept-friend-request', async (req, res) => {
  const { username, from } = req.body;
  const user = await User.findOne({ username });
  const sender = await User.findOne({ username: from });

  if (!user || !sender) return res.status(404).json({ error: 'User not found' });

  await User.updateOne({ username }, {
    $pull: { friendRequests: from },
    $addToSet: { friends: from }
  });
  await User.updateOne({ username: from }, {
    $addToSet: { friends: username }
  });

  io.to(from).emit('friend_request_accepted', { by: username });
  res.sendStatus(200);
});

app.get('/friend-requests/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user.friendRequests || []);
});

// Chat History
app.get('/messages/:from/:to', async (req, res) => {
  const { from, to } = req.params;
  const msgs = await Message.find({
    $or: [
      { from, to },
      { from: to, to: from }
    ]
  }).sort({ timestamp: 1 });
  res.json(msgs);
});

app.delete('/messages/:from/:to', async (req, res) => {
  const { from, to } = req.params;
  await Message.deleteMany({
    $or: [
      { from, to },
      { from: to, to: from }
    ]
  });
  res.sendStatus(200);
});

app.delete('/messages/:id', async (req, res) => {
  await Message.findByIdAndDelete(req.params.id);
  res.sendStatus(200);
});

// Serve HTML pages
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/chat.html', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/register.html', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// WebSockets
let onlineUsers = [];

io.on('connection', (socket) => {
  socket.on('user_connected', (username) => {
    socket.username = username;
    socket.join(username); // ✅ join personal room
    if (!onlineUsers.includes(username)) {
      onlineUsers.push(username);
    }
    io.emit('online_users', onlineUsers);
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      onlineUsers = onlineUsers.filter(user => user !== socket.username);
      io.emit('online_users', onlineUsers);
    }
  });

  socket.on('join_room', ({ from, to }) => {
    const room = [from, to].sort().join('_');
    socket.join(room);
    socket.room = room;
  });

  socket.on("typing", ({ from, to, typing }) => {
  const room = [from, to].sort().join("_");
  io.to(room).emit("typing", { from, to, typing });
});

  socket.on('send_message', async ({ from, to, text }) => {
    const room = [from, to].sort().join('_');
    const msg = new Message({ from, to, text });
    await msg.save();
    io.to(room).emit('receive_message', msg);
  });

  socket.on('share_file', (data) => {
    const room = [data.from, data.to].sort().join('_');
    io.to(room).emit('file_shared', data);
  });
   // ✅ Friend request system
  socket.on("friend_request_sent", ({ from, to }) => {
    io.to(to).emit("friend_request_received", { from });
  });

  socket.on("friend_request_accepted", ({ from, to }) => {
    io.to(to).emit("friend_request_accepted", { from });
  });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
