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

const messageSchema = new mongoose.Schema({
  name: String,
  text: String,
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', messageSchema);

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

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname)));

const USERS = {
  mohib: "zainab",
  zainab: "mohib",
  alice: "123",
  bob: "456",
};

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] === password) res.sendStatus(200);
  else res.sendStatus(401);
});

app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  const url = `/uploads/${file.filename}`;
  res.json({ url });
});

app.get('/messages', async (req, res) => {
  const messages = await Message.find().sort({ timestamp: 1 }).limit(100);
  res.json(messages);
});

app.delete('/messages', async (req, res) => {
  await Message.deleteMany({});
  res.sendStatus(200);
});

app.delete('/messages/:id', async (req, res) => {
  await Message.findByIdAndDelete(req.params.id);
  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let onlineUsers = [];

io.on("connection", (socket) => {
  socket.on("user_connected", (username) => {
    socket.username = username;
    if (!onlineUsers.includes(username)) onlineUsers.push(username);
    io.emit("update_online_users", onlineUsers);
  });

  socket.on("send_message", async (data) => {
    const newMsg = new Message(data);
    await newMsg.save();
    io.emit("receive_message", { _id: newMsg._id, ...data });
  });

  socket.on("share_file", (data) => {
    io.emit("file_shared", data);
  });

  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter(name => name !== socket.username);
    io.emit("update_online_users", onlineUsers);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
