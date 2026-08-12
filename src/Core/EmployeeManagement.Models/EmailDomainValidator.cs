using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EmployeeManagement.Models
{
    public class EmailDomainValidator : ValidationAttribute
    {
        public string AllowedDomain { get; set; }

        protected override ValidationResult IsValid(object value, ValidationContext validationContext)
        {
            if (value == null)
            {
                return new ValidationResult("Email address is required.");
            }

            var emailString = value as string;
            if (emailString == null || !emailString.Contains('@'))
            {
                return new ValidationResult("Invalid email address format.");
            }

            string[] strings = emailString.Split('@');
            if (strings.Length < 2)
            {
                return new ValidationResult("Invalid email address format.");
            }

            if (strings[1].ToUpper() == AllowedDomain.ToUpper())
            {
                return ValidationResult.Success;
            }

            return new ValidationResult($"Domain must be {AllowedDomain}", new[] { validationContext.MemberName });
        }
    }
}
