using Google.Apis.Auth;
using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Dtos.Auth;
using kgs_api.Interfaces;
using kgs_api.Utility;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text;
using System.Web;
using static kgs_api.Common.Common;

namespace kgs_api.Services
{
    public sealed class AuthService : IAuthService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ITokenService _tokenService;
        private readonly IEmailSender _emailSender;
        private readonly ApplicationDbContext _db;
        private readonly AuthSettings _settings;
        private readonly ILogger<AuthService> _logger;

        private readonly GoogleAuthSettings _googleSettings;
        private readonly IHttpClientFactory _httpClientFactory;

        public AuthService(
            UserManager<ApplicationUser> userManager,
            ITokenService tokenService,
            IEmailSender emailSender,
            ApplicationDbContext db,
            IOptions<AuthSettings> settings,
            ILogger<AuthService> logger,
            IOptions<GoogleAuthSettings> googleSettings,
            IHttpClientFactory httpClientFactory
            )
        {
            _userManager = userManager;
            _tokenService = tokenService;
            _emailSender = emailSender;
            _db = db;
            _settings = settings.Value;
            _logger = logger;
            _googleSettings = googleSettings.Value;       
            _httpClientFactory = httpClientFactory;
        }

        // ==================== ĐĂNG KÝ ====================

        public async Task<AuthResponse> RegisterAsync(RegisterRequest request, string? ip, CancellationToken ct = default)
        {
            var email = request.Email.Trim().ToLowerInvariant();

            if (await _userManager.FindByEmailAsync(email) is not null)
                throw new ConflictException("Email này đã được đăng ký.");

            var user = new ApplicationUser
            {
                UserName = email,          // đăng nhập bằng email → UserName = Email
                Email = email,
                Name = request.Name.Trim(),
                PhoneNumber = request.PhoneNumber?.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            var result = await _userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
                throw new ValidationFailedException(string.Join(" ", result.Errors.Select(e => e.Description)));

            // Mọi user mới đều có role "User"
            await _userManager.AddToRoleAsync(user, "User");

            await SendConfirmationEmailAsync(user, ct);

            return await BuildAuthResponseAsync(user, ip, ct);
        }

        // ==================== ĐĂNG NHẬP ====================

        public async Task<AuthResponse> LoginAsync(LoginRequest request, string? ip, CancellationToken ct = default)
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var user = await _userManager.FindByEmailAsync(email);

            // Thông báo giống hệt nhau cho cả 2 trường hợp (sai email / sai mật khẩu)
            // để không lộ email nào đã tồn tại trong hệ thống.
            if (user is null || !await _userManager.CheckPasswordAsync(user, request.Password))
                throw new ValidationFailedException("Email hoặc mật khẩu không đúng.");

            if (await _userManager.IsLockedOutAsync(user))
                throw new ConflictException("Tài khoản đang bị tạm khoá do đăng nhập sai nhiều lần. Vui lòng thử lại sau.");

            if (_settings.RequireConfirmedEmail && !user.EmailConfirmed)
                throw new ConflictException("Vui lòng xác thực email trước khi đăng nhập.");

            await _userManager.ResetAccessFailedCountAsync(user);

            return await BuildAuthResponseAsync(user, ip, ct);
        }

        // ==================== REFRESH TOKEN (có rotation) ====================

        public async Task<AuthResponse> RefreshAsync(string refreshToken, string? ip, CancellationToken ct = default)
        {
            var stored = await _db.Set<RefreshToken>()
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.Token == refreshToken, ct)
                ?? throw new ValidationFailedException("Refresh token không hợp lệ.");

            // Phát hiện tái sử dụng token đã bị thu hồi → khả năng token bị đánh cắp.
            // Thu hồi TOÀN BỘ token của user, buộc đăng nhập lại trên mọi thiết bị.
            if (stored.RevokedAt is not null)
            {
                _logger.LogWarning(
                    "Phát hiện tái sử dụng refresh token đã thu hồi. UserId={UserId}, IP={Ip}",
                    stored.UserId, ip);

                await RevokeAllTokensOfUserAsync(stored.UserId, ct);
                throw new ValidationFailedException("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
            }

            if (stored.IsExpired)
                throw new ValidationFailedException("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");

            // Rotation: thu hồi token cũ, cấp token mới
            var newRefreshToken = _tokenService.GenerateRefreshToken();
            stored.RevokedAt = DateTime.UtcNow;
            stored.ReplacedByToken = newRefreshToken;

            var response = await BuildAuthResponseAsync(stored.User, ip, ct, presetRefreshToken: newRefreshToken);
            return response;
        }

        // ==================== ĐĂNG XUẤT ====================

        public async Task LogoutAsync(string refreshToken, CancellationToken ct = default)
        {
            var stored = await _db.Set<RefreshToken>()
                .FirstOrDefaultAsync(t => t.Token == refreshToken, ct);

            // Không ném lỗi nếu token không tồn tại — đăng xuất là thao tác idempotent
            if (stored is null || stored.RevokedAt is not null) return;

            stored.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        public async Task LogoutAllDevicesAsync(string userId, CancellationToken ct = default)
        {
            await RevokeAllTokensOfUserAsync(userId, ct);
        }

        // ==================== XÁC THỰC EMAIL ====================

        public async Task ConfirmEmailAsync(string userId, string token, CancellationToken ct = default)
        {
            var user = await _userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("Không tìm thấy tài khoản.");

            if (user.EmailConfirmed) return;   // idempotent

            var decoded = DecodeToken(token);
            var result = await _userManager.ConfirmEmailAsync(user, decoded);

            if (!result.Succeeded)
                throw new ValidationFailedException("Link xác thực không hợp lệ hoặc đã hết hạn.");
        }

        public async Task ResendConfirmationAsync(string email, CancellationToken ct = default)
        {
            var user = await _userManager.FindByEmailAsync(email.Trim().ToLowerInvariant());

            // Im lặng nếu email không tồn tại — không lộ email nào đã đăng ký
            if (user is null || user.EmailConfirmed) return;

            await SendConfirmationEmailAsync(user, ct);
        }

        // ==================== QUÊN / ĐẶT LẠI / ĐỔI MẬT KHẨU ====================

        public async Task ForgotPasswordAsync(string email, CancellationToken ct = default)
        {
            var user = await _userManager.FindByEmailAsync(email.Trim().ToLowerInvariant());

            // Luôn trả về thành công ở controller, kể cả khi email không tồn tại —
            // tránh dò email nào có trong hệ thống.
            if (user is null) return;

            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var link = $"{_settings.ClientBaseUrl}/reset-password" +
                       $"?userId={HttpUtility.UrlEncode(user.Id)}&token={EncodeToken(token)}";

            await _emailSender.SendPasswordResetAsync(user.Email!, user.Name, link, ct);
        }

        public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default)
        {
            var user = await _userManager.FindByIdAsync(request.UserId)
                ?? throw new NotFoundException("Không tìm thấy tài khoản.");

            var decoded = DecodeToken(request.Token);
            var result = await _userManager.ResetPasswordAsync(user, decoded, request.NewPassword);

            if (!result.Succeeded)
                throw new ValidationFailedException(string.Join(" ", result.Errors.Select(e => e.Description)));

            // Đổi mật khẩu → thu hồi mọi phiên cũ
            await RevokeAllTokensOfUserAsync(user.Id, ct);
        }

        public async Task ChangePasswordAsync(string userId, ChangePasswordRequest request, CancellationToken ct = default)
        {
            var user = await _userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("Không tìm thấy tài khoản.");

            var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);

            if (!result.Succeeded)
                throw new ValidationFailedException(string.Join(" ", result.Errors.Select(e => e.Description)));

            await RevokeAllTokensOfUserAsync(user.Id, ct);
        }

        // ==================== THÔNG TIN TÀI KHOẢN ====================

        public async Task<CurrentUserDto> GetCurrentUserAsync(string userId, CancellationToken ct = default)
        {
            var user = await _userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("Không tìm thấy tài khoản.");

            var roles = await _userManager.GetRolesAsync(user);

            return new CurrentUserDto(
                user.Id, user.Email!, user.Name, user.AvatarUrl, user.Bio,
                user.PhoneNumber, user.EmailConfirmed, roles, user.CreatedAt);
        }

        public async Task<CurrentUserDto> UpdateProfileAsync(string userId, UpdateProfileRequest request, CancellationToken ct = default)
        {
            var user = await _userManager.FindByIdAsync(userId)
                ?? throw new NotFoundException("Không tìm thấy tài khoản.");

            user.Name = request.Name.Trim();
            user.Bio = request.Bio?.Trim();
            user.PhoneNumber = request.PhoneNumber?.Trim();

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
                throw new ValidationFailedException(string.Join(" ", result.Errors.Select(e => e.Description)));

            return await GetCurrentUserAsync(userId, ct);
        }

        // ====================== Google OAuth ======================

        /// <summary>Đăng nhập bằng Google. Nếu email chưa từng đăng ký, tự tạo tài khoản
        /// mới (EmailConfirmed = true luôn, vì nhà cung cấp đã xác thực email). Nếu email đã tồn tại
        /// (kể cả từng đăng ký bằng mật khẩu thường), tự động đăng nhập vào ĐÚNG tài khoản đó.</summary>
        public async Task<AuthResponse> ExternalLoginAsync(ExternalLoginRequest request, string? ip, CancellationToken ct = default)
        {
            var (email, name, avatarUrl, emailVerified) = request.Provider.Trim().ToLowerInvariant() switch
            {
                "google" => await VerifyGoogleTokenAsync(request.Token),
                _ => throw new ValidationFailedException($"Provider '{request.Provider}' không được hỗ trợ.")
            };

            if (!emailVerified || string.IsNullOrEmpty(email))
                throw new ValidationFailedException(
                    "Không lấy được email đã xác thực từ nhà cung cấp. Vui lòng cấp quyền chia sẻ email hoặc đăng ký bằng email/mật khẩu.");

            email = email.Trim().ToLowerInvariant();   // nhất quán với cách RegisterAsync/LoginAsync chuẩn hoá email

            var user = await _userManager.FindByEmailAsync(email);

            if (user is null)
            {
                // Chưa từng có tài khoản — tạo mới, KHÔNG cần password (chỉ đăng nhập qua OAuth từ giờ)
                user = new ApplicationUser
                {
                    Email = email,
                    UserName = email,
                    Name = string.IsNullOrWhiteSpace(name) ? email : name,
                    AvatarUrl = avatarUrl,
                    EmailConfirmed = true,
                    CreatedAt = DateTime.UtcNow
                };

                var createResult = await _userManager.CreateAsync(user);
                if (!createResult.Succeeded)
                    throw new ValidationFailedException(string.Join("; ", createResult.Errors.Select(e => e.Description)));

                await _userManager.AddToRoleAsync(user, "User");

                _logger.LogInformation("Tạo tài khoản mới qua {Provider}: {Email}", request.Provider, email);
            }
            else if (!user.EmailConfirmed)
            {
                // Tài khoản cũ đăng ký bằng email/password nhưng chưa xác thực — đăng nhập
                // Google/Facebook bằng đúng email này coi như xác thực luôn.
                user.EmailConfirmed = true;
                await _userManager.UpdateAsync(user);
            }

            return await BuildAuthResponseAsync(user, ip, ct);
        }


        // ==================== HELPERS ====================

        private async Task<AuthResponse> BuildAuthResponseAsync(
            ApplicationUser user, string? ip, CancellationToken ct, string? presetRefreshToken = null)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var accessToken = _tokenService.CreateToken(user, roles);
            var refreshToken = presetRefreshToken ?? _tokenService.GenerateRefreshToken();

            var refreshExpiresAt = DateTime.UtcNow.AddDays(_settings.RefreshTokenDays);

            await _db.Set<RefreshToken>().AddAsync(new RefreshToken
            {
                UserId = user.Id,
                Token = refreshToken,
                ExpiresAt = refreshExpiresAt,
                CreatedByIp = ip
            }, ct);

            await _db.SaveChangesAsync(ct);

            return new AuthResponse(
                user.Id, user.Email!, user.Name, user.AvatarUrl, roles, user.EmailConfirmed,
                accessToken, DateTime.UtcNow.AddMinutes(_settings.AccessTokenMinutes),
                refreshToken, refreshExpiresAt);
        }

        private async Task SendConfirmationEmailAsync(ApplicationUser user, CancellationToken ct)
        {
            var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
            var link = $"{_settings.ClientBaseUrl}/confirm-email" +
                       $"?userId={HttpUtility.UrlEncode(user.Id)}&token={EncodeToken(token)}";

            await _emailSender.SendEmailConfirmationAsync(user.Email!, user.Name, link, ct);
        }

        private async Task RevokeAllTokensOfUserAsync(string userId, CancellationToken ct)
        {
            var tokens = await _db.Set<RefreshToken>()
                .Where(t => t.UserId == userId && t.RevokedAt == null)
                .ToListAsync(ct);

            var now = DateTime.UtcNow;
            foreach (var t in tokens) t.RevokedAt = now;

            await _db.SaveChangesAsync(ct);
        }

        // Token của Identity chứa ký tự đặc biệt (+, /, =) — phải encode base64url
        // để truyền an toàn qua query string, tránh lỗi "Invalid token".
        private static string EncodeToken(string token)
            => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

        private static string DecodeToken(string encoded)
        {
            try
            {
                return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(encoded));
            }
            catch
            {
                throw new ValidationFailedException("Token không hợp lệ.");
            }
        }

        // ---------- Helper: verify Google ID token ----------

        private async Task<(string? Email, string? Name, string? AvatarUrl, bool EmailVerified)> VerifyGoogleTokenAsync(string idToken)
        {
            try
            {
                var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { _googleSettings.ClientId }   // BẮT BUỘC — chặn token cấp cho app khác
                });

                return (payload.Email, payload.Name, payload.Picture, payload.EmailVerified);
            }
            catch (InvalidJwtException ex)
            {
                _logger.LogWarning(ex, "Token Google không hợp lệ");
                throw new ValidationFailedException($"Token Google không hợp lệ: {ex.Message}");
            }
        }




    }
}
