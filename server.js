const express = require('express');
const {rateLimit} = require('express-rate-limit');
const morgan = require('morgan');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec)
const fs = require('fs/promises');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(morgan('dev'));

const port = process.env.PORT || 3000;

// static files
app.use('/editor', express.static('editor'));
app.use('/gallery', express.static('gallery'));
app.use('/assets', express.static('assets'));
app.use('/intermediate_files', express.static('intermediate_files'));
app.use('/examples', express.static('examples'));
// static files in root: index.hrml, style.css, script.js, favicon.svg
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
    });
app.get("/style.css", (req, res) => {
    res.sendFile(__dirname + '/style.css');
    });
app.get("/script.js", (req, res) => {
    res.sendFile(__dirname + '/script.js');
    });
app.get("/favicon.svg", (req, res) => {
    res.sendFile(__dirname + '/favicon.svg');
    });
app.get('/docs/api.md', (req, res) => {
    res.sendFile(__dirname + '/docs/api.md');
    })

function generateCodeId(code){
    return crypto.createHash('sha256').update(code).digest('base64url');
}

const limiter = rateLimit({
    windowMs: 8000, // 8 seconds
    max: 3, // limit each IP to 3 requests per windowMs
    message: {error: "Too many requests, please don't spam compile."},
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
// the fun part: compilation
app.post('/compile', limiter, async (req, res) => {
    const data = req.body;
    const rawCode = data.code;
    // redefine millis and setup to avoid conflict w/ arduino api
    const code = "#define millis bb_millis\n#define setup user_setup\n" + rawCode + "\n#undef millis\n#undef setup\n";

    const codeId = generateCodeId(code);
    console.log(`Received code with id ${codeId}`);
    if (code.length > 1000000){
        res.status(400).json({ error: "Code is too long. 1MB ought to be enough for anyone.", codeId });
        return
    }

    if (data.compileUF2){
        try {
            await fs.access(__dirname + "/intermediate_files/" + codeId + "/blackbox-os-arduino.ino.uf2");
            console.log(`Using existing UF2 with id ${codeId}`);
            res.json({ codeId });
            return
        } catch (err){
            // file doesn't exist, so we need to compile
            await fs.mkdir(__dirname + "/intermediate_files/" + codeId, { recursive: true });
            await fs.writeFile(__dirname + "/intermediate_files/" + codeId + "/" + codeId + ".c", code);
            await fs.writeFile(__dirname + "/intermediate_files/" + codeId + "/" + codeId + ".h", "// this file only exists so the IDE picks up on it as a lib"); 
            try{
                await exec(
                    "arduino-cli compile --fqbn rp2040:rp2040:rpipico " +
                    "--config-file ./arduino-cli.yaml " +
                    `--output-dir ./intermediate_files/${codeId} ` +
                    "--library ./blackbox-os-base/ " +
                    `--library ./intermediate_files/${codeId} ` +
                    `--build-property 'compiler.flags=-march=armv6-m -mcpu=cortex-m0plus -mthumb -ffunction-sections -fdata-sections -fno-exceptions -DUSER_CODE_LIB="${codeId}.h"' ` +
                    `./blackbox-os-arduino/blackbox-os-arduino.ino`
                )
                // to explain that build-property mess, that's the least bad way I found to define things on the command line
            } catch (err){
                console.log(err);
                res.status(400).json({ error: err.stderr, codeId });
                return
            }
            // now send back the codeId
            res.json({ codeId });
        }
    } else {
        // only recompile if the code doesn't already exist
        // checking for the wasm means we'll always recompile if there's a compiler error
        try{
            await fs.access(__dirname + "/intermediate_files/" + codeId + ".js");
            console.log(`Using existing code with id ${codeId}`);
            res.json({ codeId });
            return
        } catch (err){
            // file doesn't exist, so we need to compile
            await fs.writeFile(__dirname + "/intermediate_files/" + codeId + ".c", code);
            try{
                // stupid
                await exec(
                    "emcc " +
                    "./blackbox-os-base/api_impl.c " +
                    "./blackbox-os-base/executor.c " +
                    "./blackbox-os-wasm/plat_hal.c " +
                    "./blackbox-os-wasm/plat_main.c " +
                    `./intermediate_files/${codeId}.c ` +
                    `-o ./intermediate_files/${codeId}.js ` +
                    "-I ./blackbox-os-base/ " +
                    "--js-library ./blackbox-os-wasm/jslib.js " +
                    "-s WASM=1 " +
                    "-s MODULARIZE=1 " +
                    "-s EXPORT_ES6=1 " +
                    "-sEXPORTED_RUNTIME_METHODS=HEAP8 " + // now needed for emscripten 4.0.7 (:
                    `-s EXPORTED_FUNCTIONS="['_plat_init','_plat_tick']" ` +
                    "-Werror=incompatible-function-pointer-types-strict"
                )
            } catch (err){
                console.log(err);
                res.status(400).json({ error: err.stderr, codeId });
                return
            }
            // now send back the codeId
            res.json({ codeId });
        }
    }
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    });
