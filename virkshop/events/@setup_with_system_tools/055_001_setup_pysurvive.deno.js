import { FileSystem, glob } from "https://deno.land/x/quickr@0.6.31/main/file_system.js"
import { Console } from "https://deno.land/x/quickr@0.6.31/main/console.js"
import { run, Stdout, Stderr } from "https://deno.land/x/quickr@0.6.31/main/run.js"

// depends on
    // system_tools having a variable named "cc" with a lib folder
    // patchelf executable
    // VIRTUAL_ENV existing

if (Console.env.VIRTUAL_ENV) {
    const ccLibsFolder = JSON.parse(Deno.env.get("VIRKSHOP_NIX_SHELL_DATA")).libraryPaths['cc']
    const venvInfo = await FileSystem.info(Console.env.VIRTUAL_ENV)
    if (!ccLibsFolder) {
        console.log(`\n\n        I expected the system_tools.yaml to have a \`saveVariableAs: cc\`\n        Usually something like:\n            - (package):\n                load: [ "stdenv", "cc", "cc" ]\n                saveVariableAs: cc\n\n        but I didn't see one, or the lib folder didnt exist\n`)
    } else {
        if (venvInfo.isFolder) {
            console.log("\n\n        running libsurvive patch")
            const sharedObjectFiles = await glob(`${Console.env.VIRTUAL_ENV}/lib/**/*.so`)
            for (const eachSharedObjectFile of sharedObjectFiles) {
                // intentionally not awaited
                run`patchelf --set-rpath ${ccLibsFolder} ${eachSharedObjectFile}`
            }
        } else {
            console.log("\n\n        NOTE: you're probably going to need to do a 'pip install pysurvive'\n        and THEN exit, and run virkshop/enter again\n\n")
        }
    }
}