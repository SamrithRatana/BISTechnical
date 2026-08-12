
    document.addEventListener("DOMContentLoaded", function () {
        console.log("✅ Notification script loaded");

    var hubConnection = new signalR.HubConnectionBuilder()
    .withUrl("/chathub")
    .build();

    hubConnection.start()
        .then(() => console.log("✅ SignalR connected"))
        .catch(err => console.error("❌ SignalR error:", err.toString()));

    hubConnection.on("ReceiveNotification", function (message, profilePictureBase64, username) {
        var notificationElement = document.createElement("div");
    notificationElement.classList.add("notification-item");

    var profilePicture = document.createElement("img");
    profilePicture.src = "data:image/png;base64," + profilePictureBase64;
    profilePicture.classList.add("profile-picture-envelope");

    var contentElement = document.createElement("div");
    contentElement.classList.add("notification-content");

    var usernameElement = document.createElement("span");
    usernameElement.classList.add("notification-username");
    usernameElement.textContent = username;

    var messageElement = document.createElement("span");
    messageElement.classList.add("notification-message");
    messageElement.textContent = message;

    contentElement.appendChild(usernameElement);
    contentElement.appendChild(messageElement);

    notificationElement.appendChild(profilePicture);
    notificationElement.appendChild(contentElement);

    var notificationArea = document.getElementById("notificationArea");
    if (notificationArea) {
        notificationArea.prepend(notificationElement);
        }

    var badge = document.getElementById("notificationBadge");
    if (badge) {
        badge.textContent = parseInt(badge.textContent || "0") + 1;
        }
    });

    window.toggleDropdown = function () {
        var dropdown = document.getElementById("notificationDropdown");
    if (dropdown) {
        dropdown.classList.toggle("show");

    if (dropdown.classList.contains("show")) {
                var badge = document.getElementById("notificationBadge");
    if (badge) {
        badge.textContent = "0";
                }
            }
        }
    };

    window.clearNotifications = function () {
        var notificationArea = document.getElementById("notificationArea");
    if (notificationArea) {
        notificationArea.innerHTML = "";
        }

    var badge = document.getElementById("notificationBadge");
    if (badge) {
        badge.textContent = "0";
        }
    };

    // ✅ FIXED: Safe click handler with null checks
    document.addEventListener("click", function (event) {
        var dropdown = document.getElementById("notificationDropdown");
    var button = document.querySelector("[onclick='toggleDropdown()']");

    // ✅ Check if elements exist before accessing them
    if (dropdown && button) {
            if (!dropdown.contains(event.target) && !button.contains(event.target)) {
        dropdown.classList.remove("show");
            }
        }
    });
});

