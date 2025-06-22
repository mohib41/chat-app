const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serves index.html, main.js
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer (file upload)
const upload = multer({ dest: 'uploads/' });

// Dummy Auth
const USERS = { mohib: "zainab", zainab: "mohib" };

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] === password) res.sendStatus(200);
  else res.sendStatus(401);
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// MongoDB Chat Schema
const messageSchema = new mongoose.Schema({
  name: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', messageSchema);

// Chat history endpoint
app.get('/messages', async (req, res) => {
  const messages = await Message.find().sort({ timestamp: 1 }).limit(100);
  res.json(messages);
});

// Socket.IO
io.on("connection", (socket) => {
  socket.on("user_connected", (name) => console.log(`${name} connected`));
  socket.on("send_message", async (data) => {
    const msg = new Message(data);
    await msg.save();
    io.emit("receive_message", data);
  });
  socket.on("share_file", data => io.emit("file_shared", data));
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
