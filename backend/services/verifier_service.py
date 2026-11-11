import re
import socket
import smtplib
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List, Optional
import dns.resolver

from backend.data.disposable_domains import DISPOSABLE_DOMAINS, ROLE_PREFIXES

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)

# DNS Cache to avoid redundant DNS lookups during bulk checks
DNS_CACHE: Dict[str, Dict[str, Any]] = {}
executor = ThreadPoolExecutor(max_workers=20)


def get_mx_records(domain: str) -> List[str]:
    """Query DNS MX records for the given domain."""
    domain = domain.strip().lower()
    if domain in DNS_CACHE:
        return DNS_CACHE[domain].get("mx_hosts", [])

    mx_hosts = []
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 3.0
        resolver.lifetime = 3.0
        answers = resolver.resolve(domain, "MX")
        # Sort by preference
        sorted_answers = sorted(answers, key=lambda r: r.preference)
        mx_hosts = [str(r.exchange).rstrip(".") for r in sorted_answers]
    except Exception:
        # Fallback: check if domain has an A record (RFC standard allows fallback to A if no MX)
        try:
            resolver = dns.resolver.Resolver()
            resolver.timeout = 2.0
            resolver.lifetime = 2.0
            answers_a = resolver.resolve(domain, "A")
            if answers_a:
                mx_hosts = [domain]
        except Exception:
            mx_hosts = []

    DNS_CACHE[domain] = {"mx_hosts": mx_hosts}
    return mx_hosts


def perform_smtp_check(email: str, mx_host: str, timeout: float = 4.0) -> Dict[str, Any]:
    """
    Perform direct SMTP handshake with MX server.
    Tests RCPT TO for the recipient and tests a random address to detect catch-all.
    """
    result = {
        "connected": False,
        "deliverable": False,
        "is_catch_all": False,
        "code": None,
        "message": "",
        "notes": ""
    }

    try:
        # Fast socket connection check
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        conn_res = sock.connect_ex((mx_host, 25))
        sock.close()

        if conn_res != 0:
            result["notes"] = "SMTP port 25 connection refused or blocked by ISP/network"
            return result

        result["connected"] = True

        # Perform SMTP dialog
        server = smtplib.SMTP(mx_host, 25, timeout=timeout)
        server.ehlo_or_helo_if_needed()
        
        # MAIL FROM with a standard verification sender
        sender = "verify@mailscout-check.org"
        mail_code, _ = server.mail(sender)

        if mail_code >= 400:
            server.quit()
            result["notes"] = f"Mail server rejected MAIL FROM (code {mail_code})"
            return result

        # Test target email
        rcpt_code, rcpt_msg = server.rcpt(email)
        result["code"] = rcpt_code
        result["message"] = str(rcpt_msg)

        if rcpt_code == 250:
            result["deliverable"] = True
            
            # Now test random probe to detect Catch-All / Accept-All domain
            domain = email.split("@")[1]
            dummy_email = f"catchall_probe_xyz987q@{domain}"
            try:
                dummy_code, _ = server.rcpt(dummy_email)
                if dummy_code == 250:
                    result["is_catch_all"] = True
                    result["notes"] = "Server is Catch-All (Accepts any address)"
                else:
                    result["is_catch_all"] = False
                    result["notes"] = "Specific mailbox confirmed active"
            except Exception:
                result["is_catch_all"] = False
        elif rcpt_code in [550, 551, 553, 554]:
            result["deliverable"] = False
            result["notes"] = "Mailbox does not exist (rejected with 550)"
        else:
            result["deliverable"] = False
            result["notes"] = f"Server returned code {rcpt_code}"

        try:
            server.quit()
        except Exception:
            pass

    except (socket.timeout, TimeoutError):
        result["notes"] = "SMTP server connection timed out"
    except Exception as e:
        result["notes"] = f"SMTP check skipped: {str(e)[:60]}"

    return result


def verify_email_sync(email: str, check_smtp: bool = True) -> Dict[str, Any]:
    """
    Comprehensive multi-stage email verification:
    1. Syntax Check
    2. Disposable Domain Check
    3. DNS MX Record Check
    4. Role-based prefix check
    5. SMTP Deliverability & Catch-all Check
    """
    email = email.strip()
    res = {
        "email": email,
        "status": "invalid",        # "valid", "risky", "invalid", "role_based"
        "score": 0,                 # 0 to 100
        "is_valid_format": False,
        "is_disposable": False,
        "is_role_based": False,
        "is_catch_all": False,
        "has_mx_records": False,
        "mx_host": None,
        "smtp_verified": False,
        "smtp_details": "",
        "recommendation": ""
    }

    if not email or "@" not in email:
        res["recommendation"] = "Invalid email format."
        return res

    # 1. Syntax Check
    if not EMAIL_REGEX.match(email):
        res["recommendation"] = "Email syntax does not conform to RFC standards."
        return res

    res["is_valid_format"] = True
    parts = email.split("@")
    user_part = parts[0].lower()
    domain_part = parts[1].lower()

    # 2. Disposable Email Check
    if domain_part in DISPOSABLE_DOMAINS:
        res["is_disposable"] = True
        res["recommendation"] = "Disposable/temporary burner domain detected. High bounce risk."
        res["status"] = "invalid"
        res["score"] = 5
        return res

    # 3. Role-Based Check
    clean_user = re.sub(r"[._-]", "", user_part)
    if clean_user in ROLE_PREFIXES or user_part in ROLE_PREFIXES or any(user_part.startswith(p) for p in ["hr.", "careers.", "recruiting."]):
        res["is_role_based"] = True

    # 4. DNS MX Records Check
    mx_hosts = get_mx_records(domain_part)
    if not mx_hosts:
        res["has_mx_records"] = False
        res["recommendation"] = f"No mail server (MX record) found for '{domain_part}'. Cannot receive mail."
        res["status"] = "invalid"
        res["score"] = 10
        return res

    res["has_mx_records"] = True
    res["mx_host"] = mx_hosts[0]

    # 5. SMTP Handshake & Catch-All Check
    smtp_res = {"connected": False, "deliverable": False, "is_catch_all": False, "notes": ""}
    if check_smtp and mx_hosts:
        smtp_res = perform_smtp_check(email, mx_hosts[0], timeout=3.5)

    res["smtp_verified"] = smtp_res["deliverable"]
    res["is_catch_all"] = smtp_res["is_catch_all"]
    res["smtp_details"] = smtp_res["notes"]

    # Calculate Legitimacy Score and Overall Status
    if smtp_res["connected"]:
        if smtp_res["deliverable"]:
            if smtp_res["is_catch_all"]:
                res["status"] = "risky"
                res["score"] = 75
                res["recommendation"] = "Catch-all domain: Server accepts all addresses. Deliverable, but may be filtered."
            else:
                res["status"] = "role_based" if res["is_role_based"] else "valid"
                res["score"] = 98 if not res["is_role_based"] else 92
                res["recommendation"] = "Verified deliverable! Mailbox is active and confirmed."
        else:
            if smtp_res.get("code") in [550, 551, 553, 554]:
                res["status"] = "invalid"
                res["score"] = 15
                res["recommendation"] = "Mailbox does not exist on target server (550 User Unknown)."
            else:
                res["status"] = "risky"
                res["score"] = 50
                res["recommendation"] = f"Server rejected delivery: {smtp_res['notes']}"
    else:
        # Port 25 was blocked/filtered by local network or timed out
        # Since MX records exist and syntax is valid, calculate deliverability confidence
        base_score = 85
        if res["is_role_based"]:
            base_score = 88
            res["status"] = "role_based"
            res["recommendation"] = f"Active MX server ({res['mx_host']}). Standard company inbox for outreach."
        else:
            res["status"] = "valid"
            res["recommendation"] = f"Active MX server ({res['mx_host']}). Standard pattern, high delivery likelihood."
        
        res["score"] = base_score
        if smtp_res["notes"]:
            res["smtp_details"] = f"MX Confirmed ({smtp_res['notes']})"

    return res


async def verify_email_async(email: str, check_smtp: bool = True) -> Dict[str, Any]:
    """Asynchronous wrapper for email verification."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, verify_email_sync, email, check_smtp)


async def verify_bulk_emails(emails: List[str], check_smtp: bool = True) -> List[Dict[str, Any]]:
    """Verify a list of emails concurrently."""
    tasks = [verify_email_async(email, check_smtp) for email in emails]
    return await asyncio.gather(*tasks)

