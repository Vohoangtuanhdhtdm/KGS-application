using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace kgs_api.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }
        public DbSet<FileDeletionQueueItem> FileDeletionQueueItems => Set<FileDeletionQueueItem>();
        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
        public DbSet<Listing> Listings => Set<Listing>();
        public DbSet<ListingImage> ListingImages => Set<ListingImage>();
        public DbSet<Asset> Assets => Set<Asset>();
        public DbSet<AssetUnit> AssetUnits => Set<AssetUnit>();
        public DbSet<AssetMedia> AssetMedia => Set<AssetMedia>();
        public DbSet<SavedListing> SavedListings => Set<SavedListing>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<ListingInquiry> ListingInquiries => Set<ListingInquiry>();
        public DbSet<SavedSearch> SavedSearches => Set<SavedSearch>();
        public DbSet<ListingInvitation> ListingInvitations => Set<ListingInvitation>();
        public DbSet<ListingReport> ListingReports => Set<ListingReport>();
        public DbSet<ListingModerationEvent> ListingModerationEvents => Set<ListingModerationEvent>();
        public DbSet<ListingView> ListingViews => Set<ListingView>();

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            SyncNewAddresses();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        {
            SyncNewAddresses();
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        /// <summary>Địa chỉ mới (sau sắp xếp 2025) luôn đi theo địa chỉ cũ: mọi tài sản vừa thêm hoặc
        /// vừa sửa địa chỉ đều được tính lại ở đây — một chỗ duy nhất, thay vì nhắc từng service
        /// (đăng tin, toà nhà, tài sản, seed...) tự nhớ gọi.</summary>
        private void SyncNewAddresses()
        {
            foreach (var e in ChangeTracker.Entries<Asset>())
            {
                var addr = e.Reference(a => a.Address).TargetEntry;
                if (e.State is EntityState.Added or EntityState.Modified
                    || addr?.State is EntityState.Added or EntityState.Modified)
                    e.Entity.Address?.SyncNewUnits(e.Entity.Location);
            }
        }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        }

    }
}
