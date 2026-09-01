using kgs_api.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using static kgs_api.Common.Common;


namespace kgs_api.Infrastructure.Persistence.Interceptors
{
    // Infrastructure/Persistence/Interceptors/AuditableEntityInterceptor.cs
    public sealed class AuditableEntityInterceptor : SaveChangesInterceptor
    {
        private readonly ICurrentUserService _currentUser; // lấy UserId từ HttpContext

        public AuditableEntityInterceptor(ICurrentUserService currentUser)
            => _currentUser = currentUser;

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result,
            CancellationToken ct = default)
        {
            var context = eventData.Context;
            if (context is null) return base.SavingChangesAsync(eventData, result, ct);

            foreach (var entry in context.ChangeTracker.Entries<BaseAuditableEntity>())
            {
                if (entry.State == EntityState.Added)
                {
                    entry.Entity.CreatedAt = DateTime.UtcNow;
                    entry.Entity.CreatedBy = _currentUser.UserId;
                }
                else if (entry.State == EntityState.Modified)
                {
                    entry.Entity.UpdatedAt = DateTime.UtcNow;
                    entry.Entity.UpdatedBy = _currentUser.UserId;
                }
            }
            return base.SavingChangesAsync(eventData, result, ct);
        }
    }
}
