function scrollToBottom(elementId) {
    var element = document.getElementById(elementId);
    if (element) {
        element.scrollTop = element.scrollHeight;
    }
}
function saveAsFile(fileName, base64String) {
        var link = document.createElement('a');
        link.href = 'data:application/pdf;base64,' + base64String;
        link.download = fileName;
        link.click();


    }

    // wwwroot/js/site.js
    // site.js
    window.applyDarkMode = function () {
        document.body.classList.add('dark-mode');
    };

    window.applyLightMode = function () {
        document.body.classList.remove('dark-mode');
    };

    window.updateDropdown = (moduleName, allChecked) => {
        let dropdown = document.querySelector(`select[data-module='${moduleName}']`);
        if (dropdown) {
            dropdown.value = allChecked ? "true" : "false";
        }
    };

 

    window.uploadAudio = async function (audioBlobUrl) {
        const response = await fetch(audioBlobUrl);
        const blob = await response.blob(); // Get the blob from the URL
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm'); // Append blob to FormData

        const uploadResponse = await fetch('/uploadAudio', {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to upload audio');
        }

        // Get the URL for the uploaded audio
        const uploadedAudioUrl = await uploadResponse.text();
        return uploadedAudioUrl;
    };

    document.addEventListener('DOMContentLoaded', function () {
        const audioElement = document.getElementById('audioPlayer');

        if (audioElement) {
            audioElement.addEventListener('loadedmetadata', function () {
                const duration = audioElement.duration; // Duration in seconds
                const minWidth = 200; // Minimum width in pixels
                const maxWidth = 600; // Maximum width in pixels
                const width = Math.max(minWidth, Math.min(maxWidth, duration * 20)); // Calculate width based on duration

                audioElement.style.width = width + 'px';
            });
        }
    });

    // Function to hide recording controls
    function hideRecordingControls() {
        document.getElementById('recordingControls').style.display = 'none';
    }

    // Function to show recording controls
    function showRecordingControls() {
        document.getElementById('recordingControls').style.display = 'flex';
    }




    document.addEventListener('DOMContentLoaded', () => {
        attachFocusBlurHandlers();
    });

function observeDOMChanges() {
    const targetNode = document.body; // Or a specific container
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                attachFocusBlurHandlers(); // Re-check for the input field
            }
        }
    });

    observer.observe(targetNode, { childList: true, subtree: true });
}

document.addEventListener('DOMContentLoaded', () => {
    attachFocusBlurHandlers();
    observeDOMChanges();
});
function attachFocusBlurHandlers() {
    const inputField = document.querySelector('.chat-text-input');
    if (inputField) {
        inputField.addEventListener('focus', hideRecordingControls);
        inputField.addEventListener('blur', showRecordingControls);
    } else {
        // Log as debug instead of warning
        console.debug('Input Field:', inputField);
    }
}
// Function to prevent default behavior and manage focus
function preventEnterDefault(inputId) {
    if (typeof inputId === 'string' && inputId.trim() !== '') {
        var inputElement = document.getElementById(inputId);

        if (inputElement) {
            inputElement.blur();
            setTimeout(function () {
                inputElement.focus();
            }, 100);
        } else {
            console.warn(`Element with ID "${inputId}" not found.`);
        }
    }
}


document.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        preventEnterDefault(event);
    }
});



const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chathub")
    .build();

connection.on("OperationNotification", (operation, details) => {
    // Handle the notification
    console.log(`Operation: ${operation}, Details: ${details}`);

    // You can show a toast or a notification popup here
    showToastNotification(operation, details);
});

connection.start().catch(err => console.error(err));




window.toggleDarkMode = () => {
    const toggleButton = document.querySelector('.dark-light');
    if (!toggleButton) return;

    toggleButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });
};


window.addOutsideClickListener = (dotNetHelper, dropdownElement, buttonElement) => {
    document.addEventListener("click", (event) => {
        const isClickInsideDropdown = dropdownElement && dropdownElement.contains(event.target);
        const isClickOnButton = buttonElement && buttonElement.contains(event.target);

        if (!isClickInsideDropdown && !isClickOnButton) {
            dotNetHelper.invokeMethodAsync("CloseNotificationDropdown");
        }
    });
};



