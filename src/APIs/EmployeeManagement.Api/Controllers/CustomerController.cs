using EmployeeManagement.Api.Dtos;
using EmployeeManagement.Api.Models;
using EmployeeManagement.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
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
        /// <summary>Page size used when the caller asks for a page but not a size.</summary>
        private const int DefaultPageSize = 10;

        /// <summary>Hard ceiling on page size so one request cannot pull the whole table.</summary>
        private const int MaxPageSize = 100;

        private readonly ICustomerRepository _customerRepository;
        private readonly ILogger<CustomerController> _logger;

        public CustomerController(ICustomerRepository customerRepository, ILogger<CustomerController> logger)
        {
            _customerRepository = customerRepository;
            _logger = logger;
        }

        /// <summary>
        /// Gets customers, optionally paginated and filtered.
        /// GET: api/customer (all)
        /// GET: api/customer?pageNumber=1&amp;pageSize=10 (paginated)
        /// GET: api/customer?pageNumber=1&amp;pageSize=10&amp;searchTerm=abc&amp;isActive=true
        /// </summary>
        [HttpGet]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> GetCustomers(
            [FromQuery] int? pageNumber = null,
            [FromQuery] int? pageSize = null,
            [FromQuery] string searchTerm = null,
            [FromQuery] bool? isActive = null)
        {
            try
            {
                // A page number alone is enough to mean paginate; the size falls
                // back to the default rather than silently returning every row.
                if (pageNumber.HasValue || pageSize.HasValue)
                {
                    var page = Math.Max(1, pageNumber ?? 1);
                    var size = Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize);

                    var (items, totalCount) = await _customerRepository.GetCustomersPaginated(
                        page, size, searchTerm, isActive);

                    var pagedResponse = new PagedResponse<CustomerResponse>(
                        items.Select(CustomerResponse.From).ToList(), page, size, totalCount);

                    return Ok(pagedResponse);
                }

                var customers = await _customerRepository.GetCustomers();
                return Ok(customers.Select(CustomerResponse.From).ToList());
            }
            catch (Exception ex)
            {
                // Detail goes to the log, never to the caller: raw SqlException
                // text exposes schema, server and connection internals.
                _logger.LogError(ex, "Error retrieving customers.");
                return Problem(
                    detail: "An error occurred while retrieving customers.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>GET: api/customer/{id}</summary>
        [HttpGet("{id:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<CustomerResponse>> GetCustomerById(Guid id)
        {
            try
            {
                var customer = await _customerRepository.GetCustomerById(id);

                if (customer == null)
                {
                    return NotFound($"Customer with ID = {id} not found.");
                }

                return Ok(CustomerResponse.From(customer));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving customer {CustomerId}.", id);
                return Problem(
                    detail: "An error occurred while retrieving the customer.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>POST: api/customer</summary>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<CustomerResponse>> CreateCustomer([FromBody] Customer customer)
        {
            if (customer == null)
            {
                return BadRequest("Customer data is required.");
            }

            try
            {
                // The server owns the identity; whatever the caller sent is discarded.
                // Audit timestamps are stamped by the repository.
                customer.Id = Guid.NewGuid();

                var createdCustomer = await _customerRepository.CreateCustomer(customer);

                return CreatedAtAction(
                    nameof(GetCustomerById),
                    new { id = createdCustomer.Id },
                    CustomerResponse.From(createdCustomer));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating customer.");
                return Problem(
                    detail: "An error occurred while creating the customer.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>PUT: api/customer/{id}</summary>
        [HttpPut("{id:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<CustomerResponse>> UpdateCustomer(Guid id, [FromBody] Customer customer)
        {
            if (customer == null)
            {
                return BadRequest("Customer data is required.");
            }

            if (id != customer.Id)
            {
                return BadRequest("Customer ID mismatch.");
            }

            try
            {
                // The repository reports a missing row by returning null, so the
                // previous existence pre-check was a wasted database round-trip.
                var updatedCustomer = await _customerRepository.UpdateCustomer(customer);

                if (updatedCustomer == null)
                {
                    return NotFound($"Customer with ID = {id} not found.");
                }

                return Ok(CustomerResponse.From(updatedCustomer));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating customer {CustomerId}.", id);
                return Problem(
                    detail: "An error occurred while updating the customer.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>
        /// Assigns one customer type to many customers in a single statement.
        /// PUT: api/customer/bulk-assign-type
        /// </summary>
        [HttpPut("bulk-assign-type")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<BulkAssignResult>> BulkAssignCustomerType(
            [FromBody] BulkAssignCustomerTypeRequest request)
        {
            if (request?.CustomerIds == null || request.CustomerIds.Count == 0)
            {
                return BadRequest("At least one customer id is required.");
            }

            try
            {
                var ids = request.CustomerIds
                    .Where(id => id != Guid.Empty)
                    .Distinct()
                    .ToList();

                if (ids.Count == 0)
                {
                    return BadRequest("At least one valid customer id is required.");
                }

                var updatedCount = await _customerRepository.BulkAssignCustomerType(
                    ids, request.CustomerTypeListId, request.ModifiedBy);

                _logger.LogInformation(
                    "Bulk-assigned customer type {CustomerTypeId} to {UpdatedCount} of {RequestedCount} customer(s).",
                    request.CustomerTypeListId, updatedCount, ids.Count);

                return Ok(new BulkAssignResult
                {
                    RequestedCount = ids.Count,
                    UpdatedCount = updatedCount
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error bulk-assigning customer type.");
                return Problem(
                    detail: "An error occurred while assigning the customer type.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>DELETE: api/customer/{id}</summary>
        [HttpDelete("{id:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult> DeleteCustomer(Guid id)
        {
            try
            {
                var deleted = await _customerRepository.DeleteCustomer(id);

                if (!deleted)
                {
                    return NotFound($"Customer with ID = {id} not found.");
                }

                return Ok(new { message = $"Customer with ID = {id} deleted successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting customer {CustomerId}.", id);
                return Problem(
                    detail: "An error occurred while deleting the customer.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }
    }
}
