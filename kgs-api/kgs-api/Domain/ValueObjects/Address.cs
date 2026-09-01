using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using System.ComponentModel.DataAnnotations;

namespace kgs_api.Domain.ValueObjects
{
    [Owned]
    public class Address
    {
        [Required, MaxLength(100)] public string City { get; set; } = string.Empty;
        [Required, MaxLength(100)] public string District { get; set; } = string.Empty;
        [Required, MaxLength(100)] public string Ward { get; set; } = string.Empty;
        [MaxLength(500)] public string Detail { get; set; } = string.Empty;
    }
}
