using System.ComponentModel.DataAnnotations;

public class RequiredWithCustomMessageAttribute : ValidationAttribute
{
    public RequiredWithCustomMessageAttribute()
        : base("Serial Number is required. (ត្រូវតែបញ្ចូល)") // Custom message
    {
    }

    protected override ValidationResult IsValid(object value, ValidationContext validationContext)
    {
        if (value == null || string.IsNullOrWhiteSpace(value.ToString()))
        {
            return new ValidationResult(ErrorMessage);
        }

        return ValidationResult.Success;
    }
}
