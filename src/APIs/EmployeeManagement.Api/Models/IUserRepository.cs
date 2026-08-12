using EmployeeManagement.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EmployeeManagement.Api.Models
{
    public interface IUserRepository
    {
        Task<User> GetUser(string id);
        Task<IEnumerable<User>> GetUsers();
        Task<User> AddUser(User user);
        Task<User> UpdateUser(User user);
        Task<User> DeleteUser(string id);
        Task<IEnumerable<User>> Search(string name, string email);
        Task<User> ValidateUserByEmail(string email);
    }

}
