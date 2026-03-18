const socket = io();
let qrCodeInstance = null;

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

logoutBtn.addEventListener('click', () => {
    if(confirm('Are you sure you want to log out the WhatsApp session? You will need to re-scan the QR code.')) {
        socket.emit('logout');
        log('Logout signal sent...');
        logoutBtn.disabled = true;
        setTimeout(() => { logoutBtn.disabled = false; }, 3000);
    }
});

log('Dashboard UI loaded, connecting to background server...');
