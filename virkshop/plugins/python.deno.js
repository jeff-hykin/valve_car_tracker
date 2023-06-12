import { FileSystem, glob } from "https://deno.land/x/quickr@0.6.26/main/file_system.js"
import { Console } from "https://deno.land/x/quickr@0.6.26/main/console.js"
import { run, Stdin, Stdout, Stderr, returnAsString, hasCommand } from "https://deno.land/x/quickr@0.6.26/main/run.js"
import { generateKeys, encrypt, decrypt, hashers } from "https://deno.land/x/good@0.7.18/encryption.js"

// todo:
    // git.addToGitIgnore()

// indent everything
export default ({id, pluginSettings, virkshop, shellApi, helpers })=>({
    settings: {
        virtualEnvFolder: `${virkshop.pathTo.project}/.venv`,
        requirementsTxtPath: `${virkshop.pathTo.project}/requirements.txt`,
        ...pluginSettings,
    },
    commands: {
        async pip(args) {
            // always use the version connected to python, and disable the version check, but otherwise be the same
            await run("python", "-m", "pip", "--disable-pip-version-check", ...args)
        },
    },
    events: {
        // async '@setup_without_system_tools/python'() {
        //    return {
        //        // deadlines are in chronological order (top is the shortest/soonest)
        //        // HOWEVER, the startup time will be optimized if code is
        //        // placed in the bottom-most deadline (last deadline)
        //        // because of async/concurrent computations
        //        async beforeSetup(virkshop) {
        //            // virkshop.injectUsersCommand("sudo")
        //        },
        //        async beforeReadingSystemTools(virkshop) {
        //        },
        //        async beforeShellScripts(virkshop) {
        //        },
        //        async beforeEnteringVirkshop(virkshop) {
        //        },
        //     }
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
            const oldPythonVersion = helpers.longTermColdStorage.get('pythonVersion')
            const pythonVersionChangedSinceLastTime = oldPythonVersion && oldPythonVersion !== pythonVersion
            if (pythonVersionChangedSinceLastTime) {
                if (await Console.askFor.yesNo(`\nIt looks like your python version has changed from ${oldPythonVersion} to ${pythonVersion}\nIt is highly recommended to regenerate your python venv when this happens.\nWould you like me to go ahead and do that?`)) {
                    this.events['purge/054_000_python_venv']()
                }
            } else {
                helpers.longTermColdStorage.set('pythonVersion',  pythonVersion)
            }
            
            // 
            // create venv if needed
            // 
            const virtualEnvPath = await FileSystem.info(VIRTUAL_ENV)
            let shellStatements = []
            if (virtualEnvPath.isFolder) {
                console.log(`        [python] creating virtual env for python`)
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
                    shellStatements.push(   shellApi.modifyEnvVar({ name: "PATH"       , overwriteAs: PATH        })   )
                    shellStatements.push(   shellApi.modifyEnvVar({ name: "TMPDIR"     , overwriteAs: TMPDIR      })   )
                    shellStatements.push(   shellApi.modifyEnvVar({ name: "VIRTUAL_ENV", overwriteAs: VIRTUAL_ENV })   )
                }
            }
            return shellStatements
        },
        async 'clean/054_000_python_venv'() {
            for (const eachFolder of await glob('**/__pycache__')) {
                FileSystem.remove(eachFolder)
            }
        },
        async 'purge/054_000_python_venv'() {
            await Promise.all([
                FileSystem.remove(this.settings.virtualEnvFolder),
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
            this.methods.cachedInstallFromRequirementsTxt() 
        },
    },
    methods: {
        async cachedInstallFromRequirementsTxt() {
            const requirementsTxtPath = await FileSystem.info(this.settings.requirementsTxtPath)
            if (requirementsTxtPath.exists) {
                await helpers.changeChecker({
                    checkName: "requirements.txt",
                    filePaths: [ this.settings.requirementsTxtPath ],
                    values: [],
                    executeOnFirstTime: true,
                    whenNoChange: ()=>{
                        console.log(`        [python] skipping pip install because requirements.txt seems unchanged`)
                    },
                    whenChanged: async ()=>{
                        console.log(`        [python] runing pip install because requirements.txt seems different`)
                        const { success } = await run`python -m pip install --disable-pip-version-check install -r ${this.settings.requirementsTxtPath}`
                        if (success) {
                            console.log(`        [python] pip install finished successfully`)
                            helpers.shortTermColdStorage.set(requirementsTxtKey, hash)
                        } else {
                            console.error(`        [python] pip install failed, see output above`)
                            throw Error(``) // throw error so changeChecker() knows not to cache the change (will keep triggering until runs without errors)
                        }
                    },
                })
            }
        },
    },
})