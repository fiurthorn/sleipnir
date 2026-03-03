[private]
default:
	@just --list

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
generate-version:
    @rm -f "src/version.g.ts"
    echo "// Automatisch generiert - nicht editieren" > "src/version.g.ts"
    echo "export const VERSION = \"{{version}}\";" >> "src/version.g.ts"
    @echo "✅ version.ts mit Version {{version}} erstellt."

#  -A, --allow-all
#  -P, --permission-set[=<NAME>]
#  -R, --allow-read
#  -W, --allow-write
#  -I, --allow-import
#  -N, --allow-net
#  -E, --allow-env
#  -S, --allow-sys
#      --allow-run
#      --allow-ffi

[group('lifecycle')]
clean:
    rm -f "dist/index.js"

[group('lifecycle')]
dist-clean: clean
     rm -rf node_modules deno.lock

[group('lifecycle')]
get-dependencies:
    deno cache --reload main.ts main_test.ts

[group('lifecycle')]
update-dependencies: update-libs
    deno update

[private]
update-vendor url vendor:
    @mkdir -p static/vendor
    @curl -sL "{{url}}" -o "static/vendor/{{vendor}}"
    @gzip -kf "static/vendor/{{vendor}}"

[group('lifecycle')]
update-libs:
    just update-vendor "https://unpkg.com/htmx.org/dist/htmx.min.js"                           "htmx.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/mask@3.x.x/dist/cdn.min.js"     "alpine-mask.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/persist@3.x.x/dist/cdn.min.js"  "alpine-persist.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/focus@3.x.x/dist/cdn.min.js"    "alpine-focus.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3.x.x/dist/cdn.min.js" "alpine-collapse.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/csp@3.x.x/dist/cdn.min.js"      "alpine.min.js"

[group('lifecycle')]
watch-css:
    deno run -A "npm:@tailwindcss/cli" -i ./src/input.css -o ./static/styles.css --watch

[group('lifecycle')]
build-css:
    deno run -A "npm:@tailwindcss/cli" -i ./src/input.css -o ./static/styles.css

[group('lifecycle')]
run:
     deno -P=app --watch main.ts

[group('lifecycle')]
compile-all: compile-javascript

[group('lifecycle')]
compile-javascript: generate-version
    deno bundle -o "dist/index.js" "main.ts"
