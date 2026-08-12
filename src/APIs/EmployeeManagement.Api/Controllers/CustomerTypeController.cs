using EmployeeManagement.Api.Models;
using EmployeeManagement.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Produces("application/json")]
    public class CustomerTypeController : ControllerBase
    {
        private readonly ICustomerTypeRespository customerTypeRepository;
        private readonly ILogger<CustomerTypeController> _logger;

        public CustomerTypeController(
            ICustomerTypeRespository customerTypeRepository,
            ILogger<CustomerTypeController> logger)
        {
            this.customerTypeRepository = customerTypeRepository;
            _logger = logger;
        }

        /// <summary>
        /// Get customer types with optional pagination
        /// GET: api/CustomerType (returns all)
        /// GET: api/CustomerType?pageNumber=1&pageSize=10 (returns paginated)
        /// GET: api/CustomerType?pageNumber=1&pageSize=10&searchTerm=abc
        /// </summary>
        [HttpGet]
        [Produces("application/json")]
        public async Task<ActionResult> GetCustomerTypes(
            [FromQuery] int? pageNumber = null,
            [FromQuery] int? pageSize = null,
            [FromQuery] string searchTerm = null)
        {
            try
            {
                if (pageNumber.HasValue && pageSize.HasValue)
                {
                    return await GetCustomerTypesPaginated(pageNumber.Value, pageSize.Value, searchTerm);
                }
                else
                {
                    return await GetAllCustomerTypes();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"Error retrieving customer types: {ex.Message}");
            }
        }

        private async Task<ActionResult> GetAllCustomerTypes()
        {
            var customerTypes = await customerTypeRepository.GetCustomerTypes();
            Response.ContentType = "application/json";
            return Ok(customerTypes);
        }

        private async Task<ActionResult> GetCustomerTypesPaginated(
            int pageNumber,
            int pageSize,
            string searchTerm = null)
        {
            if (pageNumber < 1)
                pageNumber = 1;

            if (pageSize < 1)
                pageSize = 10;

            if (pageSize > 100)
                pageSize = 100;

            var (items, totalCount) = await customerTypeRepository.GetCustomerTypesPaginated(
                pageNumber,
                pageSize,
                searchTerm);

            var pagedResponse = new PagedResponse<CustomerType>(
                items,
                pageNumber,
                pageSize,
                totalCount);

            Response.ContentType = "application/json";
            return Ok(pagedResponse);
        }

        /// <summary>
        /// Get customer type by ID
        /// GET: api/CustomerType/{id}
        /// </summary>
        [HttpGet("{id}")]
        [Produces("application/json")]
        public async Task<ActionResult<CustomerType>> GetCustomerTypeById(int id)
        {
            try
            {
                var customerType = await customerTypeRepository.GetCustomerTypeById(id);
                if (customerType == null)
                {
                    return NotFound($"CustomerType with ID = {id} not found.");
                }
                Response.ContentType = "application/json";
                return Ok(customerType);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"Error retrieving customer type: {ex.Message}");
            }
        }

        /// <summary>
        /// Create a new customer type
        /// POST: api/CustomerType
        /// </summary>
        [HttpPost]
        [Produces("application/json")]
        public async Task<ActionResult<CustomerType>> CreateCustomerType([FromBody] CustomerType customerType)
        {
            try
            {
                if (customerType == null)
                {
                    return BadRequest("CustomerType data is required.");
                }

                // Set creation metadata
                customerType.CreatedAt = DateTime.UtcNow;
                customerType.ModifiedAt = DateTime.UtcNow;

                var createdCustomerType = await customerTypeRepository.CreateCustomerType(customerType);

                Response.ContentType = "application/json";
                return CreatedAtAction(nameof(GetCustomerTypeById),
                    new { id = createdCustomerType.ListId },
                    createdCustomerType);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"Error creating customer type: {ex.Message}");
            }
        }

        /// <summary>
        /// Update an existing customer type
        /// PUT: api/CustomerType/{id}
        /// </summary>
        [HttpPut("{id}")]
        [Produces("application/json")]
        public async Task<ActionResult<CustomerType>> UpdateCustomerType(int id, [FromBody] CustomerType customerType)
        {
            try
            {
                if (customerType == null)
                {
                    return BadRequest("CustomerType data is required.");
                }

                if (id != customerType.ListId)
                {
                    return BadRequest("CustomerType ID mismatch.");
                }

                var existingCustomerType = await customerTypeRepository.GetCustomerTypeById(id);
                if (existingCustomerType == null)
                {
                    return NotFound($"CustomerType with ID = {id} not found.");
                }

                var updatedCustomerType = await customerTypeRepository.UpdateCustomerType(customerType);

                Response.ContentType = "application/json";
                return Ok(updatedCustomerType);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"Error updating customer type: {ex.Message}");
            }
        }

        /// <summary>
        /// Delete a customer type
        /// DELETE: api/CustomerType/{id}
        /// </summary>
        [HttpDelete("{id}")]
        [Produces("application/json")]
        public async Task<ActionResult> DeleteCustomerType(int id)
        {
            try
            {
                var customerType = await customerTypeRepository.GetCustomerTypeById(id);
                if (customerType == null)
                {
                    return NotFound($"CustomerType with ID = {id} not found.");
                }

                await customerTypeRepository.DeleteCustomerType(id);

                return Ok(new { message = $"CustomerType with ID = {id} deleted successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error: {ex.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    $"Error deleting customer type: {ex.Message}");
            }
        }
    }
}