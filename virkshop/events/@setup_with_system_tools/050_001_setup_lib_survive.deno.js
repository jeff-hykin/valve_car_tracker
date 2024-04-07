import { FileSystem } from "https://deno.land/x/quickr@0.6.66/main/file_system.js"
import { Console } from "https://deno.land/x/quickr@0.6.66/main/console.js"
import { run, Stdout, Stderr, Timeout} from "https://deno.land/x/quickr@0.6.66/main/run.js"

const localLibSurviveCopy = `${Console.env.PROJECT_FOLDER}/repos/libsurvive`
const libSurviveConfig = `${FileSystem.home}/.config/libsurvive/config.json`
const localRulesFile = `${localLibSurviveCopy}/useful_files/81-vive.rules`

await FileSystem.ensureIsFolder(
    FileSystem.parentPath(libSurviveConfig)
)

// 
// first time setup
// 
const configInfo = await FileSystem.info(libSurviveConfig)
if (!configInfo.exists && Deno.build.os == 'linux' ) {
    console.log("        I see the libsurvive config hasn't been created yet, so I'm going to do some inital setup")
    console.log("        I'm going to run the commands from the 'Getting Started' area, which require sudo")
    console.log("        https://github.com/cntools/libsurvive/tree/ec902cc048baecbca3d704482d3923bdb84a1e7d#getting-started")
    try {
        await run`${`${Console.env.VIRKSHOP_FOLDER}/commands/sudo`} rm -f ${`/etc/udev/rules.d/${FileSystem.basename(localRulesFile)}`} ${Stdout(null)} ${Stderr(null)}`
        await run`${`${Console.env.VIRKSHOP_FOLDER}/commands/sudo`} cp ${localRulesFile} /etc/udev/rules.d/`
        await run`${`${Console.env.VIRKSHOP_FOLDER}/commands/sudo`} udevadm control --reload-rules`
        await run(`survive-cli`, Timeout({ gentlyBy: 4000, waitBeforeUsingForce: 1000}))
    } catch (error) {
        console.error(error)
    }
}