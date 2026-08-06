const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e7 // 10MB limit for image attachments
});

const APP_VERSION = '1.1.1';

// Middleware & Static files
app.use(express.static(path.join(__dirname, 'public')));

// Version API Endpoint for Auto-updater
app.get('/api/version', (req, res) => {
  res.json({
    version: APP_VERSION,
    downloadUrl: '/download/EmergencyCord-Portable.zip'
  });
});

// Download Route for Windows Standalone Executable / Zip
app.get('/download/EmergencyCord-Portable.zip', (req, res) => {
  const zipPath = path.join(__dirname, 'public', 'EmergencyCord-Portable.zip');
  const distExePath = path.join(__dirname, 'dist', 'EmergencyCord-Portable.exe');
  
  if (fs.existsSync(zipPath)) {
    return res.download(zipPath, 'EmergencyCord-Portable.zip');
  } else if (fs.existsSync(distExePath)) {
    return res.download(distExePath, 'EmergencyCord-Portable.exe');
  } else {
    return res.status(404).send('El ejecutable comprimido de Windows no está disponible.');
  }
});

app.get('/download/EmergencyCord-Portable.exe', (req, res) => {
  const distExePath = path.join(__dirname, 'dist', 'EmergencyCord-Portable.exe');
  const zipPath = path.join(__dirname, 'public', 'EmergencyCord-Portable.zip');
  
  if (fs.existsSync(distExePath)) {
    return res.download(distExePath, 'EmergencyCord-Portable.exe');
  } else if (fs.existsSync(zipPath)) {
    return res.download(zipPath, 'EmergencyCord-Portable.zip');
  } else {
    return res.status(404).send('El ejecutable de Windows no está disponible.');
  }
});

// Default Channels Setup
const CHANNELS = [
  { id: 'general', name: 'general', type: 'text', topic: 'Sala principal de conversación' },
  { id: 'emergencia', name: 'emergencia', type: 'text', topic: 'Canal prioritario si Discord se cae' },
  { id: 'gaming', name: 'gaming-y-memes', type: 'text', topic: 'Juegos, memes y enlaces' },
  { id: 'voice-1', name: '🔊 Sala de Voz 1', type: 'voice', limit: 0 }, // 0 = unlimited
  { id: 'voice-2', name: '🔊 Sala de Voz 2', type: 'voice', limit: 0 }
];

// In-Memory Data Storage
const users = new Map(); // socket.id -> { id, username, avatar, color, currentChannel, voiceChannel, isMuted, isDeafened, isSpeaking }
const channelMessages = {
  general: [
    {
      id: 'welcome-1',
      username: 'EmergencyCord Bot',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=EmergencyBot',
      color: '#5865F2',
      content: '👋 **¡Bienvenido a EmergencyCord!** Esta es tu sala de chat de respaldo ligera.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true
    }
  ],
  emergencia: [],
  gaming: []
};

// Helper: Broadcast updated user list
function broadcastUserList() {
  const userList = Array.from(users.values());
  io.emit('users:update', userList);
}

// Helper: Broadcast voice channel states
function broadcastVoiceState(channelId) {
  const usersInVoice = Array.from(users.values()).filter(u => u.voiceChannel === channelId);
  io.emit('voice:users', { channelId, users: usersInVoice });
}

io.on('connection', (socket) => {
  console.log(`🔌 Usuario conectado: ${socket.id}`);

  // User Join Event (instant login with username)
  socket.on('user:join', ({ username, avatar, color }) => {
    const cleanUsername = username ? username.trim().substring(0, 24) : `Usuario-${Math.floor(1000 + Math.random() * 9000)}`;
    const userAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUsername)}`;
    const userColor = color || '#5865F2';

    const userObj = {
      id: socket.id,
      username: cleanUsername,
      avatar: userAvatar,
      color: userColor,
      currentChannel: 'general',
      voiceChannel: null,
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      joinedAt: new Date().toISOString()
    };

    users.set(socket.id, userObj);

    // Send initial configuration to client
    socket.emit('init:state', {
      user: userObj,
      channels: CHANNELS,
      messages: channelMessages['general'] || []
    });

    // Notify channel
    io.emit('user:joined', userObj);
    broadcastUserList();
  });

  // Switch Text Channel
  socket.on('channel:switch', (channelId) => {
    const user = users.get(socket.id);
    if (!user) return;

    user.currentChannel = channelId;
    users.set(socket.id, user);

    socket.emit('channel:history', {
      channelId,
      messages: channelMessages[channelId] || []
    });
  });

  // Dynamic Channel Creation Event
  socket.on('channel:create', ({ name, type, topic }) => {
    if (!name) return;
    const cleanName = type === 'text' ? name.trim().toLowerCase().replace(/\s+/g, '-') : name.trim();
    const channelId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const newChannel = {
      id: channelId,
      name: cleanName,
      type: type === 'voice' ? 'voice' : 'text',
      topic: topic ? topic.trim() : (type === 'text' ? 'Canal de conversación' : '')
    };

    CHANNELS.push(newChannel);

    if (type === 'text') {
      channelMessages[channelId] = [];
    }

    // Broadcast updated channels list to all connected clients
    io.emit('channels:update', CHANNELS);
  });

  // Text Message Sending
  socket.on('message:send', ({ channelId, content, attachment }) => {
    const user = users.get(socket.id);
    if (!user || !content && !attachment) return;

    const messageObj = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      socketId: socket.id,
      username: user.username,
      avatar: user.avatar,
      color: user.color,
      content: content ? content.trim() : '',
      attachment: attachment || null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString()
    };

    if (!channelMessages[channelId]) {
      channelMessages[channelId] = [];
    }

    channelMessages[channelId].push(messageObj);

    // Keep history capped at 50 messages per channel
    if (channelMessages[channelId].length > 50) {
      channelMessages[channelId].shift();
    }

    // Broadcast to all connected clients
    io.emit('message:new', { channelId, message: messageObj });
  });

  // Typing Indicators
  socket.on('typing:start', ({ channelId }) => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.broadcast.emit('typing:update', { channelId, username: user.username, isTyping: true });
  });

  socket.on('typing:stop', ({ channelId }) => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.broadcast.emit('typing:update', { channelId, username: user.username, isTyping: false });
  });

  // --- Voice Channel Logic ---

  // Join Voice Channel
  socket.on('voice:join', ({ channelId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const oldChannel = user.voiceChannel;
    user.voiceChannel = channelId;
    users.set(socket.id, user);

    socket.join(`voice-${channelId}`);

    if (oldChannel && oldChannel !== channelId) {
      socket.leave(`voice-${oldChannel}`);
      broadcastVoiceState(oldChannel);
    }

    broadcastVoiceState(channelId);
    broadcastUserList();

    // Signal existing users in channel that a new peer joined
    const peersInRoom = Array.from(users.values())
      .filter(u => u.voiceChannel === channelId && u.id !== socket.id)
      .map(u => u.id);

    socket.emit('voice:peers', { channelId, peers: peersInRoom });
  });

  // Leave Voice Channel
  socket.on('voice:leave', () => {
    const user = users.get(socket.id);
    if (!user || !user.voiceChannel) return;

    const channelId = user.voiceChannel;
    socket.leave(`voice-${channelId}`);

    user.voiceChannel = null;
    user.isSpeaking = false;
    users.set(socket.id, user);

    broadcastVoiceState(channelId);
    broadcastUserList();
    socket.emit('voice:left');
  });

  // Voice Speaking Status Indicator (VAD / PTT)
  socket.on('voice:speaking', ({ isSpeaking }) => {
    const user = users.get(socket.id);
    if (!user || !user.voiceChannel) return;

    user.isSpeaking = !!isSpeaking;
    users.set(socket.id, user);

    io.to(`voice-${user.voiceChannel}`).emit('voice:speaking_update', {
      userId: socket.id,
      isSpeaking: user.isSpeaking
    });
  });

  // WebRTC Peer Signaling Relay
  socket.on('voice:signal', ({ targetId, signalData }) => {
    io.to(targetId).emit('voice:signal', {
      senderId: socket.id,
      signalData
    });
  });

  // Audio Chunk Relay (Fallback audio streaming for maximum compatibility)
  socket.on('voice:audio_chunk', ({ channelId, audioData }) => {
    const user = users.get(socket.id);
    if (!user || user.isMuted) return;

    // Relay to other users in same voice room
    socket.to(`voice-${channelId}`).emit('voice:audio_chunk', {
      senderId: socket.id,
      audioData
    });
  });

  // User Audio Settings Toggle (Mute / Deafen)
  socket.on('voice:toggle_mute', ({ isMuted }) => {
    const user = users.get(socket.id);
    if (!user) return;

    user.isMuted = !!isMuted;
    users.set(socket.id, user);
    broadcastUserList();
    if (user.voiceChannel) broadcastVoiceState(user.voiceChannel);
  });

  socket.on('voice:toggle_deafen', ({ isDeafened }) => {
    const user = users.get(socket.id);
    if (!user) return;

    user.isDeafened = !!isDeafened;
    users.set(socket.id, user);
    broadcastUserList();
    if (user.voiceChannel) broadcastVoiceState(user.voiceChannel);
  });

  // Disconnect Handler
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`❌ Usuario desconectado: ${user.username}`);
      if (user.voiceChannel) {
        broadcastVoiceState(user.voiceChannel);
      }
      users.delete(socket.id);
      io.emit('user:left', socket.id);
      broadcastUserList();
    }
  });
});

const PORT = process.env.PORT || 9090;
server.listen(PORT, () => {
  console.log(`
  🚀 ===============================================
  🟢 EmergencyCord iniciado exitosamente!
  📡 Servidor escuchando en: http://localhost:${PORT}
  🐳 Listo para Docker / Despliegue inmediato
  =================================================
  `);
});
