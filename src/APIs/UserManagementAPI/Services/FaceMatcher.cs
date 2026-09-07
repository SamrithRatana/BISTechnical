using UserManagementAPI.Models;

namespace UserManagementAPI.Services
{
    /// <summary>
    /// Encodes, decodes and compares face descriptors.
    ///
    /// The distance measure is EUCLIDEAN, not cosine. face-api's recognition net
    /// emits L2-normalised 128-float descriptors and the library's own published
    /// threshold (0.6) is a Euclidean one — comparing them any other way means the
    /// threshold from the model's documentation no longer describes anything.
    /// </summary>
    public static class FaceMatcher
    {
        /// <summary>Descriptor length face-api's recognition net produces.</summary>
        public const int ExpectedDimensions = 128;

        /// <summary>
        /// Default match threshold, in Euclidean distance. Lower is stricter.
        ///
        /// face-api documents 0.6 as a good general threshold — but that is tuned
        /// for "is this the same person in two photos", where a false accept costs
        /// a mislabelled photo. Here a false accept is someone else getting into an
        /// account, so this defaults tighter at 0.45 and is overridable via
        /// <c>Face:MatchThreshold</c>.
        ///
        /// **This number has not been tuned against real staff faces.** It is a
        /// starting point. Tune it on the actual people who will use it, in the
        /// actual lighting, before trusting it — and tune it by measuring the
        /// distance distribution for same-person and different-person pairs, not by
        /// nudging it until one test passes.
        /// </summary>
        public const double DefaultThreshold = 0.45;

        /// <summary>Reads a float32 descriptor out of its stored bytes.</summary>
        public static float[] Decode(byte[] stored)
        {
            if (stored == null || stored.Length == 0 || stored.Length % 4 != 0)
            {
                return Array.Empty<float>();
            }

            var values = new float[stored.Length / 4];
            Buffer.BlockCopy(stored, 0, values, 0, stored.Length);
            return values;
        }

        /// <summary>Packs a descriptor for storage.</summary>
        public static byte[] Encode(float[] descriptor)
        {
            var bytes = new byte[descriptor.Length * 4];
            Buffer.BlockCopy(descriptor, 0, bytes, 0, bytes.Length);
            return bytes;
        }

        /// <summary>
        /// Euclidean distance between two descriptors, or
        /// <see cref="double.PositiveInfinity"/> when they are not comparable.
        ///
        /// Mismatched lengths return infinity rather than throwing or comparing the
        /// overlap: a shorter vector that happened to match on its first 64 values
        /// must never read as a closer match than a full one.
        /// </summary>
        public static double Distance(float[] a, float[] b)
        {
            if (a == null || b == null || a.Length == 0 || a.Length != b.Length)
            {
                return double.PositiveInfinity;
            }

            double sum = 0;
            for (var i = 0; i < a.Length; i++)
            {
                var d = a[i] - b[i];
                sum += d * d;
            }

            return Math.Sqrt(sum);
        }

        /// <summary>
        /// Distance from a candidate to the CLOSEST of a user's enrolled samples.
        ///
        /// Closest, not average: averaging descriptors from different poses produces
        /// a vector that resembles none of them, which makes a well-enrolled user
        /// harder to recognise the more samples they provide.
        /// </summary>
        public static double BestDistance(IEnumerable<UserFaceTemplate> enrolled, float[] candidate)
        {
            var best = double.PositiveInfinity;

            foreach (var template in enrolled)
            {
                var distance = Distance(Decode(template.Embedding), candidate);
                if (distance < best)
                {
                    best = distance;
                }
            }

            return best;
        }

        /// <summary>
        /// Whether a descriptor is shaped like something the recognition net could
        /// have produced. Rejects wrong lengths, and non-finite or absurd values —
        /// a hand-crafted vector of zeros would otherwise sit a fixed distance from
        /// every enrolled sample, which is a cheap thing to try against a matcher.
        /// </summary>
        public static bool IsWellFormed(float[] descriptor)
        {
            if (descriptor == null || descriptor.Length != ExpectedDimensions)
            {
                return false;
            }

            float first = descriptor[0];
            bool allEqual = true;
            double sum = 0;
            double sumSq = 0;

            for (var i = 0; i < descriptor.Length; i++)
            {
                var value = descriptor[i];
                if (float.IsNaN(value) || float.IsInfinity(value) || Math.Abs(value) > 10f)
                {
                    return false;
                }

                if (Math.Abs(value - first) > 1e-5f)
                {
                    allEqual = false;
                }

                sum += value;
                sumSq += value * value;
            }

            // Reject synthetic or constant placeholder vectors
            if (allEqual)
            {
                return false;
            }

            // Authentic biological face embeddings exhibit natural dimensional variance
            double mean = sum / descriptor.Length;
            double variance = (sumSq / descriptor.Length) - (mean * mean);
            if (variance < 0.0005)
            {
                return false;
            }

            // face-api descriptors are L2-normalised, so |v| is ~1. A vector far
            // from that did not come from a genuine recognition net.
            double magnitude = Math.Sqrt(sumSq);
            return magnitude > 0.5 && magnitude < 2.0;
        }
    }
}
