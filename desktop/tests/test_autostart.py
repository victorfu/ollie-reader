import plistlib

from shell import autostart


def test_install_writes_plist(tmp_path):
    path = autostart.install(["/Applications/ollie.app", "--serve"], home=tmp_path)
    assert path.exists()
    with open(path, "rb") as f:
        data = plistlib.load(f)
    assert data["Label"] == autostart.LABEL
    assert data["ProgramArguments"] == ["/Applications/ollie.app", "--serve"]
    assert data["RunAtLoad"] is True
    assert data["KeepAlive"] is False


def test_is_installed_and_uninstall(tmp_path):
    assert autostart.is_installed(home=tmp_path) is False
    autostart.install(["/x"], home=tmp_path)
    assert autostart.is_installed(home=tmp_path) is True
    autostart.uninstall(home=tmp_path)
    assert autostart.is_installed(home=tmp_path) is False
