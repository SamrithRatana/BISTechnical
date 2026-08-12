// Enhanced notification sound with audio file support
// Add this to wwwroot/js/notification-sound.js

let notificationAudio = null;

// Initialize audio on page load
function initializeNotificationSound() {
    try {
        // Preload the notification sound for faster playback
        notificationAudio = new Audio('/sounds/notification.mp3');
        notificationAudio.preload = 'auto';
        notificationAudio.volume = 0.6; // 60% volume

        console.log('✅ Notification sound initialized');
    } catch (error) {
        console.error('❌ Error initializing notification sound:', error);
    }
}

// Play notification sound (with fallback)
function playNotificationSound() {
    try {
        // Try to play the audio file
        if (notificationAudio) {
            notificationAudio.currentTime = 0; // Reset to start
            notificationAudio.play().catch(error => {
                console.warn('Audio file play failed, using Web Audio API fallback:', error);
                playWebAudioNotification();
            });
        } else {
            // Fallback to Web Audio API if file not loaded
            playWebAudioNotification();
        }
    } catch (error) {
        console.error('❌ Error playing notification:', error);
        // Last resort fallback
        playWebAudioNotification();
    }
}

// Web Audio API fallback (generates tone)
function playWebAudioNotification() {
    try {
        if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') {
            return;
        }

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // First tone
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.value = 0;
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);

        // Second tone
        setTimeout(() => {
            const oscillator2 = audioContext.createOscillator();
            const gainNode2 = audioContext.createGain();

            oscillator2.connect(gainNode2);
            gainNode2.connect(audioContext.destination);

            oscillator2.frequency.value = 1000;
            oscillator2.type = 'sine';

            gainNode2.gain.value = 0;
            gainNode2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
            gainNode2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);

            oscillator2.start(audioContext.currentTime);
            oscillator2.stop(audioContext.currentTime + 0.1);
        }, 100);
    } catch (error) {
        console.error('Web Audio API error:', error);
    }
}

// Enhanced browser notification with sound
function showMessageNotification(userName, messageText, profilePicture) {
    // Check browser support
    if (!("Notification" in window)) {
        console.log("Browser notifications not supported");
        playNotificationSound(); // At least play sound
        return;
    }

    // Request permission if needed
    if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                createMessageNotification(userName, messageText, profilePicture);
            } else {
                playNotificationSound(); // Play sound even if notification denied
            }
        });
    } else if (Notification.permission === "granted") {
        createMessageNotification(userName, messageText, profilePicture);
    } else {
        playNotificationSound(); // Play sound even if notification denied
    }
}

function createMessageNotification(userName, messageText, profilePicture) {
    // Truncate message if too long
    const truncatedMessage = messageText.length > 100
        ? messageText.substring(0, 100) + '...'
        : messageText;

    const notification = new Notification(`💬 ${userName}`, {
        body: truncatedMessage,
        icon: profilePicture || '/images/default-profile.png',
        badge: '/images/logo_header.jpg',
        tag: `message-${userName}`, // Prevents duplicate notifications
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200] // Vibration pattern for mobile
    });

    // Play custom sound
    playNotificationSound();

    // Handle notification click
    notification.onclick = function (event) {
        event.preventDefault();
        window.focus();
        // You can add navigation to chat here
        notification.close();
    };

    // Auto close after 6 seconds
    setTimeout(() => {
        notification.close();
    }, 6000);
}

// Volume control
function setNotificationVolume(volume) {
    if (notificationAudio && volume >= 0 && volume <= 1) {
        notificationAudio.volume = volume;
    }
}

// Test notification function
function testNotification() {
    console.log('🔔 Testing notification...');
    playNotificationSound();

    // Optional: test browser notification too
    setTimeout(() => {
        showMessageNotification('Test User', 'This is a test notification message', '/images/avatar.jpg');
    }, 1000);
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNotificationSound);
} else {
    initializeNotificationSound();
}

// Request notification permission on first user interaction
let permissionRequested = false;
function requestNotificationPermission() {
    if (!permissionRequested && "Notification" in window && Notification.permission === "default") {
        permissionRequested = true;
        Notification.requestPermission().then(permission => {
            console.log('Notification permission:', permission);
        });
    }
}

// Add click listener to request permission
document.addEventListener('click', requestNotificationPermission, { once: true });