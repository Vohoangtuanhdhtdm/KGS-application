using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeAdministrativeNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Đưa tên tỉnh/quận đã lưu về TÊN CHÍNH THỨC (dạng của biểu mẫu nhập địa chỉ — xem
            // AdministrativeNames). Đo trên dữ liệu thật trước khi viết: cùng TP.HCM đang lưu
            // thành "TP. Hồ Chí Minh" và "Thành phố Hồ Chí Minh", nên lọc Bình Thạnh ra 1 tin
            // thay vì 13. Từ nay mọi lần ghi đều qua AdministrativeNames; migration này chỉ dọn
            // phần đã lỡ lưu.
            //
            // SQL không tra được danh mục hành chính, nên chỉ sửa những dạng viết tắt CÓ QUY LUẬT:
            //   "TP. X" / "TP X" → "Thành phố X"      "TX. X" → "Thị xã X"
            //   "Q.3" / "Q3"     → "Quận 3"           bỏ phần ghi chú trong ngoặc "(Q2 cũ)"
            //   và các cách gọi tắt quen thuộc của TP.HCM.
            const string fix = @"
CREATE OR REPLACE FUNCTION pg_temp.kgs_area(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE
    WHEN v IS NULL THEN NULL
    WHEN lower(btrim(v)) IN ('hồ chí minh', 'tp.hcm', 'tp hcm', 'tphcm', 'hcm', 'sài gòn')
      THEN 'Thành phố Hồ Chí Minh'
    ELSE regexp_replace(
           regexp_replace(
             regexp_replace(
               btrim(regexp_replace(v, '\s*\([^)]*\)\s*', ' ', 'g')),
               '^[Tt][Pp]\.?\s+', 'Thành phố '),
             '^[Tt][Xx]\.?\s+', 'Thị xã '),
           '^[Qq]\.?\s*([0-9]+)$', 'Quận \1')
  END
$f$;

UPDATE ""Assets""
   SET ""City""     = pg_temp.kgs_area(""City""),
       ""District"" = pg_temp.kgs_area(""District"")
 WHERE ""City"" IS DISTINCT FROM pg_temp.kgs_area(""City"")
    OR ""District"" IS DISTINCT FROM pg_temp.kgs_area(""District"");

-- Bộ lọc đã lưu (jsonb, tên trường PascalCase như System.Text.Json mặc định). Không sửa thì
-- bộ lọc cũ ""TP. Hồ Chí Minh"" sẽ không còn khớp tin nào sau khi dữ liệu đã đổi tên.
UPDATE ""SavedSearches""
   SET ""CriteriaJson"" = jsonb_set(""CriteriaJson"", '{City}', to_jsonb(pg_temp.kgs_area(""CriteriaJson""->>'City')))
 WHERE jsonb_typeof(""CriteriaJson""->'City') = 'string'
   AND ""CriteriaJson""->>'City' IS DISTINCT FROM pg_temp.kgs_area(""CriteriaJson""->>'City');
UPDATE ""SavedSearches""
   SET ""CriteriaJson"" = jsonb_set(""CriteriaJson"", '{District}', to_jsonb(pg_temp.kgs_area(""CriteriaJson""->>'District')))
 WHERE jsonb_typeof(""CriteriaJson""->'District') = 'string'
   AND ""CriteriaJson""->>'District' IS DISTINCT FROM pg_temp.kgs_area(""CriteriaJson""->>'District');
";
            migrationBuilder.Sql(fix);
        }

        /// <summary>Không hoàn tác: tên chính thức hiển thị đúng với mọi phiên bản mã, còn dạng
        /// viết tắt cũ thì không khôi phục lại được một cách chính xác (đã gộp các biến thể).</summary>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
