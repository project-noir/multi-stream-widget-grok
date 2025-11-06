require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static('public'));

let eventQueue = [];

// Add or update event
function addEvent(type, username) {
  eventQueue = eventQueue.filter(e => e.type !== type);
  eventQueue.push({ type, username, timestamp: Date.now() });
  io.emit('newEvent', { type, username });
}

// === WEBHOOKS ===
app.post('/webhook/twitch', (req, res) => {
  const msgType = req.headers['twitch-eventsub-message-type'];
  if (msgType === 'webhook_callback_verification') return res.send(req.body.challenge);
  if (msgType !== 'notification') return res.sendStatus(200);

  const event = req.body.event;
  const subType = req.body.subscription.type;
  if (subType === 'channel.follow') addEvent('twitch_follow', event.user_name);
  if (subType === 'channel.subscribe') addEvent('twitch_sub', event.user_name);
  res.sendStatus(200);
});

app.post('/webhook/kick', (req, res) => {
  const { event, data } = req.body;
  if (event === 'ChannelFollowed') addEvent('kick_follow', data.username);
  if (event === 'SubscriptionCreated') addEvent('kick_sub', data.username);
  res.sendStatus(200);
});

app.post('/webhook/youtube', (req, res) => {
  if (req.query['hub.challenge']) return res.send(req.query['hub.challenge']);
  res.sendStatus(200);
  // Poll YouTube live chat for membership events (simplified)
  setTimeout(pollYouTube, 1000);
});

io.on('connection', (socket) => {
  socket.emit('initQueue', eventQueue);
});

// === AUTO SUBSCRIBE ON START (Twitch) ===
async function subscribeTwitch() {
  if (!process.env.TWITCH_CLIENT_ID) return;
  try {
    const tokenRes = await axios.post(`https://id.twitch.tv/oauth2/token`, null, {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }
    });
    const token = tokenRes.data.access_token;

    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:3000`;
    const types = ['channel.follow', 'channel.subscribe'];
    for (const type of types) {
      await axios.post('https://api.twitch.tv/helix/eventsub/subscriptions', {
        type, version: '2',
        condition: { broadcaster_user_id: process.env.TWITCH_USER_ID },
        transport: { method: 'webhook', callback: `${url}/webhook/twitch`, secret: process.env.WEBHOOK_SECRET }
      }, {
        headers: { 'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
    }
    console.log('Twitch subscribed!');
  } catch (e) { console.error('Twitch sub failed:', e.response?.data || e.message); }
}

// YouTube polling (run every 30s)
async function pollYouTube() {
  if (!process.env.YOUTUBE_API_KEY || !process.env.YOUTUBE_LIVE_CHAT_ID) return;
  try {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/liveChat/messages', {
      params: { liveChatId: process.env.YOUTUBE_LIVE_CHAT_ID, part: 'snippet,authorDetails', key: process.env.YOUTUBE_API_KEY }
    });
    const items = res.data.items || [];
    const latest = items[items.length - 1];
    if (latest?.snippet?.type === 'newSponsorEvent') {
      addEvent('youtube_sub', latest.authorDetails.displayName);
    }
  } catch (e) { console.error('YT poll failed'); }
}
setInterval(pollYouTube, 30000);

// Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Alert live at ${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/alert.html`);
  subscribeTwitch();
});
