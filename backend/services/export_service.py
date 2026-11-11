import io
from typing import List, Dict, Any
import pandas as pd


def prepare_leads_dataframe(leads: List[Dict[str, Any]], company_default: str = "", domain_default: str = "") -> pd.DataFrame:
    """Flatten lead objects into a clean pandas DataFrame ready for CSV/Excel export."""
    records = []
    for lead in leads:
        verif = lead.get("verification", {})
        records.append({
            "Company": lead.get("company", company_default),
            "Domain": lead.get("domain", domain_default),
            "Name": lead.get("name", ""),
            "Title": lead.get("title", ""),
            "Category": lead.get("category", ""),
            "Email": lead.get("email", ""),
            "Verification Status": verif.get("status", "unknown").upper(),
            "Deliverability Score (%)": verif.get("score", 0),
            "MX Server": verif.get("mx_host", "N/A"),
            "SMTP Verified": "YES" if verif.get("smtp_verified") else "NO",
            "Is Catch-All": "YES" if verif.get("is_catch_all") else "NO",
            "Is Disposable": "YES" if verif.get("is_disposable") else "NO",
            "Data Source": lead.get("source", "Discovery Engine"),
            "Notes / Recommendation": verif.get("recommendation", "")
        })
    return pd.DataFrame(records)


def export_leads_to_csv(leads: List[Dict[str, Any]], company_default: str = "", domain_default: str = "") -> str:
    """Generate CSV string from lead data."""
    df = prepare_leads_dataframe(leads, company_default, domain_default)
    return df.to_csv(index=False, encoding="utf-8")


def export_leads_to_excel(leads: List[Dict[str, Any]], company_default: str = "", domain_default: str = "") -> bytes:
    """Generate binary Excel (.xlsx) file buffer from lead data."""
    df = prepare_leads_dataframe(leads, company_default, domain_default)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Verified Leads")
    return output.getvalue()

