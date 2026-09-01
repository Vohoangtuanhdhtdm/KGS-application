using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace kgs_api.Common
{
    public class Common
    {
        // ============================================================
        // EXCEPTIONS — service ném exception ngữ nghĩa,
        // middleware phía dưới map sang HTTP status + ProblemDetails.
        // ============================================================
        public abstract class DomainException : Exception
        {
            protected DomainException(string message) : base(message) { }
        }

        /// <summary>404 — không tìm thấy, HOẶC bản ghi tồn tại nhưng không thuộc user hiện tại
        /// (trả 404 thay vì 403 để không lộ sự tồn tại của dữ liệu người khác).</summary>
        public sealed class NotFoundException : DomainException
        {
            public NotFoundException(string message = "Không tìm thấy dữ liệu.") : base(message) { }
        }

        /// <summary>409 — xung đột nghiệp vụ (trùng kỳ hạn hợp đồng, xoá contact còn ràng buộc...).</summary>
        public sealed class ConflictException : DomainException
        {
            public ConflictException(string message) : base(message) { }
        }

        /// <summary>400 — dữ liệu đầu vào sai nghiệp vụ.</summary>
        public sealed class ValidationFailedException : DomainException
        {
            public ValidationFailedException(string message) : base(message) { }
        }

        // ============================================================
        // CURRENT USER
        // ============================================================
        public interface ICurrentUserService
        {
            /// <summary>Id của user đang đăng nhập. Ném UnauthorizedAccessException nếu chưa đăng nhập.</summary>
            string UserId { get; }
        }

        public sealed class CurrentUserService : ICurrentUserService
        {
            private readonly IHttpContextAccessor _http;
            public CurrentUserService(IHttpContextAccessor http) => _http = http;

            public string UserId =>
                _http.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? throw new UnauthorizedAccessException("Người dùng chưa đăng nhập.");
        }

        // ============================================================
        // PAGING
        // ============================================================
        /// <summary>Phân trang offset — dùng cho danh sách nhỏ/trung bình (assets, contracts...).</summary>
        public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
        {
            public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
        }

        /// <summary>Phân trang keyset — dùng cho bảng lớn tăng vô hạn (CashFlowEntries).
        /// NextCursor = null nghĩa là đã hết dữ liệu.</summary>
        public sealed record KeysetPage<T>(IReadOnlyList<T> Items, string? NextCursor);

        /// <summary>Cursor 2 thành phần (OccurredAt, Id) — encode base64 để client truyền lại nguyên vẹn.</summary>
        public static class CashFlowCursor
        {
            public static string Encode(DateTime occurredAt, Guid id)
                => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{occurredAt:O}|{id}"));

            public static (DateTime OccurredAt, Guid Id)? Decode(string? cursor)
            {
                if (string.IsNullOrWhiteSpace(cursor)) return null;
                try
                {
                    var parts = System.Text.Encoding.UTF8
                        .GetString(Convert.FromBase64String(cursor)).Split('|');
                    return (DateTime.Parse(parts[0], null, System.Globalization.DateTimeStyles.RoundtripKind),
                            Guid.Parse(parts[1]));
                }
                catch
                {
                    throw new ValidationFailedException("Cursor phân trang không hợp lệ.");
                }
            }
        }

        // ============================================================
        // MIDDLEWARE — DomainException → ProblemDetails
        // ============================================================
        public sealed class DomainExceptionMiddleware
        {
            private readonly RequestDelegate _next;
            public DomainExceptionMiddleware(RequestDelegate next) => _next = next;

            public async Task InvokeAsync(HttpContext context)
            {
                try
                {
                    await _next(context);
                }
                catch (Exception ex) when (ex is DomainException or UnauthorizedAccessException)
                {
                    var (status, title) = ex switch
                    {
                        NotFoundException => (StatusCodes.Status404NotFound, "Not Found"),
                        ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
                        ValidationFailedException => (StatusCodes.Status400BadRequest, "Bad Request"),
                        UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
                        _ => (StatusCodes.Status400BadRequest, "Bad Request")
                    };

                    context.Response.StatusCode = status;
                    context.Response.ContentType = "application/problem+json";
                    await context.Response.WriteAsJsonAsync(new ProblemDetails
                    {
                        Status = status,
                        Title = title,
                        Detail = ex.Message
                    });
                }
            }
        }
    }
}
