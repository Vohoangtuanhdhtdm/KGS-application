using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Rules
{
    /// <summary>Quy tắc của các thao tác quản trị — tách ra hàm thuần để test được và để mọi
    /// nơi (API, giao diện qua cờ CanRestore) hiểu giống nhau.</summary>
    public static class AdminRules
    {
        /// <summary>Ghi chú đánh dấu tin bị gỡ VÌ KHOÁ TÀI KHOẢN — mở khoá dựa vào nó để biết tin
        /// nào được khôi phục theo, tin nào bị gỡ vì lý do riêng thì giữ nguyên.</summary>
        public const string LockTakedownPrefix = "Tài khoản người đăng bị khoá";

        /// <summary>Đánh dấu tin bị gỡ lúc khoá khi nó CHƯA được duyệt — mở khoá thì trả về hàng
        /// đợi duyệt, không được đi tắt lên trang công khai.</summary>
        public const string LockWhilePendingMarker = " (khi đang chờ duyệt)";

        public static string LockTakedownNote(string reason, bool wasPending)
            => $"{LockTakedownPrefix}{(wasPending ? LockWhilePendingMarker : "")}: {reason}";

        /// <summary>Trạng thái trả về khi mở khoá, đọc từ ghi chú lúc gỡ.</summary>
        public static ListingStatus StatusAfterUnlock(string moderationNote)
            => moderationNote.StartsWith(LockTakedownPrefix + LockWhilePendingMarker)
                ? ListingStatus.Pending
                : ListingStatus.Approved;

        /// <summary>Khôi phục chỉ áp dụng cho tin do QUẢN TRỊ gỡ/đóng (sau báo vi phạm hoặc khi khoá
        /// tài khoản). Tin bị từ chối lúc duyệt hay do chủ tin tự đóng có luồng riêng của chúng —
        /// sửa và gửi duyệt lại, hoặc chủ tin tự mở lại — admin không nên đi tắt qua.</summary>
        public static bool CanRestore(ListingStatus status, ModerationAction? latestAction)
            => status is ListingStatus.Rejected or ListingStatus.Closed
               && latestAction is ModerationAction.TakenDown or ModerationAction.ClosedByReport;

        /// <summary>Thời điểm hết khoá. null số ngày = khoá vô thời hạn.</summary>
        public static DateTimeOffset LockEnd(DateTimeOffset now, int? days)
            => days is > 0 ? now.AddDays(days.Value) : DateTimeOffset.MaxValue;

        /// <summary>Lý do KHÔNG được khoá — null nghĩa là được.</summary>
        public static string? CannotLock(string actorId, string targetId, bool targetIsAdmin, bool alreadyLocked)
        {
            if (actorId == targetId) return "Không thể tự khoá tài khoản của chính mình.";
            if (targetIsAdmin) return "Tài khoản này là quản trị viên — thu quyền Admin trước khi khoá.";
            if (alreadyLocked) return "Tài khoản đang bị khoá.";
            return null;
        }

        /// <summary>Lý do KHÔNG được đổi quyền Admin — null nghĩa là được.</summary>
        /// <param name="targetOpenListings">Số tin CHƯA đóng (nháp, chờ duyệt, đang hiển thị, cần
        /// sửa, bị từ chối) của người được cấp quyền. Admin không đồng thời là Chủ nhà: cấp quyền
        /// cho người đang có tin thì những tin đó thành tin "mồ côi" — chủ không còn quản lý được
        /// (chức năng Chủ nhà chặn tài khoản Admin), còn chính họ lại duyệt được tin của mình.</param>
        public static string? CannotChangeAdmin(
            string actorId, string targetId, bool grant, bool targetLocked, int adminCount, int targetOpenListings = 0)
        {
            if (grant && targetOpenListings > 0)
                return $"Tài khoản này đang có {targetOpenListings} tin chưa đóng. Quản trị viên không đồng thời là Chủ nhà — " +
                       "đóng hoặc xoá các tin đó trước khi cấp quyền Admin.";
            if (!grant && actorId == targetId) return "Không thể tự thu quyền Admin của chính mình.";
            if (!grant && adminCount <= 1) return "Hệ thống phải còn ít nhất một quản trị viên.";
            if (grant && targetLocked) return "Không cấp quyền Admin cho tài khoản đang bị khoá.";
            return null;
        }
    }
}
