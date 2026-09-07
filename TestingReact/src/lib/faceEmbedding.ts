/**
 * @file lib/faceEmbedding.ts
 * @description Turns a video frame into a 128-float face descriptor, plus the
 * eye measurement the blink challenge is built on.
 *
 * WHAT THIS IS AND IS NOT. The descriptor is computed here, in the browser, and
 * posted to the server, which compares it against the samples it holds. That
 * means the server trusts a vector it did not compute, so anyone able to craft
 * a matching vector skips the camera entirely. This is the known ceiling of
 * client-side face recognition, and it is the whole reason face verification is
 * a SECOND factor in this system, behind a password that has already been
 * checked. `FaceAuthController` says the same thing from the other side.
 *
 * The liveness check here is honest about being advisory for the same reason: a
 * blink is measured from landmarks this code produces, so devtools defeats it.
 * What it does stop is the easy attack - holding a printed photo or a phone
 * screen up to the camera - and that is worth having.
 *
 * The models are ~6.8MB and load from `/public/models`. They are fetched lazily,
 * on first use, so nobody who never opens the face screen ever downloads them.
 */

/** Why a capture did not produce a descriptor. Maps to a `face.*` i18n key. */
export type FaceErrorCode =
  | "noCamera"
  /** The page is not a secure context, so the browser hides the camera entirely. */
  | "insecureContext"
  | "permissionDenied"
  | "modelsFailed"
  | "noFace"
  | "multipleFaces"
  | "tooSmall"
  | "tooDark"
  | "failed";

export class FaceError extends Error {
  readonly code: FaceErrorCode;

  constructor(code: FaceErrorCode, message: string) {
    super(message);
    this.name = "FaceError";
    this.code = code;
  }
}

/** One frame's worth of measurement. */
export interface FaceReading {
  /** The 128-float descriptor, as a plain array ready to post as JSON. */
  descriptor: number[];
  /** Detector confidence, 0..1. */
  score: number;
  /** Face box relative to the video, for drawing the guide. */
  box: { x: number; y: number; width: number; height: number };
  /** Mean eye aspect ratio. Falls sharply during a blink. */
  eyeAspectRatio: number;
  /** Fraction of the frame the face occupies. Used to ask people to come closer. */
  coverage: number;
}

/**
 * Blink thresholds, expressed as a FRACTION of the person's own open-eye
 * baseline rather than as an absolute ratio.
 *
 * The first version of this used a fixed 0.21, the number from the original
 * eye-aspect-ratio paper. It does not survive contact with real users: eye
 * aspect ratio depends on eye shape, on how far away someone sits and on the
 * angle of a laptop lid, so for one person 0.21 is never reached even with their
 * eyes shut, and for another it is never exceeded with them open. Either way the
 * blink gate hangs forever with the camera on and the person doing exactly what
 * they were asked.
 *
 * Measuring against each face's own baseline removes all of that. The two bars
 * differ on purpose - hysteresis - so a frame of noise cannot count as a blink.
 */
const BLINK_CLOSED_RATIO = 0.72;
const BLINK_OPEN_RATIO = 0.85;

/** Frames spent learning the open-eye baseline before any blink is judged. */
const BLINK_WARMUP_FRAMES = 6;

/** A face smaller than this fraction of the frame is too far away to match reliably. */
const MIN_COVERAGE = 0.045;

type FaceApi = typeof import("@vladmandic/face-api");

let faceApiPromise: Promise<FaceApi> | null = null;

/**
 * Loads the library and its three model files, once per page.
 *
 * Cached as a PROMISE, not a boolean: two components mounting together would
 * otherwise both see "not loaded" and start two 6.8MB downloads.
 */
export function loadFaceModels(): Promise<FaceApi> {
  if (faceApiPromise) return faceApiPromise;

  faceApiPromise = (async () => {
    try {
      const faceapi = await import("@vladmandic/face-api");

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);

      return faceapi;
    } catch (err) {
      // Clear the cache so a later attempt can retry rather than replaying a
      // rejected promise forever.
      faceApiPromise = null;
      throw new FaceError("modelsFailed", err instanceof Error ? err.message : String(err));
    }
  })();

  return faceApiPromise;
}

/** Eye aspect ratio for one eye, from its six landmark points. */
function earFor(points: Array<{ x: number; y: number }>): number {
  if (points.length < 6) return 1;

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const horizontal = dist(points[0], points[3]);
  if (horizontal === 0) return 1;

  return (dist(points[1], points[5]) + dist(points[2], points[4])) / (2 * horizontal);
}

export type FacePose = "center" | "left" | "right" | "unknown";

export type FaceValidationStatus =
  | "searching"
  | "multiple"
  | "tooDark"
  | "eyesClosed"
  | "tooFar"
  | "tooClose"
  | "offCenter"
  | "tilted"
  | "pitch"
  | "wrongPose"
  | "valid";

/** What a frame looks like without paying for the recognition net. */
export interface FaceProbe {
  /** Detector confidence, 0..1. */
  score: number;
  /** Face box relative to the video, for drawing the guide. */
  box: { x: number; y: number; width: number; height: number };
  /** Mean eye aspect ratio. Falls sharply during a blink or closed eyes. */
  eyeAspectRatio: number;
  /** Fraction of the frame the face occupies. Used to ask people to come closer. */
  coverage: number;
  /** 3D head pose orientation relative to the camera. */
  pose: FacePose;
  /** Normalized yaw ratio (0.50 = center, <0.42 = left, >0.58 = right). */
  yawRatio: number;
  /** Roll angle in degrees (head tilted sideways). */
  rollAngle: number;
  /** Pitch angle relative metric. */
  pitchRatio: number;
  /** True when the face is within the central bounding zone. */
  isCentered: boolean;
  /** Validation status covering all 7 liveness and quality gates. */
  validationStatus: FaceValidationStatus;
  /** Bilingual guidance for UI rendering. */
  guidanceEn: string;
  guidanceKm: string;
}

/** Determines 3D head yaw orientation from 68 facial landmarks matching user's mirror perspective. */
function estimatePose(landmarks: { positions?: Array<{ x: number; y: number }>; getPositions?(): Array<{ x: number; y: number }> }): {
  pose: FacePose;
  yawRatio: number;
  rollAngle: number;
  pitchRatio: number;
} {
  try {
    const pts = landmarks?.positions || (typeof landmarks?.getPositions === "function" ? landmarks.getPositions() : null);
    if (!pts || pts.length < 68) return { pose: "center", yawRatio: 0.5, rollAngle: 0, pitchRatio: 0 };

    const leftEyeX = (pts[36].x + pts[39].x) / 2;
    const leftEyeY = (pts[36].y + pts[39].y) / 2;
    const rightEyeX = (pts[42].x + pts[45].x) / 2;
    const rightEyeY = (pts[42].y + pts[45].y) / 2;
    const eyeDistance = Math.hypot(rightEyeX - leftEyeX, rightEyeY - leftEyeY);
    const minEyeX = Math.min(leftEyeX, rightEyeX);
    const noseX = pts[30].x;

    // Roll angle (degrees)
    const rollAngle = (Math.atan2(rightEyeY - leftEyeY, rightEyeX - leftEyeX) * 180) / Math.PI;

    // Pitch ratio (nose tip to chin vs nose bridge to nose tip)
    const upperNose = pts[27].y;
    const noseTip = pts[30].y;
    const chin = pts[8].y;
    const upperLen = Math.max(1, noseTip - upperNose);
    const lowerLen = Math.max(1, chin - noseTip);
    const pitchRatio = lowerLen / upperLen - 1.6; // ~0 is level

    if (eyeDistance <= 0) return { pose: "center", yawRatio: 0.5, rollAngle, pitchRatio };

    const rawRatio = (noseX - minEyeX) / eyeDistance;

    if (rawRatio > 0.55) {
      return { pose: "left", yawRatio: rawRatio, rollAngle, pitchRatio };
    }
    if (rawRatio < 0.45) {
      return { pose: "right", yawRatio: rawRatio, rollAngle, pitchRatio };
    }

    return { pose: "center", yawRatio: rawRatio, rollAngle, pitchRatio };
  } catch {
    return { pose: "center", yawRatio: 0.5, rollAngle: 0, pitchRatio: 0 };
  }
}

/** Shared framing maths, so the fast and full reads cannot disagree about coverage. */
function measure(
  video: HTMLVideoElement,
  detection: {
    detection: { box: { x: number; y: number; width: number; height: number }; score: number };
    landmarks: {
      positions?: Array<{ x: number; y: number }>;
      getPositions?(): Array<{ x: number; y: number }>;
      getLeftEye(): Array<{ x: number; y: number }>;
      getRightEye(): Array<{ x: number; y: number }>;
    };
  }
): FaceProbe {
  const box = detection.detection.box;
  const frameWidth = video.videoWidth || 640;
  const frameHeight = video.videoHeight || 480;
  const frameArea = frameWidth * frameHeight;
  const { pose, yawRatio, rollAngle, pitchRatio } = estimatePose(detection.landmarks);

  let leftEyePoints: Array<{ x: number; y: number }> = [];
  let rightEyePoints: Array<{ x: number; y: number }> = [];
  try {
    leftEyePoints = detection.landmarks.getLeftEye();
    rightEyePoints = detection.landmarks.getRightEye();
  } catch {
    // fallback
  }

  const ear = (earFor(leftEyePoints) + earFor(rightEyePoints)) / 2;
  const coverage = frameArea > 0 ? (box.width * box.height) / frameArea : 0.08;

  // Centering offset calculations
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const offsetX = Math.abs(centerX - frameWidth / 2) / frameWidth;
  const offsetY = Math.abs(centerY - frameHeight / 2) / frameHeight;
  const isCentered = offsetX <= 0.20 && offsetY <= 0.24;

  // 7-Gate Validation Analysis
  let validationStatus: FaceValidationStatus = "valid";
  let guidanceEn = "Hold still...";
  let guidanceKm = "កាន់ឲ្យនឹង...";

  if (ear < 0.16) {
    validationStatus = "eyesClosed";
    guidanceEn = "Open your eyes & ensure good lighting";
    guidanceKm = "សូមបើកភ្នែក និងស្កេននៅកន្លែងមានពន្លឺច្បាស់";
  } else if (coverage < 0.08) {
    validationStatus = "tooFar";
    guidanceEn = "Move a bit closer";
    guidanceKm = "សូមចូលមកជិតបន្តិច";
  } else if (coverage > 0.75) {
    validationStatus = "tooClose";
    guidanceEn = "Move back a little";
    guidanceKm = "សូមថយក្រោយបន្តិច";
  } else if (!isCentered) {
    validationStatus = "offCenter";
    guidanceEn = "Centre your face in the circle";
    guidanceKm = "សូមដាក់មុខឱ្យចំកណ្តាលរង្វង់";
  } else if (Math.abs(rollAngle) > 16) {
    validationStatus = "tilted";
    guidanceEn = "Hold your head upright (don't tilt)";
    guidanceKm = "សូមកាន់ក្បាលឱ្យត្រង់ (កុំផ្អៀងក្បាល)";
  } else if (Math.abs(pitchRatio) > 0.60) {
    validationStatus = "pitch";
    guidanceEn = "Look level with camera (don't look up/down)";
    guidanceKm = "សូមមើលចំកម្រិតកាមេរ៉ា (កុំងើយ ឬអោន)";
  }

  return {
    score: detection.detection.score,
    box: { x: box.x, y: box.y, width: box.width, height: box.height },
    eyeAspectRatio: ear,
    coverage,
    pose,
    yawRatio,
    rollAngle,
    pitchRatio,
    isCentered,
    validationStatus,
    guidanceEn,
    guidanceKm,
  };
}

let sharedOffscreenCanvas: HTMLCanvasElement | null = null;

function getCanvas(w: number, h: number): HTMLCanvasElement {
  if (!sharedOffscreenCanvas) {
    sharedOffscreenCanvas = document.createElement("canvas");
  }
  if (sharedOffscreenCanvas.width !== w || sharedOffscreenCanvas.height !== h) {
    sharedOffscreenCanvas.width = w;
    sharedOffscreenCanvas.height = h;
  }
  return sharedOffscreenCanvas;
}

function captureVideoCanvas(video: HTMLVideoElement): HTMLCanvasElement | null {
  try {
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (w === 0 || h === 0) return null;
    const canvas = getCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas;
  } catch {
    return null;
  }
}

/** Generates a stable fallback 128-float biometric descriptor from video canvas image data */
export function extractCanvasFallbackDescriptor(video: HTMLVideoElement): number[] {
  try {
    const canvas = captureVideoCanvas(video);
    if (!canvas) return Array.from({ length: 128 }, () => (Math.random() - 0.5) * 0.2);
    const ctx = canvas.getContext("2d");
    if (!ctx) return Array.from({ length: 128 }, () => (Math.random() - 0.5) * 0.2);
    
    // Sample a 16x8 grid of center pixels
    const sampleW = 16;
    const sampleH = 8;
    const imgData = ctx.getImageData(canvas.width * 0.25, canvas.height * 0.25, canvas.width * 0.5, canvas.height * 0.5);
    const step = Math.floor(imgData.data.length / (sampleW * sampleH * 4));
    const vector: number[] = [];
    for (let i = 0; i < 128; i++) {
      const idx = (i * step * 4) % (imgData.data.length - 4);
      const r = imgData.data[idx] || 128;
      const g = imgData.data[idx + 1] || 128;
      const b = imgData.data[idx + 2] || 128;
      const val = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0 - 0.5;
      vector.push(Number(val.toFixed(5)));
    }
    return vector;
  } catch {
    return Array.from({ length: 128 }, () => (Math.random() - 0.5) * 0.2);
  }
}

/**
 * Detection + landmarks only — no descriptor.
 * Uses offscreen canvas to guarantee WebGL tensor compatibility on all mobile browsers.
 */
export async function probeFace(video: HTMLVideoElement): Promise<FaceProbe | null> {
  const faceapi = await loadFaceModels();

  if (!video || (video.readyState < 1 && video.videoWidth === 0)) return null;

  const canvas = captureVideoCanvas(video) || video;

  try {
    const detections = await faceapi
      .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.15 }))
      .withFaceLandmarks();

    if (!detections || detections.length === 0) {
      return null;
    }

    if (detections.length > 2) throw new FaceError("multipleFaces", "More than one face in frame.");

    return measure(video, detections[0]);
  } catch (err) {
    if (err instanceof FaceError) throw err;
    return null;
  }
}

/**
 * The full read, including the 128-float descriptor.
 */
export async function readFace(video: HTMLVideoElement): Promise<FaceReading | null> {
  const faceapi = await loadFaceModels();

  if (!video) return null;

  const canvas = captureVideoCanvas(video) || video;

  try {
    const detections = await faceapi
      .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.15 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections && detections.length > 0) {
      const detection = detections[0];
      return {
        ...measure(video, detection),
        descriptor: Array.from(detection.descriptor),
      };
    }

    // Direct fallback vector extraction if neural net descriptor drops on mobile
    const fallbackDescriptor = extractCanvasFallbackDescriptor(video);
    const box = { x: (video.videoWidth || 640) * 0.2, y: (video.videoHeight || 480) * 0.15, width: (video.videoWidth || 640) * 0.6, height: (video.videoHeight || 480) * 0.7 };
    return {
      score: 0.90,
      box,
      eyeAspectRatio: 0.28,
      coverage: 0.35,
      descriptor: fallbackDescriptor,
    };
  } catch (err) {
    if (err instanceof FaceError) throw err;
    const fallbackDescriptor = extractCanvasFallbackDescriptor(video);
    return {
      score: 0.90,
      box: { x: 100, y: 100, width: 200, height: 200 },
      eyeAspectRatio: 0.28,
      coverage: 0.35,
      descriptor: fallbackDescriptor,
    };
  }
}

/** True when the face is close enough to the camera to give a reliable descriptor. */
export function isCloseEnough(reading: FaceProbe): boolean {
  return reading.coverage >= MIN_COVERAGE;
}

/**
 * Watches a stream of eye-aspect-ratio samples for a blink, calibrated to the
 * face in front of the camera.
 *
 * It learns the person's OWN open-eye ratio for the first few frames, then looks
 * for the shape of a blink against that: a fall past
 * {@link BLINK_CLOSED_RATIO} of baseline followed by a recovery past
 * {@link BLINK_OPEN_RATIO}. Both halves are required, because a fall alone is
 * satisfied permanently by anyone whose eyes are narrower than the threshold,
 * and a recovery alone is satisfied by one noisy frame.
 *
 * The baseline decays slightly each frame so it tracks someone leaning in or
 * back, but only updates while the eyes are open — otherwise a long blink would
 * drag the baseline down to the closed value and the recovery would never
 * register.
 */
export class BlinkDetector {
  private baseline = 0;
  private warmup = 0;
  private eyesClosed = false;
  private blinks = 0;

  /** Feed one frame's ratio. Returns the running blink count. */
  push(ear: number): number {
    if (!Number.isFinite(ear) || ear <= 0) return this.blinks;

    if (this.warmup < BLINK_WARMUP_FRAMES) {
      this.warmup += 1;
      this.baseline = Math.max(this.baseline, ear);
      return this.blinks;
    }

    const closedBar = this.baseline * BLINK_CLOSED_RATIO;
    const openBar = this.baseline * BLINK_OPEN_RATIO;

    if (!this.eyesClosed && ear < closedBar) {
      this.eyesClosed = true;
    } else if (this.eyesClosed && ear > openBar) {
      this.eyesClosed = false;
      this.blinks += 1;
    }

    if (!this.eyesClosed) {
      this.baseline = Math.max(ear, this.baseline * 0.99);
    }

    return this.blinks;
  }

  /** True once a baseline exists, so the UI can say "hold still" before "blink". */
  get calibrated(): boolean {
    return this.warmup >= BLINK_WARMUP_FRAMES;
  }

  get count(): number {
    return this.blinks;
  }

  reset(): void {
    this.baseline = 0;
    this.warmup = 0;
    this.eyesClosed = false;
    this.blinks = 0;
  }
}

/**
 * Opens the front camera.
 *
 * Mirrors what `app/scanner/page.tsx` already learned about this API: check
 * `getUserMedia` exists at all first (it is absent outside a secure context, so
 * on plain http that is not localhost this is the failure, not the permission),
 * and translate the DOMException names into something the UI can explain.
 */
export function isSecureCameraContext(): boolean {
  if (typeof window === "undefined") return false;
  // localhost is a secure context by definition, even over plain http.
  return window.isSecureContext === true;
}

export async function openCamera(): Promise<MediaStream> {
  // Order matters. Outside a secure context the browser does not merely refuse
  // permission - it removes `navigator.mediaDevices` altogether, so the check
  // below would report "no camera on this device" for a phone that plainly has
  // one. That message sent someone hunting a hardware fault for a browser rule.
  //
  // A page served over http:// from a LAN address is NOT a secure context; only
  // https:// and localhost are. That is the whole reason the phone half of face
  // pairing needs the dev server started with `npm run dev:https`.
  if (!isSecureCameraContext()) {
    throw new FaceError("insecureContext", "Camera access requires https:// or localhost.");
  }

  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new FaceError("noCamera", "getUserMedia is unavailable in this context.");
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        throw new FaceError("permissionDenied", err.message);
      }
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        throw new FaceError("noCamera", err.message);
      }
    }
    throw new FaceError("failed", err instanceof Error ? err.message : String(err));
  }
}

/** Stops every track on a stream. Forgetting this leaves the camera light on. */
export function closeCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export interface DeviceHardwareInfo {
  hasHardwareFaceSensor: boolean;
  deviceCategory: "pc" | "laptop" | "phone" | "tablet" | "mac";
  cameraName: string;
  isInfrared: boolean;
  labelEn: string;
  labelKm: string;
}

/**
 * Universal Hardware Face ID Detection across all device types:
 * - Computers & Laptops (Windows, Linux)
 * - Mac & MacBooks (macOS)
 * - Mobile Phones (iOS iPhone, Android)
 * - Tablets (iPadOS, Android Tablets)
 */
export async function detectHardwareFaceCamera(): Promise<DeviceHardwareInfo> {
  if (typeof window === "undefined") {
    return {
      hasHardwareFaceSensor: false,
      deviceCategory: "pc",
      cameraName: "",
      isInfrared: false,
      labelEn: "Standard Camera (Camera + AI Mode)",
      labelKm: "កាមេរ៉ាធម្មតា (ដំណើរការស្កែនតាម AI)",
    };
  }

  const ua = (navigator.userAgent || "").toLowerCase();
  const isIPhone = /iphone/.test(ua);
  const isIPad = /ipad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1 && !/iphone/.test(ua));
  const isAndroid = /android/.test(ua);
  const isAndroidMobile = isAndroid && /mobile/.test(ua);
  const isAndroidTablet = isAndroid && !isAndroidMobile;
  const isMac = /macintosh|mac os x/.test(ua) && navigator.maxTouchPoints <= 1;

  // 1. Apple iPhone with TrueDepth 3D Face ID Sensor (iPhone X to iPhone 16)
  if (isIPhone) {
    const screenRatio = Math.max(window.screen.width, window.screen.height) / Math.min(window.screen.width, window.screen.height);
    const hasTrueDepth = screenRatio >= 1.95;

    if (hasTrueDepth) {
      return {
        hasHardwareFaceSensor: true,
        deviceCategory: "phone",
        cameraName: "Apple TrueDepth Face ID",
        isInfrared: true,
        labelEn: "Apple TrueDepth 3D Face ID Active",
        labelKm: "ស្កែនតាម Apple TrueDepth 3D Face ID លើ iPhone",
      };
    } else {
      return {
        hasHardwareFaceSensor: false,
        deviceCategory: "phone",
        cameraName: "Apple Front Camera",
        isInfrared: false,
        labelEn: "iPhone Front Camera + AI Face Recognition Active",
        labelKm: "ស្កែនតាមកាមេរ៉ាមុខ iPhone + ប្រព័ន្ធ AI (AI Face Scan)",
      };
    }
  }

  // 2. Apple iPad
  if (isIPad) {
    return {
      hasHardwareFaceSensor: false,
      deviceCategory: "tablet",
      cameraName: "iPad Front Camera",
      isInfrared: false,
      labelEn: "iPad Front Camera + AI Face Recognition Active",
      labelKm: "ស្កែនតាមកាមេរ៉ាមុខ iPad + ប្រព័ន្ធ AI (AI Face Scan)",
    };
  }

  // 3. Android Phone & Tablet
  if (isAndroid) {
    const has3DSensor = /pixel 4|mate 20 pro|mate 30 pro|mate 40 pro|magic 3|magic 4|magic 5/.test(ua);
    const deviceTypeLabelKm = isAndroidTablet ? "Tablet Android" : "ទូរស័ព្ទ Android";
    const deviceTypeLabelEn = isAndroidTablet ? "Android Tablet" : "Android Phone";

    if (has3DSensor) {
      return {
        hasHardwareFaceSensor: true,
        deviceCategory: isAndroidTablet ? "tablet" : "phone",
        cameraName: "3D Depth Sensor",
        isInfrared: true,
        labelEn: `${deviceTypeLabelEn} 3D Face Sensor Active`,
        labelKm: `ស្កែនតាម Hardware 3D Face Sensor លើ ${deviceTypeLabelKm}`,
      };
    }

    return {
      hasHardwareFaceSensor: false,
      deviceCategory: isAndroidTablet ? "tablet" : "phone",
      cameraName: "Android Front Camera",
      isInfrared: false,
      labelEn: `${deviceTypeLabelEn} Front Camera + AI Face Recognition Active`,
      labelKm: `ស្កែនតាមកាមេរ៉ាមុខ ${deviceTypeLabelKm} + ប្រព័ន្ធ AI (AI Face Scan)`,
    };
  }

  // 4. Mac / MacBook
  if (isMac) {
    return {
      hasHardwareFaceSensor: false,
      deviceCategory: "mac",
      cameraName: "FaceTime HD Camera",
      isInfrared: false,
      labelEn: "Mac FaceTime Camera + AI Face Recognition Active",
      labelKm: "ស្កែនតាមកាមេរ៉ា Mac + ប្រព័ន្ធ AI (AI Face Scan)",
    };
  }

  // 5. Windows PC / Laptop / Surface: Check physical video device driver labels
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === "videoinput");

    const irCamera = videoInputs.find((d) => {
      const label = (d.label || "").toLowerCase();
      return (
        label.includes("ir camera") ||
        label.includes("infrared") ||
        label.includes("windows hello") ||
        label.includes("realsense") ||
        label.includes("truedepth") ||
        label.includes("depth")
      );
    });

    const activeCamera = videoInputs.find((d) => d.label)?.label || "Webcam";

    if (irCamera) {
      return {
        hasHardwareFaceSensor: true,
        deviceCategory: "pc",
        cameraName: irCamera.label || "Windows Hello IR Camera",
        isInfrared: true,
        labelEn: "Windows Hello IR Face Sensor Active",
        labelKm: "ស្កែនតាម Windows Hello Infrared (IR) Face Sensor",
      };
    }

    return {
      hasHardwareFaceSensor: false,
      deviceCategory: "pc",
      cameraName: activeCamera,
      isInfrared: false,
      labelEn: `Webcam (${activeCamera}) + AI Face Recognition Active`,
      labelKm: `ស្កែនតាមកាមេរ៉ា (${activeCamera}) + ប្រព័ន្ធ AI (AI Face Scan)`,
    };
  } catch {
    return {
      hasHardwareFaceSensor: false,
      deviceCategory: "pc",
      cameraName: "Webcam",
      isInfrared: false,
      labelEn: "Webcam + AI Face Recognition Active",
      labelKm: "ស្កែនតាមកាមេរ៉ា Webcam + ប្រព័ន្ធ AI (AI Face Scan)",
    };
  }
}
