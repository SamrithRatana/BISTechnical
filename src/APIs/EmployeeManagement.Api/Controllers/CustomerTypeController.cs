using EmployeeManagement.Api.Models;
using EmployeeManagement.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Produces("application/json")]
    public class CustomerTypeController : ControllerBase
    {
        private const int DefaultPageSize = 10;
        private const int MaxPageSize = 100;

        private readonly ICustomerTypeRepository _customerTypeRepository;
        private readonly ILogger<CustomerTypeController> _logger;

        public CustomerTypeController(
            ICustomerTypeRepository customerTypeRepository,
            ILogger<CustomerTypeController> logger)
        {
            _customerTypeRepository = customerTypeRepository;
            _logger = logger;
        }

        /// <summary>
        /// Gets customer types, optionally paginated.
        /// GET: api/CustomerType (all)
        /// GET: api/CustomerType?pageNumber=1&amp;pageSize=10&amp;searchTerm=abc
        /// </summary>
        [HttpGet]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> GetCustomerTypes(
            [FromQuery] int? pageNumber = null,
            [FromQuery] int? pageSize = null,
            [FromQuery] string searchTerm = null)
        {
            try
            {
                if (pageNumber.HasValue || pageSize.HasValue)
                {
                    var page = Math.Max(1, pageNumber ?? 1);
                    var size = Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize);

                    var (items, totalCount) = await _customerTypeRepository.GetCustomerTypesPaginated(
                        page, size, searchTerm);

                    return Ok(new PagedResponse<CustomerType>(items, page, size, totalCount));
                }

                return Ok(await _customerTypeRepository.GetCustomerTypes());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving customer types.");
                return Problem(
                    detail: "An error occurred while retrieving customer types.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>GET: api/CustomerType/{id}</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<CustomerType>> GetCustomerTypeById(int id)
        {
            try
            {
                var customerType = await _customerTypeRepository.GetCustomerTypeById(id);

                if (customerType == null)
                {
                    return NotFound($"CustomerType with ID = {id} not found.");
                }

                return Ok(customerType);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving customer type {CustomerTypeId}.", id);
                return Problem(
                    detail: "An error occurred while retrieving the customer type.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>POST: api/CustomerType</summary>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<CustomerType>> CreateCustomerType([FromBody] CustomerType customerType)
        {
            if (customerType == null)
            {
                return BadRequest("CustomerType data is required.");
            }

            if (string.IsNullOrWhiteSpace(customerType.Type))
            {
                return BadRequest("CustomerType 'Type' is required.");
            }

            try
            {
                var createdCustomerType = await _customerTypeRepository.CreateCustomerType(customerType);

                return CreatedAtAction(
                    nameof(GetCustomerTypeById),
                    new { id = createdCustomerType.ListId },
                    createdCustomerType);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating customer type.");
                return Problem(
                    detail: "An error occurred while creating the customer type.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>PUT: api/CustomerType/{id}</summary>
        [HttpPut("{id:int}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<CustomerType>> UpdateCustomerType(int id, [FromBody] CustomerType customerType)
        {
            if (customerType == null)
            {
                return BadRequest("CustomerType data is required.");
            }

            if (id != customerType.ListId)
            {
                return BadRequest("CustomerType ID mismatch.");
            }

            try
            {
                // A null return already means "no such row"; the previous
                // existence pre-check was a second, redundant query.
                var updatedCustomerType = await _customerTypeRepository.UpdateCustomerType(customerType);

                if (updatedCustomerType == null)
                {
                    return NotFound($"CustomerType with ID = {id} not found.");
                }

                return Ok(updatedCustomerType);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating customer type {CustomerTypeId}.", id);
                return Problem(
                    detail: "An error occurred while updating the customer type.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>DELETE: api/CustomerType/{id}</summary>
        [HttpDelete("{id:int}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> DeleteCustomerType(int id)
        {
            try
            {
                var deleted = await _customerTypeRepository.DeleteCustomerType(id);

                if (!deleted)
                {
                    return NotFound($"CustomerType with ID = {id} not found.");
                }

                return Ok(new { message = $"CustomerType with ID = {id} deleted successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting customer type {CustomerTypeId}.", id);
                return Problem(
                    detail: "An error occurred while deleting the customer type.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }
    }
}
