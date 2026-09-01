using kgs_api.Dtos.Auth;

namespace kgs_api.Interfaces
{
    public interface IAuthService
    {
        Task<AuthResponse> RegisterAsync(RegisterRequest request, string? ip, CancellationToken ct = default);
        Task<AuthResponse> LoginAsync(LoginRequest request, string? ip, CancellationToken ct = default);
        Task<AuthResponse> RefreshAsync(string refreshToken, string? ip, CancellationToken ct = default);
        Task LogoutAsync(string refreshToken, CancellationToken ct = default);
        Task LogoutAllDevicesAsync(string userId, CancellationToken ct = default);

        Task ConfirmEmailAsync(string userId, string token, CancellationToken ct = default);
        Task ResendConfirmationAsync(string email, CancellationToken ct = default);

        Task ForgotPasswordAsync(string email, CancellationToken ct = default);
        Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default);
        Task ChangePasswordAsync(string userId, ChangePasswordRequest request, CancellationToken ct = default);

        Task<CurrentUserDto> GetCurrentUserAsync(string userId, CancellationToken ct = default);
        Task<CurrentUserDto> UpdateProfileAsync(string userId, UpdateProfileRequest request, CancellationToken ct = default);
        Task<AuthResponse> ExternalLoginAsync(ExternalLoginRequest request, string? ip, CancellationToken ct = default);
    }
}
