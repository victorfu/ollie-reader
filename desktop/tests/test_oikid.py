import httpx
import pytest

import server.oikid as oikid_module
from server.oikid import OikidError, search_booking_records


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_missing_credentials_raises_400(monkeypatch):
    monkeypatch.setattr(oikid_module, "get_oikid_credentials", lambda: None)
    with pytest.raises(OikidError) as exc:
        search_booking_records(client=_client(lambda r: httpx.Response(200)))
    assert exc.value.status_code == 400


def test_success_maps_fields(monkeypatch):
    monkeypatch.setattr(oikid_module, "get_oikid_credentials", lambda: ("u", "p"))

    def handler(request):
        url = str(request.url)
        if "login.php" in url:
            return httpx.Response(200)
        if "Student/Login" in url:
            return httpx.Response(200, headers={"set-cookie": "PHPSESSID=abc; Path=/"})
        if "BookingRecord" in url:
            return httpx.Response(
                200,
                json={
                    "Token": "tok",
                    "Data": [
                        {
                            "Classroom_id": "1",
                            "Level": "L1",
                            "ClassVersion": "v",
                            "CoursesName": "Course",
                            "ClassTime": "2026-07-01 10:00",
                            "TeacherName": "Tina",
                            "OpenName": "Open",
                        }
                    ],
                },
            )
        return httpx.Response(404)

    result = search_booking_records(client=_client(handler))
    assert result["Token"] == "tok"
    assert result["Data"] == [
        {
            "id": "1",
            "Level": "L1",
            "ClassVersion": "v",
            "CoursesName": "Course",
            "ClassTime": "2026-07-01 10:00",
            "TeacherName": "Tina",
            "OpenName": "Open",
        }
    ]


def test_login_without_phpsessid_raises_502(monkeypatch):
    monkeypatch.setattr(oikid_module, "get_oikid_credentials", lambda: ("u", "p"))

    def handler(request):
        if "BookingRecord" in str(request.url):
            return httpx.Response(200, json={"Token": "", "Data": []})
        return httpx.Response(200)  # login 無 set-cookie

    with pytest.raises(OikidError) as exc:
        search_booking_records(client=_client(handler))
    assert exc.value.status_code == 502


def test_search_non_json_raises_502(monkeypatch):
    monkeypatch.setattr(oikid_module, "get_oikid_credentials", lambda: ("u", "p"))

    def handler(request):
        url = str(request.url)
        if "Student/Login" in url:
            return httpx.Response(200, headers={"set-cookie": "PHPSESSID=abc; Path=/"})
        if "BookingRecord" in url:
            return httpx.Response(200, text="<html>not json</html>")
        return httpx.Response(200)

    with pytest.raises(OikidError) as exc:
        search_booking_records(client=_client(handler))
    assert exc.value.status_code == 502


def test_cookie_header_omits_absent_aws_cookies(monkeypatch):
    monkeypatch.setattr(oikid_module, "get_oikid_credentials", lambda: ("u", "p"))
    captured = {}

    def handler(request):
        url = str(request.url)
        if "Student/Login" in url:
            return httpx.Response(200, headers={"set-cookie": "PHPSESSID=abc; Path=/"})
        if "BookingRecord" in url:
            captured["cookie"] = request.headers.get("Cookie", "")
            return httpx.Response(200, json={"Token": "t", "Data": []})
        return httpx.Response(200)

    search_booking_records(client=_client(handler))
    assert "PHPSESSID=abc" in captured["cookie"]
    assert "None" not in captured["cookie"]
    assert "AWSALB" not in captured["cookie"]


def test_cookie_header_includes_aws_cookies_when_present(monkeypatch):
    monkeypatch.setattr(oikid_module, "get_oikid_credentials", lambda: ("u", "p"))
    captured = {}

    def handler(request):
        url = str(request.url)
        if "Student/Login" in url:
            return httpx.Response(
                200,
                headers=[
                    ("set-cookie", "PHPSESSID=abc; Path=/"),
                    ("set-cookie", "AWSALB=lb1; Path=/"),
                    ("set-cookie", "AWSALBCORS=lb2; Path=/"),
                ],
            )
        if "BookingRecord" in url:
            captured["cookie"] = request.headers.get("Cookie", "")
            return httpx.Response(200, json={"Token": "t", "Data": []})
        return httpx.Response(200)

    search_booking_records(client=_client(handler))
    assert "AWSALB=lb1" in captured["cookie"]
    assert "AWSALBCORS=lb2" in captured["cookie"]
