const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
app.use(cors());
app.use(express.json());
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lovechat');

// Mongo Schema
const messageSchema = new mongoose.Schema({
  name: String, text: String, timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// Upload Setup
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads/'),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

// Local Auth
const USERS = { mohib: "zainab", zainab: "mohib", bob: "bob", alice: "alice" };
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] === password) res.sendStatus(200);
  else res.sendStatus(401);
});

// Upload
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Messages
app.get('/messages', async (_, res) => {
  const messages = await Message.find().sort({ timestamp: 1 }).limit(100);
  res.json(messages);
});
app.delete('/messages', async (_, res) => { await Message.deleteMany({}); res.sendStatus(200); });
app.delete('/messages/:id', async (req, res) => { await Message.findByIdAndDelete(req.params.id); res.sendStatus(200); });

// Socket.IO
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
let onlineUsers = [];

io.on("connection", (socket) => {
  socket.on("user_connected", (name) => {
    socket.username = name;
    if (!onlineUsers.includes(name)) onlineUsers.push(name);
    io.emit("online_users", onlineUsers);
  });

  socket.on("send_message", async (data) => {
    const newMsg = new Message(data);
    await newMsg.save();
    io.emit("receive_message", data);
  });

  socket.on("share_file", (data) => {
    io.emit("file_shared", data);
  });

  socket.on("typing", (name) => {
    socket.broadcast.emit("typing", name);
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      onlineUsers = onlineUsers.filter(user => user !== socket.username);
      io.emit("online_users", onlineUsers);
    }
  });
});

// Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
