using kgs_api.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using static kgs_api.Common.Common;

namespace kgs_api.Infrastructure.Persistence.Interceptors
{
    /// <summary>Tự điền CreatedAt/CreatedBy/UpdatedAt/UpdatedBy cho mọi BaseAuditableEntity.
    /// Đăng ký trong ApplicationServiceExtensions qua DbContextOptions.AddInterceptors.</summary>
    public sealed class AuditableEntityInterceptor : SaveChangesInterceptor
    {
        private readonly ICurrentUserService _currentUser;

        public AuditableEntityInterceptor(ICurrentUserService currentUser)
            => _currentUser = currentUser;

        public override InterceptionResult<int> SavingChanges(
            DbContextEventData eventData, InterceptionResult<int> result)
        {
            Stamp(eventData.Context);
            return base.SavingChanges(eventData, result);
        }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result,
            CancellationToken ct = default)
        {
            Stamp(eventData.Context);
            return base.SavingChangesAsync(eventData, result, ct);
        }

        private void Stamp(DbContext? context)
        {
            if (context is null) return;

            // UserIdOrNull chu KHONG phai UserId: interceptor nay cung chay trong cac job nen
            // Hangfire (ReminderProcessingJob, ContractExpiryJob) - noi khong co HttpContext.
            // Dung UserId se nem UnauthorizedAccessException va giet job.
            var userId = _currentUser.UserIdOrNull;
            var now = DateTime.UtcNow;

            foreach (var entry in context.ChangeTracker.Entries<BaseAuditableEntity>())
            {
                if (entry.State == EntityState.Added)
                {
                    entry.Entity.CreatedAt = now;
                    entry.Entity.CreatedBy = userId;
                }
                else if (entry.State == EntityState.Modified)
                {
                    entry.Entity.UpdatedAt = now;
                    entry.Entity.UpdatedBy = userId;
                }
            }
        }
    }
}
