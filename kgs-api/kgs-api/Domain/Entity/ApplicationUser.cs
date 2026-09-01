using Microsoft.AspNetCore.Identity;

namespace kgs_api.Domain.Entity
{
    public class ApplicationUser : IdentityUser
    {
        public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
        public string Name { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public string? Bio { get; set; } 
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
