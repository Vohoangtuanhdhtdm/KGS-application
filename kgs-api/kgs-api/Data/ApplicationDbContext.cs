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
        public DbSet<AssetDocument> AssetDocuments => Set<AssetDocument>();
        public DbSet<LeaseContract> LeaseContracts => Set<LeaseContract>();
        public DbSet<ContactParty> ContactParties => Set<ContactParty>();
        public DbSet<CashFlowEntry> CashFlowEntries => Set<CashFlowEntry>();
        public DbSet<Reminder> Reminders => Set<Reminder>();
        public DbSet<SavedListing> SavedListings => Set<SavedListing>();
        public DbSet<ListingInquiry> ListingInquiries => Set<ListingInquiry>();
        public DbSet<SavedSearch> SavedSearches => Set<SavedSearch>();
        public DbSet<ListingReport> ListingReports => Set<ListingReport>();
        public DbSet<ListingView> ListingViews => Set<ListingView>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        }

    }
}
