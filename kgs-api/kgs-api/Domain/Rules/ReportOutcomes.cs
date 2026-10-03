using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Rules
{
    /// <summary>Xác nhận một báo vi phạm thì TIN ĐĂNG phải đổi theo.
    ///
    /// Trước đây "xác nhận vi phạm" chỉ đánh dấu báo cáo là đã xử lý — tin lừa đảo vẫn nằm
    /// nguyên trên trang tìm kiếm, và chủ tin không hề biết đã có người phản ánh. Báo cáo
    /// mà không dẫn tới hành động thì người dùng sẽ thôi báo.
    ///
    /// Không phải vi phạm nào cũng đáng gỡ hẳn: tin ghi sai giá chỉ cần sửa, tin đã cho thuê
    /// rồi chỉ cần đóng (chủ tin mở lại được khi phòng trống lần sau). Hàm này đề xuất cách
    /// xử lý theo lý do báo; người kiểm duyệt vẫn chọn lại được.</summary>
    public static class ReportOutcomes
    {
        /// <summary>Cách xử lý mặc định theo lý do người dùng báo.</summary>
        public static ReportAction DefaultAction(ListingReportReason reason) => reason switch
        {
            ListingReportReason.Scam or ListingReportReason.Spam or ListingReportReason.Inappropriate
                => ReportAction.TakeDown,
            ListingReportReason.AlreadyTaken => ReportAction.MarkTaken,
            _ => ReportAction.RequestChanges,   // sai thông tin, lý do khác: cho chủ tin cơ hội sửa
        };

        /// <summary>Trạng thái mới của tin và dòng ghi vào lịch sử kiểm duyệt.</summary>
        public static (ListingStatus Status, ModerationAction Action, ModerationReason Reason) Apply(
            ReportAction action, ListingReportReason reason) => action switch
        {
            ReportAction.TakeDown => (ListingStatus.Rejected, ModerationAction.TakenDown, ToModerationReason(reason)),
            ReportAction.MarkTaken => (ListingStatus.Closed, ModerationAction.ClosedByReport, ModerationReason.Other),
            _ => (ListingStatus.ChangesRequested, ModerationAction.ChangesRequested, ToModerationReason(reason)),
        };

        public static ModerationReason ToModerationReason(ListingReportReason reason) => reason switch
        {
            ListingReportReason.Scam or ListingReportReason.Inappropriate => ModerationReason.ProhibitedContent,
            ListingReportReason.Spam => ModerationReason.Duplicate,
            _ => ModerationReason.Other,
        };

        /// <summary>Lý do báo, viết để đọc trong thông báo gửi chủ tin.</summary>
        public static string Describe(ListingReportReason reason) => reason switch
        {
            ListingReportReason.Spam => "tin rác hoặc đăng trùng",
            ListingReportReason.WrongInfo => "thông tin trong tin không đúng thực tế",
            ListingReportReason.AlreadyTaken => "bất động sản đã cho thuê hoặc đã bán",
            ListingReportReason.Scam => "có dấu hiệu lừa đảo",
            ListingReportReason.Inappropriate => "nội dung không phù hợp",
            _ => "lý do khác",
        };
    }
}
