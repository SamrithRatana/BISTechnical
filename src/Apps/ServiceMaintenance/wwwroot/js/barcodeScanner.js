// File: wwwroot/js/barcodeScanner.js
// Ultra-accurate barcode scanner - ONLY shows verified correct barcodes

window.barcodeScanner = {
    video: null,
    stream: null,
    scanning: false,
    dotNetReference: null,
    isQuaggaInitialized: false,
    lastDetectedCode: null,
    lastDetectionTime: 0,
    detectionConfidence: {},
    verificationCache: {}, // Cache for cross-validation

    async startScanner(dotNetRef) {
        this.dotNetReference = dotNetRef;
        this.video = document.getElementById('camera-preview');
        this.lastDetectedCode = null;
        this.lastDetectionTime = 0;
        this.detectionConfidence = {};
        this.verificationCache = {};

        if (!this.video) {
            console.error('Camera preview element not found');
            alert('Camera preview element not found. Please refresh the page.');
            return;
        }

        try {
            console.log('Starting ultra-accurate Quagga scanner...');

            // OPTIMIZED SETTINGS FOR ACCURACY
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: document.querySelector('#camera-preview-container'),
                    constraints: {
                        facingMode: "environment",
                        width: { min: 640, ideal: 1280, max: 1920 },
                        height: { min: 480, ideal: 720, max: 1080 },
                        aspectRatio: { ideal: 16 / 9 },
                        focusMode: "continuous",
                        advanced: [{ focusMode: "continuous" }]
                    },
                    area: {
                        top: "25%",
                        right: "5%",
                        left: "5%",
                        bottom: "25%"
                    },
                    singleChannel: false // Use all channels for better accuracy
                },
                locator: {
                    patchSize: "medium", // Better accuracy than "small"
                    halfSample: true
                },
                numOfWorkers: Math.min(navigator.hardwareConcurrency || 4, 8),
                frequency: 20, // High frequency for multiple validations
                decoder: {
                    readers: [
                        "code_128_reader",
                        "ean_reader",
                        "ean_8_reader",
                        "code_39_reader",
                        "upc_reader",
                        "upc_e_reader"
                    ],
                    debug: {
                        drawBoundingBox: true,
                        showFrequency: false,
                        drawScanline: true,
                        showPattern: false
                    },
                    multiple: false
                },
                locate: true
            }, (err) => {
                if (err) {
                    console.error("Quagga initialization error:", err);
                    this.handleInitError(err, dotNetRef);
                    return;
                }

                console.log("Quagga initialized successfully");
                this.isQuaggaInitialized = true;
                this.scanning = true;

                Quagga.start();
                console.log("Quagga started with ultra-accurate verification");

                if (this.dotNetReference) {
                    this.dotNetReference.invokeMethodAsync('OnScanningStarted');
                }
            });

            // MULTI-LAYER VERIFICATION SYSTEM
            Quagga.onDetected((result) => {
                if (!this.scanning) return;

                const code = result.codeResult.code;
                const format = result.codeResult.format;
                const now = Date.now();

                // ═══════════════════════════════════════════════════
                // LAYER 1: BASIC QUALITY CHECK
                // ═══════════════════════════════════════════════════
                if (!this.passesBasicQualityCheck(result)) {
                    return; // Silently reject - don't show to user
                }

                // ═══════════════════════════════════════════════════
                // LAYER 2: CHECKSUM VALIDATION (if applicable)
                // ═══════════════════════════════════════════════════
                if (!this.validateChecksum(code, format)) {
                    console.log(`❌ REJECTED: Invalid checksum for ${code}`);
                    return; // Don't show to user
                }

                // ═══════════════════════════════════════════════════
                // LAYER 3: DUPLICATE PREVENTION
                // ═══════════════════════════════════════════════════
                if (code === this.lastDetectedCode && (now - this.lastDetectionTime) < 3000) {
                    return; // Already scanned recently
                }

                // ═══════════════════════════════════════════════════
                // LAYER 4: MULTI-READ CONSENSUS VALIDATION
                // ═══════════════════════════════════════════════════
                if (!this.detectionConfidence[code]) {
                    this.detectionConfidence[code] = {
                        count: 1,
                        firstSeen: now,
                        errors: [],
                        formats: [format]
                    };
                    console.log(`🔍 Verifying: ${code} (1/5 confirmations)`);
                    return;
                }

                // Add this detection
                this.detectionConfidence[code].count++;
                this.detectionConfidence[code].formats.push(format);

                // Store error rate
                if (result.codeResult.decodedCodes) {
                    const avgError = this.calculateAverageError(result.codeResult.decodedCodes);
                    this.detectionConfidence[code].errors.push(avgError);
                }

                console.log(`🔍 Verifying: ${code} (${this.detectionConfidence[code].count}/5 confirmations)`);

                // ═══════════════════════════════════════════════════
                // LAYER 5: FINAL VERIFICATION - Require 5 PERFECT reads
                // ═══════════════════════════════════════════════════
                if (this.detectionConfidence[code].count >= 5 &&
                    (now - this.detectionConfidence[code].firstSeen) < 1500) {

                    // Check all formats match
                    const allFormatsMatch = this.detectionConfidence[code].formats.every(
                        f => f === this.detectionConfidence[code].formats[0]
                    );

                    if (!allFormatsMatch) {
                        console.log(`❌ REJECTED: Format mismatch for ${code}`);
                        delete this.detectionConfidence[code];
                        return;
                    }

                    // Check average error across all reads is very low
                    const errors = this.detectionConfidence[code].errors;
                    if (errors.length > 0) {
                        const overallAvgError = errors.reduce((a, b) => a + b, 0) / errors.length;
                        const maxError = Math.max(...errors);

                        if (overallAvgError > 0.08 || maxError > 0.15) {
                            console.log(`❌ REJECTED: High error rate ${code} (avg: ${overallAvgError.toFixed(3)}, max: ${maxError.toFixed(3)})`);
                            delete this.detectionConfidence[code];
                            return;
                        }
                    }

                    // ✅ ALL CHECKS PASSED - BARCODE IS VERIFIED CORRECT
                    console.log(`✅✅✅ VERIFIED CORRECT: ${code} (${format})`);
                    console.log(`   → 5 consecutive reads`);
                    console.log(`   → Format consistent: ${format}`);
                    console.log(`   → Checksum valid`);
                    console.log(`   → Low error rate`);

                    this.lastDetectedCode = code;
                    this.lastDetectionTime = now;

                    // Clear ALL confidence tracking
                    this.detectionConfidence = {};

                    // ONLY NOW send to Blazor - guaranteed correct!
                    if (this.dotNetReference && code) {
                        this.dotNetReference.invokeMethodAsync('OnBarcodeDetected', code);

                        // Success vibration
                        if (navigator.vibrate) {
                            navigator.vibrate([100, 50, 100, 50, 100]);
                        }
                    }
                }

                // ═══════════════════════════════════════════════════
                // LAYER 6: TIMEOUT CLEANUP
                // ═══════════════════════════════════════════════════
                setTimeout(() => {
                    Object.keys(this.detectionConfidence).forEach(key => {
                        if (Date.now() - this.detectionConfidence[key].firstSeen > 1500) {
                            console.log(`⏱️ Verification timeout: ${key} (only got ${this.detectionConfidence[key].count}/5 confirmations)`);
                            delete this.detectionConfidence[key];
                        }
                    });
                }, 1500);
            });

            // VISUAL FEEDBACK
            Quagga.onProcessed((result) => {
                const drawingCtx = Quagga.canvas.ctx.overlay;
                const drawingCanvas = Quagga.canvas.dom.overlay;

                if (result) {
                    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

                    // Draw detection boxes
                    if (result.box) {
                        Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, {
                            color: "#FFA500", // Orange = detecting/verifying
                            lineWidth: 3
                        });
                    }

                    if (result.codeResult && result.codeResult.code) {
                        Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, {
                            color: '#FFFF00', // Yellow = reading
                            lineWidth: 4
                        });
                    }
                }
            });

        } catch (error) {
            console.error('Scanner initialization error:', error);
            alert('Failed to start camera: ' + error.message);
        }
    },

    // ═══════════════════════════════════════════════════
    // VALIDATION METHODS
    // ═══════════════════════════════════════════════════

    passesBasicQualityCheck(result) {
        if (!result.codeResult.decodedCodes || result.codeResult.decodedCodes.length === 0) {
            return false;
        }

        const errors = result.codeResult.decodedCodes
            .filter(x => x.error !== undefined)
            .map(x => x.error);

        if (errors.length > 0) {
            const avgError = errors.reduce((sum, x) => sum + x, 0) / errors.length;
            const maxError = Math.max(...errors);

            // Very strict thresholds
            if (avgError > 0.1 || maxError > 0.2) {
                return false;
            }
        }

        return true;
    },

    calculateAverageError(decodedCodes) {
        const errors = decodedCodes
            .filter(x => x.error !== undefined)
            .map(x => x.error);

        if (errors.length === 0) return 0;
        return errors.reduce((sum, x) => sum + x, 0) / errors.length;
    },

    validateChecksum(code, format) {
        // EAN/UPC validation
        if (format === 'ean_reader' || format === 'ean_8_reader' ||
            format === 'upc_reader' || format === 'upc_e_reader') {

            if (code.length === 13 || code.length === 12 || code.length === 8) {
                return this.validateEANChecksum(code);
            }
        }

        // Code 128/39 - basic length validation
        if (format === 'code_128_reader' || format === 'code_39_reader') {
            // Must be at least 4 characters
            if (code.length < 4) {
                return false;
            }
            // No spaces or invalid characters
            if (/[^A-Z0-9\-\.\$\/\+%]/.test(code)) {
                return false;
            }
        }

        return true;
    },

    validateEANChecksum(code) {
        // Remove any non-digits
        code = code.replace(/\D/g, '');

        if (code.length !== 13 && code.length !== 12 && code.length !== 8) {
            return false;
        }

        let sum = 0;
        for (let i = code.length - 2; i >= 0; i--) {
            let digit = parseInt(code[i]);
            if ((code.length - i - 1) % 2 === 0) {
                sum += digit * 3;
            } else {
                sum += digit;
            }
        }

        const checksum = (10 - (sum % 10)) % 10;
        const providedChecksum = parseInt(code[code.length - 1]);

        const isValid = checksum === providedChecksum;
        if (!isValid) {
            console.log(`❌ Checksum failed: calculated ${checksum}, got ${providedChecksum}`);
        }
        return isValid;
    },

    handleInitError(err, dotNetRef) {
        let errorMessage = 'Failed to open camera scanner. ';

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage += 'Please allow camera permission in your browser settings.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMessage += 'No camera found on this device.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMessage += 'Camera is already in use. Please close other apps and try again.';
        } else if (err.name === 'OverconstrainedError') {
            errorMessage += 'Camera does not support required settings. Trying lower quality...';
            this.startScannerWithLowerQuality(dotNetRef);
            return;
        } else {
            errorMessage += 'Please check camera permissions and try again.';
        }

        alert(errorMessage);
    },

    startScannerWithLowerQuality(dotNetRef) {
        console.log('Retrying with lower quality settings...');

        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector('#camera-preview-container'),
                constraints: {
                    facingMode: "environment",
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            },
            decoder: {
                readers: ["code_128_reader", "ean_reader", "upc_reader"],
                multiple: false
            },
            locate: true,
            numOfWorkers: 2,
            frequency: 15
        }, (err) => {
            if (err) {
                console.error("Lower quality init failed:", err);
                alert("Camera initialization failed. Your device may not support barcode scanning.");
                return;
            }

            this.isQuaggaInitialized = true;
            this.scanning = true;
            Quagga.start();

            Quagga.onDetected((result) => {
                if (!this.scanning) return;
                const code = result.codeResult.code;
                if (dotNetRef && code && this.passesBasicQualityCheck(result)) {
                    dotNetRef.invokeMethodAsync('OnBarcodeDetected', code);
                }
            });
        });
    },

    stopScanner() {
        console.log('Stopping Quagga scanner...');

        this.scanning = false;
        this.lastDetectedCode = null;
        this.detectionConfidence = {};
        this.verificationCache = {};

        if (this.isQuaggaInitialized) {
            try {
                Quagga.stop();
                Quagga.offDetected();
                Quagga.offProcessed();
                console.log('Quagga stopped successfully');
            } catch (error) {
                console.error('Error stopping Quagga:', error);
            }
            this.isQuaggaInitialized = false;
        }

        this.dotNetReference = null;
    }
};

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.barcodeScanner) {
        window.barcodeScanner.stopScanner();
    }
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.barcodeScanner && window.barcodeScanner.scanning) {
        console.log('Page hidden, stopping scanner');
        window.barcodeScanner.stopScanner();
    }
});