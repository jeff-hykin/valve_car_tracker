import { FileSystem, glob } from "https://deno.land/x/quickr@0.6.26/main/file_system.js"
import { Console } from "https://deno.land/x/quickr@0.6.26/main/console.js"
import { run, Stdin, Stdout, Stderr, returnAsString, hasCommand } from "https://deno.land/x/quickr@0.6.26/main/run.js"
import { generateKeys, encrypt, decrypt, hashers } from "https://deno.land/x/good@0.7.11/encryption.js"

// todo:
    // git.addToGitIgnore()

// indent everything
const realLog = console.log; console.log = (...args)=>realLog(`    `,...args)

export default ({id, virkshop, shortTermColdStorage, longTermColdStorage, shellApi, shortTermDoOneTime, longTermDoOneTime })=>({
    settings: {
        virtualEnvFolder: `${virkshop.pathTo.project}/.venv`,
        requirementsTxtPath: `${virkshop.pathTo.project}/requirements.txt`,
    },
    systemTools: `
        # 
        # 
        # Python
        # 
        # 
        - (package):
            load: [ "python38",]
            asBuildInput: true

        - (package):
            load: [ "python38Packages", "setuptools" ]
            asBuildInput: true

        - (package):
            load: [ "python38Packages", "pip" ]
            asBuildInput: true

        - (package):
            load: [ "python38Packages", "virtualenv" ]
            asBuildInput: true

        - (package):
            load: [ "python38Packages", "wheel" ]
            asBuildInput: true
    `,
    commands: {
        async pip(args) {
            // always use the version connected to python, and disable the version check, but otherwise be the same
            await run("python", "-m", "pip", "--disable-pip-version-check", ...args)
        },
    },
    events: {
        // async '@setup_without_system_tools/054_000_setup_python_venv'() {
        // 
        // },
        async '@setup_with_system_tools/054_000_setup_python_venv'() {
            // having a TMPDIR is required for venv to work
            const TMPDIR      = Console.env.TMPDIR      = `${virkshop.pathTo.fakeHome}/tmp.cleanable`
            const VIRTUAL_ENV = Console.env.VIRTUAL_ENV = this.settings.virtualEnvFolder
            const PATH        = Console.env.PATH        = `${this.settings.virtualEnvFolder}/bin:${virkshop.pathTo.fakeHome}/.local/bin:${Console.env.PATH}`
            
            await FileSystem.ensureIsFolder(TMPDIR)
            
            // 
            // regenerate venv if needed
            // 
            const pythonVersion = await run`python --version ${Stdout(returnAsString)}`
            const oldPythonVersion = virkshop.longTermColdStorage.get('pythonVersion')
            const pythonVersionChangedSinceLastTime = oldPythonVersion && oldPythonVersion !== pythonVersion
            if (pythonVersionChangedSinceLastTime) {
                if (await Console.askFor.yesNo(`\nIt looks like your python version has changed from ${oldPythonVersion} to ${pythonVersion}\nIt is highly recommended to regenerate your python venv when this happens.\nWould you like me to go ahead and do that?`)) {
                    this.events['purge/054_000_python_venv']()
                }
            } else {
                virkshop.longTermColdStorage.set('pythonVersion',  pythonVersion)
            }
            
            // 
            // create venv if needed
            // 
            const virtualEnvPath = await FileSystem.info(VIRTUAL_ENV)
            if (virtualEnvPath.isFolder) {
                console.log(`creating virtual env for python`)
                // clean first
                await this.events['clean/054_000_python_venv']()
                // then create venv
                const { success } = await run`python -m venv ${this.settings.virtualEnvFolder}`
                if (success) {
                    // 
                    // install pip modules if needed
                    // 
                    this.methods.cachedInstallFromRequirementsTxt()

                    // export ENV variables
                    virkshop.shellApi.overwriteEnvVars({
                        PATH,
                        TMPDIR,
                        VIRTUAL_ENV,
                    })
                }
            }
        },
        async 'clean/054_000_python_venv'() {
            for (const eachFolder of await glob('**/__pycache__')) {
                FileSystem.remove(eachFolder)
            }
        },
        async 'purge/054_000_python_venv'() {
            await Promise.all([
                FileSystem.remove(pythonVenv.VIRTUAL_ENV),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/.cache/pip`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/.cache/pypoetry/`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/.local/share/virtualenv`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/.config/pypoetry`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/.config/matplotlib`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/.ipython`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/.jupyter`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/.keras`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/.local/share/jupyter`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/.python_history`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/Library/Application Support/pypoetry`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/Library/Application Support/virtualenv`),
                FileSystem.remove(`${virkshop.pathTo.fakeHome}/Library/Library/Preferences/pypoetry`),
                // for future poetry support:
                // ;((async ()=>{
                //     if (await hasCommand(`poetry`)) {
                //         run`poetry cache clear . --all ${Stdin(`yes\nyes\nyes\nyes\nyes\nyes\nyes\nyes\nyes\n`)}`
                //     }
                // })())
            ])
        },
        async 'git/post-update/054_000_python_venv'() {
            this.settings.cachedInstallFromRequirementsTxt() 
        },
    },
    methods: {
        async cachedInstallFromRequirementsTxt() {
            const requirmentsTxtContents = await FileSystem.read(this.settings.requirementsTxtPath)
            if (!requirmentsTxtContents) {
                return
            } else {
                const requirementsTxtKey = 'requirements.txt:hash'
                const hash = await hashers.sha256(
                    await FileSystem.read(this.settings.requirementsTxtPath)
                )
                const oldHash = virkshop.shortTermColdStorage.get(requirementsTxtKey)
                if (hash === oldHash) {
                    console.log(`[python] skipping pip install because requirements.txt seems unchanged`)
                } else {
                    console.log(`[python] runing pip install because requirements.txt seems different`)
                    const { success } = await run`python -m pip install --disable-pip-version-check install -r ${this.settings.requirementsTxtPath}`
                    if (success) {
                        console.log(`[python] pip install finished successfully`)
                        virkshop.shortTermColdStorage.set(requirementsTxtKey, hash)
                    }
                }
            }
        },
    },
})