namespace kgs_api.Domain.Entity
{
    public class FileDeletionQueueItem
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string PublicId { get; set; } = string.Empty;
        public string ResourceType { get; set; } = "image"; // "image" | "raw"
        public DateTime EnqueuedAt { get; set; } = DateTime.UtcNow;
        public int Attempts { get; set; }
        public DateTime? LastAttemptAt { get; set; }
        public string? LastError { get; set; }
    }

}
