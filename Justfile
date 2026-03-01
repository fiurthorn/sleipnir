[private]
default:
	@just --list

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

LINUX_MAIN:="main"
WINDOWS_MAIN:="main.exe"
JS_MAIN:="main.js"

clean:
    rm -f "dist/{{LINUX_MAIN}}" "dist/{{WINDOWS_MAIN}}" "dist/{{JS_MAIN}}"

dist-clean: clean
     rm -rf node_modules deno.lock

get-dependencies:
    deno cache --reload main.ts main_test.ts

update-dependencies: update-libs
    deno update

[private]
update-vendor url vendor:
    @mkdir -p static/vendor
    @curl -sL "{{url}}" -o "static/vendor/{{vendor}}"

update-libs:
    just update-vendor "https://unpkg.com/htmx.org/dist/htmx.min.js"                           "htmx.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/mask@3.x.x/dist/cdn.min.js"     "alpine-mask.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/persist@3.x.x/dist/cdn.min.js"  "alpine-persist.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/focus@3.x.x/dist/cdn.min.js"    "alpine-focus.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3.x.x/dist/cdn.min.js" "alpine-collapse.min.js"
    just update-vendor "https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"           "alpine.min.js"

watch-css:
    deno run -A "npm:@tailwindcss/cli" -i ./src/input.css -o ./static/styles.css --watch

build-css:
    deno run -A "npm:@tailwindcss/cli" -i ./src/input.css -o ./static/styles.css

run:
     deno -P=app --watch main.ts

compile-all: compile-windows compile-linux compile-javascript

compile-javascript:
    deno bundle -o "dist/{{JS_MAIN}}" "main.ts"

compile-windows:
    deno compile -P=app --icon main.ico --target "x86_64-pc-windows-msvc" -o "dist/{{WINDOWS_MAIN}}" "main.ts"

compile-linux:
    deno compile -P=app --target "x86_64-unknown-linux-gnu" -o "dist/{{LINUX_MAIN}}" "main.ts"

