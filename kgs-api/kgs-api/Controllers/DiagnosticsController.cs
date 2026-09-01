using kgs_api.Common.Filters;
using kgs_api.Data;
using kgs_api.Utility;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;
using Npgsql;

namespace kgs_api.Controllers
{


    /// <summary>
    /// Endpoint chẩn đoán hệ thống — dùng để xác minh hạ tầng đã sẵn sàng trước khi test nghiệp vụ.
    /// ⚠️ CHỈ BẬT Ở MÔI TRƯỜNG DEVELOPMENT. Xem ghi chú cuối file về cách chặn ở production.
    /// </summary>
    [ApiController]
    [AllowAnonymous]   // cố ý: cần gọi được khi CHƯA có tài khoản nào để kiểm tra DB
    [DevelopmentOnly]
    [Route("api/diagnostics")]
    public sealed class DiagnosticsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IWebHostEnvironment _env;
        private readonly IOptions<CloudinarySettings> _cloudinary;

        public DiagnosticsController(
            ApplicationDbContext db,
            IWebHostEnvironment env,
            IOptions<CloudinarySettings> cloudinary)
        {
            _db = db;
            _env = env;
            _cloudinary = cloudinary;
        }

        /// <summary>
        /// GET /api/diagnostics/health
        /// Kiểm tra tổng quát: DB kết nối, PostGIS, số bảng, migration đã áp dụng.
        /// Đây là endpoint ĐẦU TIÊN nên gọi sau khi chạy Update-Database.
        /// </summary>
        [HttpGet("health")]
        public async Task<IActionResult> Health(CancellationToken ct)
        {
            var report = new Dictionary<string, object?>();

            // 1. Kết nối database
            try
            {
                var canConnect = await _db.Database.CanConnectAsync(ct);
                report["database_connected"] = canConnect;

                if (!canConnect)
                {
                    report["status"] = "FAILED";
                    report["hint"] = "Kiểm tra ConnectionStrings:PostgresDb trong appsettings.json và PostgreSQL đã chạy chưa.";
                    return StatusCode(503, report);
                }
            }
            catch (Exception ex)
            {
                report["database_connected"] = false;
                report["database_error"] = ex.Message;
                report["status"] = "FAILED";
                return StatusCode(503, report);
            }

            // 2. Migration đã áp dụng / còn pending
            try
            {
                var applied = (await _db.Database.GetAppliedMigrationsAsync(ct)).ToList();
                var pending = (await _db.Database.GetPendingMigrationsAsync(ct)).ToList();

                report["migrations_applied_count"] = applied.Count;
                report["migrations_latest"] = applied.LastOrDefault();
                report["migrations_pending"] = pending;

                if (pending.Count > 0)
                    report["migrations_hint"] = "Còn migration chưa chạy — thực hiện Update-Database.";
            }
            catch (Exception ex)
            {
                report["migrations_error"] = ex.Message;
            }

            // 3. PostGIS extension — bắt buộc cho Asset.Location
            try
            {
                var conn = _db.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open)
                    await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT extversion FROM pg_extension WHERE extname = 'postgis';";
                var version = await cmd.ExecuteScalarAsync(ct);

                report["postgis_enabled"] = version is not null;
                report["postgis_version"] = version?.ToString();

                if (version is null)
                    report["postgis_hint"] = "Chạy: CREATE EXTENSION IF NOT EXISTS postgis;";
            }
            catch (Exception ex)
            {
                report["postgis_error"] = ex.Message;
            }

            // 4. Kiểu cột Location — phải là geography, KHÔNG phải geometry
            try
            {
                var conn = _db.Database.GetDbConnection();
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT udt_name
                    FROM information_schema.columns
                    WHERE table_name = 'Assets' AND column_name = 'Location';";
                var udtName = (await cmd.ExecuteScalarAsync(ct))?.ToString();

                report["assets_location_type"] = udtName;
                report["assets_location_correct"] = udtName == "geography";

                if (udtName is not null && udtName != "geography")
                    report["assets_location_hint"] =
                        "Cột Location phải là geography (không phải geometry) — nếu không, tính khoảng cách sẽ ra ĐỘ thay vì MÉT.";
            }
            catch (Exception ex)
            {
                report["assets_location_error"] = ex.Message;
            }

            // 5. GiST index trên Location
            try
            {
                var conn = _db.Database.GetDbConnection();
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT indexdef FROM pg_indexes
                    WHERE tablename = 'Assets' AND indexname = 'IX_Assets_Location';";
                var indexDef = (await cmd.ExecuteScalarAsync(ct))?.ToString();

                report["assets_location_gist_index"] = indexDef is not null && indexDef.Contains("gist", StringComparison.OrdinalIgnoreCase);
            }
            catch (Exception ex)
            {
                report["assets_location_index_error"] = ex.Message;
            }

            // 6. Đếm bản ghi từng bảng nghiệp vụ
            try
            {
                report["table_counts"] = new Dictionary<string, int>
                {
                    ["Assets"] = await _db.Assets.CountAsync(ct),
                    ["AssetUnits"] = await _db.AssetUnits.CountAsync(ct),
                    ["AssetMedia"] = await _db.AssetMedia.CountAsync(ct),
                    ["AssetDocuments"] = await _db.AssetDocuments.CountAsync(ct),
                    ["LeaseContracts"] = await _db.LeaseContracts.CountAsync(ct),
                    ["ContactParties"] = await _db.ContactParties.CountAsync(ct),
                    ["CashFlowEntries"] = await _db.CashFlowEntries.CountAsync(ct),
                    ["Reminders"] = await _db.Reminders.CountAsync(ct),
                    ["Equipments"] = await _db.Equipments.CountAsync(ct),
                    ["MaintenanceRecords"] = await _db.MaintenanceRecords.CountAsync(ct),
                    ["UsagePeriods"] = await _db.UsagePeriods.CountAsync(ct),
                    ["SaleListings"] = await _db.SaleListings.CountAsync(ct),
                    ["SaleListingBrokers"] = await _db.SaleListingBrokers.CountAsync(ct),
                    ["FileDeletionQueueItems"] = await _db.FileDeletionQueueItems.CountAsync(ct),
                    ["Properties"] = await _db.Properties.CountAsync(ct),
                    ["PropertyImages"] = await _db.PropertyImages.CountAsync(ct),
                    ["Users"] = await _db.Users.CountAsync(ct)
                };
            }
            catch (Exception ex)
            {
                report["table_counts_error"] = ex.Message;
                report["table_counts_hint"] = "Có bảng chưa được tạo — kiểm tra migration.";
            }

            // 7. Hangfire — bảng schema hangfire đã tạo chưa
            try
            {
                var conn = _db.Database.GetDbConnection();
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT COUNT(*) FROM information_schema.tables
                    WHERE table_schema = 'hangfire';";
                var count = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));

                report["hangfire_tables_count"] = count;
                report["hangfire_ready"] = count > 0;

                if (count == 0)
                    report["hangfire_hint"] = "Hangfire chưa khởi tạo schema — chạy app một lần để nó tự tạo bảng.";
            }
            catch (Exception ex)
            {
                report["hangfire_error"] = ex.Message;
            }

            // 8. Cấu hình Cloudinary (KHÔNG log ApiSecret)
            report["cloudinary_configured"] =
                !string.IsNullOrWhiteSpace(_cloudinary.Value.CloudName) &&
                !string.IsNullOrWhiteSpace(_cloudinary.Value.ApiKey) &&
                !string.IsNullOrWhiteSpace(_cloudinary.Value.ApiSecret);
            report["cloudinary_cloud_name"] = _cloudinary.Value.CloudName;

            report["environment"] = _env.EnvironmentName;
            report["server_time_utc"] = DateTime.UtcNow;
            report["status"] = "OK";

            return Ok(report);
        }

        /// <summary>
        /// GET /api/diagnostics/schema
        /// Liệt kê toàn bộ khoá ngoại + hành vi ON DELETE thực tế trong DB.
        /// Dùng để đối chiếu với bảng 3.1 trong tài liệu thiết kế — phát hiện sai lệch OnDelete.
        /// </summary>
        [HttpGet("schema")]
        public async Task<IActionResult> Schema(CancellationToken ct)
        {
            var conn = _db.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
                await conn.OpenAsync(ct);

            var foreignKeys = new List<object>();

            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT
                        tc.table_name        AS from_table,
                        kcu.column_name      AS from_column,
                        ccu.table_name       AS to_table,
                        rc.delete_rule       AS on_delete
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name = kcu.constraint_name
                    JOIN information_schema.constraint_column_usage ccu
                        ON tc.constraint_name = ccu.constraint_name
                    JOIN information_schema.referential_constraints rc
                        ON tc.constraint_name = rc.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                      AND tc.table_schema = 'public'
                      AND tc.table_name NOT LIKE 'AspNet%'
                    ORDER BY tc.table_name, kcu.column_name;";

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    foreignKeys.Add(new
                    {
                        FromTable = reader.GetString(0),
                        FromColumn = reader.GetString(1),
                        ToTable = reader.GetString(2),
                        OnDelete = reader.GetString(3)
                    });
                }
            }

            var indexes = new List<object>();
            await using (var cmd2 = conn.CreateCommand())
            {
                cmd2.CommandText = @"
                    SELECT tablename, indexname, indexdef
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND tablename NOT LIKE 'AspNet%'
                      AND indexname LIKE 'IX_%'
                    ORDER BY tablename, indexname;";

                await using var reader = await cmd2.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    indexes.Add(new
                    {
                        Table = reader.GetString(0),
                        Index = reader.GetString(1),
                        Definition = reader.GetString(2)
                    });
                }
            }

            return Ok(new
            {
                ForeignKeyCount = foreignKeys.Count,
                ForeignKeys = foreignKeys,
                IndexCount = indexes.Count,
                Indexes = indexes
            });
        }

        /// <summary>
        /// GET /api/diagnostics/postgis-test
        /// Kiểm tra PostGIS tính khoảng cách ĐÚNG ĐƠN VỊ MÉT.
        /// Dùng 2 điểm có khoảng cách thực tế đã biết để đối chiếu.
        /// </summary>
        [HttpGet("postgis-test")]
        public async Task<IActionResult> PostGisTest(CancellationToken ct)
        {
            var conn = _db.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
                await conn.OpenAsync(ct);

            // Bến Thành (10.7721, 106.6980) → Landmark 81 (10.7949, 106.7219)
            // Khoảng cách thực tế ~3.4 km
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT ST_Distance(
                    ST_SetSRID(ST_MakePoint(106.6980, 10.7721), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(106.7219, 10.7949), 4326)::geography
                );";

            var distanceMeters = Convert.ToDouble(await cmd.ExecuteScalarAsync(ct));

            var isCorrect = distanceMeters > 3000 && distanceMeters < 4000;

            return Ok(new
            {
                From = "Chợ Bến Thành (10.7721, 106.6980)",
                To = "Landmark 81 (10.7949, 106.7219)",
                DistanceMeters = Math.Round(distanceMeters, 2),
                DistanceKm = Math.Round(distanceMeters / 1000, 3),
                ExpectedApproxKm = "~3.4",
                Result = isCorrect ? "PASS — PostGIS trả về đúng đơn vị mét" : "FAIL — kiểm tra lại kiểu cột geography",
                IsCorrect = isCorrect
            });
        }
    }
}


/* ============================================================
   ⚠️ CHẶN Ở PRODUCTION — chọn 1 trong 2 cách:

   Cách 1 (khuyến nghị) — chỉ map controller này khi ở Development.
   Trong Program.cs, thay app.MapControllers() bằng:

       app.MapControllers();
       // và thêm filter loại bỏ DiagnosticsController ở production:
       // đơn giản nhất là dùng Cách 2 bên dưới.

   Cách 2 — thêm attribute kiểm tra environment ngay trong action.
   Thêm đoạn này vào đầu MỖI action:

       if (!_env.IsDevelopment())
           return NotFound();

   Hoặc tạo một ActionFilter dùng chung:

   public sealed class DevelopmentOnlyAttribute : ActionFilterAttribute
   {
       public override void OnActionExecuting(ActionExecutingContext context)
       {
           var env = context.HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>();
           if (!env.IsDevelopment())
               context.Result = new NotFoundResult();
       }
   }

   Rồi gắn [DevelopmentOnly] lên class DiagnosticsController.
   ============================================================ */