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
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

mongoose.connect(process.env.MONGO_URI);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public'))); // ✅ Serve /public folder

// File Upload
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads/'),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// ========== Auth ==========
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = new User({ username, email, passwordHash });
  await user.save();
  res.sendStatus(201);
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

// Upload File
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
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

// WebSockets
io.on('connection', (socket) => {
  socket.on('join_room', ({ from, to }) => {
    const room = [from, to].sort().join('_');
    socket.join(room);
    socket.room = room;
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));