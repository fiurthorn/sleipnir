[private]
default:
	@just --list

mod chatmate 'apps/chatmate/Justfile'
mod notemate 'apps/notemate/Justfile'

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
    deno check packages/sleipnir/mod.ts packages/sleipnir/src/client/main.ts apps/chatmate/main.ts apps/notemate/main.ts

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
update-dependencies:
    deno update

[group('lifecycle')]
build-css:
    @just chatmate build-css
    @just notemate build-css

[group('lifecycle')]
build-client:
    deno run -A npm:esbuild packages/sleipnir/src/client/main.ts --bundle --format=iife --outfile=packages/sleipnir/static/sleipnir-client.min.js --minify
    @cp packages/sleipnir/static/sleipnir-client.min.js apps/notemate/static/sleipnir-client.min.js
    @cp packages/sleipnir/static/sleipnir-client.min.js apps/chatmate/static/sleipnir-client.min.js
    @echo "✅ Sleipnir Client gebündelt und verteilt."

[group('lifecycle')]
build: build-client build-css


