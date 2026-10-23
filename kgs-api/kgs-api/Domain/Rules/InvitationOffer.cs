namespace kgs_api.Domain.Rules
{
    /// <summary>Ưu đãi riêng kèm lời mời xem nhà.
    ///
    /// Giá ưu đãi phải THẤP HƠN giá niêm yết: "giá cho riêng bạn" mà bằng hay cao hơn giá ai
    /// cũng thấy thì là mồi nhử, không phải ưu đãi. Khi người tìm nhận lời, con số này được ghi
    /// cứng vào yêu cầu xem nhà để cả hai bên cùng giữ một lời hứa.</summary>
    public static class InvitationOffer
    {
        public const int MaxNoteLength = 120;

        /// <summary>Giá ưu đãi còn đúng là ưu đãi so với giá tin HIỆN TẠI không. Chủ nhà hạ giá tin
        /// xuống bằng hoặc dưới mức đã mời thì giá ưu đãi mất nghĩa: không ghi cứng nó khi nhận lời,
        /// không hiện nó như một món hời.</summary>
        public static decimal? Effective(decimal? offerPrice, decimal currentPrice)
            => offerPrice is { } p && p < currentPrice ? p : null;

        /// <summary>Câu lỗi cho người dùng, hoặc null khi hợp lệ. Cả hai trường đều tuỳ chọn.</summary>
        public static string? Validate(decimal? offerPrice, string? offerNote, decimal listedPrice)
        {
            if (offerPrice is { } p)
            {
                if (p <= 0) return "Giá ưu đãi phải lớn hơn 0.";
                if (p >= listedPrice) return "Giá ưu đãi phải thấp hơn giá đang đăng của tin.";
            }
            if (offerNote is not null && offerNote.Trim().Length > MaxNoteLength)
                return $"Dòng ưu đãi tối đa {MaxNoteLength} ký tự.";
            return null;
        }
    }
}
