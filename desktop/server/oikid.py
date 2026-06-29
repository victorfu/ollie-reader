"""本機 sidecar 的 OIKID 預約記錄抓取。

移植自 purism-ev-bot services/oikid_service.py：
- 帳密改從 OS keychain（oikid_secrets）讀。
- HTTP 改用 httpx（取代 requests）。
合約與雲端一致：回傳 {"Token", "Data":[...]}。
"""

import logging
from typing import Any, Optional

import httpx

from server.oikid_secrets import get_oikid_credentials
from server.ssl_compat import create_ssl_context

logger = logging.getLogger(__name__)

_LOGIN_PAGE = "https://www.oikid.com/login.php"
_LOGIN_URL = (
    "https://www.oikid.com/?a=Student/Login&b=Process&t=0.8666370350207129"
)
_SEARCH_URL = "https://www.oikid.com/?a=Student/BookingRecord&b=Search"


class OikidError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def _login(client: httpx.Client, username: str, password: str) -> dict[str, str]:
    client.get(_LOGIN_PAGE, timeout=30.0)
    resp = client.post(
        _LOGIN_URL,
        data={"Username": username, "Password": password},
        timeout=30.0,
    )
    resp.raise_for_status()

    phpsessid = resp.cookies.get("PHPSESSID")
    awsalb = resp.cookies.get("AWSALB")
    awsalbcors = resp.cookies.get("AWSALBCORS")
    if not phpsessid:
        logger.error("OIKID 登入未取得 PHPSESSID")
        raise OikidError("OIKID login failed", status_code=502)

    cookie_parts = ["location=zh-tw", f"PHPSESSID={phpsessid}"]
    if awsalb:
        cookie_parts.append(f"AWSALB={awsalb}")
    if awsalbcors:
        cookie_parts.append(f"AWSALBCORS={awsalbcors}")
    cookie = "; ".join(cookie_parts)
    return {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": "https://www.oikid.com",
        "Referer": "https://www.oikid.com/?a=Student/Booking2",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        ),
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": cookie,
    }


def search_booking_records(*, client: Optional[httpx.Client] = None) -> dict[str, Any]:
    creds = get_oikid_credentials()
    if creds is None:
        raise OikidError("OIKID 帳密未設定，請到桌面 App 設定", status_code=400)
    username, password = creds

    own_client = client is None
    if own_client:
        client = httpx.Client(timeout=30.0, verify=create_ssl_context())
    try:
        headers = _login(client, username, password)
        resp = client.post(_SEARCH_URL, headers=headers, data={"P": 1}, timeout=30.0)
        resp.raise_for_status()
        data_json = resp.json()
    except OikidError:
        raise
    except httpx.HTTPError as e:
        logger.exception("OIKID 抓取錯誤")
        raise OikidError(f"OIKID fetch error: {e}", status_code=502) from e
    except ValueError as e:
        logger.exception("OIKID 回傳非 JSON")
        raise OikidError("Invalid JSON from OIKID", status_code=502) from e
    finally:
        if own_client:
            client.close()

    output: dict[str, Any] = {"Token": data_json.get("Token", ""), "Data": []}
    for d in data_json.get("Data", []):
        output["Data"].append(
            {
                "id": d.get("Classroom_id", ""),
                "Level": d.get("Level", ""),
                "ClassVersion": d.get("ClassVersion", ""),
                "CoursesName": d.get("CoursesName", ""),
                "ClassTime": d.get("ClassTime", ""),
                "TeacherName": d.get("TeacherName", ""),
                "OpenName": d.get("OpenName", ""),
            }
        )
    return output
