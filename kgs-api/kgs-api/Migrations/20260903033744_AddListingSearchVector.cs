using Microsoft.EntityFrameworkCore.Migrations;
using NpgsqlTypes;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddListingSearchVector : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // unaccent() cua PostgreSQL KHONG duoc danh dau IMMUTABLE, nen khong dung
            // truc tiep trong generated column duoc. Boc lai bang mot ham IMMUTABLE —
            // day la cach lam chuan duoc khuyen nghi trong tai lieu PostgreSQL.
            migrationBuilder.Sql(@"
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, $1)
$$;
");

            migrationBuilder.AddColumn<NpgsqlTsVector>(
                name: "SearchVector",
                table: "Listings",
                type: "tsvector",
                nullable: true,
                computedColumnSql: "to_tsvector('simple', f_unaccent(coalesce(\"Title\", '') || ' ' || coalesce(\"Description\", '')))",
                stored: true);

            migrationBuilder.CreateIndex(
                name: "IX_Listings_SearchVector",
                table: "Listings",
                column: "SearchVector")
                .Annotation("Npgsql:IndexMethod", "gin");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Listings_SearchVector",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "SearchVector",
                table: "Listings");

            migrationBuilder.Sql("DROP FUNCTION IF EXISTS f_unaccent(text);");
        }
    }
}
