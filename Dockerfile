# ============================
# BUILD IMAGE
# ============================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# ── Install native SkiaSharp dependencies into the build container ──
# This ensures any design-time / build-time SkiaSharp initialization
# (or test runs during build) won't fail with missing libfontconfig.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libfontconfig1 \
        libfreetype6 \
        libgl1 \
        libx11-6 \
        libicu-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Pre-copy DevExpress local NuGet feed if present ──────
# If nuget-packages folder exists, copy it into the build image
COPY nuget-packages/ /src/nuget-packages/

# ── Copy solution file ──────────────────────────────────
COPY ["ServiceMaintenanceApplication.sln", "./"]

# ── Copy ALL .csproj files (layer-cache friendly) ───────
COPY ["src/Apps/ServiceMaintenance/ServiceMaintenance.csproj",                                             "src/Apps/ServiceMaintenance/"]
COPY ["src/Core/ServiceMaintenance.Models/ServiceMaintenance.Models.csproj",                               "src/Core/ServiceMaintenance.Models/"]
COPY ["src/Shared/ServiceMaintenance.Infrastructure.Shared/ServiceMaintenance.Infrastructure.Shared.csproj", "src/Shared/ServiceMaintenance.Infrastructure.Shared/"]
COPY ["src/APIs/UserManagementAPI/UserManagementAPI.csproj",                                               "src/APIs/UserManagementAPI/"]
COPY ["src/APIs/EmployeeManagement.Api/EmployeeManagement.Api.csproj",                                   "src/APIs/EmployeeManagement.Api/"]
COPY ["src/Core/EmployeeManagement.Models/EmployeeManagement.Models.csproj",                             "src/Core/EmployeeManagement.Models/"]
COPY ["src/APIs/TechnicalService.API/TechnicalService.API.csproj",                                       "src/APIs/TechnicalService.API/"]
COPY ["src/Core/TechnicalService.Domain/TechnicalService.Domain.csproj",                                 "src/Core/TechnicalService.Domain/"]
COPY ["src/Shared/TechnicalService.Infrastructure/TechnicalService.Infrastructure.csproj",                 "src/Shared/TechnicalService.Infrastructure/"]

# ── Generate nuget.config for DevExpress local feed ─────
RUN echo '<?xml version="1.0" encoding="utf-8"?>' > nuget.config && \
    echo '<configuration>' >> nuget.config && \
    echo '  <packageSources>' >> nuget.config && \
    echo '    <add key="local-devexpress" value="/src/nuget-packages" />' >> nuget.config && \
    echo '    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />' >> nuget.config && \
    echo '  </packageSources>' >> nuget.config && \
    echo '  <packageSourceMapping>' >> nuget.config && \
    echo '    <packageSource key="local-devexpress">' >> nuget.config && \
    echo '      <package pattern="DevExpress.*" />' >> nuget.config && \
    echo '    </packageSource>' >> nuget.config && \
    echo '    <packageSource key="nuget.org">' >> nuget.config && \
    echo '      <package pattern="*" />' >> nuget.config && \
    echo '  </packageSource>' >> nuget.config && \
    echo '  </packageSourceMapping>' >> nuget.config && \
    echo '</configuration>' >> nuget.config

# ── Restore (layer-cached until a .csproj changes) ──────
RUN dotnet restore "src/Apps/ServiceMaintenance/ServiceMaintenance.csproj" \
    --configfile nuget.config \
    -r linux-x64
RUN dotnet restore "src/APIs/UserManagementAPI/UserManagementAPI.csproj"                 --configfile nuget.config
RUN dotnet restore "src/APIs/EmployeeManagement.Api/EmployeeManagement.Api.csproj" --configfile nuget.config
RUN dotnet restore "src/APIs/TechnicalService.API/TechnicalService.API.csproj"     --configfile nuget.config

# ── Copy all remaining source files ─────────────────────
COPY . .

# ── Build ────────────────────────────────────────────────
WORKDIR "/src/src/Apps/ServiceMaintenance"
RUN dotnet build "ServiceMaintenance.csproj" \
    -c $BUILD_CONFIGURATION \
    -r linux-x64 \
    --self-contained false \
    -o /app/build/servicemaintenance

WORKDIR "/src/src/APIs/UserManagementAPI"
RUN dotnet build "UserManagementAPI.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/build/usermanagementapi

WORKDIR "/src/src/APIs/EmployeeManagement.Api"
RUN dotnet build "EmployeeManagement.Api.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/build/employeemanagementapi

WORKDIR "/src/src/APIs/TechnicalService.API"
RUN dotnet build "TechnicalService.API.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/build/technicalserviceapi

# ============================
# PUBLISH IMAGE
# ============================
FROM build AS publish
ARG BUILD_CONFIGURATION=Release

WORKDIR "/src/src/Apps/ServiceMaintenance"
RUN dotnet publish "ServiceMaintenance.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/publish/servicemaintenance \
    -r linux-x64 \
    --self-contained false \
    /p:UseAppHost=false \
    /p:ErrorOnDuplicatePublishOutputFiles=false

WORKDIR "/src/src/APIs/UserManagementAPI"
RUN dotnet publish "UserManagementAPI.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/publish/usermanagementapi \
    /p:UseAppHost=false \
    /p:ErrorOnDuplicatePublishOutputFiles=false

WORKDIR "/src/src/APIs/EmployeeManagement.Api"
RUN dotnet publish "EmployeeManagement.Api.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/publish/employeemanagementapi \
    /p:UseAppHost=false \
    /p:ErrorOnDuplicatePublishOutputFiles=false

WORKDIR "/src/src/APIs/TechnicalService.API"
RUN dotnet publish "TechnicalService.API.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/publish/technicalserviceapi \
    /p:UseAppHost=false \
    /p:ErrorOnDuplicatePublishOutputFiles=false

# ============================
# FINAL RUNTIME IMAGE: ServiceMaintenance (Blazor UI)
# ============================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS servicemaintenance
WORKDIR /app
EXPOSE 8080

RUN apt-get update && apt-get install -y --no-install-recommends \
        libfontconfig1 \
        libfreetype6 \
        libgl1 \
        libx11-6 \
        libicu-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish/servicemaintenance .
ENTRYPOINT ["dotnet", "ServiceMaintenance.dll"]

# ============================
# FINAL RUNTIME IMAGE: UserManagementAPI
# ============================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS usermanagementapi
WORKDIR /app
EXPOSE 8080
COPY --from=publish /app/publish/usermanagementapi .
ENTRYPOINT ["dotnet", "UserManagementAPI.dll"]

# ============================
# FINAL RUNTIME IMAGE: TechnicalService.API
# ============================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS technicalserviceapi
WORKDIR /app
EXPOSE 8080
COPY --from=publish /app/publish/technicalserviceapi .
ENTRYPOINT ["dotnet", "TechnicalService.API.dll"]

# ============================
# FINAL RUNTIME IMAGE: EmployeeManagement.Api
# ============================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS employeemanagementapi
WORKDIR /app
EXPOSE 8081
COPY --from=publish /app/publish/employeemanagementapi .
ENTRYPOINT ["dotnet", "EmployeeManagement.Api.dll"]