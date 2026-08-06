/**
 * EmergencyCord — Client JavaScript (Ultra Glassmorphism & Windows Desktop Client)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Detect Electron Desktop App environment
  let ipcRenderer = null;
  const isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
  
  if (isElectron) {
    try {
      const electron = window.require('electron');
      ipcRenderer = electron.ipcRenderer;
    } catch (e) {
      console.log('Electron IPC not available');
    }
  }

  // Windows Titlebar IPC Controls
  const winMinBtn = document.getElementById('winMinBtn');
  const winMaxBtn = document.getElementById('winMaxBtn');
  const winCloseBtn = document.getElementById('winCloseBtn');
  const windowTitlebar = document.getElementById('windowTitlebar');

  if (isElectron && ipcRenderer) {
    windowTitlebar.style.display = 'flex';
    winMinBtn.addEventListener('click', () => ipcRenderer.send('window-minimize'));
    winMaxBtn.addEventListener('click', () => ipcRenderer.send('window-maximize'));
    winCloseBtn.addEventListener('click', () => ipcRenderer.send('window-close'));
  } else {
    // Hide native titlebar controls on standard web browsers
    windowTitlebar.style.display = 'none';
  }

  // Dynamic Socket.IO connection
  let socket = null;

  function connectSocket(targetUrl) {
    if (socket) socket.disconnect();
    
    // Default to sg.dimzo.es:9090 if accessed from web or custom input
    const cleanUrl = targetUrl || window.location.origin;
    console.log(`🔌 Conectando Socket.IO a: ${cleanUrl}`);
    socket = io(cleanUrl, { reconnectionAttempts: 5 });
    
    setupSocketListeners();
  }

  // Initial connection
  connectSocket(window.location.origin.includes('file:') ? 'http://sg.dimzo.es:9090' : window.location.origin);

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
    inputMode: 'vad',
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
  const serverUrlInput = document.getElementById('serverUrlInput');
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

  // Load Saved Username from LocalStorage
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

  const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    let serverUrl = serverUrlInput.value.trim() || 'http://sg.dimzo.es:9090';
    
    if (!username) return;

    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      serverUrl = 'http://' + serverUrl;
    }

    localStorage.setItem('emergency_username', username);
    const avatar = avatarPreview.src;
    const userColor = getRandomColor();

    const originalBtnHTML = loginSubmitBtn.innerHTML;
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';

    const sendJoin = () => {
      socket.emit('user:join', { username, avatar, color: userColor });
    };

    const timeout = setTimeout(() => {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.innerHTML = originalBtnHTML;
      alert(`⚠️ No se pudo conectar al servidor (${serverUrl}).\n\nAsegúrate de que el contenedor Docker esté encendido y el puerto 9090 abierto.`);
    }, 7000);

    // If socket needs to connect to new URL or reconnect
    if (!socket || !socket.connected || (socket.io && socket.io.uri !== serverUrl)) {
      connectSocket(serverUrl);
      socket.once('connect', () => {
        clearTimeout(timeout);
        sendJoin();
      });
      socket.once('connect_error', (err) => {
        clearTimeout(timeout);
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.innerHTML = originalBtnHTML;
        alert(`❌ Error al conectar a ${serverUrl}: ` + (err.message || 'Servidor no disponible'));
      });
    } else {
      clearTimeout(timeout);
      sendJoin();
    }
  });

  function getRandomColor() {
    const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f43f5e', '#f59e0b'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // --- Socket Listeners Setup ---

  function setupSocketListeners() {
    socket.on('init:state', (data) => {
      currentUser = data.user;
      channels = data.channels;

      loginSubmitBtn.disabled = false;
      loginSubmitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Conectar al Servidor';

      loginModal.classList.add('hidden');
      appContainer.classList.remove('hidden');

      myUsername.textContent = currentUser.username;
      myAvatarImg.src = currentUser.avatar;

      soundJoin.play().catch(() => {});
      renderChannels();
      renderMessages(data.messages);
      enumerateInputDevices();
    });

    socket.on('channels:update', (updatedChannels) => {
      channels = updatedChannels;
      renderChannels();
    });

    socket.on('users:update', (userList) => {
      onlineUsers = userList;
      renderMembersList();
      renderChannels();
      updateOverlayState();
      onlineCountText.textContent = `${userList.length} ${userList.length === 1 ? 'usuario' : 'usuarios'}`;
      onlineMembersCount.textContent = userList.length;
    });

    socket.on('voice:users', (data) => {
      renderChannels();
      updateOverlayState();
    });

    socket.on('voice:speaking_update', (data) => {
      const user = onlineUsers.find(u => u.id === data.userId);
      if (user) {
        user.isSpeaking = data.isSpeaking;
        renderChannels();
        renderMembersList();
        updateOverlayState();
      }
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
          showOverlayToast(data.message.username, data.message.content);
        }
      }
    });

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
  }

  // --- Channel Rendering & Switching ---

  function renderChannels() {
    textChannelsList.innerHTML = '';
    voiceChannelsList.innerHTML = '';

    channels.forEach(ch => {
      if (ch.type === 'text') {
        const li = document.createElement('li');
        li.className = `channel-item ${ch.id === currentChannel ? 'active' : ''}`;
        li.dataset.id = ch.id;
        li.innerHTML = `
          <div class="channel-item-left">
            <i class="fa-solid fa-hashtag channel-icon"></i>
            <span>${escapeHTML(ch.name)}</span>
          </div>
        `;
        li.addEventListener('click', () => switchTextChannel(ch.id));
        textChannelsList.appendChild(li);
      } else if (ch.type === 'voice') {
        const wrapper = document.createElement('li');
        wrapper.className = 'channel-wrapper';
        
        const isCurrentVoice = activeVoiceChannel === ch.id;
        
        // Find users in this voice channel
        const usersInThisChannel = onlineUsers.filter(u => u.voiceChannel === ch.id);

        let usersHTML = '';
        if (usersInThisChannel.length > 0) {
          usersHTML = `<div class="voice-channel-users">`;
          usersInThisChannel.forEach(u => {
            const speakingClass = u.isSpeaking ? 'speaking' : '';
            const muteIcon = u.isMuted ? '<i class="fa-solid fa-microphone-slash voice-icon-muted" title="Silenciado"></i>' : '';
            const deafenIcon = u.isDeafened ? '<i class="fa-solid fa-volume-xmark voice-icon-muted" title="Ensordecido"></i>' : '';

            usersHTML += `
              <div class="voice-user-subitem ${speakingClass}">
                <div class="voice-user-avatar-wrap ${speakingClass}">
                  <img src="${u.avatar}" alt="${escapeHTML(u.username)}">
                </div>
                <span class="voice-user-name" style="color: ${u.color || '#a1a1aa'}">${escapeHTML(u.username)}</span>
                <div class="voice-user-icons">${muteIcon}${deafenIcon}</div>
              </div>
            `;
          });
          usersHTML += `</div>`;
        }

        wrapper.innerHTML = `
          <div class="channel-item voice-channel-header ${isCurrentVoice ? 'active-voice' : ''}" data-id="${ch.id}">
            <div class="channel-item-left">
              <i class="fa-solid fa-volume-high channel-icon"></i>
              <span>${escapeHTML(ch.name)}</span>
            </div>
            <span class="member-voice-badge"><i class="fa-solid fa-infinity"></i> Slots</span>
          </div>
          ${usersHTML}
        `;

        wrapper.querySelector('.channel-item').addEventListener('click', () => joinVoiceChannel(ch.id, ch.name));
        voiceChannelsList.appendChild(wrapper);
      }
    });
  }

  function switchTextChannel(channelId) {
    if (currentChannel === channelId) return;
    currentChannel = channelId;
    
    const chObj = channels.find(c => c.id === channelId);
    if (chObj) {
      currentChannelName.textContent = chObj.name;
      currentChannelTopic.textContent = chObj.topic || '';
      messageInput.placeholder = `Enviar mensaje a #${chObj.name}...`;
    }

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
            <span class="message-author" style="color: ${msg.color || '#6366f1'}">${escapeHTML(msg.username)}</span>
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
      color: '#71717a',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: true
    });
  }

  function formatMarkdown(text) {
    if (!text) return '';
    let escaped = escapeHTML(text);
    
    escaped = escaped.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
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
        <span class="member-name" style="color: ${u.color || '#a1a1aa'}">${escapeHTML(u.username)}</span>
        ${voiceBadge}
      `;
      membersList.appendChild(li);
    });
  }

  // --- Voice Engine (Native Windows Electron & WebRTC Noise Suppression) ---

  async function requestMicrophoneAccess() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (!isElectron) {
        alert(
          '⚠️ SOBRE PERMISOS DE MICRÓFONO EN NAVEGADOR:\n\n' +
          'Los navegadores bloquean el micrófono en HTTP sin cifrar.\n\n' +
          '💡 SOLUCIÓN FÁCIL: Usa el Cliente de Escritorio de Windows (Electron) que se conecta directamente a sg.dimzo.es:9090 sin esta restricción.'
        );
      }
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
      enumerateInputDevices();
      return stream;
    } catch (err) {
      console.error('Error al pedir micrófono:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('🚫 Permiso de micrófono denegado. Por favor dale acceso al micrófono.');
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
      micMeterFill.style.width = Math.min(100, averageVolume * 3) + '%';

      if (settings.inputMode === 'vad') {
        const threshold = 15;
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
    testMicBtn.textContent = 'Solicitando...';
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

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
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

    if (activeVoiceChannel) {
      const channelId = activeVoiceChannel;
      const channelName = activeVoiceChannelName.textContent;
      leaveVoice();
      joinVoiceChannel(channelId, channelName);
    }
  });

  // --- Dynamic Channel Creation Logic ---
  const addTextChannelBtn = document.getElementById('addTextChannelBtn');
  const addVoiceChannelBtn = document.getElementById('addVoiceChannelBtn');
  const createChannelModal = document.getElementById('createChannelModal');
  const closeCreateChannelBtn = document.getElementById('closeCreateChannelBtn');
  const createChannelForm = document.getElementById('createChannelForm');
  const newChannelNameInput = document.getElementById('newChannelNameInput');
  const newChannelTopicInput = document.getElementById('newChannelTopicInput');
  const newTypeText = document.getElementById('newTypeText');
  const newTypeVoice = document.getElementById('newTypeVoice');

  if (addTextChannelBtn) {
    addTextChannelBtn.addEventListener('click', () => {
      newTypeText.checked = true;
      newChannelNameInput.value = '';
      newChannelTopicInput.value = '';
      createChannelModal.classList.remove('hidden');
      newChannelNameInput.focus();
    });
  }

  if (addVoiceChannelBtn) {
    addVoiceChannelBtn.addEventListener('click', () => {
      newTypeVoice.checked = true;
      newChannelNameInput.value = '';
      newChannelTopicInput.value = '';
      createChannelModal.classList.remove('hidden');
      newChannelNameInput.focus();
    });
  }

  if (closeCreateChannelBtn) {
    closeCreateChannelBtn.addEventListener('click', () => {
      createChannelModal.classList.add('hidden');
    });
  }

  if (createChannelForm) {
    createChannelForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = newChannelNameInput.value.trim();
      const topic = newChannelTopicInput.value.trim();
      const type = newTypeText.checked ? 'text' : 'voice';

      if (!name) return;

      socket.emit('channel:create', { name, type, topic });
      createChannelModal.classList.add('hidden');
    });
  }

  // --- Floating Game Overlay HUD Logic ---
  const toggleOverlayBtn = document.getElementById('toggleOverlayBtn');
  const closeOverlayBtn = document.getElementById('closeOverlayBtn');
  const gameOverlayWidget = document.getElementById('gameOverlayWidget');
  const overlayVoiceChannelName = document.getElementById('overlayVoiceChannelName');
  const overlayVoiceUsersList = document.getElementById('overlayVoiceUsersList');
  const overlayChatToast = document.getElementById('overlayChatToast');
  const overlayToastAuthor = document.getElementById('overlayToastAuthor');
  const overlayToastContent = document.getElementById('overlayToastContent');

  let isOverlayActive = false;

  function toggleGameOverlay() {
    isOverlayActive = !isOverlayActive;

    if (isOverlayActive) {
      gameOverlayWidget.classList.remove('hidden');
      appContainer.classList.add('hidden');

      if (isElectron && ipcRenderer) {
        ipcRenderer.send('overlay-enable');
      }
      updateOverlayState();
    } else {
      gameOverlayWidget.classList.add('hidden');
      appContainer.classList.remove('hidden');

      if (isElectron && ipcRenderer) {
        ipcRenderer.send('overlay-disable');
      }
    }
  }

  function updateOverlayState() {
    if (!isOverlayActive) return;

    if (activeVoiceChannel) {
      const ch = channels.find(c => c.id === activeVoiceChannel);
      overlayVoiceChannelName.textContent = ch ? ch.name : '🔊 Sala de Voz';
      
      const voiceUsers = onlineUsers.filter(u => u.voiceChannel === activeVoiceChannel);
      overlayVoiceUsersList.innerHTML = '';

      voiceUsers.forEach(u => {
        const speakingClass = u.isSpeaking ? 'speaking' : '';
        const card = document.createElement('div');
        card.className = 'overlay-user-card';
        card.innerHTML = `
          <div class="overlay-avatar-wrap ${speakingClass}">
            <img src="${u.avatar}" alt="${escapeHTML(u.username)}">
          </div>
          <span class="overlay-user-name" style="color: ${u.color || '#ffffff'}">${escapeHTML(u.username)}</span>
        `;
        overlayVoiceUsersList.appendChild(card);
      });
    } else {
      overlayVoiceChannelName.textContent = '🔊 Sin canal de voz conectado';
      overlayVoiceUsersList.innerHTML = '<span style="font-size:12px; color:#71717a;">Únete a un canal de voz para ver la lista en tu juego.</span>';
    }
  }

  // Toast notifications for overlay when a new message arrives
  function showOverlayToast(author, content) {
    if (!isOverlayActive) return;
    overlayToastAuthor.textContent = author;
    overlayToastContent.textContent = content.substring(0, 40) + (content.length > 40 ? '...' : '');
    overlayChatToast.classList.remove('hidden');

    setTimeout(() => {
      overlayChatToast.classList.add('hidden');
    }, 4000);
  }

  if (toggleOverlayBtn) toggleOverlayBtn.addEventListener('click', toggleGameOverlay);
  if (closeOverlayBtn) closeOverlayBtn.addEventListener('click', toggleGameOverlay);

  // Global shortcut Shift + F3 for Overlay Mode toggle
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === 'F3' || e.code === 'F3')) {
      e.preventDefault();
      toggleGameOverlay();
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
