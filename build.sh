emcc \
  ./blackbox-os-base/api_impl.c \
  ./blackbox-os-base/executor.c \
  ./blackbox-os-wasm/plat_hal.c \
  ./blackbox-os-wasm/plat_main.c \
  ./intermediate_files/user.c \
  -o ./intermediate_files/user.js \
  -I ./blackbox-os-base/ \
  --js-library ./blackbox-os-wasm/jslib.js \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORTED_FUNCTIONS="['_plat_init','_plat_tick']"
