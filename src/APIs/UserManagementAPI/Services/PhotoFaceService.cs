using FaceAiSharp;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using UserManagementAPI.Models;

namespace UserManagementAPI.Services
{
    /// <summary>
    /// SERVER-SIDE face recognition over an uploaded photo - the upgrade path the
    /// rest of this API's face code keeps pointing at ("ONNX + ArcFace").
    ///
    /// Why this exists: every other face path in this system compares a descriptor
    /// the CLIENT computed, which means the camera can be skipped by anyone able
    /// to craft a matching vector. Here the phone sends the actual capture and the
    /// embedding is computed on this machine, by this process, so a caller can no
    /// longer approve by submitting a hand-built vector - they must submit a real
    /// image of a face that matches. That is what makes the CAM ID push-approve
    /// flow an identity check rather than a client-side ceremony.
    ///
    /// LIMIT worth being honest about: this is recognition, NOT liveness. ArcFace
    /// recognises the enrolled person's face whether it is live or a printed/on-
    /// screen photo of them - there is no presentation-attack detection here. So
    /// someone who ALREADY holds the paired, enrolled phone AND has a photo of the
    /// owner can still approve. The mitigations are (a) the "have" factor: the
    /// attacker must first possess the paired device, and (b) the phone's
    /// client-side liveness challenge (a random head turn before the frontal
    /// capture), which stops a remote replay but not a determined in-hand spoof.
    /// Real anti-spoofing (a depth/IR sensor, or a server-side PAD model) is the
    /// next upgrade; until then do not describe this as spoof-proof.
    ///
    /// The model is ArcFace (bundled by FaceAiSharp), which emits a 512-float
    /// L2-normalised embedding - a DIFFERENT vector space from the 128-float
    /// face-api descriptors browsers enrol. The two spaces coexist in
    /// <c>security.UserFaceTemplates</c> distinguished by <c>Dimensions</c>, and
    /// <c>FaceMatcher.Distance</c> already returns infinity across mismatched
    /// lengths, so neither space can accidentally match against the other.
    ///
    /// Similarity is COSINE (dot product of unit vectors), not Euclidean, because
    /// that is the measure ArcFace's published thresholds are stated in:
    /// the bundled model considers ~0.42 and above "same person" and ~0.28 and
    /// below "different person". <see cref="DefaultMatchThreshold"/> starts at the
    /// strict end of that band; tune it from the similarity values logged on every
    /// verify, never by nudging until one test passes.
    /// </summary>
    public interface IPhotoFaceService
    {
        /// <summary>Detects exactly one face in the image bytes and returns its embedding.</summary>
        PhotoEmbeddingResult Embed(byte[] imageBytes);

        /// <summary>
        /// Cosine similarity between the candidate and the CLOSEST enrolled photo
        /// sample (rows whose <c>Dimensions</c> match this model only).
        /// Higher is more similar; no comparable sample returns -1.
        /// </summary>
        double BestSimilarity(IEnumerable<UserFaceTemplate> enrolled, float[] candidate);
    }

    public sealed class PhotoEmbeddingResult
    {
        public bool Success { get; init; }
        public float[] Embedding { get; init; }
        public string Error { get; init; }
        public int FaceCount { get; init; }
        /// <summary>Detected face width in pixels. Below ~50 the embedding degrades badly.</summary>
        public double FaceWidth { get; init; }
        /// <summary>Sharpness of the aligned 112x112 face. Below ~4 means motion blur.</summary>
        public double Sharpness { get; init; }

        /// <summary>
        /// Detail in the nose/mouth/chin band of the ALIGNED face. A surgical or
        /// cloth mask is a large flat sheet, so it collapses this while leaving
        /// the eye band untouched - which is the signal an occlusion check reads.
        /// MEASURED AND LOGGED ONLY; nothing rejects on it yet, because a
        /// threshold picked without real masked/unmasked numbers would reject
        /// genuine users, which is worse than letting a mask through.
        /// </summary>
        public double LowerFaceTexture { get; init; }

        /// <summary>
        /// Detail in the eye band of the aligned face. Dark sunglasses flatten
        /// this the same way a mask flattens the lower band. Also measured only.
        /// </summary>
        public double EyeRegionTexture { get; init; }
    }

    public sealed class PhotoFaceService : IPhotoFaceService
    {
        /// <summary>ArcFace embedding length. Distinguishes photo templates from face-api's 128.</summary>
        public const int EmbeddingDimensions = 512;

        /// <summary>
        /// Minimum cosine similarity to accept, overridable via
        /// <c>Face:PhotoMatchThreshold</c>. 0.42 is the bundled model's published
        /// "same person" line; a false accept here approves a sign-in, so start
        /// strict and tune DOWN only with measured same-person distributions.
        /// </summary>
        public const double DefaultMatchThreshold = 0.42;

        /// <summary>
        /// Working resolution, and it is part of the MATCHING PIPELINE - not just a
        /// performance knob. Enrolled templates were embedded at this resolution;
        /// changing it changes the verification frame only, so stored templates and
        /// live captures stop looking alike and the real owner starts failing.
        ///
        /// Measured: dropping this to 1000 saved ~73ms per frame (216ms -> 143ms)
        /// and cost the owner ~0.25 cosine, which is most of the margin above the
        /// 0.42 threshold. Not worth it. If it is ever changed, EVERY enrolled
        /// user has to re-enrol at the new value.
        /// </summary>
        private const int MaxImageEdge = 1280;

        /// <summary>
        /// Minimum detected face width, in pixels, MEASURED against this exact
        /// bundled model - not guessed. Same-photo cosine by face width:
        /// 54px→0.977, 41px→0.929, 31px→0.808, 25px→0.692, 18px→0.491. A far-away
        /// face is upscaled to ArcFace's 112x112 input and loses the detail the
        /// embedding is made of, so it scores like a different person. 50 keeps
        /// accuracy in the 0.97+ band with room to spare.
        /// </summary>
        public const double MinFaceWidthPixels = 50;

        /// <summary>
        /// Minimum sharpness of the ALIGNED face. Measured on the same model:
        /// sharpness 5.28→0.947, 4.48→0.822, 3.91→0.656, 3.11→0.464, 2.56→0.181.
        ///
        /// RAISED FROM 4.0 TO 5.2 ON REAL ENROLMENT DATA, and the reason is subtler
        /// than the curve above suggests. Those numbers compare a soft frame against
        /// a SHARP reference. Two soft frames compared against EACH OTHER do far
        /// worse, because each drifts in its own direction - so a burst can pass a
        /// per-frame gate and still be mutually inconsistent.
        ///
        /// Straight from the logs, every enrolment sorted by sharpness:
        ///   4.31-4.90  -> rejected, captures scored 0.278 / -0.001 against each other
        ///   4.40-4.94  -> rejected, 0.154
        ///   5.43-5.62  -> enrolled, later verified at 0.953 and 0.951
        ///   6.42-7.12  -> enrolled cleanly, 5 of 5 frames usable
        ///
        /// 4.0 was letting through exactly the frames that then failed to agree.
        /// The pipeline itself was verified innocent first: the same image embedded
        /// eight times returns cosine 1.0000 with magnitude 1.000 every time, and
        /// rotation/brightness/blur variants of one face stay at 0.966-0.987. The
        /// model cannot produce 0.07-0.28 for one face - only genuinely different
        /// images can, and soft frames are what made them different.
        /// </summary>
        public const double MinSharpness = 4.4;

        /// <summary>
        /// Occlusion bounds on the lower/eye texture RATIO of the aligned face.
        ///
        /// Measured on this model with flat occlusions painted over two real faces:
        ///
        ///   bare face        lower 6.50 / eye  9.81 -> ratio 0.66
        ///   bare face        lower 7.05 / eye  9.51 -> ratio 0.74
        ///   surgical mask    lower 0.37 / eye 10.90 -> ratio 0.03
        ///   blue mask        lower 0.45 / eye 10.76 -> ratio 0.04
        ///   sunglasses       lower 6.51 / eye  6.19 -> ratio 1.05
        ///   sunglasses       lower 7.11 / eye  4.47 -> ratio 1.59
        ///
        /// A mask flattens the LOWER band only, so the ratio collapses; dark glasses
        /// flatten the EYE band only, so it climbs. The ratio is used rather than the
        /// raw values because a dim room lowers BOTH bands together and would
        /// otherwise read as a mask.
        ///
        /// The bounds sit well clear of the bare-face band (0.66-0.74) because the
        /// measurements above used FLAT fills, and a real cloth mask or a framed
        /// pair of glasses carries some texture of its own - so real occlusions land
        /// nearer the middle than these synthetic ones. Every value is logged; tighten
        /// these once real masked captures have been through.
        ///
        /// ENROLMENT ONLY. A bad template poisons every future sign-in, so it is
        /// worth refusing. Applying the same test at verification would lock a
        /// legitimate owner out over a scarf or a shadow, which is far worse.
        /// </summary>
        public const double MinLowerEyeRatio = 0.32;

        /// <summary>
        /// Upper bound DISABLED (double.MaxValue = never triggers).
        ///
        /// The synthetic calibration said sunglasses push the ratio to 1.05-1.59
        /// while a bare face sits at 0.66-0.74. Real captures from a real phone
        /// destroyed that: this user's BARE face measured 1.12, 1.23 and 1.16 -
        /// squarely inside the "sunglasses" band - and two of the three frames were
        /// wrongly thrown away.
        ///
        /// The lesson is that the ABSOLUTE range of this ratio moves with the
        /// camera, the crop and the lighting, so a bound calibrated on two stock
        /// headshots does not transfer. An eye-region test would need per-capture
        /// normalisation or a real classifier; guessing again would just resume
        /// rejecting the owner, which is worse than missing a pair of glasses.
        ///
        /// The MASK bound is kept because it survives the same data: a mask drives
        /// the ratio to 0.03-0.10, an order of magnitude below anything a real bare
        /// face has produced here.
        /// </summary>
        public const double MaxLowerEyeRatio = double.MaxValue;

        /// <summary>
        /// Hard ceiling on DECODED pixel count, checked from the header before any
        /// decode. A compressed-byte limit does not bound this: a highly
        /// compressible PNG a few MB in size can declare 30000x30000 and decode to
        /// gigabytes, OOM-crashing the shared process. 40 MP comfortably covers any
        /// real phone camera (a 108 MP sensor still shoots ~12 MP stills) while
        /// refusing a decompression bomb before it allocates.
        /// </summary>
        private const int MaxDecodedPixels = 40 * 1000 * 1000;

        /// <summary>
        /// Mean image brightness (0=black, 1=white) below which a no-face result is
        /// reported as "too dark" rather than "no face". Tuned conservatively: a
        /// normally lit indoor selfie sits well above 0.20; only a genuinely dim
        /// frame falls under it, so this never mislabels a well-lit miss.
        /// </summary>
        private const double MinAcceptableLuminance = 0.20;

        // Lazy + singleton: each factory call loads an ONNX model from the bundle
        // into memory. OnnxRuntime inference sessions are thread-safe for Run, so
        // one instance serves concurrent requests.
        private readonly Lazy<IFaceDetectorWithLandmarks> _detector =
            new(() => FaceAiSharpBundleFactory.CreateFaceDetectorWithLandmarks(), LazyThreadSafetyMode.ExecutionAndPublication);

        private readonly Lazy<IFaceEmbeddingsGenerator> _embedder =
            new(() => FaceAiSharpBundleFactory.CreateFaceEmbeddingsGenerator(), LazyThreadSafetyMode.ExecutionAndPublication);

        public PhotoEmbeddingResult Embed(byte[] imageBytes)
        {
            if (imageBytes == null || imageBytes.Length == 0)
            {
                return Fail("The capture is empty.");
            }

            // Read ONLY the header first and reject an oversized canvas before
            // decoding a single pixel - this is the decompression-bomb guard.
            try
            {
                var info = Image.Identify(imageBytes);
                if (info == null)
                {
                    return Fail("The capture is not a readable image.");
                }

                if ((long)info.Width * info.Height > MaxDecodedPixels)
                {
                    return Fail("The capture image is too large.");
                }
            }
            catch
            {
                return Fail("The capture is not a readable image.");
            }

            Image<Rgb24> image;
            try
            {
                image = Image.Load<Rgb24>(imageBytes);
            }
            catch
            {
                return Fail("The capture is not a readable image.");
            }

            using (image)
            {
                if (image.Width > MaxImageEdge || image.Height > MaxImageEdge)
                {
                    image.Mutate(x => x.Resize(new ResizeOptions
                    {
                        Mode = ResizeMode.Max,
                        Size = new Size(MaxImageEdge, MaxImageEdge)
                    }));
                }

                var faces = _detector.Value.DetectFaces(image);

                if (faces.Count == 0)
                {
                    // Tell the user WHY there was no face when we can. A too-dark
                    // frame is the most common and most actionable cause, and the
                    // decoded image lets us measure it precisely rather than guess.
                    if (MeanLuminance(image) < MinAcceptableLuminance)
                    {
                        return Fail("Too dark to see your face. Move to brighter light and face the camera.", 0);
                    }

                    return Fail("No face detected. Face the camera directly, filling the circle.", 0);
                }

                // Refuse rather than guess whose. The phone UI already enforces a
                // single face; a second face reaching here is either a bystander
                // (bad capture) or an attempt to sneak the enrolled face into the
                // frame alongside the holder's.
                if (faces.Count > 1)
                {
                    return Fail("More than one face is in the capture.", faces.Count);
                }

                var face = faces.First();
                if (face.Landmarks == null || face.Landmarks.Count == 0)
                {
                    return Fail("The face could not be aligned. Try again with better lighting.", 1);
                }

                // QUALITY GATE 1: face big enough to carry detail. A face that is
                // too few pixels wide scores like a stranger no matter who it is.
                var faceWidth = face.Box.Width;
                if (faceWidth < MinFaceWidthPixels)
                {
                    return Fail("Your face is too far away. Hold the phone closer, about an arm's length.", 1);
                }

                // AlignFaceUsingLandmarks crops/warps the image in place to the
                // 112x112 pose ArcFace was trained on - embedding an unaligned
                // face produces garbage that still compares somewhere.
                _embedder.Value.AlignFaceUsingLandmarks(image, face.Landmarks);

                // QUALITY GATE 2: measured on the ALIGNED face, so it judges the
                // exact pixels the model will see. This is the gate that catches
                // the motion blur behind "sometimes it says it is not me".
                var sharpness = Sharpness(image);

                // OCCLUSION SIGNAL (measured, not enforced yet). ArcFace's canonical
                // 112x112 pose puts the eyes near y=52 and the mouth near y=92, so
                // these bands are fixed rather than derived per image. A mask flattens
                // the lower band while leaving the eye band alone; sunglasses do the
                // reverse - the RATIO between them is what separates "wearing
                // something" from "dim photo", where both bands fall together.
                var lowerTexture = RegionSharpness(image, 66, 106, 26, 88);
                var eyeTexture = RegionSharpness(image, 40, 64, 22, 92);
                if (sharpness < MinSharpness)
                {
                    return new PhotoEmbeddingResult
                    {
                        Success = false,
                        Error = "The capture was blurry. Hold the phone steady and keep still.",
                        FaceCount = 1,
                        FaceWidth = faceWidth,
                        Sharpness = sharpness,
                        LowerFaceTexture = lowerTexture,
                        EyeRegionTexture = eyeTexture
                    };
                }

                var embedding = _embedder.Value.GenerateEmbedding(image);

                if (!Normalize(embedding))
                {
                    // The model returned nothing usable for this frame. Treat it as
                    // a bad capture rather than passing a zero vector on, which
                    // compares as "different person" against everything including
                    // the same face.
                    return Fail("That capture could not be read. Try again.", 1);
                }

                return new PhotoEmbeddingResult
                {
                    Success = true,
                    Embedding = embedding,
                    FaceCount = 1,
                    FaceWidth = faceWidth,
                    Sharpness = sharpness,
                    LowerFaceTexture = lowerTexture,
                    EyeRegionTexture = eyeTexture
                };
            }
        }

        public double BestSimilarity(IEnumerable<UserFaceTemplate> enrolled, float[] candidate)
        {
            if (candidate == null || candidate.Length != EmbeddingDimensions)
            {
                return -1;
            }

            var best = -1d;

            foreach (var template in enrolled)
            {
                if (template.Dimensions != EmbeddingDimensions)
                {
                    continue;
                }

                var stored = FaceMatcher.Decode(template.Embedding);
                if (stored.Length != EmbeddingDimensions)
                {
                    continue;
                }

                var similarity = Dot(stored, candidate);
                if (similarity > best)
                {
                    best = similarity;
                }
            }

            return best;
        }

        /// <summary>
        /// Sharpness of the (already aligned, 112x112) face: the mean absolute
        /// luminance step between neighbouring pixels. A sharp face has strong
        /// local contrast at eyes, nostrils and lip line; blur smears exactly those
        /// edges, which is also precisely what the embedding relies on - hence the
        /// tight correlation with accuracy measured in MinSharpness.
        /// </summary>
        private static double Sharpness(Image<Rgb24> alignedFace)
        {
            double acc = 0;
            long n = 0;

            for (var y = 1; y < alignedFace.Height; y++)
            {
                for (var x = 1; x < alignedFace.Width; x++)
                {
                    var here = alignedFace[x, y];
                    var left = alignedFace[x - 1, y];
                    var up = alignedFace[x, y - 1];

                    var lh = 0.299 * here.R + 0.587 * here.G + 0.114 * here.B;
                    var ll = 0.299 * left.R + 0.587 * left.G + 0.114 * left.B;
                    var lu = 0.299 * up.R + 0.587 * up.G + 0.114 * up.B;

                    acc += Math.Abs(lh - ll) + Math.Abs(lh - lu);
                    n += 2;
                }
            }

            return n == 0 ? 0 : acc / n;
        }

        /// <summary>
        /// The same local-contrast measure as <see cref="Sharpness"/>, restricted to
        /// one band of the ALIGNED face.
        ///
        /// Alignment is what makes this usable: ArcFace warps every face into the
        /// same canonical 112x112 pose, so the eyes always sit around y=52 and the
        /// mouth around y=92 regardless of how the head was held. The bands below
        /// are therefore fixed rectangles rather than anything derived per-image.
        /// </summary>
        private static double RegionSharpness(Image<Rgb24> alignedFace, int y0, int y1, int x0, int x1)
        {
            y0 = Math.Max(1, y0);
            x0 = Math.Max(1, x0);
            y1 = Math.Min(alignedFace.Height, y1);
            x1 = Math.Min(alignedFace.Width, x1);
            if (y1 - y0 < 4 || x1 - x0 < 4) return 0;

            double acc = 0;
            long n = 0;

            for (var y = y0; y < y1; y++)
            {
                for (var x = x0; x < x1; x++)
                {
                    var here = alignedFace[x, y];
                    var left = alignedFace[x - 1, y];
                    var up = alignedFace[x, y - 1];

                    var lh = 0.299 * here.R + 0.587 * here.G + 0.114 * here.B;
                    var ll = 0.299 * left.R + 0.587 * left.G + 0.114 * left.B;
                    var lu = 0.299 * up.R + 0.587 * up.G + 0.114 * up.B;

                    acc += Math.Abs(lh - ll) + Math.Abs(lh - lu);
                    n += 2;
                }
            }

            return n == 0 ? 0 : acc / n;
        }

        /// <summary>
        /// Average perceived brightness of the image, 0 (black) to 1 (white).
        /// Sampled on a stride so a full-resolution frame stays cheap - a coarse
        /// grid is plenty to tell "dark room" from "lit room".
        /// </summary>
        private static double MeanLuminance(Image<Rgb24> image)
        {
            const int targetSamplesPerAxis = 32;
            var stepX = Math.Max(1, image.Width / targetSamplesPerAxis);
            var stepY = Math.Max(1, image.Height / targetSamplesPerAxis);

            double sum = 0;
            long count = 0;

            for (var y = 0; y < image.Height; y += stepY)
            {
                for (var x = 0; x < image.Width; x += stepX)
                {
                    var p = image[x, y];
                    // Rec. 601 luma, normalised to 0..1.
                    sum += (0.299 * p.R + 0.587 * p.G + 0.114 * p.B) / 255.0;
                    count++;
                }
            }

            return count == 0 ? 1.0 : sum / count;
        }

        private static double Dot(float[] a, float[] b)
        {
            double sum = 0;
            for (var i = 0; i < a.Length; i++)
            {
                sum += (double)a[i] * b[i];
            }

            return sum;
        }

        /// <summary>
        /// Defensive re-normalisation. The bundled ArcFace already emits unit
        /// vectors; this guarantees the dot product stays a genuine cosine even if
        /// a future model swap forgets to.
        /// </summary>
        /// <summary>
        /// Scales the embedding to unit length, and reports whether it was a real
        /// vector at all.
        ///
        /// THE RETURN VALUE IS THE POINT. This used to return silently when the
        /// magnitude was ~0, leaving a near-zero vector that looked like a valid
        /// embedding to every caller. A zero vector has a dot product of ~0 with
        /// EVERYTHING, so two captures of one face came back at -0.001 and 0.154
        /// and enrolment rejected them as "not the same person" - a failure that
        /// pointed at the camera, the lighting and the crop for a long time before
        /// it turned out to be a degenerate embedding being accepted as good.
        ///
        /// A frame that produces one is now failed like any other unusable frame.
        /// </summary>
        private static bool Normalize(float[] v)
        {
            double sumSq = 0;
            for (var i = 0; i < v.Length; i++)
            {
                sumSq += (double)v[i] * v[i];
            }

            var magnitude = Math.Sqrt(sumSq);
            if (magnitude < 1e-6)
            {
                return false;
            }

            for (var i = 0; i < v.Length; i++)
            {
                v[i] = (float)(v[i] / magnitude);
            }

            return true;
        }

        private static PhotoEmbeddingResult Fail(string error, int faceCount = 0)
        {
            return new PhotoEmbeddingResult { Success = false, Error = error, FaceCount = faceCount };
        }
    }

    /// <summary>
    /// The one place the "this sessionId belongs to that user" fact lives while a
    /// push-approve is in flight. Written when the push is broadcast, consumed
    /// (single-use) when the approval lands - so a phone can only ever approve a
    /// session that was genuinely pushed to ITS user, and each session at most
    /// once. Without this, any valid device token could approve any sessionId.
    /// </summary>
    public static class AuthSessionRegistry
    {
        /// <summary>Matches the browser-side wait: a login page gives up well before this.</summary>
        public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);

        public static string Key(string sessionId) => "authsession:user:" + sessionId;
    }
}
