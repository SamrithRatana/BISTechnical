using EmployeeManagement.Api.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;

namespace EmployeeManagement.Api
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        // This method gets called by the runtime. Use this method to add services to the container.
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddControllers();

            var connectionString = Configuration.GetConnectionString("DBConnection");

            // Fail at startup rather than on the first request: without this the
            // app booted happily and every endpoint returned a 500 instead.
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    "Connection string 'DBConnection' is not configured. " +
                    "Add it to appsettings.json or the environment before starting the API.");
            }

            services.AddDbContext<AppDbContext>(options =>
                options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure()));

            services.AddScoped<IDepartmentRepository, DepartmentRepository>();
            services.AddScoped<IEmployeeRepository, EmployeeRepository>();
            services.AddScoped<ICustomerTypeRepository, CustomerTypeRepository>();
            services.AddScoped<ICustomerRepository, CustomerRepository>();
            services.AddScoped<IUserRepository, UserRepository>();

            // AddControllersWithViews() and AddRazorPages() were registered here
            // but this project has no Views and no Pages; they only added MVC
            // services and startup cost.

            services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
                {
                    Title = "Customers API",
                    Version = "v1"
                });
            });
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IWebHostEnvironment env, ILoggerFactory loggerFactory)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                // Outside development an unhandled exception previously fell
                // through to the host, which returns an empty 500 with no log
                // entry of its own. This logs it and returns a ProblemDetails
                // body without leaking the exception text.
                app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
                {
                    var feature = context.Features.Get<IExceptionHandlerPathFeature>();
                    var logger = loggerFactory.CreateLogger("UnhandledException");
                    logger.LogError(feature?.Error, "Unhandled exception for {Path}.", feature?.Path);

                    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                    context.Response.ContentType = "application/problem+json";
                    await context.Response.WriteAsync(
                        "{\"title\":\"An unexpected error occurred.\",\"status\":500}");
                }));
            }

            app.UseHttpsRedirection();

            // Swagger describes every endpoint and payload shape, so it is served
            // only in development unless "Swagger:Enabled" is explicitly set true.
            if (env.IsDevelopment() || Configuration.GetValue<bool>("Swagger:Enabled"))
            {
                app.UseSwagger();
                app.UseSwaggerUI(c =>
                {
                    c.SwaggerEndpoint("/swagger/v1/swagger.json", "BIS v1");
                    c.RoutePrefix = string.Empty; // Serve the UI at the site root.
                });
            }

            app.UseRouting();
            app.UseAuthorization();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();
            });
        }
    }
}
