import re
import urllib.parse
from typing import Dict, Any, List, Optional
import httpx

# In-memory cache for company lookups
DOMAIN_CACHE: Dict[str, Dict[str, Any]] = {
    "google": {"name": "Google", "domain": "google.com", "logo": "https://logo.clearbit.com/google.com"},
    "microsoft": {"name": "Microsoft", "domain": "microsoft.com", "logo": "https://logo.clearbit.com/microsoft.com"},
    "apple": {"name": "Apple", "domain": "apple.com", "logo": "https://logo.clearbit.com/apple.com"},
    "amazon": {"name": "Amazon", "domain": "amazon.com", "logo": "https://logo.clearbit.com/amazon.com"},
    "meta": {"name": "Meta", "domain": "meta.com", "logo": "https://logo.clearbit.com/meta.com"},
    "stripe": {"name": "Stripe", "domain": "stripe.com", "logo": "https://logo.clearbit.com/stripe.com"},
    "netflix": {"name": "Netflix", "domain": "netflix.com", "logo": "https://logo.clearbit.com/netflix.com"},
    "uber": {"name": "Uber", "domain": "uber.com", "logo": "https://logo.clearbit.com/uber.com"},
    "airbnb": {"name": "Airbnb", "domain": "airbnb.com", "logo": "https://logo.clearbit.com/airbnb.com"},
    "spotify": {"name": "Spotify", "domain": "spotify.com", "logo": "https://logo.clearbit.com/spotify.com"},
    "salesforce": {"name": "Salesforce", "domain": "salesforce.com", "logo": "https://logo.clearbit.com/salesforce.com"},
    "adobe": {"name": "Adobe", "domain": "adobe.com", "logo": "https://logo.clearbit.com/adobe.com"},
    "nvidia": {"name": "NVIDIA", "domain": "nvidia.com", "logo": "https://logo.clearbit.com/nvidia.com"},
    "tesla": {"name": "Tesla", "domain": "tesla.com", "logo": "https://logo.clearbit.com/tesla.com"},
    "openai": {"name": "OpenAI", "domain": "openai.com", "logo": "https://logo.clearbit.com/openai.com"},
}


def clean_domain_string(input_str: str) -> str:
    """Clean URL or domain input to extract bare domain (e.g. 'stripe.com')."""
    s = input_str.strip().lower()
    # Remove protocol
    s = re.sub(r"^https?://", "", s)
    # Remove www
    s = re.sub(r"^www\.", "", s)
    # Remove trailing paths or query params
    s = s.split("/")[0].split("?")[0].strip()
    return s


async def autocomplete_company(query: str) -> List[Dict[str, Any]]:
    """Fetch company domain suggestions using Clearbit Autocomplete API."""
    query = query.strip()
    if not query:
        return []

    # Check local cache first
    q_lower = query.lower()
    matched = [v for k, v in DOMAIN_CACHE.items() if q_lower in k or q_lower in v["domain"]]
    if matched:
        return matched[:5]

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                f"https://autocomplete.clearbit.com/v1/companies/suggest?query={urllib.parse.quote(query)}"
            )
            if resp.status_code == 200:
                results = resp.json()
                formatted = []
                for item in results[:6]:
                    name = item.get("name") or query.capitalize()
                    domain = item.get("domain", "")
                    logo = item.get("logo") or f"https://logo.clearbit.com/{domain}"
                    formatted.append({
                        "name": name,
                        "domain": domain,
                        "logo": logo
                    })
                    # cache entry
                    DOMAIN_CACHE[name.lower()] = formatted[-1]
                return formatted
    except Exception:
        pass

    # Fallback if external API is unreachable
    cleaned = clean_domain_string(query)
    if "." in cleaned:
        domain = cleaned
        name = cleaned.split(".")[0].capitalize()
    else:
        domain = f"{cleaned.lower().replace(' ', '')}.com"
        name = query.capitalize()

    return [{
        "name": name,
        "domain": domain,
        "logo": f"https://logo.clearbit.com/{domain}"
    }]


async def resolve_company_domain(company_input: str) -> Dict[str, Any]:
    """Resolve a company name or domain into standard metadata."""
    cleaned = clean_domain_string(company_input)
    
    # If the user directly typed a valid domain like "stripe.com" or "uber.com"
    if "." in cleaned and not " " in cleaned:
        name = cleaned.split(".")[0].capitalize()
        return {
            "name": name,
            "domain": cleaned,
            "logo": f"https://logo.clearbit.com/{cleaned}"
        }

    # Otherwise query autocomplete
    suggestions = await autocomplete_company(company_input)
    if suggestions:
        return suggestions[0]

    # Heuristic fallback
    domain = f"{cleaned.lower().replace(' ', '')}.com"
    return {
        "name": company_input.strip().capitalize(),
        "domain": domain,
        "logo": f"https://logo.clearbit.com/{domain}"
    }

