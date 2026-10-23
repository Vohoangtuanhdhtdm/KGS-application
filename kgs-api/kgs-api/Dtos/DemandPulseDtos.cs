using static kgs_api.Domain.Enums;

namespace kgs_api.Dtos
{
    public sealed record DemandPulseBandDto(string Label, decimal? Min, decimal? Max, int People);

    /// <summary>Số người đang tìm ở một khu vực (đã bỏ nhóm dưới 3 người). <paramref name="Type"/>
    /// null = mọi loại tin; <paramref name="District"/> null = cả tỉnh/thành.</summary>
    public sealed record DemandPulseDto(
        ListingType? Type, string City, string? District, int People, IReadOnlyList<DemandPulseBandDto> Bands);

    /// <summary>Bọc lại để "chưa đủ người" là một câu trả lời bình thường (Group = null), không
    /// phải 204 rỗng mà client phải xử lý riêng.</summary>
    public sealed record DemandPulseResponse(DemandPulseDto? Group);
}
