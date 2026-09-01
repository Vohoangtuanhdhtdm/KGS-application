using kgs_api.Domain.Entity;

namespace kgs_api.Interfaces
{
    public interface ITokenService
    {
        string CreateToken(ApplicationUser user, IList<string> roles);
        string GenerateRefreshToken();
    }
}
