# EmployeeManagement.Api — Index

ASP.NET Core (net8.0) Web API for employee/customer/user management: CRUD over Employees, Departments, Customers, CustomerTypes, and Users backed by SQL Server via EF Core. Domain model classes (`Employee`, `Department`, `Customer`, `CustomerType`, `User`, `PagedResponse<T>`, `Gender`) live in the referenced `EmployeeManagement.Models` project, not here. Swagger UI is mounted at root (`/`).

## Entry Points

- `src/APIs/EmployeeManagement.Api/Program.cs` — host bootstrap.
  - `Main(string[])` — builds and runs the host.
  - `CreateHostBuilder(string[])` — configures `Startup`.
- `src/APIs/EmployeeManagement.Api/Startup.cs` — DI + middleware pipeline.
  - `ConfigureServices(IServiceCollection)` — registers `AppDbContext` (SQL Server, conn string `DBConnection`), DI bindings for all repositories (`IDepartmentRepository`→`DepartmentRepository`, `IEmployeeRepository`→`EmployeeRepository`, `ICustomerTypeRespository`→`CustomerTypeRepository`, `ICustomerRespository`→`CustomerRepository`, `IUserRepository`→`UserRepository`), Swagger ("Customers API" v1).
  - `Configure(IApplicationBuilder, IWebHostEnvironment)` — dev exception page, HTTPS redirect, Swagger/SwaggerUI at root, routing, `MapControllers()`.

## Controllers

- `src/APIs/EmployeeManagement.Api/Controllers/CustomerController.cs` — Customer CRUD + search/pagination. Route: `api/[controller]` → `api/Customer`.
  - `GET api/Customer` (`GetCustomers`, query: pageNumber, pageSize, searchTerm, isActive) — list all, or paginated+filtered if pageNumber & pageSize given; shadows `CustomerType.Type` into result.
  - `GET api/Customer/{id}` (`GetCustomerById(Guid)`) — fetch one, 404 if missing.
  - `POST api/Customer` (`CreateCustomer(Customer)`) — creates, sets Id/CreatedAt/ModifiedAt.
  - `PUT api/Customer/{id}` (`UpdateCustomer(Guid, Customer)`) — 400 on id mismatch, 404 if not found.
  - `DELETE api/Customer/{id}` (`DeleteCustomer(Guid)`) — 404 if not found.
  - Private helpers: `GetAllCustomers()`, `GetCustomersPaginated(int,int,string,bool?)` (pageSize clamped 1-100).
- `src/APIs/EmployeeManagement.Api/Controllers/CustomerTypeController.cs` — CustomerType CRUD + search/pagination. Route: `api/[controller]` → `api/CustomerType`.
  - `GET api/CustomerType` (`GetCustomerTypes`, query: pageNumber, pageSize, searchTerm) — list all or paginated.
  - `GET api/CustomerType/{id}` (`GetCustomerTypeById(int)`) — fetch one by `ListId`, 404 if missing.
  - `POST api/CustomerType` (`CreateCustomerType(CustomerType)`) — creates, sets CreatedAt/ModifiedAt.
  - `PUT api/CustomerType/{id}` (`UpdateCustomerType(int, CustomerType)`) — 400 on id mismatch, 404 if not found.
  - `DELETE api/CustomerType/{id}` (`DeleteCustomerType(int)`) — 404 if not found.
  - Private helpers: `GetAllCustomerTypes()`, `GetCustomerTypesPaginated(int,int,string)` (pageSize clamped 1-100).
- `src/APIs/EmployeeManagement.Api/Controllers/DepartmentsController.cs` — read-only Department lookup. Route: `api/[controller]` → `api/Departments`.
  - `GET api/Departments` (`GetDepartments`) — list all.
  - `GET api/Departments/{id:int}` (`GetDepartment(int)`) — fetch one, 404 if missing.
- `src/APIs/EmployeeManagement.Api/Controllers/EmployeesController.cs` — Employee CRUD + search. Route: `api/[controller]` → `api/Employees`. Note: has a dead/commented-out `[HttpGet]` block above the live `GetEmployees`.
  - `GET api/Employees` (`GetEmployees`) — list all.
  - `GET api/Employees/{id:int}` (`GetEmployee(int)`) — fetch one (includes `Department`), 404 if missing.
  - `POST api/Employees` (`CreateEmployee(Employee)`) — creates (email-uniqueness check is commented out).
  - `PUT api/Employees` (`UpdateEmployee(Employee)`) — id comes from body (`employee.EmployeeId`), not route; 404 if not found.
  - `DELETE api/Employees/{id:int}` (`DeleteEmployee(int)`) — 404 if not found.
  - `GET api/Employees/{search}` (`Search(string name, Gender? gender)`) — filters by name substring (first/last) and/or gender; 404 if no results.
- `src/APIs/EmployeeManagement.Api/Controllers/UsersController.cs` — User CRUD + search. Route: `api/[controller]` → `api/Users`.
  - `GET api/Users` (`GetUsers`) — list all.
  - `GET api/Users/{id}` (`GetUser(string)`) — fetch one, 404 if missing.
  - `POST api/Users` (`CreateUser(User)`) — creates; 400 if email already in use (`ValidateUserByEmail`).
  - `PUT api/Users` (`UpdateUser(User)`) — id comes from body (`user.Id`); 404 if not found.
  - `DELETE api/Users/{id}` (`DeleteUser(string)`) — 404 if not found.
  - `GET api/Users/search` (`Search(string name, string email)`) — filters by username/email substring; 404 if no results.

## Models (DbContext, repositories, interfaces)

- `src/APIs/EmployeeManagement.Api/Models/AppDBContext.cs` — **`AppDbContext : DbContext`**, the EF Core context. High-value for "find where table X is used":
  - `DbSet<User> Users` → `Users` table
  - `DbSet<Employee> Employees` → `Employees` table
  - `DbSet<Department> Departments` → `Departments` table
  - `DbSet<CustomerType> CustomerTypes` → `CustomerTypes` table
  - `DbSet<Customer> Customers` → `Customers` table
  - `OnModelCreating(ModelBuilder)` — seeds 4 `Department` rows (IT/HR/Payroll/Admin) and 4 `Employee` rows (John/Sam/Mary/Sara) via `HasData`.
- `src/APIs/EmployeeManagement.Api/Models/ICustomerRespository.cs` — `ICustomerRespository` interface: `CreateCustomer`, `GetCustomers`, `GetCustomerById(Guid)`, `GetCustomersPaginated(int,int,string,bool?)`, `UpdateCustomer`, `DeleteCustomer(Guid)`.
- `src/APIs/EmployeeManagement.Api/Models/CustomerRespository.cs` — `CustomerRepository : ICustomerRespository`, uses `AppDbContext`.
  - `CreateCustomer(Customer)` — assigns Id/CreatedAt/ModifiedAt, saves, loads `CustomerType` nav prop.
  - `GetCustomers()` — all customers with `CustomerType` included.
  - `GetCustomerById(Guid)` — single, with `CustomerType` included.
  - `GetCustomersPaginated(int,int,string,bool?)` — filters by `isActive` and multi-word case-insensitive LIKE search across CompanyName/ContactName/PhoneNumber/Email/Address; orders by CompanyName.
  - `UpdateCustomer(Customer)` — in-place field update + `ModifiedAt`, reloads `CustomerType`.
  - `DeleteCustomer(Guid)` — find + remove.
- `src/APIs/EmployeeManagement.Api/Models/ICustomerTypeRespository.cs` — `ICustomerTypeRespository` interface: `CreateCustomerType`, `GetCustomerTypes`, `GetCustomerTypeById(int)`, `GetCustomerTypesPaginated(int,int,string)`, `UpdateCustomerType`, `DeleteCustomerType(int)`.
- `src/APIs/EmployeeManagement.Api/Models/CustomerTypeRespository.cs` — `CustomerTypeRepository : ICustomerTypeRespository`, uses `AppDbContext`.
  - `CreateCustomerType(CustomerType)` — sets CreatedAt/ModifiedAt, saves.
  - `GetCustomerTypes()` — all.
  - `GetCustomerTypeById(int)` — by `ListId`.
  - `GetCustomerTypesPaginated(int,int,string)` — `Type.Contains(searchTerm)` filter, ordered by Type.
  - `UpdateCustomerType(CustomerType)` — updates `Type`/`ModifiedBy`/`ModifiedAt`.
  - `DeleteCustomerType(int)` — find by `ListId` + remove.
- `src/APIs/EmployeeManagement.Api/Models/IDepartmentRespository.cs` — `IDepartmentRepository` interface: `GetDepartments()`, `GetDepartment(int)`.
- `src/APIs/EmployeeManagement.Api/Models/DepartmentRepository.cs` — `DepartmentRepository : IDepartmentRepository`, uses `AppDbContext`.
  - `GetDepartment(int departmentId)` — single by id.
  - `GetDepartments()` — all.
- `src/APIs/EmployeeManagement.Api/Models/IEmployeeRepository.cs` — `IEmployeeRepository` interface: `GetEmployees`, `GetEmployee(int)`, `ValidateEmployeeByEmail(string)`, `Search(string,Gender?)`, `AddEmployee`, `UpdateEmployee`, `DeleteEmployee(int)`.
- `src/APIs/EmployeeManagement.Api/Models/EmployeeRepository.cs` — `EmployeeRepository : IEmployeeRepository`, uses `AppDbContext`.
  - `GetEmployees()` — all.
  - `GetEmployee(int employeeId)` — single, includes `Department`.
  - `ValidateEmployeeByEmail(string email)` — lookup by exact email (used for uniqueness checks, currently unused by controller).
  - `Search(string name, Gender? gender)` — filters by FirstName/LastName `Contains(name)` and/or Gender.
  - `AddEmployee(Employee)` — adds + saves.
  - `UpdateEmployee(Employee)` — in-place update of FirstName/LastName/Email/DateOfBrith/Gender/DepartmentId/PhotoPath.
  - `DeleteEmployee(int employeeId)` — find by id + remove.
- `src/APIs/EmployeeManagement.Api/Models/IUserRepository.cs` — `IUserRepository` interface: `GetUser(string)`, `GetUsers()`, `AddUser`, `UpdateUser`, `DeleteUser(string)`, `Search(string,string)`, `ValidateUserByEmail(string)`.
- `src/APIs/EmployeeManagement.Api/Models/UserRepository.cs` — `UserRepository : IUserRepository` (top-level class, no namespace), uses `AppDbContext`.
  - `GetUser(string id)` — `FindAsync`.
  - `GetUsers()` — all.
  - `AddUser(User)` — adds + saves.
  - `UpdateUser(User)` — `_context.Users.Update(user)` + saves.
  - `DeleteUser(string id)` — find + remove.
  - `Search(string name, string email)` — filters by `UserName.Contains(name)` and/or `Email.Contains(email)`.
  - `ValidateUserByEmail(string email)` — lookup by exact email.

## Migrations

- `src/APIs/EmployeeManagement.Api/Migrations/` — EF Core migration history (`20250121073319_NewDB2`, `20250121073925_NewDB3`); see `Migrations/AppDbContextModelSnapshot.cs` for current schema. `*.Designer.cs` files are auto-generated boilerplate, not enumerated here.
