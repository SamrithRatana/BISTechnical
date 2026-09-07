using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using UserManagementAPI.Models;
using UserManagementAPI.Models.Leave;

namespace UserManagementAPI.Data
{
    public class UserManagementContext : IdentityDbContext<ApplicationUser>
    {
        public UserManagementContext(DbContextOptions<UserManagementContext> options)
            : base(options)
        {
        }

        public DbSet<Message> Messages { get; set; }
        public DbSet<Article> Articles { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<LeaveType> LeaveTypes { get; set; }
        public DbSet<LeaveRequest> LeaveRequests { get; set; }
        public DbSet<LeaveApproval> LeaveApprovals { get; set; }
        public DbSet<LeaveBalance> LeaveBalances { get; set; }
        public DbSet<AppSetting> AppSettings { get; set; }
        public DbSet<UserCredential> UserCredentials { get; set; }
        public DbSet<UserFaceTemplate> UserFaceTemplates { get; set; }
        public DbSet<UserFaceDevice> UserFaceDevices { get; set; }
        public DbSet<UserPreference> UserPreferences { get; set; }
        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Identity Tables Configuration - Using 'security' schema
            builder.Entity<ApplicationUser>().ToTable("Users", "security");
            builder.Entity<IdentityRole>().ToTable("Roles", "security");
            builder.Entity<IdentityUserRole<string>>().ToTable("UserRoles", "security");
            builder.Entity<IdentityUserClaim<string>>().ToTable("UserClaims", "security");
            builder.Entity<IdentityUserLogin<string>>().ToTable("UserLogins", "security");
            builder.Entity<IdentityRoleClaim<string>>().ToTable("RoleClaims", "security");
            builder.Entity<IdentityUserToken<string>>().ToTable("UserTokens", "security");
            builder.Entity<RefreshToken>(entity =>
            {
                entity.ToTable("RefreshTokens", "security"); // Add this line to specify security schema
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Token).IsRequired().HasMaxLength(500);
                entity.Property(e => e.JwtId).IsRequired().HasMaxLength(500);
                entity.HasIndex(e => e.Token).IsUnique();
                entity.HasIndex(e => e.JwtId);
                entity.HasIndex(e => new { e.UserId, e.IsRevoked, e.IsUsed });

                // Relationship with User
                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
            // WebAuthn / FIDO2 credentials ("passkeys") — see Models/UserCredential.cs.
            // Sits in the `security` schema beside RefreshTokens because it is
            // authentication state, not application data.
            builder.Entity<UserCredential>(entity =>
            {
                entity.ToTable("UserCredentials", "security");
                entity.HasKey(e => e.Id);

                entity.Property(e => e.UserId).IsRequired().HasMaxLength(450);
                entity.Property(e => e.CredentialId).IsRequired().HasMaxLength(1024);
                entity.Property(e => e.PublicKey).IsRequired().HasMaxLength(1024);
                entity.Property(e => e.UserHandle).IsRequired().HasMaxLength(128);
                entity.Property(e => e.CredType).HasMaxLength(32);
                entity.Property(e => e.Transports).HasMaxLength(256);
                entity.Property(e => e.DeviceName).HasMaxLength(120);
                entity.Property(e => e.CreatedAt).HasColumnType("datetime2");
                entity.Property(e => e.LastUsedAt).HasColumnType("datetime2");

                // Unique across the whole table, not per user: a passkey login
                // starts by looking a credential up by this id ALONE, before it
                // knows whose account it is. Two users sharing one CredentialId
                // would make that lookup ambiguous, which is an authentication
                // bug, not a data-tidiness one.
                //
                // varbinary(1024) is within SQL Server's 1700-byte nonclustered
                // index key limit, so this is indexable as-is.
                entity.HasIndex(e => e.CredentialId)
                    .IsUnique()
                    .HasDatabaseName("IX_UserCredentials_CredentialId");

                entity.HasIndex(e => e.UserId)
                    .HasDatabaseName("IX_UserCredentials_UserId");

                // Deleting a user takes their passkeys with them — leaving an
                // orphan row would leave a credential that still verifies.
                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Face verification samples - see Models/UserFaceTemplate.cs.
            // In the security schema beside the other authentication tables, and
            // NOT alongside application data: this is biometric-derived personal
            // data and its blast radius should be obvious from where it lives.
            builder.Entity<UserFaceTemplate>(entity =>
            {
                entity.ToTable("UserFaceTemplates", "security");
                entity.HasKey(e => e.Id);

                entity.Property(e => e.UserId).IsRequired().HasMaxLength(450);
                entity.Property(e => e.Embedding).IsRequired().HasMaxLength(2048);
                entity.Property(e => e.CreatedAt).HasColumnType("datetime2");

                // Every lookup is "all samples for this user" - there is no query
                // in this system that finds a user FROM a descriptor, and there
                // must not be: that would be face SEARCH over the whole staff
                // list, which is a different feature with different consent.
                entity.HasIndex(e => e.UserId)
                    .HasDatabaseName("IX_UserFaceTemplates_UserId");

                // Deleting a user deletes their biometric data with them.
                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Phones paired for face sign-in - see Models/UserFaceDevice.cs.
            builder.Entity<UserFaceDevice>(entity =>
            {
                entity.ToTable("UserFaceDevices", "security");
                entity.HasKey(e => e.Id);

                entity.Property(e => e.UserId).IsRequired().HasMaxLength(450);
                entity.Property(e => e.TokenHash).IsRequired().HasMaxLength(32);
                entity.Property(e => e.DeviceName).HasMaxLength(120);
                entity.Property(e => e.CreatedAt).HasColumnType("datetime2");
                entity.Property(e => e.LastUsedAt).HasColumnType("datetime2");

                // Unique, and the lookup path for every phone login: the token is
                // presented alone and has to resolve to exactly one account.
                entity.HasIndex(e => e.TokenHash)
                    .IsUnique()
                    .HasDatabaseName("IX_UserFaceDevices_TokenHash");

                entity.HasIndex(e => e.UserId)
                    .HasDatabaseName("IX_UserFaceDevices_UserId");

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Message Configuration
            builder.Entity<Message>(entity =>
            {
                entity.ToTable("Messages", "dbo"); // Specify schema
                entity.HasKey(e => e.Id);

                entity.Property(e => e.UserName)
                    .IsRequired()
                    .HasMaxLength(256);

                entity.Property(e => e.Text)
                    .IsRequired();

                entity.Property(e => e.UserID)
                    .IsRequired()
                    .HasMaxLength(450);

                entity.Property(e => e.RecipientID)
                    .HasMaxLength(450);

                entity.Property(e => e.FileUrl)
                    .HasMaxLength(2048);

                entity.Property(e => e.AudioURL)
                    .HasMaxLength(2048);

                entity.Property(e => e.VideoUrl)
                    .HasMaxLength(2048);

                entity.Property(e => e.When)
                    .HasColumnType("datetime2");

                // Foreign key relationship
                entity.HasOne(m => m.Sender)
                    .WithMany(u => u.Messages)
                    .HasForeignKey(m => m.UserID)
                    .OnDelete(DeleteBehavior.Cascade);

                // Indexes for performance
                entity.HasIndex(e => new { e.UserID, e.RecipientID })
                    .HasDatabaseName("IX_Messages_UserID_RecipientID");

                entity.HasIndex(e => e.When)
                    .HasDatabaseName("IX_Messages_When");

                entity.HasIndex(e => new { e.RecipientID, e.IsRead })
                    .HasDatabaseName("IX_Messages_RecipientID_IsRead");
            });

            // Article Configuration
            builder.Entity<Article>(entity =>
            {
                entity.ToTable("Articles", "dbo"); // Specify schema
                entity.HasKey(e => e.Id);

                entity.Property(e => e.ArticleHeading)
                    .IsRequired()
                    .HasMaxLength(500);

                entity.Property(e => e.ArticleContent)
                    .IsRequired();

                entity.Property(e => e.Username)
                    .IsRequired()
                    .HasMaxLength(256);

                entity.Property(e => e.ProfilePicture)
                    .HasMaxLength(2048);

                entity.Property(e => e.Timestamp)
                    .HasColumnType("datetime2")
                    .HasDefaultValueSql("GETUTCDATE()");

                // Indexes for performance
                entity.HasIndex(e => e.Timestamp)
                    .HasDatabaseName("IX_Articles_Timestamp");

                entity.HasIndex(e => e.IsRead)
                    .HasDatabaseName("IX_Articles_IsRead");

                entity.HasIndex(e => e.Username)
                    .HasDatabaseName("IX_Articles_Username");

                entity.HasIndex(e => e.ArticleHeading)
                    .HasDatabaseName("IX_Articles_ArticleHeading");
            });
            // Leave Management Configuration
            builder.Entity<LeaveBalance>()
                .HasIndex(b => new { b.UserId, b.LeaveTypeId, b.Year })
                .IsUnique();

            builder.Entity<LeaveBalance>()
                .Ignore(b => b.RemainingHours);   // computed, not stored

            builder.Entity<LeaveType>().HasData(
      new LeaveType { Id = 1, Name = "Annual Leave", HoursPerMonth = 16, TotalHoursYear = 192, IsOnTime = false, CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
      new LeaveType { Id = 2, Name = "Personal Leave", HoursPerMonth = 16, TotalHoursYear = 192, IsOnTime = false, CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
      new LeaveType { Id = 3, Name = "Sick Leave", HoursPerMonth = null, TotalHoursYear = null, IsOnTime = true, CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
      new LeaveType { Id = 4, Name = "Maternity Leave", HoursPerMonth = null, TotalHoursYear = 56, IsOnTime = false, CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
  );

            // App-wide settings — a single fixed row so GET never has to handle
            // "no row yet" and PUT never has to decide between insert/update.
            builder.Entity<AppSetting>(entity =>
            {
                entity.ToTable("AppSettings", "dbo");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.LogoUrl).HasMaxLength(2048);
                entity.Property(e => e.AccentColor).HasMaxLength(50);
                entity.Property(e => e.SurfaceStyle).HasMaxLength(50);
                entity.Property(e => e.UpdatedAt).HasColumnType("datetime2");
                entity.HasData(new AppSetting
                {
                    Id = 1,
                    LogoUrl = null,
                    AccentColor = null,
                    LogoScale = 130,
                    SurfaceStyle = "cushion",
                    UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
                });
            });

            // Per-user appearance and theme preferences
            builder.Entity<UserPreference>(entity =>
            {
                entity.ToTable("UserPreferences", "security");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.UserId).IsRequired().HasMaxLength(450);
                entity.Property(e => e.UpdatedAt).HasColumnType("datetime2");
                entity.HasIndex(e => e.UserId)
                    .IsUnique()
                    .HasDatabaseName("IX_UserPreferences_UserId");
                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }  // ← end of OnModelCreating

        // Static helper, inside the class but outside OnModelCreating.
        public static async Task SeedAnnualBalances(UserManagementContext db, UserManager<ApplicationUser> userManager, int year)
        {
            // ToListAsync, not ToList: this blocked a thread on the database
            // inside an async method.
            var userIds = await userManager.Users.Select(u => u.Id).ToListAsync();
            var types = await db.LeaveTypes
                .Where(t => t.IsActive && !t.IsOnTime && t.TotalHoursYear.HasValue)
                .ToListAsync();

            if (userIds.Count == 0 || types.Count == 0)
            {
                return;
            }

            // One query for everything already seeded for this year, instead of
            // an AnyAsync per user PER leave type - 50 users and 3 types meant
            // 150 round trips to decide 150 booleans.
            var existing = (await db.LeaveBalances
                    .AsNoTracking()
                    .Where(b => b.Year == year)
                    .Select(b => new { b.UserId, b.LeaveTypeId })
                    .ToListAsync())
                .Select(b => (b.UserId, b.LeaveTypeId))
                .ToHashSet();

            var toAdd = new List<LeaveBalance>();

            foreach (var userId in userIds)
            {
                foreach (var lt in types)
                {
                    if (existing.Contains((userId, lt.Id)))
                    {
                        continue;
                    }

                    toAdd.Add(new LeaveBalance
                    {
                        UserId = userId,
                        LeaveTypeId = lt.Id,
                        Year = year,
                        TotalHours = lt.TotalHoursYear!.Value,
                        UsedHours = 0
                    });
                }
            }

            if (toAdd.Count == 0)
            {
                return;
            }

            db.LeaveBalances.AddRange(toAdd);
            await db.SaveChangesAsync();
        }
    }
    
}