# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# This stage is used when running from VS in fast mode (Default for Debug configuration)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 5002
ENV ASPNETCORE_URLS=http://+:5002

# This stage is used to build the service project
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["TechnicalService.API/TechnicalService.API.csproj", "TechnicalService.API/"]
COPY ["TechnicalService.Domain/TechnicalService.Domain.csproj", "TechnicalService.Domain/"]
COPY ["TechnicalService.Infrastructure/TechnicalService.Infrastructure.csproj", "TechnicalService.Infrastructure/"]
RUN dotnet restore "./TechnicalService.API/TechnicalService.API.csproj"
COPY . .
WORKDIR "/src/TechnicalService.API"
RUN dotnet build "./TechnicalService.API.csproj" -c $BUILD_CONFIGURATION -o /app/build

# This stage is used to publish the service project to be copied to the final stage
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./TechnicalService.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# This stage is used in production or when running from VS in regular mode (Default when not using the Debug configuration)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "TechnicalService.API.dll"]