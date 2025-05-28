const express = require('express');
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

// the fun part: compilation
app.post('/compile', async (req, res) => {
    const data = req.body;
    const code = data.code;
    const codeId = generateCodeId(code);
    console.log(`Received code with id ${codeId}`);
    if (code.length > 1000000){
        res.status(400).json({ error: "Code is too long. 1MB ought to be enough for anyone.", codeId });
        return
    }
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
                `-s EXPORTED_FUNCTIONS="['_plat_init','_plat_tick']" ` +
                "-sEXPORTED_RUNTIME_METHODS=HEAP8 " + // now needed for emscripten 4.0.7 (:
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
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    });
