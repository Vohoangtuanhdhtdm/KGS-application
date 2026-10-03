namespace kgs_api.Dtos
{
    public sealed record NotificationDto(
        Guid Id, string Title, string Body, string? LinkPath, string? LinkLabel,
        DateTime CreatedAt, bool IsRead);

    public sealed record NotificationPageDto(
        IReadOnlyList<NotificationDto> Items, int UnreadCount, int TotalCount, int Page, int PageSize);
}
