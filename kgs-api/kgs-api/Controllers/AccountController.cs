using kgs_api.Extensions;
using Microsoft.AspNetCore.RateLimiting;
using kgs_api.Dtos.Auth;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Common.Common;

namespace kgs_api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public sealed class AccountController : ControllerBase
    {
        private readonly IAuthService _auth;
        private readonly ICurrentUserService _currentUser;

        public AccountController(IAuthService auth, ICurrentUserService currentUser)
        {
            _auth = auth;
            _currentUser = currentUser;
        }

        // ==================== ĐĂNG KÝ / ĐĂNG NHẬP ====================

        /// <summary>Đăng ký tài khoản mới. Tự gửi email xác thực (dev: in link ra console).</summary>
        [HttpPost("register")]
        [EnableRateLimiting(RateLimitingExtensions.Auth)]
        [AllowAnonymous]
        public async Task<ActionResult<AuthResponse>> Register(
            [FromBody] RegisterRequest request, CancellationToken ct)
        {
            var result = await _auth.RegisterAsync(request, GetIpAddress(), ct);
            return Ok(result);
        }

        /// <summary>Đăng nhập bằng email + mật khẩu.</summary>
        [HttpPost("login")]
        [EnableRateLimiting(RateLimitingExtensions.Auth)]
        [AllowAnonymous]
        public async Task<ActionResult<AuthResponse>> Login(
            [FromBody] LoginRequest request, CancellationToken ct)
        {
            var result = await _auth.LoginAsync(request, GetIpAddress(), ct);
            return Ok(result);
        }

        [HttpPost("external-login")]
        [AllowAnonymous]
        public async Task<ActionResult<AuthResponse>> ExternalLogin( [FromBody] ExternalLoginRequest request, CancellationToken ct)
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var result = await _auth.ExternalLoginAsync(request, ip, ct);
            return Ok(result);
        }

        /// <summary>
        /// Cấp access token mới bằng refresh token. Refresh token cũ bị thu hồi (rotation).
        /// Nếu dùng lại token đã thu hồi → toàn bộ phiên của user bị huỷ (phát hiện token bị đánh cắp).
        /// </summary>
        [HttpPost("refresh")]
        [AllowAnonymous]
        public async Task<ActionResult<AuthResponse>> Refresh(
            [FromBody] RefreshTokenRequest request, CancellationToken ct)
        {
            var result = await _auth.RefreshAsync(request.RefreshToken, GetIpAddress(), ct);
            return Ok(result);
        }

        /// <summary>Đăng xuất thiết bị hiện tại (thu hồi 1 refresh token).</summary>
        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout(
            [FromBody] RefreshTokenRequest request, CancellationToken ct)
        {
            await _auth.LogoutAsync(request.RefreshToken, ct);
            return NoContent();
        }

        /// <summary>Đăng xuất khỏi TẤT CẢ thiết bị.</summary>
        [HttpPost("logout-all")]
        [Authorize]
        public async Task<IActionResult> LogoutAll(CancellationToken ct)
        {
            await _auth.LogoutAllDevicesAsync(_currentUser.UserId, ct);
            return NoContent();
        }

        // ==================== XÁC THỰC EMAIL ====================

        /// <summary>Xác thực email bằng link đã gửi. Frontend gọi endpoint này với userId + token từ query string.</summary>
        [HttpPost("confirm-email")]
        [AllowAnonymous]
        public async Task<IActionResult> ConfirmEmail(
            [FromBody] ConfirmEmailRequest request, CancellationToken ct)
        {
            await _auth.ConfirmEmailAsync(request.UserId, request.Token, ct);
            return Ok(new { message = "Xác thực email thành công." });
        }

        /// <summary>Gửi lại email xác thực.</summary>
        [HttpPost("resend-confirmation")]
        [AllowAnonymous]
        public async Task<IActionResult> ResendConfirmation(
            [FromBody] ResendConfirmationRequest request, CancellationToken ct)
        {
            await _auth.ResendConfirmationAsync(request.Email, ct);
            // Luôn trả thành công dù email có tồn tại hay không
            return Ok(new { message = "Nếu email tồn tại và chưa xác thực, chúng tôi đã gửi lại link xác thực." });
        }

        // ==================== MẬT KHẨU ====================

        /// <summary>Gửi link đặt lại mật khẩu về email.</summary>
        [HttpPost("forgot-password")]
        [EnableRateLimiting(RateLimitingExtensions.Auth)]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword(
            [FromBody] ForgotPasswordRequest request, CancellationToken ct)
        {
            await _auth.ForgotPasswordAsync(request.Email, ct);
            // Luôn trả thành công — không tiết lộ email nào có trong hệ thống
            return Ok(new { message = "Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu." });
        }

        /// <summary>Đặt lại mật khẩu bằng token từ email. Thu hồi mọi phiên đăng nhập cũ.</summary>
        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPassword(
            [FromBody] ResetPasswordRequest request, CancellationToken ct)
        {
            await _auth.ResetPasswordAsync(request, ct);
            return Ok(new { message = "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." });
        }

        /// <summary>Đổi mật khẩu khi đang đăng nhập. Thu hồi mọi phiên cũ.</summary>
        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword(
            [FromBody] ChangePasswordRequest request, CancellationToken ct)
        {
            await _auth.ChangePasswordAsync(_currentUser.UserId, request, ct);
            return Ok(new { message = "Đổi mật khẩu thành công. Vui lòng đăng nhập lại." });
        }

        // ==================== THÔNG TIN TÀI KHOẢN ====================

        /// <summary>Thông tin tài khoản đang đăng nhập.</summary>
        [HttpGet("me")]
        [Authorize]
        public async Task<ActionResult<CurrentUserDto>> Me(CancellationToken ct)
            => Ok(await _auth.GetCurrentUserAsync(_currentUser.UserId, ct));

        /// <summary>Cập nhật hồ sơ cá nhân.</summary>
        [HttpPut("me")]
        [Authorize]
        public async Task<ActionResult<CurrentUserDto>> UpdateProfile(
            [FromBody] UpdateProfileRequest request, CancellationToken ct)
            => Ok(await _auth.UpdateProfileAsync(_currentUser.UserId, request, ct));

        // ==================== HELPER ====================

        private string? GetIpAddress()
            => Request.Headers.TryGetValue("X-Forwarded-For", out var forwarded)
                ? forwarded.ToString().Split(',').FirstOrDefault()?.Trim()
                : HttpContext.Connection.RemoteIpAddress?.ToString();
    }
}
