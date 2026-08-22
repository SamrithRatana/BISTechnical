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
    public class EmployeesController : ControllerBase
    {
        private readonly IEmployeeRepository _employeeRepository;
        private readonly ILogger<EmployeesController> _logger;

        public EmployeesController(IEmployeeRepository employeeRepository, ILogger<EmployeesController> logger)
        {
            _employeeRepository = employeeRepository;
            _logger = logger;
        }

        /// <summary>GET: api/employees</summary>
        [HttpGet]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<IEnumerable<Employee>>> GetEmployees()
        {
            try
            {
                return Ok(await _employeeRepository.GetEmployees());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving employees.");
                return Problem(
                    detail: "An error occurred while retrieving employees.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>
        /// Searches employees by name and/or gender.
        /// GET: api/employees/search?name=abc&amp;gender=Male
        /// </summary>
        /// <remarks>
        /// Declared before the <c>{id:int}</c> route for readability; the literal
        /// segment wins regardless of order. The previous template was
        /// <c>[HttpGet("{search}")]</c>, which declared a route *parameter*
        /// called "search" that bound to nothing (the action takes "name"), so
        /// the endpoint was only ever reachable as an unfiltered list.
        /// </remarks>
        [HttpGet("search")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<IEnumerable<Employee>>> Search(
            [FromQuery] string name,
            [FromQuery] Gender? gender)
        {
            try
            {
                var result = await _employeeRepository.Search(name, gender);

                // Matching nothing is a successful search, so return 200 with [].
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching employees.");
                return Problem(
                    detail: "An error occurred while searching employees.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>GET: api/employees/{id}</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<Employee>> GetEmployee(int id)
        {
            try
            {
                var result = await _employeeRepository.GetEmployee(id);

                if (result == null)
                {
                    return NotFound($"Employee with Id = {id} not found.");
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving employee {EmployeeId}.", id);
                return Problem(
                    detail: "An error occurred while retrieving the employee.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>POST: api/employees</summary>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<Employee>> CreateEmployee([FromBody] Employee employee)
        {
            if (employee == null)
            {
                return BadRequest("Employee data is required.");
            }

            try
            {
                // Duplicate-email check, previously commented out, so two
                // employees could be created with the same address.
                if (!string.IsNullOrWhiteSpace(employee.Email))
                {
                    var existing = await _employeeRepository.ValidateEmployeeByEmail(employee.Email);
                    if (existing != null)
                    {
                        ModelState.AddModelError("email", "Employee email already in use");
                        return BadRequest(ModelState);
                    }
                }

                var createdEmployee = await _employeeRepository.AddEmployee(employee);

                return CreatedAtAction(
                    nameof(GetEmployee),
                    new { id = createdEmployee.EmployeeId },
                    createdEmployee);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating employee.");
                return Problem(
                    detail: "An error occurred while creating the employee.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>PUT: api/employees</summary>
        [HttpPut]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<Employee>> UpdateEmployee([FromBody] Employee employee)
        {
            if (employee == null)
            {
                return BadRequest("Employee data is required.");
            }

            try
            {
                // A null return already means the row is missing, so the separate
                // existence check that used to precede this was a wasted query.
                var updated = await _employeeRepository.UpdateEmployee(employee);

                if (updated == null)
                {
                    return NotFound($"Employee with Id = {employee.EmployeeId} not found.");
                }

                return Ok(updated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating employee {EmployeeId}.", employee.EmployeeId);
                return Problem(
                    detail: "An error occurred while updating the employee.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>DELETE: api/employees/{id}</summary>
        [HttpDelete("{id:int}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<Employee>> DeleteEmployee(int id)
        {
            try
            {
                var deleted = await _employeeRepository.DeleteEmployee(id);

                if (deleted == null)
                {
                    return NotFound($"Employee with Id = {id} not found.");
                }

                return Ok(deleted);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting employee {EmployeeId}.", id);
                return Problem(
                    detail: "An error occurred while deleting the employee.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }
    }
}
