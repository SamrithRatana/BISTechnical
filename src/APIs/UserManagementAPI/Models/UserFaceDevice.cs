using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.Models
{
    /// <summary>
    /// A phone that has been paired to an account for face sign-in.
    ///
    /// THIS IS THE PIECE THAT MAKES PHONE FACE-LOGIN SAFE, so it is worth being
    /// explicit about why it exists rather than treating it as plumbing.
    ///
    /// The obvious way to build "scan the QR, show your face, get signed in" is to
    /// take the descriptor and search every enrolled face for a match. Do not.
    /// That is 1:N identification, and it has two properties that make it the
    /// wrong shape for authentication:
    ///
    ///  * The face becomes the ONLY credential. Nothing else is presented.
    ///  * False accepts scale with headcount. A threshold that almost never
    ///    confuses two given people will confuse *some* pair once the comparison
    ///    runs across fifty of them, every single login.
    ///
    /// Pairing the phone first turns the problem back into 1:1. The phone holds a
    /// token that already says which account it belongs to, so the face only has
    /// to answer "is this that person", against that person's samples alone. The
    /// result is genuinely two factors: something you have (this paired phone) and
    /// something you are (your face).
    ///
    /// The token is stored HASHED, for the same reason a password is: this row is
    /// enough to sign in as its owner, so a dump of the table must not hand
    /// anyone a working credential.
    /// </summary>
    public class UserFaceDevice
    {
        public int Id { get; set; }

        [Required, MaxLength(450)]
        public string UserId { get; set; }

        /// <summary>SHA-256 of the device token. The token itself is shown once, to the phone, and never stored.</summary>
        [Required, MaxLength(32)]
        public byte[] TokenHash { get; set; }

        /// <summary>User-facing label, so a person can tell their phones apart when revoking one.</summary>
        [MaxLength(120)]
        public string DeviceName { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? LastUsedAt { get; set; }

        /// <summary>
        /// Revoked rather than deleted, so "this phone was unpaired on that date"
        /// survives in the record. A revoked row never authenticates.
        /// </summary>
        public bool IsRevoked { get; set; }

        public virtual ApplicationUser User { get; set; }
    }
}
