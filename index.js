const { Client, LocalAuth } = require('whatsapp-web.js');
const cron = require('node-cron');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let client = null;
let isReady = false;
let currentQr = null;
let stateStatus = 'initializing';
let sessionExpiry = null;

function getSystemChromePath() {
    if (process.platform === 'win32') {
        const paths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
        ];
        for (const p of paths) {
            if (fs.existsSync(p)) return p;
        }
    } else if (process.platform === 'darwin') {
        const paths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        ];
        for (const p of paths) {
            if (fs.existsSync(p)) return p;
        }
    }
    return null;
}

function setStatus(newStatus) {
    stateStatus = newStatus;
    io.emit('status', newStatus);
}

function initializeClient() {
    isReady = false;
    currentQr = null;
    setStatus('initializing');
    io.emit('log', 'Initializing WhatsApp Client...');

    client = new Client({
        authStrategy: new LocalAuth({
            clientId: 'bot-session'
        }),
        puppeteer: {
            executablePath: getSystemChromePath(),
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        }
    });

    client.on('qr', (qr) => {
        console.log('QR Code generated.');
        currentQr = qr;
        isReady = false;
        setStatus('waiting_qr');
        io.emit('qr', qr);
        io.emit('log', 'Please scan the QR code to log in.');
    });

    client.on('authenticated', () => {
        console.log('Authentication successful!');
        setStatus('authenticated');
        io.emit('log', 'Authentication successful! Session saved.');
    });

    client.on('auth_failure', msg => {
        console.error('Authentication failed:', msg);
        isReady = false;
        setStatus('auth_failure');
        io.emit('log', 'Authentication failed: ' + msg);
    });

    client.on('ready', () => {
        console.log('WhatsApp Bot is ready!');
        isReady = true;
        currentQr = null;
        setStatus('ready');
        io.emit('log', 'Bot is completely ready and listening.');
        
        // Reset expiry to 14 days (typical limits when phone is disconnected)
        sessionExpiry = Date.now() + (14 * 24 * 60 * 60 * 1000);
        io.emit('expiry', sessionExpiry);
    });

    client.on('disconnected', (reason) => {
        console.log('Bot was disconnected:', reason);
        isReady = false;
        currentQr = null;
        setStatus('disconnected');
        io.emit('log', 'Bot disconnected: ' + reason);

        // Auto-reconnect or reset
        io.emit('log', 'Automatically attempting to destroy and reconnect...');
        client.destroy().then(() => {
            setTimeout(initializeClient, 3000);
        }).catch(err => {
            console.error('Destroy error', err);
            setTimeout(initializeClient, 3000);
        });
    });

    client.initialize().catch(err => {
        console.error('Initialization error:', err);
        io.emit('log', 'Failed to initialize: ' + err.message);
    });
}

// Socket communication
io.on('connection', (socket) => {
    console.log('A dashboard client connected.');

    // Sync current state
    socket.emit('status', stateStatus);
    if (currentQr && stateStatus === 'waiting_qr') {
        socket.emit('qr', currentQr);
    }
    if (sessionExpiry) {
        socket.emit('expiry', sessionExpiry);
    }

    socket.on('logout', async () => {
        if (client) {
            io.emit('log', 'Processing manual logout request...');
            setStatus('initializing');
            try {
                await client.logout();
                io.emit('log', 'Logged out successfully from WhatsApp.');
            } catch (err) {
                console.error('Error on logout:', err);
                io.emit('log', 'Logout error, destroying client instead: ' + err.message);
                try {
                    await client.destroy();
                } catch (e) { }
            }

            // Re-init client to get a fresh QR code
            setTimeout(() => {
                initializeClient();
            }, 3000);
        }
    });
});

// Original business logic
async function getGroupIdByName(groupName) {
    try {
        const chats = await client.getChats();
        const targetGroup = chats.find(chat => chat.isGroup && chat.name === groupName);
        return targetGroup ? targetGroup.id._serialized : null;
    } catch (error) {
        console.error('Error fetching chats:', error);
        return null;
    }
}

async function sendToGroup(groupName, message) {
    if (!isReady) throw new Error('Bot is not ready.');
    const groupId = await getGroupIdByName(groupName);
    if (groupId) {
        await client.sendMessage(groupId, message);
        return { success: true, message: 'Sent' };
    } else {
        return { success: false, error: 'Group not found' };
    }
}

app.post('/api/send-group', async (req, res) => {
    const { groupName, message } = req.body;
    if (!groupName || !message) return res.status(400).json({ error: 'Missing parameters' });
    try {
        const result = await sendToGroup(groupName, message);
        if (result.success) res.status(200).json({ status: 'Success' });
        else res.status(404).json({ status: 'Failed', error: result.error });
    } catch (error) {
        res.status(500).json({ status: 'Error', error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({ online: isReady, timestamp: new Date().toISOString() });
});

// Start Server and Client
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`API/Dashboard Server running on http://localhost:${PORT}`);
    initializeClient();
});
