[private]
default:
	@just --list

mod cookmate 'apps/cookmate/Justfile'
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
    deno check packages/sleipnir/mod.ts apps/cookmate/main.ts apps/chatmate/main.ts apps/notemate/main.ts

[group('lifecycle')]
test:
    deno test

[group('lifecycle')]
lint:
    deno lint

[group('lifecycle')]
fmt:
    deno fmt

[group('lifecycle')]
update-dependencies:
    deno update

[group('cookmate')]
dev-cookmate:
    deno run -P=app --watch apps/cookmate/main.ts

[group('cookmate')]
build-css-cookmate:
    deno run -A "npm:@tailwindcss/cli" -i ./apps/cookmate/src/input.css -o ./apps/cookmate/static/styles.css

[group('cookmate')]
watch-css-cookmate:
    deno run -A "npm:@tailwindcss/cli" -i ./apps/cookmate/src/input.css -o ./apps/cookmate/static/styles.css --watch

[group('chatmate')]
dev-chatmate:
    deno run -P=app --watch apps/chatmate/main.ts

[group('chatmate')]
build-css-chatmate:
    deno run -A "npm:@tailwindcss/cli" -i ./apps/chatmate/src/input.css -o ./apps/chatmate/static/styles.css

[group('chatmate')]
watch-css-chatmate:
    deno run -A "npm:@tailwindcss/cli" -i ./apps/chatmate/src/input.css -o ./apps/chatmate/static/styles.css --watch

[group('notemate')]
dev-notemate:
    deno run -P=app --watch apps/notemate/main.ts

[group('notemate')]
build-css-notemate:
    deno run -A "npm:@tailwindcss/cli" -i ./apps/notemate/src/input.css -o ./apps/notemate/static/styles.css

[group('notemate')]
watch-css-notemate:
    deno run -A "npm:@tailwindcss/cli" -i ./apps/notemate/src/input.css -o ./apps/notemate/static/styles.css --watch

[group('lifecycle')]
build-css: build-css-cookmate build-css-chatmate build-css-notemate
