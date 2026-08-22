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
    public class DepartmentsController : ControllerBase
    {
        private readonly IDepartmentRepository _departmentRepository;
        private readonly ILogger<DepartmentsController> _logger;

        public DepartmentsController(
            IDepartmentRepository departmentRepository,
            ILogger<DepartmentsController> logger)
        {
            _departmentRepository = departmentRepository;
            _logger = logger;
        }

        /// <summary>GET: api/departments</summary>
        [HttpGet]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<IEnumerable<Department>>> GetDepartments()
        {
            try
            {
                return Ok(await _departmentRepository.GetDepartments());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving departments.");
                return Problem(
                    detail: "An error occurred while retrieving departments.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>GET: api/departments/{id}</summary>
        [HttpGet("{id:int}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<Department>> GetDepartment(int id)
        {
            try
            {
                var result = await _departmentRepository.GetDepartment(id);

                if (result == null)
                {
                    return NotFound($"Department with Id = {id} not found.");
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving department {DepartmentId}.", id);
                return Problem(
                    detail: "An error occurred while retrieving the department.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }
    }
}
