const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// Serve static files (HTML, JS, uploads)
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lovechat');

// MongoDB Message Schema
const messageSchema = new mongoose.Schema({
  name: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', messageSchema);

// ✅ Configure multer to save original file names
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// 🔐 Simple local login system
const USERS = {
  mohib: "zainab",
  zainab: "mohib",
};

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] === password) {
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

// 📁 File upload route
app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  const url = `/uploads/${file.filename}`;
  res.json({ url });
});

// 🕓 Load recent chat messages
app.get('/messages', async (req, res) => {
  const messages = await Message.find().sort({ timestamp: 1 }).limit(100);
  res.json(messages);
});

// 🏠 Serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 🔌 Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on("connection", socket => {
  socket.on("user_connected", name => {
    console.log(`${name} connected`);
  });

  socket.on("send_message", async (data) => {
    const newMsg = new Message(data);
    await newMsg.save();
    io.emit("receive_message", data);
  });

  socket.on("share_file", data => {
    io.emit("file_shared", data);
  });
});

// 🚀 Start the server
server.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});
