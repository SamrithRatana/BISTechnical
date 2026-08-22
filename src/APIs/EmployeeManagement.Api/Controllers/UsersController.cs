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
    public class UsersController : ControllerBase
    {
        private readonly IUserRepository _userRepository;
        private readonly ILogger<UsersController> _logger;

        public UsersController(IUserRepository userRepository, ILogger<UsersController> logger)
        {
            _userRepository = userRepository;
            _logger = logger;
        }

        /// <summary>GET: api/users</summary>
        [HttpGet]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<IEnumerable<UserResponse>>> GetUsers()
        {
            try
            {
                var users = await _userRepository.GetUsers();
                return Ok(users.Select(UserResponse.From).ToList());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving users.");
                return Problem(
                    detail: "An error occurred while retrieving users.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>GET: api/users/{id}</summary>
        [HttpGet("{id}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<UserResponse>> GetUser(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest("User id is required.");
            }

            try
            {
                var result = await _userRepository.GetUser(id);

                if (result == null)
                {
                    return NotFound($"User with Id = {id} not found.");
                }

                return Ok(UserResponse.From(result));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user {UserId}.", id);
                return Problem(
                    detail: "An error occurred while retrieving the user.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>POST: api/users</summary>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<UserResponse>> CreateUser([FromBody] User user)
        {
            if (user == null)
            {
                return BadRequest("User data is required.");
            }

            if (string.IsNullOrWhiteSpace(user.Email))
            {
                return BadRequest("Email is required.");
            }

            try
            {
                var existingUser = await _userRepository.ValidateUserByEmail(user.Email);
                if (existingUser != null)
                {
                    ModelState.AddModelError("email", "User email already in use");
                    return BadRequest(ModelState);
                }

                if (string.IsNullOrWhiteSpace(user.Id))
                {
                    user.Id = Guid.NewGuid().ToString();
                }

                user.NormalizedUserName = user.UserName?.ToUpperInvariant();
                user.NormalizedEmail = user.Email.ToUpperInvariant();

                var createdUser = await _userRepository.AddUser(user);

                return CreatedAtAction(
                    nameof(GetUser),
                    new { id = createdUser.Id },
                    UserResponse.From(createdUser));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user.");
                return Problem(
                    detail: "An error occurred while creating the user.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>PUT: api/users</summary>
        [HttpPut]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<UserResponse>> UpdateUser([FromBody] User user)
        {
            if (user == null || string.IsNullOrWhiteSpace(user.Id))
            {
                return BadRequest("User data with an Id is required.");
            }

            try
            {
                // The repository copies only editable profile fields; password
                // hash and security stamps are never taken from the request.
                var updated = await _userRepository.UpdateUser(user);

                if (updated == null)
                {
                    return NotFound($"User with Id = {user.Id} not found.");
                }

                return Ok(UserResponse.From(updated));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user {UserId}.", user.Id);
                return Problem(
                    detail: "An error occurred while updating the user.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>DELETE: api/users/{id}</summary>
        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<UserResponse>> DeleteUser(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest("User id is required.");
            }

            try
            {
                var deleted = await _userRepository.DeleteUser(id);

                if (deleted == null)
                {
                    return NotFound($"User with Id = {id} not found.");
                }

                return Ok(UserResponse.From(deleted));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user {UserId}.", id);
                return Problem(
                    detail: "An error occurred while deleting the user.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }

        /// <summary>
        /// Searches users by name and/or email.
        /// GET: api/users/search?name=abc&amp;email=def
        /// </summary>
        [HttpGet("search")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<IEnumerable<UserResponse>>> Search(
            [FromQuery] string name,
            [FromQuery] string email)
        {
            try
            {
                var result = await _userRepository.Search(name, email);

                // An empty result set is a successful search that matched
                // nothing - not a missing resource, so this is 200 with [].
                return Ok(result.Select(UserResponse.From).ToList());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching users.");
                return Problem(
                    detail: "An error occurred while searching users.",
                    statusCode: StatusCodes.Status500InternalServerError);
            }
        }
    }
}
