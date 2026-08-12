using EmployeeManagement.Api.Models;
using EmployeeManagement.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Produces("application/json")]
    public class CustomerController : ControllerBase
    {
        private readonly ICustomerRespository customerRepository;
        private readonly ILogger<CustomerController> _logger;

        public CustomerController(ICustomerRespository customerRepository, ILogger<CustomerController> logger)
        {
            this.customerRepository = customerRepository;
            _logger = logger;
        }

        /// <summary>
        /// Get customers with optional pagination
        /// GET: api/customer (returns all)
        /// GET: api/customer?pageNumber=1&pageSize=10 (returns paginated)
        /// GET: api/customer?pageNumber=1&pageSize=10&searchTerm=abc&isActive=true
        /// </summary>
        [HttpGet]
        public async Task<ActionResult> GetCustomers(
            [FromQuery] int? pageNumber = null,
            [FromQuery] int? pageSize = null,
            [FromQuery] string searchTerm = null,
            [FromQuery] bool? isActive = null)
        {
            try
            {
                if (pageNumber.HasValue && pageSize.HasValue)
                {
                    return await GetCustomersPaginated(pageNumber.Value, pageSize.Value, searchTerm, isActive);
                }
                else
                {
                    return await GetAllCustomers();
                }
            }
            catch (SqlException sqlEx)
            {
                _logger.LogError($"SQL Error: {sqlEx.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"SQL Error: An error occurred while retrieving customers. {sqlEx.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError($"General Error: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"Error retrieving customers: {ex.Message}");
            }
        }

        private async Task<ActionResult> GetAllCustomers()
        {
            var customers = await customerRepository.GetCustomers();

            var customersWithType = customers.Select(c => new
            {
                c.Id,
                c.CreatedBy,
                c.CreatedAt,
                c.ModifiedBy,
                c.ModifiedAt,
                c.CompanyName,
                c.Address,
                c.ContactName,
                c.PhoneNumber,
                c.Email,
                c.CustomerTypeListId,
                c.IsActive,
                CustomerType = c.CustomerType?.Type
            }).ToList();

            Response.ContentType = "application/json";
            return Ok(customersWithType);
        }

        private async Task<ActionResult> GetCustomersPaginated(
            int pageNumber,
            int pageSize,
            string searchTerm = null,
            bool? isActive = null)
        {
            if (pageNumber < 1)
                pageNumber = 1;

            if (pageSize < 1)
                pageSize = 10;

            if (pageSize > 100)
                pageSize = 100;

            var (items, totalCount) = await customerRepository.GetCustomersPaginated(
                pageNumber,
                pageSize,
                searchTerm,
                isActive);

            var customersWithType = items.Select(c => new
            {
                c.Id,
                c.CreatedBy,
                c.CreatedAt,
                c.ModifiedBy,
                c.ModifiedAt,
                c.CompanyName,
                c.Address,
                c.ContactName,
                c.PhoneNumber,
                c.Email,
                c.CustomerTypeListId,
                c.IsActive,
                CustomerType = c.CustomerType?.Type
            }).ToList();

            var pagedResponse = new PagedResponse<object>(
                customersWithType,
                pageNumber,
                pageSize,
                totalCount);

            Response.ContentType = "application/json";
            return Ok(pagedResponse);
        }

        /// <summary>
        /// Get customer by ID
        /// GET: api/customer/{id}
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetCustomerById(Guid id)
        {
            try
            {
                var customer = await customerRepository.GetCustomerById(id);

                if (customer == null)
                {
                    return NotFound($"Customer with ID = {id} not found.");
                }

                var customerWithType = new
                {
                    customer.Id,
                    customer.CreatedBy,
                    customer.CreatedAt,
                    customer.ModifiedBy,
                    customer.ModifiedAt,
                    customer.CompanyName,
                    customer.Address,
                    customer.ContactName,
                    customer.PhoneNumber,
                    customer.Email,
                    customer.CustomerTypeListId,
                    customer.IsActive,
                    CustomerType = customer.CustomerType?.Type
                };

                Response.ContentType = "application/json";
                return Ok(customerWithType);
            }
            catch (SqlException sqlEx)
            {
                _logger.LogError($"SQL Error: {sqlEx.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"SQL Error: An error occurred while retrieving the customer with ID = {id}. {sqlEx.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError($"General Error: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"Error retrieving the customer with ID = {id}: {ex.Message}");
            }
        }

        /// <summary>
        /// Create a new customer
        /// POST: api/customer
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<Customer>> CreateCustomer([FromBody] Customer customer)
        {
            try
            {
                if (customer == null)
                {
                    return BadRequest("Customer data is required.");
                }

                // Set creation metadata
                customer.Id = Guid.NewGuid();
                customer.CreatedAt = DateTime.UtcNow;
                customer.ModifiedAt = DateTime.UtcNow;

                var createdCustomer = await customerRepository.CreateCustomer(customer);

                var customerWithType = new
                {
                    createdCustomer.Id,
                    createdCustomer.CreatedBy,
                    createdCustomer.CreatedAt,
                    createdCustomer.ModifiedBy,
                    createdCustomer.ModifiedAt,
                    createdCustomer.CompanyName,
                    createdCustomer.Address,
                    createdCustomer.ContactName,
                    createdCustomer.PhoneNumber,
                    createdCustomer.Email,
                    createdCustomer.CustomerTypeListId,
                    createdCustomer.IsActive,
                    CustomerType = createdCustomer.CustomerType?.Type
                };

                Response.ContentType = "application/json";
                return CreatedAtAction(nameof(GetCustomerById),
                    new { id = createdCustomer.Id },
                    customerWithType);
            }
            catch (SqlException sqlEx)
            {
                _logger.LogError($"SQL Error: {sqlEx.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"SQL Error: An error occurred while creating the customer. {sqlEx.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError($"General Error: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"Error creating customer: {ex.Message}");
            }
        }

        /// <summary>
        /// Update an existing customer
        /// PUT: api/customer/{id}
        /// </summary>
        [HttpPut("{id}")]
        public async Task<ActionResult<Customer>> UpdateCustomer(Guid id, [FromBody] Customer customer)
        {
            try
            {
                if (customer == null)
                {
                    return BadRequest("Customer data is required.");
                }

                if (id != customer.Id)
                {
                    return BadRequest("Customer ID mismatch.");
                }

                var existingCustomer = await customerRepository.GetCustomerById(id);
                if (existingCustomer == null)
                {
                    return NotFound($"Customer with ID = {id} not found.");
                }

                var updatedCustomer = await customerRepository.UpdateCustomer(customer);

                var customerWithType = new
                {
                    updatedCustomer.Id,
                    updatedCustomer.CreatedBy,
                    updatedCustomer.CreatedAt,
                    updatedCustomer.ModifiedBy,
                    updatedCustomer.ModifiedAt,
                    updatedCustomer.CompanyName,
                    updatedCustomer.Address,
                    updatedCustomer.ContactName,
                    updatedCustomer.PhoneNumber,
                    updatedCustomer.Email,
                    updatedCustomer.CustomerTypeListId,
                    updatedCustomer.IsActive,
                    CustomerType = updatedCustomer.CustomerType?.Type
                };

                Response.ContentType = "application/json";
                return Ok(customerWithType);
            }
            catch (SqlException sqlEx)
            {
                _logger.LogError($"SQL Error: {sqlEx.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"SQL Error: An error occurred while updating the customer. {sqlEx.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError($"General Error: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"Error updating customer: {ex.Message}");
            }
        }

        /// <summary>
        /// Delete a customer
        /// DELETE: api/customer/{id}
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteCustomer(Guid id)
        {
            try
            {
                var customer = await customerRepository.GetCustomerById(id);
                if (customer == null)
                {
                    return NotFound($"Customer with ID = {id} not found.");
                }

                await customerRepository.DeleteCustomer(id);

                return Ok(new { message = $"Customer with ID = {id} deleted successfully." });
            }
            catch (SqlException sqlEx)
            {
                _logger.LogError($"SQL Error: {sqlEx.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"SQL Error: An error occurred while deleting the customer. {sqlEx.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError($"General Error: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"Error deleting customer: {ex.Message}");
            }
        }
    }
}