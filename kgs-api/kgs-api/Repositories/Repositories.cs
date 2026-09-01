using kgs_api.Data;
using Microsoft.EntityFrameworkCore.Storage;

namespace kgs_api.Repositories
{
    public interface IRepository<TEntity> where TEntity : class
    {
        /// <summary>IQueryable gốc (tracking). Nơi đọc thuần hãy nối .AsNoTracking().</summary>
        IQueryable<TEntity> Query();

        Task<TEntity?> FindAsync(Guid id, CancellationToken ct = default);
        Task AddAsync(TEntity entity, CancellationToken ct = default);
        Task AddRangeAsync(IEnumerable<TEntity> entities, CancellationToken ct = default);
        void Update(TEntity entity);
        void Remove(TEntity entity);
        void RemoveRange(IEnumerable<TEntity> entities);
    }

    public interface IUnitOfWork
    {
        Task<int> SaveChangesAsync(CancellationToken ct = default);

        /// <summary>Chỉ dùng khi một luồng nghiệp vụ cần nhiều SaveChanges nguyên tử
        /// (VD: gia hạn hợp đồng = đóng HĐ cũ + tạo HĐ mới + đổi reminder).</summary>
        Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken ct = default);
    }

    public sealed class EfRepository<TEntity> : IRepository<TEntity> where TEntity : class
    {
        private readonly ApplicationDbContext _db;
        public EfRepository(ApplicationDbContext db) => _db = db;

        public IQueryable<TEntity> Query() => _db.Set<TEntity>();

        public async Task<TEntity?> FindAsync(Guid id, CancellationToken ct = default)
            => await _db.Set<TEntity>().FindAsync(new object[] { id }, ct);

        public Task AddAsync(TEntity entity, CancellationToken ct = default)
            => _db.Set<TEntity>().AddAsync(entity, ct).AsTask();

        public Task AddRangeAsync(IEnumerable<TEntity> entities, CancellationToken ct = default)
            => _db.Set<TEntity>().AddRangeAsync(entities, ct);

        public void Update(TEntity entity) => _db.Set<TEntity>().Update(entity);
        public void Remove(TEntity entity) => _db.Set<TEntity>().Remove(entity);
        public void RemoveRange(IEnumerable<TEntity> entities) => _db.Set<TEntity>().RemoveRange(entities);
    }

    public sealed class EfUnitOfWork : IUnitOfWork
    {
        private readonly ApplicationDbContext _db;
        public EfUnitOfWork(ApplicationDbContext db) => _db = db;

        public Task<int> SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken ct = default)
            => _db.Database.BeginTransactionAsync(ct);
    }

}
