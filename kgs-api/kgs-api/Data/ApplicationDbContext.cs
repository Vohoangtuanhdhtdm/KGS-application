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
        public DbSet<Property> Properties => Set<Property>();
        public DbSet<PropertyImages> PropertyImages => Set<PropertyImages>();
        public DbSet<Asset> Assets => Set<Asset>();
        public DbSet<AssetUnit> AssetUnits => Set<AssetUnit>();
        public DbSet<AssetMedia> AssetMedia => Set<AssetMedia>();
        public DbSet<AssetDocument> AssetDocuments => Set<AssetDocument>();
        public DbSet<LeaseContract> LeaseContracts => Set<LeaseContract>();
        public DbSet<ContactParty> ContactParties => Set<ContactParty>();
        public DbSet<Equipment> Equipments => Set<Equipment>();
        public DbSet<MaintenanceRecord> MaintenanceRecords => Set<MaintenanceRecord>();
        public DbSet<CashFlowEntry> CashFlowEntries => Set<CashFlowEntry>();
        public DbSet<Reminder> Reminders => Set<Reminder>();
        public DbSet<UsagePeriod> UsagePeriods => Set<UsagePeriod>();
        public DbSet<SaleListing> SaleListings => Set<SaleListing>();
        public DbSet<SaleListingBroker> SaleListingBrokers => Set<SaleListingBroker>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        }

    }
}
