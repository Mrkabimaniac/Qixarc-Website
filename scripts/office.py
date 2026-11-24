"""Shared registered office details for visible contact and Organization schema."""
from html import escape

STREET = "No. 8, Kalpalam Road, M.M. Complex, Goripalayam"
CITY = "Madurai"
REGION = "Tamil Nadu"
POSTCODE = "625002"
COUNTRY = "India"
OFFICE = f"{STREET}, {CITY} – {POSTCODE}, {REGION}, {COUNTRY}"

def office_address():
    return f'<address class="contact-location office-address"><strong>Registered office</strong><br>{escape(OFFICE)}</address>'

def postal_address():
    return {"@type": "PostalAddress", "streetAddress": STREET, "addressLocality": CITY,
            "addressRegion": REGION, "postalCode": POSTCODE, "addressCountry": "IN"}
