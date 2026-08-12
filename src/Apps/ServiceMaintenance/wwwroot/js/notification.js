let notificationCount = 0;
let notifications = [];

// Function to show a browser notification
function showNotification(title, message, messageId, userName, userProfilePicture) {
    if (Notification.permission === "granted") {
        const notification = new Notification(title, {
            body: message,
            icon: userProfilePicture || '/path/to/notification-icon.png' // Fallback icon
        });

        notification.onclick = function () {
            handleNotificationClick(messageId);
        };
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
                const notification = new Notification(title, {
                    body: message,
                    icon: userProfilePicture || '/path/to/notification-icon.png' // Fallback icon
                });

                notification.onclick = function () {
                    handleNotificationClick(messageId);
                };
            }
        });
    }
}

// Function to add a notification to the page
function addNotificationToPage(message, messageId, userName, userProfilePicture) {
    const notificationArea = document.getElementById('notificationArea');
    const notificationElement = document.createElement('div');
    notificationElement.className = 'notification';
    notificationElement.innerHTML = `
        <div class="e-avatar">
            <img src="${userProfilePicture}" alt="User Avatar" class="notification-avatar" />
        </div>
        <div class="text-content">
            <span class="e-list-item-header">${userName}</span>
            <span class="e-list-content">${message}</span>
            <div class="timeStamp">${new Date().toLocaleTimeString()}</div>
        </div>
        <div class="notification-actions">
            <button class="btn-action mark-read" onclick="markAsRead(${messageId})">Mark as Read</button>
            <button class="btn-action delete" onclick="deleteNotification(${messageId})">Delete</button>
        </div>
    `;
    notificationElement.setAttribute('data-id', messageId);
    notificationElement.onclick = function () {
        handleNotificationClick(messageId);
    };
    notificationArea.appendChild(notificationElement);
}

// Update notification badge
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        badge.innerText = notificationCount;
        badge.style.display = notificationCount > 0 ? 'block' : 'none';
    }
}

// Toggle notification dropdown
function showNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
        if (dropdown.classList.contains('show')) {
            notificationCount = 0;
            updateNotificationBadge();
            displayNotifications();
        }
    }
}

// Display all notifications
function displayNotifications() {
    const notificationArea = document.getElementById('notificationArea');
    notificationArea.innerHTML = ''; // Clear existing notifications
    notifications.forEach(({ message, id, userName, userProfilePicture }) => {
        addNotificationToPage(message, id, userName, userProfilePicture);
    });
}

// Handle notification click
function handleNotificationClick(messageId) {
    DotNet.invokeMethodAsync('ServiceMaintenance', 'LoadChatForMessage', messageId)
        .then(() => {
            console.log('Chat loaded for message ID:', messageId);
        })
        .catch(err => console.error('Error loading chat:', err));
}

// Handle new notification
function handleNewNotification(message, messageId, userName, userProfilePicture) {
    notificationCount++;
    showNotification(userName, message, messageId, userName, userProfilePicture); // Show a browser notification
    notifications.push({ message, id: messageId, userName, userProfilePicture }); // Add notification to the list
    updateNotificationBadge();
}
