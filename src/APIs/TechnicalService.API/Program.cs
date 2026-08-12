using TechnicalService.API.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.AddApplicationServices();
builder.Services.AddProblemDetails();

var withApiVersioning = builder.Services.AddApiVersioning();

builder.AddDefaultOpenApi(withApiVersioning);

var app = builder.Build();

var repairs = app.NewVersionedApi("Repairs");
repairs.MapRepairsApiV1();

app.UseDefaultOpenApi();
app.Run();