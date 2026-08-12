let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let audioStream = null;

// Detect if device is mobile
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Get appropriate MIME type for the device
function getAudioMimeType() {
    const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/mpeg'
    ];

    for (let type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            console.log('Using MIME type:', type);
            return type;
        }
    }

    // Fallback
    return 'audio/webm';
}

async function startRecording() {
    try {
        // Request microphone permission with mobile-friendly constraints
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                // Mobile-specific settings
                sampleRate: 44100,
                channelCount: 1
            }
        };

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // Request permission
            audioStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Get supported MIME type
            const mimeType = getAudioMimeType();

            // Create MediaRecorder with appropriate options
            const options = {
                mimeType: mimeType,
                audioBitsPerSecond: 128000
            };

            mediaRecorder = new MediaRecorder(audioStream, options);

            // Clear previous chunks
            audioChunks = [];

            mediaRecorder.ondataavailable = function (event) {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onerror = function (event) {
                console.error('MediaRecorder error:', event.error);
                stopRecording();
            };

            // Start recording
            mediaRecorder.start(100); // Collect data every 100ms
            isRecording = true;

            console.log('Recording started successfully');

            // Mobile-specific: Prevent screen lock during recording
            if ('wakeLock' in navigator && isMobileDevice()) {
                try {
                    const wakeLock = await navigator.wakeLock.request('screen');
                    console.log('Wake lock acquired');
                } catch (err) {
                    console.log('Wake lock not supported or denied');
                }
            }

            return true;
        } else {
            throw new Error('MediaDevices API not supported on this device');
        }
    } catch (error) {
        console.error('Error accessing microphone:', error);

        // User-friendly error messages
        let errorMessage = 'Error accessing microphone: ';
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage += 'Permission denied. Please allow microphone access in your browser settings.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage += 'No microphone found on your device.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage += 'Microphone is already in use by another application.';
        } else {
            errorMessage += error.message;
        }

        alert(errorMessage);
        return false;
    }
}

function stopRecording() {
    return new Promise((resolve, reject) => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.onstop = () => {
                try {
                    // Stop all tracks to release the microphone
                    if (audioStream) {
                        audioStream.getTracks().forEach(track => track.stop());
                        audioStream = null;
                    }

                    if (audioChunks.length === 0) {
                        reject('No audio data recorded');
                        return;
                    }

                    // Create blob with the recorded audio
                    const mimeType = mediaRecorder.mimeType || 'audio/webm';
                    let audioBlob = new Blob(audioChunks, { type: mimeType });

                    // Create URL for the audio blob
                    let audioUrl = URL.createObjectURL(audioBlob);

                    // Clear chunks
                    audioChunks = [];
                    isRecording = false;

                    console.log('Recording stopped successfully. Size:', audioBlob.size, 'bytes');
                    resolve(audioUrl);
                } catch (error) {
                    console.error('Error stopping recording:', error);
                    reject(error);
                }
            };

            // Stop the recording
            try {
                mediaRecorder.stop();
            } catch (error) {
                console.error('Error calling stop:', error);
                reject(error);
            }
        } else {
            reject('No recording in progress');
        }
    });
}

// Clean up function to ensure resources are released
function cleanupRecording() {
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    audioChunks = [];
    isRecording = false;
}

// Handle visibility change (when user switches tabs/apps on mobile)
document.addEventListener('visibilitychange', function () {
    if (document.hidden && isRecording) {
        console.log('App hidden while recording, stopping...');
        stopRecording().catch(err => console.error('Error stopping on visibility change:', err));
    }
});

// Export for testing
window.isRecording = () => isRecording;
window.cleanupRecording = cleanupRecording;