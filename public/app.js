/**
 * EmergencyCord — Client JavaScript
 * Real-time Discord Backup Web Application
 */

document.addEventListener('DOMContentLoaded', () => {
  // Socket.io Connection
  const socket = io();

  // State Management
  let currentUser = null;
  let currentChannel = 'general';
  let channels = [];
  let onlineUsers = [];
  let currentAttachmentBase64 = null;
  
  // Voice & Audio Settings State
  let activeVoiceChannel = null;
  let mediaStream = null;
  let audioContext = null;
  let analyser = null;
  let vadInterval = null;
  let isMuted = false;
  let isDeafened = false;
  let isSpeaking = false;
  
  let settings = {
    micDeviceId: 'default',
    inputMode: 'vad', // 'vad' (voice activity detection) or 'ptt' (push-to-talk)
    pttKey: 'Space',
    noiseSuppression: true,
    echoCancellation: true
  };

  let pttPressed = false;

  // Sound Effects
  const soundJoin = document.getElementById('soundJoin');
  const soundMessage = document.getElementById('soundMessage');

  // DOM Elements - Login
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('usernameInput');
  const avatarPreview = document.getElementById('avatarPreview');
  const randomAvatarBtn = document.getElementById('randomAvatarBtn');

  // DOM Elements - App Layout
  const appContainer = document.getElementById('app');
  const textChannelsList = document.getElementById('textChannelsList');
  const voiceChannelsList = document.getElementById('voiceChannelsList');
  const currentChannelName = document.getElementById('currentChannelName');
  const currentChannelTopic = document.getElementById('currentChannelTopic');
  const onlineCountText = document.getElementById('onlineCountText');
  const onlineMembersCount = document.getElementById('onlineMembersCount');

  // DOM Elements - User Footer
  const myAvatarImg = document.getElementById('myAvatarImg');
  const myUsername = document.getElementById('myUsername');
  const toggleMuteBtn = document.getElementById('toggleMuteBtn');
  const toggleDeafenBtn = document.getElementById('toggleDeafenBtn');
  const openSettingsBtn = document.getElementById('openSettingsBtn');

  // DOM Elements - Voice Panel
  const voiceStatusPanel = document.getElementById('voiceStatusPanel');
  const activeVoiceChannelName = document.getElementById('activeVoiceChannelName');
  const leaveVoiceBtn = document.getElementById('leaveVoiceBtn');

  // DOM Elements - Chat
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const messageInput = document.getElementById('messageInput');
  const attachmentInput = document.getElementById('attachmentInput');
  const attachmentPreview = document.getElementById('attachmentPreview');
  const attachmentImg = document.getElementById('attachmentImg');
  const removeAttachmentBtn = document.getElementById('removeAttachmentBtn');
  const emojiPickerBtn = document.getElementById('emojiPickerBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  const typingIndicator = document.getElementById('typingIndicator');
  const typingText = document.getElementById('typingText');
  const membersSidebar = document.getElementById('membersSidebar');
  const membersList = document.getElementById('membersList');
  const toggleMembersBtn = document.getElementById('toggleMembersBtn');

  // DOM Elements - Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const micSelect = document.getElementById('micSelect');
  const modeVAD = document.getElementById('modeVAD');
  const modePTT = document.getElementById('modePTT');
  const pttKeyGroup = document.getElementById('pttKeyGroup');
  const pttKeyInput = document.getElementById('pttKeyInput');
  const noiseSuppressionToggle = document.getElementById('noiseSuppressionToggle');
  const echoCancellationToggle = document.getElementById('echoCancellationToggle');
  const micMeterFill = document.getElementById('micMeterFill');
  const testMicBtn = document.getElementById('testMicBtn');

  // Load Saved Username or Avatar from LocalStorage
  const savedUsername = localStorage.getItem('emergency_username');
  if (savedUsername) {
    usernameInput.value = savedUsername;
    updateAvatarPreview(savedUsername);
  }

  // --- Login & Avatar Logic ---

  function updateAvatarPreview(seed) {
    const cleanSeed = seed ? seed.trim() : 'EmergencyCord';
    avatarPreview.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanSeed)}`;
  }

  usernameInput.addEventListener('input', (e) => {
    updateAvatarPreview(e.target.value);
  });

  randomAvatarBtn.addEventListener('click', () => {
    const randomSeed = 'User_' + Math.floor(Math.random() * 10000);
    usernameInput.value = randomSeed;
    updateAvatarPreview(randomSeed);
  });

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (!username) return;

    localStorage.setItem('emergency_username', username);
    const avatar = avatarPreview.src;

    // Send Join Event
    socket.emit('user:join', { username, avatar, color: getRandomColor() });
  });

  function getRandomColor() {
    const colors = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#99AAB5'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // --- Socket Event Listeners ---

  socket.on('init:state', (data) => {
    currentUser = data.user;
    channels = data.channels;

    // Hide Login Modal & Show Main App
    loginModal.classList.add('hidden');
    appContainer.classList.remove('hidden');

    // Update User Footer
    myUsername.textContent = currentUser.username;
    myAvatarImg.src = currentUser.avatar;

    // Play Join Sound
    soundJoin.play().catch(() => {});

    // Render Channels
    renderChannels();
    
    // Render Initial Messages
    renderMessages(data.messages);

    // Enumerate Microphones for Settings
    enumerateInputDevices();
  });

  socket.on('users:update', (userList) => {
    onlineUsers = userList;
    renderMembersList();
    onlineCountText.textContent = `${userList.length} ${userList.length === 1 ? 'usuario' : 'usuarios'}`;
    onlineMembersCount.textContent = userList.length;
  });

  socket.on('user:joined', (user) => {
    if (currentUser && user.id !== currentUser.id) {
      appendSystemMessage(`👋 **${escapeHTML(user.username)}** se ha unido a la sala.`);
    }
  });

  socket.on('user:left', (userId) => {
    const user = onlineUsers.find(u => u.id === userId);
    if (user) {
      appendSystemMessage(`❌ **${escapeHTML(user.username)}** ha salido del chat.`);
    }
  });

  socket.on('channel:history', (data) => {
    if (data.channelId === currentChannel) {
      renderMessages(data.messages);
    }
  });

  socket.on('message:new', (data) => {
    if (data.channelId === currentChannel) {
      appendMessage(data.message);
      if (currentUser && data.message.username !== currentUser.username) {
        soundMessage.play().catch(() => {});
      }
    }
  });

  // Typing updates
  let typingUsers = new Set();
  socket.on('typing:update', (data) => {
    if (data.channelId !== currentChannel) return;

    if (data.isTyping) {
      typingUsers.add(data.username);
    } else {
      typingUsers.delete(data.username);
    }

    if (typingUsers.size > 0) {
      const names = Array.from(typingUsers).join(', ');
      typingText.textContent = `${names} ${typingUsers.size === 1 ? 'está' : 'están'} escribiendo...`;
      typingIndicator.classList.remove('hidden');
    } else {
      typingIndicator.classList.add('hidden');
    }
  });

  // --- Channel Rendering & Switching ---

  function renderChannels() {
    textChannelsList.innerHTML = '';
    voiceChannelsList.innerHTML = '';

    channels.forEach(ch => {
      const li = document.createElement('li');
      li.className = `channel-item ${ch.id === currentChannel ? 'active' : ''}`;
      li.dataset.id = ch.id;

      if (ch.type === 'text') {
        li.innerHTML = `
          <div class="channel-item-left">
            <i class="fa-solid fa-hashtag channel-icon"></i>
            <span>${escapeHTML(ch.name)}</span>
          </div>
        `;
        li.addEventListener('click', () => switchTextChannel(ch.id));
        textChannelsList.appendChild(li);
      } else if (ch.type === 'voice') {
        li.innerHTML = `
          <div class="channel-item-left">
            <i class="fa-solid fa-volume-high channel-icon"></i>
            <span>${escapeHTML(ch.name)}</span>
          </div>
          <span class="member-voice-badge"><i class="fa-solid fa-infinity"></i> Slots</span>
        `;
        li.addEventListener('click', () => joinVoiceChannel(ch.id, ch.name));
        voiceChannelsList.appendChild(li);
      }
    });
  }

  function switchTextChannel(channelId) {
    if (currentChannel === channelId) return;
    currentChannel = channelId;
    
    // Update Channel Name Header
    const chObj = channels.find(c => c.id === channelId);
    if (chObj) {
      currentChannelName.textContent = chObj.name;
      currentChannelTopic.textContent = chObj.topic || '';
      messageInput.placeholder = `Enviar mensaje a #${chObj.name}...`;
    }

    // Highlight active in UI
    document.querySelectorAll('#textChannelsList .channel-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === channelId);
    });

    socket.emit('channel:switch', channelId);
  }

  // --- Message Rendering & Markdown ---

  function renderMessages(messagesList) {
    chatMessages.innerHTML = '';
    messagesList.forEach(appendMessage);
    scrollToBottom();
  }

  function appendMessage(msg) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message-item';

    if (msg.isSystem) {
      messageEl.innerHTML = `
        <img class="message-avatar" src="${msg.avatar}" alt="Bot">
        <div class="message-body">
          <div class="message-header">
            <span class="message-author" style="color: ${msg.color}">${escapeHTML(msg.username)}</span>
            <span class="message-timestamp">${msg.timestamp}</span>
          </div>
          <div class="message-content">${formatMarkdown(msg.content)}</div>
        </div>
      `;
    } else {
      let attachmentHTML = '';
      if (msg.attachment) {
        attachmentHTML = `<img src="${msg.attachment}" class="message-attachment-img" alt="Adjunto">`;
      }

      messageEl.innerHTML = `
        <img class="message-avatar" src="${msg.avatar}" alt="${escapeHTML(msg.username)}">
        <div class="message-body">
          <div class="message-header">
            <span class="message-author" style="color: ${msg.color || '#5865F2'}">${escapeHTML(msg.username)}</span>
            <span class="message-timestamp">${msg.timestamp}</span>
          </div>
          <div class="message-content">
            ${formatMarkdown(msg.content)}
            ${attachmentHTML}
          </div>
        </div>
      `;
    }

    chatMessages.appendChild(messageEl);
    scrollToBottom();
  }

  function appendSystemMessage(text) {
    appendMessage({
      id: `sys-${Date.now()}`,
      username: 'Sistema',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SystemAlert',
      color: '#99AAB5',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true
    });
  }

  function formatMarkdown(text) {
    if (!text) return '';
    let escaped = escapeHTML(text);
    
    // Code blocks ```code```
    escaped = escaped.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    // Inline code `code`
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold **text**
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Auto-link URLs
    escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    return escaped;
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // --- Messaging Inputs & Attachments ---

  let typingTimeout = null;
  messageInput.addEventListener('input', () => {
    socket.emit('typing:start', { channelId: currentChannel });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('typing:stop', { channelId: currentChannel });
    }, 2000);
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content && !currentAttachmentBase64) return;

    socket.emit('message:send', {
      channelId: currentChannel,
      content,
      attachment: currentAttachmentBase64
    });

    messageInput.value = '';
    clearAttachment();
    socket.emit('typing:stop', { channelId: currentChannel });
  });

  // Handle Image Attachment
  attachmentInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen debe ser menor a 5MB.');
      attachmentInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(evt) {
      currentAttachmentBase64 = evt.target.result;
      attachmentImg.src = currentAttachmentBase64;
      attachmentPreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  removeAttachmentBtn.addEventListener('click', clearAttachment);

  function clearAttachment() {
    currentAttachmentBase64 = null;
    attachmentInput.value = '';
    attachmentPreview.classList.add('hidden');
  }

  // Emoji Picker Toggle
  emojiPickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('hidden');
  });

  document.querySelectorAll('#emojiPicker span').forEach(span => {
    span.addEventListener('click', () => {
      messageInput.value += span.textContent;
      messageInput.focus();
      emojiPicker.classList.add('hidden');
    });
  });

  document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiPickerBtn) {
      emojiPicker.classList.add('hidden');
    }
  });

  toggleMembersBtn.addEventListener('click', () => {
    membersSidebar.classList.toggle('hidden');
  });

  // --- Members List Rendering ---

  function renderMembersList() {
    membersList.innerHTML = '';
    onlineUsers.forEach(u => {
      const li = document.createElement('li');
      li.className = 'member-item';
      
      const isSpeakingClass = u.isSpeaking ? 'speaking' : '';
      const voiceBadge = u.voiceChannel ? '<i class="fa-solid fa-volume-high member-voice-badge" title="En canal de voz"></i>' : '';

      li.innerHTML = `
        <div class="member-avatar-wrap ${isSpeakingClass}">
          <img src="${u.avatar}" alt="${escapeHTML(u.username)}">
          <span class="status-indicator online"></span>
        </div>
        <span class="member-name" style="color: ${u.color || '#949ba4'}">${escapeHTML(u.username)}</span>
        ${voiceBadge}
      `;
      membersList.appendChild(li);
    });
  }

  // --- Voice & Audio Engine (VAD / PTT & WebRTC Noise Suppression) ---

  async function requestMicrophoneAccess() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert(
        '⚠️ ATENCIÓN SOBRE PERMISOS DE MICRÓFONO:\n\n' +
        'Los navegadores (Chrome/Edge/Firefox) solo permiten usar el micrófono en sitios seguros (HTTPS) o en http://localhost.\n\n' +
        'Si estás accediendo desde la IP de tu servidor (ej: http://192.168.x.x:9090):\n' +
        '1. Usa una conexión HTTPS (Reverse Proxy / Nginx / Traefik)\n' +
        '2. O en Chrome abre "chrome://flags/#unsafely-treat-insecure-origin-as-secure", añade la URL de tu servidor y habilítala.'
      );
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: settings.micDeviceId !== 'default' ? { exact: settings.micDeviceId } : undefined,
          noiseSuppression: settings.noiseSuppression,
          echoCancellation: settings.echoCancellation,
          autoGainControl: true
        }
      });
      // Re-enumerate devices to get human readable labels after permission granted
      enumerateInputDevices();
      return stream;
    } catch (err) {
      console.error('Error pidiendo permiso de micrófono:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('🚫 Permiso de micrófono denegado en el navegador. Por favor haz clic en el icono del candado/micrófono junto a la barra de dirección URL de tu navegador y selecciona "Permitir".');
      } else {
        alert('⚠️ No se pudo activar el micrófono: ' + (err.message || err.name));
      }
      return null;
    }
  }

  async function joinVoiceChannel(channelId, channelName) {
    if (activeVoiceChannel === channelId) return;

    const stream = await requestMicrophoneAccess();
    if (!stream) return;

    try {
      mediaStream = stream;
      setupAudioProcessing(mediaStream);

      activeVoiceChannel = channelId;
      activeVoiceChannelName.textContent = channelName;
      voiceStatusPanel.classList.remove('hidden');

      socket.emit('voice:join', { channelId });
    } catch (err) {
      console.error('Error al unirse al canal de voz:', err);
    }
  }

  leaveVoiceBtn.addEventListener('click', leaveVoice);

  function leaveVoice() {
    if (activeVoiceChannel) {
      socket.emit('voice:leave');
      activeVoiceChannel = null;
      voiceStatusPanel.classList.add('hidden');
      stopAudioProcessing();
    }
  }

  function setupAudioProcessing(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    // Start Voice Activity Detection Loop
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    clearInterval(vadInterval);
    vadInterval = setInterval(() => {
      if (!activeVoiceChannel || isMuted) return;

      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const averageVolume = sum / dataArray.length;

      // Update mic test meter if settings open
      micMeterFill.style.width = Math.min(100, averageVolume * 3) + '%';

      if (settings.inputMode === 'vad') {
        const threshold = 15; // Threshold for automatic voice activation
        const nowSpeaking = averageVolume > threshold;
        setSpeakingState(nowSpeaking);
      } else if (settings.inputMode === 'ptt') {
        setSpeakingState(pttPressed);
      }
    }, 100);
  }

  function setSpeakingState(speaking) {
    if (isSpeaking !== speaking) {
      isSpeaking = speaking;
      socket.emit('voice:speaking', { isSpeaking });
    }
  }

  function stopAudioProcessing() {
    clearInterval(vadInterval);
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    setSpeakingState(false);
  }

  // Push-To-Talk Keyboard Listeners
  document.addEventListener('keydown', (e) => {
    if (settings.inputMode === 'ptt' && activeVoiceChannel && !isMuted) {
      if (e.code === settings.pttKey || e.key === settings.pttKey) {
        pttPressed = true;
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (settings.inputMode === 'ptt' && activeVoiceChannel) {
      if (e.code === settings.pttKey || e.key === settings.pttKey) {
        pttPressed = false;
      }
    }
  });

  // Mute & Deafen Controls
  toggleMuteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    toggleMuteBtn.classList.toggle('active-mute', isMuted);
    toggleMuteBtn.innerHTML = isMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
    socket.emit('voice:toggle_mute', { isMuted });
  });

  toggleDeafenBtn.addEventListener('click', () => {
    isDeafened = !isDeafened;
    toggleDeafenBtn.classList.toggle('active-mute', isDeafened);
    toggleDeafenBtn.innerHTML = isDeafened ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-headphones"></i>';
    socket.emit('voice:toggle_deafen', { isDeafened });
  });

  // --- Voice Settings Modal Logic ---

  openSettingsBtn.addEventListener('click', async () => {
    settingsModal.classList.remove('hidden');
    await enumerateInputDevices();
  });

  testMicBtn.addEventListener('click', async () => {
    testMicBtn.textContent = 'Solicitando permiso...';
    const stream = await requestMicrophoneAccess();
    if (stream) {
      testMicBtn.textContent = '✅ Micrófono Activo';
      setupAudioProcessing(stream);
    } else {
      testMicBtn.textContent = '❌ Sin Permiso';
    }
    setTimeout(() => {
      testMicBtn.textContent = 'Probar Micrófono';
    }, 3000);
  });

  modeVAD.addEventListener('change', () => {
    settings.inputMode = 'vad';
    pttKeyGroup.classList.add('hidden');
  });

  modePTT.addEventListener('change', () => {
    settings.inputMode = 'ptt';
    pttKeyGroup.classList.remove('hidden');
  });

  pttKeyInput.addEventListener('click', () => {
    pttKeyInput.value = 'Presiona tecla...';
    const handler = (e) => {
      e.preventDefault();
      settings.pttKey = e.code;
      pttKeyInput.value = e.code;
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('keydown', handler);
  });

  saveSettingsBtn.addEventListener('click', () => {
    settings.micDeviceId = micSelect.value;
    settings.noiseSuppression = noiseSuppressionToggle.checked;
    settings.echoCancellation = echoCancellationToggle.checked;
    
    settingsModal.classList.add('hidden');

    // Re-initialize audio stream if active
    if (activeVoiceChannel) {
      const channelId = activeVoiceChannel;
      const channelName = activeVoiceChannelName.textContent;
      leaveVoice();
      joinVoiceChannel(channelId, channelName);
    }
  });

  async function enumerateInputDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      micSelect.innerHTML = '<option value="default">Micrófono Predeterminado del Sistema</option>';
      audioInputs.forEach((input, index) => {
        const option = document.createElement('option');
        option.value = input.deviceId;
        option.textContent = input.label || `Micrófono ${index + 1}`;
        micSelect.appendChild(option);
      });
    } catch (e) {
      console.log('Error enumerando dispositivos:', e);
    }
  }
});
