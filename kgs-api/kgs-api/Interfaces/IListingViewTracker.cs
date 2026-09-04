namespace kgs_api.Interfaces
{
    /// <summary>Ghi nhận lượt xem tin đăng, đã khử trùng theo người xem theo ngày.</summary>
    public interface IListingViewTracker
    {
        /// <summary>Ghi một lượt xem. Trả về true nếu đây là lượt xem MỚI (đã ghi và đã
        /// tăng bộ đếm), false nếu người này đã xem tin đó trong ngày.
        ///
        /// Không bao giờ ném lỗi: một lượt xem không đếm được thì cũng không được phép làm
        /// hỏng việc mở trang chi tiết.</summary>
        Task<bool> TrackAsync(Guid listingId, CancellationToken ct = default);
    }
}
