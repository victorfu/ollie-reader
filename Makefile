# Ollie Reader — project task runner
#
#   Frontend : React + Vite          (managed with npm)
#   Desktop  : PySide6 + FastAPI      (managed with uv, lives in ./desktop)
#
# Run `make` or `make help` to list targets.

DESKTOP := desktop
UV      := uv
NPM     := npm

.DEFAULT_GOAL := help

.PHONY: help setup install desktop-setup \
        dev build lint preview \
        desktop-serve desktop-run desktop-test desktop-models desktop-icon desktop-package desktop-package-clean desktop-clean \
        desktop-verify desktop-dmg desktop-release \
        test clean

help: ## List available targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ── Setup ─────────────────────────────────────────────────────────────────
setup: install desktop-setup ## Install everything (frontend + desktop)

install: ## Install frontend deps (npm)
	$(NPM) install

desktop-setup: ## Create the desktop venv and install deps via uv (incl. dev tools)
	$(UV) sync --directory $(DESKTOP)

# ── Frontend (web) ────────────────────────────────────────────────────────
dev: ## Run the Vite dev server (http://localhost:5173)
	$(NPM) run dev

build: ## Type-check + production build of the web app
	$(NPM) run build

lint: ## ESLint the web app
	$(NPM) run lint

preview: ## Preview the production web build
	$(NPM) run preview

# ── Desktop (PySide6 + sidecar) ───────────────────────────────────────────
desktop-serve: ## Run the local API sidecar only (http://127.0.0.1:8765)
	$(UV) run --directory $(DESKTOP) python main.py --serve

desktop-run: ## Run the PySide6 tray shell (it manages the sidecar)
	$(UV) run --directory $(DESKTOP) python main.py

desktop-test: ## Run the desktop pytest suite
	$(UV) run --directory $(DESKTOP) pytest -v

desktop-models: ## 下載 dev 用的 TTS 模型檔到 desktop/models/
	cd desktop && uv run python -m server.model_download

desktop-icon: ## Generate assets/AppIcon.icns from tray-icon.png
	bash $(DESKTOP)/release/make_icon.sh

desktop-package: ## Build the frozen binary with PyInstaller (incremental -> desktop/dist/)
	$(UV) sync --directory $(DESKTOP) --group chatterbox-mlx
	$(UV) run --directory $(DESKTOP) pyinstaller ollie-reader-desktop.spec --noconfirm

desktop-package-clean: ## Clean build of the frozen binary (drops PyInstaller cache)
	$(UV) sync --directory $(DESKTOP) --group chatterbox-mlx
	$(UV) run --directory $(DESKTOP) pyinstaller ollie-reader-desktop.spec --noconfirm --clean

desktop-clean: ## Remove PyInstaller build/dist artifacts
	rm -rf $(DESKTOP)/build $(DESKTOP)/dist

desktop-verify: ## Scan the built .app for secrets/.env (fails if any found)
	$(UV) run --directory $(DESKTOP) python release/verify_bundle.py dist/ollie-reader.app

desktop-dmg: ## Build a signed + notarized dmg (requires .env.package)
	bash $(DESKTOP)/release/package_macos.sh

desktop-release: desktop-dmg ## Publish the dmg to GitHub Releases as desktop-v<version>
	bash $(DESKTOP)/release/release_github.sh

# ── Aggregate ─────────────────────────────────────────────────────────────
test: desktop-test ## Run all test suites
clean: desktop-clean ## Remove build artifacts
