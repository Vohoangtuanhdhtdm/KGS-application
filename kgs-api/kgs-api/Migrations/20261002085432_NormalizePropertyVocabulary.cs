using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class NormalizePropertyVocabulary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Chuẩn hoá dữ liệu cũ về đúng bộ giá trị của PropertyVocabulary — để bộ lọc mới
            // (nội thất, hướng, pháp lý) không bỏ sót tin cũ. Đo trên dữ liệu thật trước khi
            // viết: 77 tài sản ghi "Đầy đủ nội thất" trong khi biểu mẫu ghi "Đầy đủ", tức chọn
            // "Đầy đủ" sẽ trượt 77/79 tin.
            migrationBuilder.Sql(@"
UPDATE ""Assets"" SET ""FurnitureState"" = 'Đầy đủ'
 WHERE ""FurnitureState"" IN ('Đầy đủ nội thất', 'Nội thất đầy đủ', 'Full nội thất', 'full nội thất');
UPDATE ""Assets"" SET ""FurnitureState"" = 'Cơ bản'  WHERE ""FurnitureState"" IN ('Nội thất cơ bản');
UPDATE ""Assets"" SET ""FurnitureState"" = 'Không nội thất'
 WHERE ""FurnitureState"" IN ('Không có nội thất', 'Nhà trống', 'Bàn giao thô');
UPDATE ""Assets"" SET ""FurnitureState"" = NULL WHERE btrim(""FurnitureState"") = '';
UPDATE ""Assets"" SET ""HouseDirection"" = NULL WHERE btrim(""HouseDirection"") = '';
UPDATE ""Assets"" SET ""LegalStatus""    = NULL WHERE btrim(""LegalStatus"") = '';
");

            // Loại 'Phòng trọ' (7) mới có. Phòng trọ trong dữ liệu MẪU trước đây phải khai là
            // 'Nhà riêng' (1). Chỉ đổi đúng dữ liệu do bộ sinh mẫu tạo — nhận ra bằng nhãn trong
            // Notes — tin người dùng tự đăng thì không đụng tới.
            migrationBuilder.Sql(@"
UPDATE ""Assets"" SET ""TypeProperty"" = 7
 WHERE ""TypeProperty"" = 1
   AND ((""Notes"" = '[demo-gd1]' AND ""Name"" LIKE 'Phòng trọ %')
     OR (""Notes"" = 'Dữ liệu mô phỏng phục vụ đánh giá tìm kiếm.' AND ""Name"" LIKE 'Khu trọ %'));
");
        }

        /// <summary>Chỉ hoàn tác được phần đổi loại hình. Chuẩn hoá chữ thì không — và cũng
        /// không cần: giá trị chuẩn vẫn hiển thị đúng với mã cũ.</summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE ""Assets"" SET ""TypeProperty"" = 1
 WHERE ""TypeProperty"" = 7
   AND ((""Notes"" = '[demo-gd1]' AND ""Name"" LIKE 'Phòng trọ %')
     OR (""Notes"" = 'Dữ liệu mô phỏng phục vụ đánh giá tìm kiếm.' AND ""Name"" LIKE 'Khu trọ %'));
");
        }
    }
}
