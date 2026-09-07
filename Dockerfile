# ==========================================
# ASP.NET Core 8 Multi-Stage Production Dockerfile
# Optimized for Microservices on DigitalOcean
# ==========================================

# ── Stage 1: Build & Restore ──
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Install build-time native dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        libfontconfig1 \
        libfreetype6 \
        libgl1 \
        libx11-6 \
        libicu-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy local NuGet packages if present (e.g. DevExpress)
COPY nuget-packages/ /src/nuget-packages/

# Copy solution file
COPY ["ServiceMaintenanceApplication.sln", "./"]

# Copy project files for layer caching
COPY ["src/Core/ServiceMaintenance.Models/ServiceMaintenance.Models.csproj",                               "src/Core/ServiceMaintenance.Models/"]
COPY ["src/Shared/ServiceMaintenance.Infrastructure.Shared/ServiceMaintenance.Infrastructure.Shared.csproj", "src/Shared/ServiceMaintenance.Infrastructure.Shared/"]
COPY ["src/APIs/UserManagementAPI/UserManagementAPI.csproj",                                               "src/APIs/UserManagementAPI/"]
COPY ["src/APIs/EmployeeManagement.Api/EmployeeManagement.Api.csproj",                                   "src/APIs/EmployeeManagement.Api/"]
COPY ["src/Core/EmployeeManagement.Models/EmployeeManagement.Models.csproj",                             "src/Core/EmployeeManagement.Models/"]
COPY ["src/APIs/TechnicalService.API/TechnicalService.API.csproj",                                       "src/APIs/TechnicalService.API/"]
COPY ["src/Core/TechnicalService.Domain/TechnicalService.Domain.csproj",                                 "src/Core/TechnicalService.Domain/"]
COPY ["src/Shared/TechnicalService.Infrastructure/TechnicalService.Infrastructure.csproj",                 "src/Shared/TechnicalService.Infrastructure/"]

# Generate nuget.config
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
    echo '    </packageSource>' >> nuget.config && \
    echo '  </packageSourceMapping>' >> nuget.config && \
    echo '</configuration>' >> nuget.config

# Restore dependencies
RUN dotnet restore "src/APIs/TechnicalService.API/TechnicalService.API.csproj"     --configfile nuget.config
RUN dotnet restore "src/APIs/UserManagementAPI/UserManagementAPI.csproj"                 --configfile nuget.config
RUN dotnet restore "src/APIs/EmployeeManagement.Api/EmployeeManagement.Api.csproj" --configfile nuget.config

# Copy all source files
COPY . .

# ── Stage 2: Publish ──
FROM build AS publish
ARG BUILD_CONFIGURATION=Release

WORKDIR "/src/src/APIs/TechnicalService.API"
RUN dotnet publish "TechnicalService.API.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/publish/technicalserviceapi \
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

# ==========================================
# FINAL RUNTIME IMAGE: TechnicalService.API
# ==========================================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS technicalserviceapi
WORKDIR /app
EXPOSE 8000
ENV ASPNETCORE_HTTP_PORTS=8000
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
ENV TZ=Asia/Phnom_Penh

# Install runtime libraries for internationalization
RUN apt-get update && apt-get install -y --no-install-recommends \
        libicu-dev \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish/technicalserviceapi .
ENTRYPOINT ["dotnet", "TechnicalService.API.dll"]

# ==========================================
# FINAL RUNTIME IMAGE: UserManagementAPI
# ==========================================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS usermanagementapi
WORKDIR /app
EXPOSE 8087
ENV ASPNETCORE_HTTP_PORTS=8087
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
ENV TZ=Asia/Phnom_Penh

# Install native libraries for ArcFace AI ONNX runtime & ImageSharp
RUN apt-get update && apt-get install -y --no-install-recommends \
        libfontconfig1 \
        libfreetype6 \
        libgl1 \
        libx11-6 \
        libicu-dev \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish/usermanagementapi .
ENTRYPOINT ["dotnet", "UserManagementAPI.dll"]

# ==========================================
# FINAL RUNTIME IMAGE: EmployeeManagement.Api
# ==========================================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS employeemanagementapi
WORKDIR /app
EXPOSE 8081
ENV ASPNETCORE_HTTP_PORTS=8081
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
ENV TZ=Asia/Phnom_Penh

RUN apt-get update && apt-get install -y --no-install-recommends \
        libicu-dev \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish/employeemanagementapi .
ENTRYPOINT ["dotnet", "EmployeeManagement.Api.dll"]