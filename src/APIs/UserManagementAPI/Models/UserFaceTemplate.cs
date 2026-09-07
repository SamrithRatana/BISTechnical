using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.Models
{
    /// <summary>
    /// One enrolled face sample for one user - a 128-float descriptor produced by
    /// face-api's recognition net, stored as raw little-endian float32.
    ///
    /// SEVERAL rows per user on purpose. A single sample encodes one pose under
    /// one set of lights; a workshop is lit differently morning and evening and
    /// people wear glasses some days. Matching against the closest of several
    /// samples is what stops the feature rejecting the right person half the time.
    ///
    /// UNLIKE <see cref="UserCredential"/>, THIS IS SENSITIVE PERSONAL DATA. A face
    /// descriptor is derived from a biometric and cannot be reissued: a person
    /// whose descriptor leaks cannot be given a new face. Three consequences that
    /// are not optional:
    ///
    ///  * No image is ever stored - only the descriptor. The descriptor is much
    ///    weaker than a photograph, but calling it "irreversible" is WRONG and
    ///    that mistake changes how this row must be treated: published template
    ///    inversion attacks can reconstruct a recognisable approximation of a
    ///    face from an embedding given the model. So this stays classified as
    ///    biometric personal data under GDPR/PDPA - minimised and access
    ///    controlled, not treated as anonymous because it looks like numbers.
    ///  * Enrolment is opt-in per user and removable by that user at any time
    ///    (DELETE api/auth/face/enroll), which deletes every row here for them.
    ///  * The descriptor is computed IN THE BROWSER and posted here, so the server
    ///    is trusting a vector it did not compute. That is precisely why face
    ///    verification is a SECOND factor in this system and never a first one:
    ///    the password has already been checked before any of this runs. Do not
    ///    promote it to a primary credential without moving the embedding step
    ///    server-side.
    /// </summary>
    public class UserFaceTemplate
    {
        public int Id { get; set; }

        [Required, MaxLength(450)]
        public string UserId { get; set; }

        /// <summary>
        /// The descriptor as raw float32. 128 floats = 512 bytes today; the column
        /// is sized for a 512-dimension model so swapping in a stronger one later
        /// does not need a schema change.
        /// </summary>
        [Required, MaxLength(2048)]
        public byte[] Embedding { get; set; }

        /// <summary>
        /// How many floats <see cref="Embedding"/> holds. Stored rather than
        /// inferred so that a future model change cannot silently compare vectors
        /// of different lengths against each other.
        /// </summary>
        public int Dimensions { get; set; }

        /// <summary>Which capture in the enrolment sequence this was (1, 2, 3...).</summary>
        public int SampleIndex { get; set; }

        public DateTime CreatedAt { get; set; }

        public virtual ApplicationUser User { get; set; }
    }
}
