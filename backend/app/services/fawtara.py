"""
Fawtara E-Invoicing Service
Oman Tax Authority — UBL 2.1 XML Invoice Generator
Peppol BIS Billing 3.0 compatible
"""

from lxml import etree
from datetime import datetime, date
from decimal import Decimal
import hashlib
import uuid

# UBL 2.1 Namespaces
NAMESPACES = {
    None: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "ext": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2",
}


def generate_invoice_xml(invoice_data: dict, company_data: dict) -> str:
    """
    Generate UBL 2.1 XML for a sales invoice.

    invoice_data keys:
        invoice_number, invoice_date, due_date,
        customer_name, customer_vat, customer_address, customer_city,
        items: list of {description, quantity, unit_price, tax_rate, line_total}
        subtotal, vat_amount, total_amount

    company_data keys:
        name, vat_number, address, city, phone, email, bank_name, bank_iban

    Returns: XML string (UTF-8)
    """

    root = etree.Element("Invoice", nsmap=NAMESPACES)

    cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"

    def cbc_elem(tag, text, **attrs):
        el = etree.SubElement(root, f"{{{cbc}}}{tag}", **attrs)
        el.text = str(text)
        return el

    # -- Header --
    cbc_elem("CustomizationID", "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0")
    cbc_elem("ProfileID", "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0")
    cbc_elem("ID", invoice_data["invoice_number"])
    cbc_elem("IssueDate", str(invoice_data["invoice_date"]))
    cbc_elem("DueDate", str(invoice_data.get("due_date", invoice_data["invoice_date"])))
    cbc_elem("InvoiceTypeCode", "380")  # 380 = Commercial Invoice
    cbc_elem("DocumentCurrencyCode", "OMR")
    cbc_elem("TaxCurrencyCode", "OMR")

    # -- Seller (your company) --
    supplier = etree.SubElement(root, f"{{{cac}}}AccountingSupplierParty")
    party = etree.SubElement(supplier, f"{{{cac}}}Party")

    party_name = etree.SubElement(party, f"{{{cac}}}PartyName")
    name_el = etree.SubElement(party_name, f"{{{cbc}}}Name")
    name_el.text = company_data["name"]

    postal = etree.SubElement(party, f"{{{cac}}}PostalAddress")
    etree.SubElement(postal, f"{{{cbc}}}StreetName").text = company_data.get("address", "")
    etree.SubElement(postal, f"{{{cbc}}}CityName").text = company_data.get("city", "Muscat")
    etree.SubElement(postal, f"{{{cbc}}}CountrySubentity").text = "OM"
    country = etree.SubElement(postal, f"{{{cac}}}Country")
    etree.SubElement(country, f"{{{cbc}}}IdentificationCode").text = "OM"

    tax_scheme = etree.SubElement(party, f"{{{cac}}}PartyTaxScheme")
    etree.SubElement(tax_scheme, f"{{{cbc}}}CompanyID").text = company_data.get("vat_number", "")
    scheme = etree.SubElement(tax_scheme, f"{{{cac}}}TaxScheme")
    etree.SubElement(scheme, f"{{{cbc}}}ID").text = "VAT"

    legal = etree.SubElement(party, f"{{{cac}}}PartyLegalEntity")
    etree.SubElement(legal, f"{{{cbc}}}RegistrationName").text = company_data["name"]
    etree.SubElement(legal, f"{{{cbc}}}CompanyID").text = company_data.get("vat_number", "")

    # -- Buyer (customer) --
    customer_party = etree.SubElement(root, f"{{{cac}}}AccountingCustomerParty")
    cust_party = etree.SubElement(customer_party, f"{{{cac}}}Party")

    cust_name = etree.SubElement(cust_party, f"{{{cac}}}PartyName")
    etree.SubElement(cust_name, f"{{{cbc}}}Name").text = invoice_data["customer_name"]

    cust_postal = etree.SubElement(cust_party, f"{{{cac}}}PostalAddress")
    etree.SubElement(cust_postal, f"{{{cbc}}}StreetName").text = invoice_data.get("customer_address", "")
    etree.SubElement(cust_postal, f"{{{cbc}}}CityName").text = invoice_data.get("customer_city", "")
    cust_country = etree.SubElement(cust_postal, f"{{{cac}}}Country")
    etree.SubElement(cust_country, f"{{{cbc}}}IdentificationCode").text = "OM"

    if invoice_data.get("customer_vat"):
        cust_tax = etree.SubElement(cust_party, f"{{{cac}}}PartyTaxScheme")
        etree.SubElement(cust_tax, f"{{{cbc}}}CompanyID").text = invoice_data["customer_vat"]
        cust_scheme = etree.SubElement(cust_tax, f"{{{cac}}}TaxScheme")
        etree.SubElement(cust_scheme, f"{{{cbc}}}ID").text = "VAT"

    # -- Tax Total --
    tax_total = etree.SubElement(root, f"{{{cac}}}TaxTotal")
    vat_amount = Decimal(str(invoice_data.get("vat_amount", 0)))
    etree.SubElement(tax_total, f"{{{cbc}}}TaxAmount",
                     currencyID="OMR").text = f"{vat_amount:.3f}"

    tax_subtotal = etree.SubElement(tax_total, f"{{{cac}}}TaxSubtotal")
    subtotal_taxable = Decimal(str(invoice_data.get("subtotal", 0)))
    etree.SubElement(tax_subtotal, f"{{{cbc}}}TaxableAmount",
                     currencyID="OMR").text = f"{subtotal_taxable:.3f}"
    etree.SubElement(tax_subtotal, f"{{{cbc}}}TaxAmount",
                     currencyID="OMR").text = f"{vat_amount:.3f}"

    tax_cat = etree.SubElement(tax_subtotal, f"{{{cac}}}TaxCategory")
    etree.SubElement(tax_cat, f"{{{cbc}}}ID").text = "S"  # S = Standard rate
    etree.SubElement(tax_cat, f"{{{cbc}}}Percent").text = "5.00"
    tax_cat_scheme = etree.SubElement(tax_cat, f"{{{cac}}}TaxScheme")
    etree.SubElement(tax_cat_scheme, f"{{{cbc}}}ID").text = "VAT"

    # -- Legal Monetary Total --
    lmt = etree.SubElement(root, f"{{{cac}}}LegalMonetaryTotal")
    total = Decimal(str(invoice_data.get("total_amount", 0)))
    etree.SubElement(lmt, f"{{{cbc}}}LineExtensionAmount",
                     currencyID="OMR").text = f"{subtotal_taxable:.3f}"
    etree.SubElement(lmt, f"{{{cbc}}}TaxExclusiveAmount",
                     currencyID="OMR").text = f"{subtotal_taxable:.3f}"
    etree.SubElement(lmt, f"{{{cbc}}}TaxInclusiveAmount",
                     currencyID="OMR").text = f"{total:.3f}"
    etree.SubElement(lmt, f"{{{cbc}}}PayableAmount",
                     currencyID="OMR").text = f"{total:.3f}"

    # -- Invoice Lines --
    for i, item in enumerate(invoice_data.get("items", []), 1):
        line = etree.SubElement(root, f"{{{cac}}}InvoiceLine")
        etree.SubElement(line, f"{{{cbc}}}ID").text = str(i)
        etree.SubElement(line, f"{{{cbc}}}InvoicedQuantity",
                         unitCode="EA").text = str(item["quantity"])
        line_amount = Decimal(str(item["line_total"]))
        etree.SubElement(line, f"{{{cbc}}}LineExtensionAmount",
                         currencyID="OMR").text = f"{line_amount:.3f}"

        line_tax = etree.SubElement(line, f"{{{cac}}}TaxTotal")
        item_vat = line_amount * Decimal(str(item.get("tax_rate", 0))) / 100
        etree.SubElement(line_tax, f"{{{cbc}}}TaxAmount",
                         currencyID="OMR").text = f"{item_vat:.3f}"

        item_el = etree.SubElement(line, f"{{{cac}}}Item")
        etree.SubElement(item_el, f"{{{cbc}}}Description").text = item["description"]
        etree.SubElement(item_el, f"{{{cbc}}}Name").text = item["description"]

        price = etree.SubElement(line, f"{{{cac}}}Price")
        unit_price = Decimal(str(item["unit_price"]))
        etree.SubElement(price, f"{{{cbc}}}PriceAmount",
                         currencyID="OMR").text = f"{unit_price:.3f}"

    # Serialize to string
    return etree.tostring(root, pretty_print=True,
                          xml_declaration=True, encoding="UTF-8").decode("utf-8")


def generate_invoice_hash(xml_string: str) -> str:
    """SHA-256 hash of the XML — required by Fawtara for QR code"""
    return hashlib.sha256(xml_string.encode("utf-8")).hexdigest()
