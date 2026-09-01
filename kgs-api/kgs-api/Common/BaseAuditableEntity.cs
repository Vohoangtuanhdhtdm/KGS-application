namespace kgs_api.Common
{
    // Domain/Common/BaseAuditableEntity.cs
    public abstract class BaseAuditableEntity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? CreatedBy { get; set; }   // ApplicationUser.Id
        public string? UpdatedBy { get; set; }
    }
}
