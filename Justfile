[private]
default:
	@just --list

mod chatmate 'apps/chatmate/Justfile'
mod notemate 'apps/notemate/Justfile'
mod scanmate 'apps/scanmate/Justfile'

version := replace(replace_regex(`git describe --tags --always --match=v*`, "v|-g.*", ""), "-", ".")

[group('lifecycle')]
get-version:
    @echo {{ version }}

[private]
guard-clean:
    @test -z "$(git status --porcelain)" || (echo "\n⛔ CRITICAL: Git working directory is dirty!\n   Committe deine Änderungen, bevor du ein Paket baust.\n" && exit 1)

[group('lifecycle')]
create-version tag: guard-clean
    git tag -a "v{{ tag }}" -m "Version {{ tag }}"
    git push origin "v{{ tag }}" --tags
    git push

[group('lifecycle')]
install-hooks:
    @mkdir -p .git/hooks
    @ln -sf ../../utils/hooks/pre-commit .git/hooks/pre-commit
    @chmod +x utils/hooks/pre-commit
    @echo "✅ Pre-Commit Hook installiert (.git/hooks/pre-commit -> utils/hooks/pre-commit)"

[group('lifecycle')]
check:
    deno check
    deno fmt
    deno lint --fix

[group('lifecycle')]
test:
    deno test -P=app

[group('lifecycle')]
lint:
    deno lint

[group('lifecycle')]
fmt:
    deno fmt

[group('lifecycle')]
fmt-notes:
    @just notemate fmt-notes


[group('lifecycle')]
update-dependencies:
    deno update

[group('lifecycle')]
build-css:
    @just chatmate build-css
    @just notemate build-css
    @just scanmate build-css

[group('lifecycle')]
generate-version:
    @rm -f "packages/sleipnir/src/version.g.ts"
    echo "// Automatisch generiert - nicht editieren" > "packages/sleipnir/src/version.g.ts"
    echo "export const VERSION = \"{{version}}\";" >> "packages/sleipnir/src/version.g.ts"
    @echo "✅ version.ts mit Version {{version}} erstellt."

[group('lifecycle')]
build-client: generate-version update-libs
    deno run -A npm:esbuild packages/sleipnir/src/client/main.ts --bundle --format=iife --outfile=packages/sleipnir/static/sleipnir-client.min.js --minify
    @cp packages/sleipnir/static/sleipnir-client.min.js apps/notemate/static/sleipnir-client.min.js
    @cp packages/sleipnir/static/sleipnir-client.min.js apps/chatmate/static/sleipnir-client.min.js
    @cp packages/sleipnir/static/sleipnir-client.min.js apps/scanmate/static/sleipnir-client.min.js
    @echo "✅ Sleipnir Client gebündelt und verteilt."

[group('lifecycle')]
build: build-client build-css sync-hub

[group('lifecycle')]
sync-hub:
    @echo "sync-hub: Noch nicht implementiert."


vendor_dir := "packages/sleipnir/static/vendor"

[group('vendor')]
update-libs:
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/mask@3.x.x/dist/cdn.min.js"     "alpine-mask.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/persist@3.x.x/dist/cdn.min.js"  "alpine-persist.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/focus@3.x.x/dist/cdn.min.js"    "alpine-focus.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3.x.x/dist/cdn.min.js" "alpine-collapse.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/csp@3.x.x/dist/cdn.min.js"      "alpine.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/marked/marked.min.js"                     "marked.min.js"
    just update-vendor "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js" "highlight.min.js"
    just update-vendor "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/nord.min.css" "nord.min.css"
    just update-vendor "https://cdn.jsdelivr.net/npm/minisearch@7.1.1/dist/umd/index.min.js"   "minisearch.min.js"
    just sync-vendor

[private]
update-vendor url vendor:
    @mkdir -p {{vendor_dir}}
    @curl -sL "{{url}}" -o "{{vendor_dir}}/{{vendor}}"
    @echo "✅ Download: {{vendor_dir}}/{{vendor}}"
    @zopfli "{{vendor_dir}}/{{vendor}}"
    @brotli -kf "{{vendor_dir}}/{{vendor}}"
    @echo "✅ Komprimiert: {{vendor}}"

[group('vendor')]
sync-vendor:
    @mkdir -p apps/chatmate/static/vendor apps/notemate/static/vendor apps/scanmate/static/vendor
    @cp -r {{vendor_dir}}/* apps/chatmate/static/vendor/
    @cp -r {{vendor_dir}}/* apps/notemate/static/vendor/
    @cp -r {{vendor_dir}}/* apps/scanmate/static/vendor/
    @echo "✅ Vendor-Assets synchronisiert nach Chatmate, Notemate & Scanmate."


