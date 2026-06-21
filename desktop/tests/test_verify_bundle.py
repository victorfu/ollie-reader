from release.verify_bundle import scan_bundle


def _app(tmp_path):
    root = tmp_path / "ollie-reader.app" / "Contents"
    (root / "MacOS").mkdir(parents=True)
    (root / "Resources").mkdir(parents=True)
    return tmp_path / "ollie-reader.app"


def test_clean_bundle_has_no_findings(tmp_path):
    app = _app(tmp_path)
    (app / "Contents" / "Resources" / "models").mkdir()
    (app / "Contents" / "Resources" / "models" / "voices.bin").write_bytes(b"\x00" * 10)
    assert scan_bundle(app) == []


def test_dotenv_file_is_flagged(tmp_path):
    app = _app(tmp_path)
    (app / "Contents" / "Resources" / ".env.local").write_text("APPLE_APP_PASSWORD=abcd-efgh\n")
    findings = scan_bundle(app)
    assert findings  # non-empty
    assert any(".env" in f for f in findings)


def test_p12_file_is_flagged(tmp_path):
    app = _app(tmp_path)
    (app / "Contents" / "Resources" / "cert.p12").write_bytes(b"\x00\x01")
    assert any(".p12" in f for f in scan_bundle(app))


def test_private_key_content_is_flagged(tmp_path):
    app = _app(tmp_path)
    (app / "Contents" / "Resources" / "config.txt").write_text(
        "-----BEGIN PRIVATE KEY-----\nMIIxxx\n-----END PRIVATE KEY-----\n"
    )
    assert any("PRIVATE KEY" in f for f in scan_bundle(app))


def test_google_api_key_content_is_flagged(tmp_path):
    app = _app(tmp_path)
    (app / "Contents" / "Resources" / "settings.json").write_text(
        '{"key": "AIzaSyA1234567890_abcdefghijklmnopqrstuv"}'
    )
    assert scan_bundle(app)


def test_certifi_cacert_pem_is_not_flagged(tmp_path):
    # Public CA bundle ships legitimately; must not be a false positive.
    app = _app(tmp_path)
    certifi = app / "Contents" / "Resources" / "certifi"
    certifi.mkdir()
    (certifi / "cacert.pem").write_text(
        "-----BEGIN CERTIFICATE-----\nMIIFake\n-----END CERTIFICATE-----\n"
    )
    assert scan_bundle(app) == []
