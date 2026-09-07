using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.Models
{
    /// <summary>
    /// One WebAuthn/FIDO2 credential — a "passkey" — belonging to one user.
    ///
    /// This is the table that replaces a password for the accounts that opt in,
    /// and the important thing about it is what it does NOT contain: there is no
    /// secret here. <see cref="PublicKey"/> is the public half of a keypair whose
    /// private half never leaves the user's phone or laptop, and no face, image
    /// or biometric template is stored anywhere in this system. A dump of this
    /// table lets an attacker verify a signature; it does not let them produce
    /// one, and it cannot be replayed against any other site.
    ///
    /// That is the whole reason WebAuthn was chosen over server-side face
    /// matching: a leaked face embedding is a credential the user can never
    /// change.
    /// </summary>
    public class UserCredential
    {
        public int Id { get; set; }

        [Required, MaxLength(450)]
        public string UserId { get; set; }

        /// <summary>
        /// The authenticator's own id for this credential. Unique across the
        /// whole table, not just per user — the login flow looks a credential up
        /// by this alone, before it knows who is signing in.
        /// </summary>
        [Required, MaxLength(1024)]
        public byte[] CredentialId { get; set; }

        /// <summary>COSE-encoded public key. Public data — see the class remarks.</summary>
        [Required, MaxLength(1024)]
        public byte[] PublicKey { get; set; }

        /// <summary>
        /// The opaque user id handed to the authenticator at enrolment (the
        /// Identity user id as UTF-8). Comes back on a discoverable-credential
        /// login, which is what lets someone sign in without typing a username.
        /// Deliberately a GUID rather than an email so nothing personal is
        /// stored on the device.
        /// </summary>
        [Required, MaxLength(128)]
        public byte[] UserHandle { get; set; }

        /// <summary>
        /// The authenticator's signature counter, for cloned-authenticator
        /// detection. Stored as <c>long</c> rather than the spec's <c>uint</c>
        /// because SQL Server has no unsigned integer type; cast at the boundary.
        /// Many platform authenticators — including every synced passkey — always
        /// report 0, so a counter that never moves is normal, not a fault.
        /// </summary>
        public long SignCount { get; set; }

        [MaxLength(32)]
        public string CredType { get; set; }

        /// <summary>Authenticator model id. All-zero for most platform authenticators.</summary>
        public Guid AaGuid { get; set; }

        /// <summary>Comma-separated transport hints ("internal", "hybrid", "usb").</summary>
        [MaxLength(256)]
        public string Transports { get; set; }

        /// <summary>
        /// True when the credential is synced by a passkey provider (iCloud
        /// Keychain, Google Password Manager). Surfaced in the UI because it
        /// answers the question users actually ask: "if I lose this phone, am I
        /// locked out?"
        /// </summary>
        public bool IsBackedUp { get; set; }

        /// <summary>User-facing label, so a person can tell their devices apart.</summary>
        [MaxLength(120)]
        public string DeviceName { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? LastUsedAt { get; set; }

        public virtual ApplicationUser User { get; set; }
    }
}
