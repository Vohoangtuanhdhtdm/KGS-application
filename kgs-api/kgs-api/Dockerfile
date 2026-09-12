# API nghiệp vụ KGS — ASP.NET Core 8.
#
# Ngữ cảnh build là thư mục kgs-api/ (nơi chứa .sln):
#     docker build -f kgs-api/Dockerfile -t kgs-api ./kgs-api
#
# Khác với bản Visual Studio sinh ra ban đầu, bản này:
#   • chỉ mở một cổng HTTP (8080) — TLS kết thúc ở nginx/CloudFront, container không giữ
#     chứng chỉ nào;
#   • có HEALTHCHECK để docker compose biết khi nào API thực sự phục vụ được;
#   • chép đúng .csproj trước khi restore, nên sửa mã nguồn không kéo theo restore lại.

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Lớp restore tách riêng: chỉ dựng lại khi .csproj đổi.
COPY ["kgs-api/kgs-api.csproj", "kgs-api/"]
RUN dotnet restore "./kgs-api/kgs-api.csproj"

COPY . .
WORKDIR "/src/kgs-api"
RUN dotnet publish "./kgs-api.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/publish \
    /p:UseAppHost=false


FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# curl cho HEALTHCHECK. Ảnh aspnet không có sẵn, và không có nó thì chỉ thị HEALTHCHECK
# luôn báo unhealthy — container tốt cũng bị compose coi là hỏng.
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Kestrel chỉ nghe HTTP. Mặc định của ảnh .NET 8 đã là 8080, nhưng ghi ra tường minh để
# người đọc Dockerfile không phải tra tài liệu mới biết ánh xạ cổng nào là đúng.
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true

COPY --from=build /app/publish .

# APP_UID là người dùng không phải root do ảnh nền của Microsoft tạo sẵn.
USER $APP_UID
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "kgs-api.dll"]
