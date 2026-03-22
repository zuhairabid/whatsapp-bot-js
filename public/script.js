let socket = null;
let qrCodeInstance = null;

const setupCard = document.getElementById('setup-card');
const botDashboard = document.getElementById('bot-dashboard');
const portInput = document.getElementById('port-input');
const runServerBtn = document.getElementById('run-server-btn');
const portIndicator = document.getElementById('port-indicator');

const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const qrCard = document.getElementById('qr-card');
const connectedCard = document.getElementById('connected-card');
const qrcodeElement = document.getElementById('qrcode');
const qrLoader = document.getElementById('qr-loader');
const logsElement = document.getElementById('logs');
const logoutBtn = document.getElementById('logout-btn');
const expiryCountdown = document.getElementById('expiry-countdown');

let countdownInterval = null;

function updateStatus(status) {
    statusBadge.className = 'status-badge';
    if (status === 'ready' || status === 'authenticated') {
        statusBadge.classList.add('connected');
        statusText.textContent = 'Connected';
        qrCard.classList.add('hidden');
        connectedCard.classList.remove('hidden');
    } else if (status === 'waiting_qr') {
        statusBadge.classList.add('connecting');
        statusText.textContent = 'Waiting for Scan';
        qrCard.classList.remove('hidden');
        connectedCard.classList.add('hidden');
    } else if (status === 'initializing') {
        statusBadge.classList.add('connecting');
        statusText.textContent = 'Initializing...';
        qrCard.classList.remove('hidden');
        connectedCard.classList.add('hidden');
        qrcodeElement.style.opacity = '0';
        qrLoader.style.display = 'block';
    } else {
        statusBadge.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
        qrCard.classList.add('hidden');
        connectedCard.classList.add('hidden');
    }
}

function log(message) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
    logsElement.prepend(entry);
}

function connectSocket(port) {
    log(`Connecting to server on port ${port}...`);
    socket = io(`http://localhost:${port}`);

    socket.on('status', (status) => {
        log(`Status changed: ${status}`);
        updateStatus(status);
    });

    socket.on('qr', (qrString) => {
        log('New QR code received. Please scan.');
        qrcodeElement.innerHTML = '';
        qrcodeElement.style.opacity = '1';
        qrLoader.style.display = 'none';
        
        qrCodeInstance = new QRCode(qrcodeElement, {
            text: qrString,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    });

    socket.on('expiry', (timestamp) => {
        if (countdownInterval) clearInterval(countdownInterval);
        
        function updateCountdown() {
            const now = Date.now();
            const diff = timestamp - now;
            
            if (diff <= 0) {
                if(expiryCountdown) expiryCountdown.textContent = "Expired";
                clearInterval(countdownInterval);
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const mins = Math.floor((diff / 1000 / 60) % 60);
            const secs = Math.floor((diff / 1000) % 60);
            
            if(expiryCountdown) {
                expiryCountdown.textContent = `${days}d ${hours}h ${mins}m ${secs}s`;
            }
        }
        
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);
    });

    socket.on('log', (message) => {
        log(message);
    });
}

// Button Click Event
runServerBtn.addEventListener('click', () => {
    const port = portInput.value;
    if (!port) {
        alert('Please enter a valid port number.');
        return;
    }

    runServerBtn.disabled = true;
    runServerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Starting...';

    // Tell Electron to start the server
    window.electronAPI.startServer(port);
});

// Listener for when server becomes active
window.electronAPI.onServerStarted((port) => {
    portIndicator.textContent = `Running on: 127.0.0.1:${port}`;
    setupCard.classList.add('hidden');
    botDashboard.classList.remove('hidden');
    
    // Connect to the newly started server
    connectSocket(port);
});

logoutBtn.addEventListener('click', () => {
    if(confirm('Are you sure you want to log out the WhatsApp session? You will need to re-scan the QR code.')) {
        if (socket) {
            socket.emit('logout');
            log('Logout signal sent...');
            logoutBtn.disabled = true;
            setTimeout(() => { logoutBtn.disabled = false; }, 3000);
        }
    }
});

log('Dashboard UI loaded. Please configure the port and click Run Server.');
