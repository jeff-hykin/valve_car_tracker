import { FileSystem, glob } from "https://deno.land/x/quickr@0.6.64/main/file_system.js"
import { run, throwIfFails, zipInto, mergeInto, returnAsString, Timeout, Env, Cwd, Stdin, Stdout, Stderr, Out, Overwrite, AppendTo } from "https://deno.land/x/quickr@0.6.64/main/run.js"
import { Console, black, white, red, green, blue, yellow, cyan, magenta, lightBlack, lightWhite, lightRed, lightGreen, lightBlue, lightYellow, lightMagenta, lightCyan, blackBackground, whiteBackground, redBackground, greenBackground, blueBackground, yellowBackground, magentaBackground, cyanBackground, lightBlackBackground, lightRedBackground, lightGreenBackground, lightYellowBackground, lightBlueBackground, lightMagentaBackground, lightCyanBackground, lightWhiteBackground, bold, reset, dim, italic, underline, inverse, strikethrough, gray, grey, lightGray, lightGrey, grayBackground, greyBackground, lightGrayBackground, lightGreyBackground, } from "https://deno.land/x/quickr@0.6.64/main/console.js"
import { indent, findAll, escapeRegexMatch, escapeRegexReplace, } from "https://deno.land/x/good@0.7.18/string.js"
import { recursivelyAllKeysOf, get, set, remove, merge, compareProperty } from "https://deno.land/x/good@0.7.18/object.js"
import { intersection, subtract } from "https://deno.land/x/good@0.7.18/set.js"
import { stats, sum, spread, normalizeZeroToOne, roundedUpToNearest, roundedDownToNearest } from "https://deno.land/x/good@0.7.18/math.js"
import { zip } from "https://deno.land/x/good@0.7.18/array.js"
import { hashers } from "https://deno.land/x/good@0.7.18/encryption.js"
import { move as moveAndRename } from "https://deno.land/std@0.133.0/fs/mod.ts"
import { Type } from "https://deno.land/std@0.82.0/encoding/_yaml/type.ts"
import * as yaml from "https://deno.land/std@0.82.0/encoding/yaml.ts"
import * as Path from "https://deno.land/std@0.128.0/path/mod.ts"
import { nix } from "./nix_tools.js"


// 
// 
// Main
// 
// 
let debuggingLevel = false
const thisFile = FileSystem.thisFile
const virkshopIdentifierPath = `support/virkshop.js` // The only thing that can basically never change
const originalPathVar = Console.env.PATH
export const createVirkshop = async (arg)=>{
    var { virkshopPath, projectPath } = {...arg}
    virkshopPath = virkshopPath || Console.env.VIRKSHOP_FOLDER         // env var is used when already inside of the virkshop
    projectPath  = projectPath  || Console.env.PROJECT_FOLDER // env var is used when already inside of the virkshop

    const realHome = Console.env.VIRKSHOP_USERS_HOME || Console.env.HOME
    
    // 
    // auto-detect a virkshop path
    // 
    if (!virkshopPath) {
        const walkUpPath = await FileSystem.walkUpUntil(virkshopIdentifierPath, FileSystem.pathOfCaller())
        if (walkUpPath) {
            virkshopPath = walkUpPath
        // fallback case, caller must be in project, try looking for top level virkshop
        } else {
            projectPath = projectPath || FileSystem.pwd
            // try the most common place
            const defaultPlaceInfo = await FileSystem.info(`${projectPath}/virkshop/${virkshopIdentifierPath}`)
            if (defaultPlaceInfo.isFolder) {
                virkshopPath = defaultPlaceInfo
            } else {
                // time to brute force search for it
                const virkshopPaths = []
                const iterator = FileSystem.recursivelyIteratePathsIn(
                    projectPath,
                    {
                        searchOrder: 'breadthFirstSearch',
                        maxDepth: 2, // TODO: this may change in the future
                    },
                )
                for await (const eachPath of iterator) {
                    const eachInfo = await FileSystem.info(`${eachPath}/${virkshopIdentifierPath}`)
                    if (eachInfo.isFolder) {
                        virkshopPaths.push(eachInfo.path)
                    }
                }
                if (virkshopPaths.length == 1) {
                    virkshopPath = virkshopPaths[0]
                } else if (virkshopPaths.length >= 2) {
                    // TODO: although I want to give a warning here, if I did then there would be no way to get rid of it
                    // (beacuse the default virkshop object is always created first, and would throw an error before they get a chance to create their own)
                    return Error(`\n\n(This is the virkshop library speaking)\nI'm unable to load using the default methods because it seems there is more than one virkshop folder in the project.\nTo specify which one to use do\n    import { createVirkshop } from "..."\n    createVirkshop({ virkshopPath: "WHICH_FOLDER_HERE", projectPath: "" })\nAnd then specify which of the ones you want to use inside ${FileSystem.pathOfCaller()}\n`)
                } else if (virkshopPaths.length == 0) {
                    return Error(`\n\n(This is the virkshop library speaking)\nI'm unable to load using the default methods because I couldn't find any virkshop folders in the project.\nTo specify which one to use do\n    import { createVirkshop } from "..."\n    createVirkshop({ virkshopPath: "WHICH_FOLDER_HERE", projectPath: "" })\nAnd then specify which of the ones you want to use inside ${FileSystem.pathOfCaller()}\n`)
                }
            }
        }
    }
    
    const virkshopCache = {}
    const virkshop = Object.defineProperties(
        {
            version: [1,0,0,],
            settings: {}, // this is not valid until after phase1
            pathTo: Object.defineProperties(
                {
                    realHome,
                    virkshop: virkshopPath,
                    project: FileSystem.makeAbsolutePath(projectPath || FileSystem.parentPath(virkshopPath)),
                },
                {
                    events:           { get() { return `${virkshop.pathTo.virkshop}/events` }},
                    commands:         { get() { return `${virkshop.pathTo.virkshop}/commands` }},
                    plugins:          { get() { return `${virkshop.pathTo.virkshop}/plugins` }}, 
                    injections:       { get() { return `${virkshop.pathTo.temporary}/long_term/injections` }}, 
                    settings:         { get() { return `${virkshop.pathTo.virkshop}/settings` }},
                    temporary:        { get() { return `${virkshop.pathTo.virkshop}/temporary.ignore` }},
                    homeMixin:        { get() { return `${virkshop.pathTo.virkshop}/home` }},
                    fakeHome:         { get() { return `${virkshop.pathTo.temporary}/long_term/home` }},
                    virkshopOptions:  { get() { return `${virkshop.pathTo.virkshop}/settings.yaml` }},
                    systemTools:      { get() { return `${virkshop.pathTo.virkshop}/system_tools.yaml` }},
                    _tempNixShellFile:{ get() { return `${virkshop.pathTo.fakeHome}/shell.nix` }},
                }
            ),
            coreWarehouse: "https://github.com/NixOS/nixpkgs/archive/ce6aa13369b667ac2542593170993504932eb836.tar.gz",
            get shellApi() {
                return shellApi
            },
            _internal: {
                importedPlugins: {},
                autogeneratedEventPaths: [],
                homeMappingPriorities: [],
                shellSetupPriorities: [],
                finalShellCode: "",
                deadlines: {
                    beforeSetup: [],
                    beforeReadingSystemTools: [],
                    beforeShellScripts: [],
                    beforeEnteringVirkshop: [],
                },
                sortPrioitiesByPath(array, convert=each=>each) {
                    array.sort((each1, each2) => convert(each1).localeCompare(convert(each2)))
                },
                createApi({ source, eventName, deadlineName }) {
                    return {
                        ...virkshop,
                        source,
                        eventName,
                        addToShellProfile(string) {
                            if (deadlineName == "beforeEnteringVirkshop") {
                                throw Error(`
                                    There is a virkshop.addToShellProfile() inside a ${deadlineName}()
                                    In this file: ${this.source}
                                    
                                    The problem:
                                        The shell profile will already be done by the time of ${deadlineName}
                                    
                                    Likely solution:
                                        Change ${deadlineName}() to beforeShellScripts()
                                        Note: the available deadlines are:
                                            beforeSetup, beforeReadingSystemTools, beforeShellScripts, beforeEnteringVirkshop
                                `.replace(/\n                                /g,"\n"))
                            }
                            
                            virkshop._internal.shellSetupPriorities.push([ this.source, string ])
                        },
                        setEnvVar(name, value) {
                            if (deadlineName == "beforeEnteringVirkshop") {
                                throw Error(`
                                    There is a virkshop.setEnvVar() inside a ${deadlineName}()
                                    In this file: ${this.source}
                                    
                                    The problem:
                                        The shell profile will already be done by the time of ${deadlineName}
                                    
                                    Likely solution:
                                        Change ${deadlineName}() to beforeShellScripts()
                                        Note: the available deadlines are:
                                            beforeSetup, beforeReadingSystemTools, beforeShellScripts, beforeEnteringVirkshop
                                `.replace(/\n                                /g,"\n"))
                            }
                            
                            virkshop._internal.shellSetupPriorities.push([ this.source, `${name}=${shellApi.escapeShellArgument(value)}` ])
                        },
                        injectUsersCommand(commandName) {
                            virkshop._internal.deadlines.beforeEnteringVirkshop.push(((async ()=>{
                                const pathThatIsHopefullyGitIgnored = `${virkshop.pathTo.injections}/${commandName}`
                                const commandPath = `${virkshop.pathTo.commands}/${commandName}`
                                
                                await FileSystem.ensureIsFile(pathThatIsHopefullyGitIgnored)
                                
                                try {
                                    await FileSystem.remove(commandPath)
                                    await FileSystem.relativeLink({
                                        existingItem: pathThatIsHopefullyGitIgnored,
                                        newItem: commandPath,
                                        overwrite: true,
                                        force: true,
                                    })
                                } catch (error) {
                                    console.error(error)
                                }
                                
                                // TODO: there's a lot that could be optimized here since system commands are slow.
                                // Note: this command is intentionally never awaited because it only needs to be done by the time nix-shell starts, which takes multiple orders of magnitude more time (not awaiting lets it be done in parallel)
                                // FIXME: maybe use $SHELL instead of "sh"
                                run("sh", "-c", `command -v ${shellApi.escapeShellArgument(commandName)}`, Out(returnAsString)).catch(console.error).then(async (absolutePathToCommand)=>{
                                    if (absolutePathToCommand) {
                                        await FileSystem.write({
                                            path: pathThatIsHopefullyGitIgnored,
                                            data: `#!/usr/bin/env sh\n# NOTE: this command was auto-generated and is just a wrapper around the user's ${commandName.replace(/\n/,"")}\n`+`HOME=${shellApi.escapeShellArgument(virkshop.pathTo.realHome)} PATH=${shellApi.escapeShellArgument(originalPathVar)} ${absolutePathToCommand} "$@"`.replace(/\n/g, ""),
                                            overwrite: true,
                                        })
                                        await FileSystem.addPermissions({path: pathThatIsHopefullyGitIgnored, permissions: { owner: {canExecute: true} }})
                                    } else {
                                        await FileSystem.remove(pathThatIsHopefullyGitIgnored)
                                    }
                                })
                            })()))
                        },
                        linkRealHomeFolder(path) {
                            virkshop._internal.homeMappingPriorities.push({
                                relativePathFromHome: path,
                                target: FileSystem.makeAbsolutePath(`${virkshop.pathTo.realHome}/${path}`),
                                targetIsFile: false, // TODO: add a check/warning if home-thing exists and disagrees
                                source,
                            })
                        },
                        linkRealHomeFile(path) {
                            virkshop._internal.homeMappingPriorities.push({
                                relativePathFromHome: path,
                                target: FileSystem.makeAbsolutePath(`${virkshop.pathTo.realHome}/${path}`),
                                targetIsFile: true, // TODO: add a check/warning if home-thing exists and disagrees
                                source,
                            })
                        },
                    }
                },
                async fixupEventPathNumbers() {
                    const paths = await FileSystem.listFilePathsIn(virkshop.pathTo.events)
                    const pathsThatNeedRenaming = numberPrefixRenameList(paths)
                    const promises = []
                    for (const { oldPath, newPath } of pathsThatNeedRenaming) {
                        promises.push(moveAndRename(oldPath, newPath))
                    }
                    await Promise.all(promises)
                },
                async importPlugin(pluginPath) {
                    if (virkshop.options.debuggingLevel > 1) {
                        console.log(`    importing plugin: ${pluginPath}`)
                    }
                    // convert URLs to paths so that _importPlugin(import.meta.url) works without additional logic
                    if (pluginPath.startsWith("file://")) {
                        const {pathname} = new URL(pluginPath)
                        // from: https://deno.land/std@0.191.0/path/posix.ts?source#L459
                        pluginPath = decodeURIComponent(pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"))
                    }
                    const id = FileSystem.isRelativePath(pluginPath) ? pluginPath : FileSystem.makeRelativePath({ from: virkshop.pathTo.plugins, to: pluginPath })
                    if (virkshop._internal.importedPlugins[id]) {
                        return virkshop._internal.importedPlugins[id]
                    }
                    const pluginImport = await import(`${encodeURIComponent(`${virkshop.pathTo.plugins}/${pluginPath}`).replace(/%2F/g,'/')}`)
                    const pluginFunction = pluginImport.default
                    
                    const valuesKey = Symbol("values")
                    const directKey = valuesKey
                    const createColdStorageAndOneTimeDo = async (name) => {
                        const storagePath = `${virkshop.pathTo.temporary}/${name}/cold_storage/${id}.json`
                        let values
                        // 
                        // init values
                        // 
                            try {
                                values = JSON.parse(
                                    await FileSystem.read(storagePath)
                                )
                            } catch (error) {
                                const storagePathInfo = await FileSystem.info(storagePath)
                                if (storagePathInfo.isFile) {
                                    console.warn(`\n\nSeems a cold storage path was corrupted (${JSON.stringify(storagePath)}). It will be wiped out to start fresh\n`)
                                }
                                values = {}
                            }
                        // 
                        // storage
                        // 
                        const storageManager = {
                            [valuesKey]: values,
                            get path() {
                                return storagePath
                            },
                            get(key, _direct) {
                                if (_direct === directKey) {
                                    return values[key]
                                } else {
                                    return values[`@${key}`]
                                }
                            },
                            set(key, value, _direct) {
                                if (_direct === directKey) {
                                    values[key] = value
                                } else {
                                    values[`@${key}`] = value
                                }
                                // no await because it assumes this runtime is the only one touching the cold storage
                                FileSystem.write({
                                    data: JSON.stringify(
                                        values,
                                        0,
                                        virkshop.options.debuggingLevel > 1 ? 4 : 0, // have indent when debuggingLevel > 1
                                    ),
                                    path: storagePath,
                                }).catch(async (error)=>{
                                    console.debug(`storagePath1 is:`,storagePath)
                                    if (virkshop.options.debuggingLevel > 0) {
                                        console.warn(error)
                                    }
                                    FileSystem.write({data:"{}", path: storagePath})
                                })
                            },
                        }

                        // 
                        // doOneTime
                        // 
                        async function doOneTime(func) {
                            const key = "doOneTime:"+await hashers.sha256(func.toString())
                            if (!storageManager.get(key, directKey)) {
                                try {
                                    await func()
                                    // only set true if completed without error
                                    storageManager.set(key, true, directKey)
                                } catch (error) {
                                    console.error(error)
                                }
                            }
                        }

                        return [
                            storageManager,
                            doOneTime,
                        ]
                    }
                    const [ shortTermColdStorage, shortTermDoOneTime ] = await createColdStorageAndOneTimeDo("short_term")
                    const [ longTermColdStorage, longTermDoOneTime ] = await createColdStorageAndOneTimeDo("long_term")
                    const pluginArgs = {
                        id,
                        virkshop,
                        pluginSettings: (virkshop.options?.plugins||{})[id] || {},
                        shellApi,
                        helpers: {
                            shortTermColdStorage,
                            longTermColdStorage,
                            shortTermDoOneTime,
                            longTermDoOneTime,
                            changeChecker: async function({
                                checkName,
                                whenChanged,
                                whenNoChange=()=>0,
                                filePaths=[],
                                values=[],
                                executeOnFirstTime=true,
                                useLongTermStorage=false,
                            }) {
                                const checkId = `${id}:${checkName}`
                                const storage = useLongTermStorage ? longTermColdStorage : shortTermColdStorage
                                const oldCheckSum = storage.get(checkId)
                                const isFirstExecution = !oldCheckSum
                                let saveNewCheckSum = true
                                const newCheckSum = await hashers.sha256(
                                    JSON.stringify(
                                        await Promise.all([
                                            ...filePaths.map(each=>FileSystem.read(each).then(hashers.sha256)),
                                            ...values,
                                        ])
                                    )
                                )
                                const whenChangedWrapper = async ()=>{
                                    try {
                                        await whenChanged()
                                    } catch (error) {
                                        saveNewCheckSum = false
                                        console.log(`        [check: ${checkId}] whenChanged threw an error: ${error}`)
                                    }
                                }
                                
                                // 
                                // no change
                                // 
                                if (newCheckSum === oldCheckSum) {
                                    try {
                                        await whenNoChange()
                                    } catch (error) {
                                        console.log(`        [check: ${checkId}] whenNoChange threw an error: ${error}`)
                                    }
                                // 
                                // change
                                // 
                                } else {
                                    if (!isFirstExecution) {
                                        await whenChangedWrapper()
                                    // if first time
                                    } else {
                                        if (executeOnFirstTime) {
                                            await whenChangedWrapper()
                                        }
                                    }
                                }
                                
                                // 
                                // save newCheckSum if no error
                                // 
                                if (saveNewCheckSum) {
                                    storage.set(checkId, newCheckSum)
                                }
                            },
                        },
                    }
                    const pluginOutput = await pluginFunction(pluginArgs)
                    // 
                    // bind all the functions
                    // 
                    for (const eachCategory of [ "commands", "events", "methods" ]) {
                        for (const [key, value] of Object.entries(pluginOutput[eachCategory]||{})) {
                            if (value instanceof Function) {
                                pluginOutput[eachCategory][key] = value.bind(pluginOutput)
                            }
                        }
                    }
                    // final output
                    return virkshop._internal.importedPlugins[id] = {
                        pluginOutput,
                        ...pluginArgs,
                    }
                },
                async setupPlugin(pluginPath) {
                    // FIXME: do an Object.freeze on plugins, and then catch the default error to explain why properties cant be edited
                    if (virkshop.options.debuggingLevel > 1) {
                        console.log(`    setting up plugin: ${pluginPath}`)
                    }
                    // FIXME: restrict what a valid plugin id can be
                    // FIXME: auto-delete things that used to be autogenerated but are not anymore
                        // for commands: FIXME
                        // for event hooks: done
                    const { pluginOutput, id, } = await virkshop._internal.importPlugin(pluginPath)
                    const relativePluginPath = FileSystem.makeRelativePath({
                        from: virkshop.pathTo.project,
                        to: `${virkshop.pathTo.plugins}/${id}`,
                    })

                    // 
                    // auto-generate commands
                    // 
                        // FIXME: make commands link as a means of identifying which are autogenerated
                        const absolutePathToDeno = Deno.execPath()
                        virkshop._internal.deadlines.beforeShellScripts.push(
                            Promise.all(Object.keys(pluginOutput?.commands||{}).map(async (commandName)=>{
                                const executablePath = `${virkshop.pathTo.commands}/${commandName}`
                                await FileSystem.write({
                                    // FIXME: check that the command doesn't already exist
                                    path: executablePath,
                                    data: [
                                        `#!/usr/bin/env -S '${absolutePathToDeno.replace(/'/g, `'"'"'`)}' run --no-lock --allow-all`,
                                        `// NOTE: this file was auto-generated by: ${JSON.stringify(relativePluginPath)}`,
                                        `//       edit that file, not this one!`,
                                        `import { virkshop } from ${JSON.stringify(FileSystem.makeRelativePath({ from: virkshop.pathTo.commands, to: thisFile }))}`,
                                        `await (await virkshop._internal.importPlugin(${JSON.stringify(pluginPath)})).commands[${JSON.stringify(commandName)}](Deno.args)`,
                                    ].join("\n")
                                })
                                await FileSystem.addPermissions({path: executablePath, permissions: { owner: {canExecute: true} }})
                            }))
                        )
                    // 
                    // events
                    // 

                        const eventNames = Object.keys(pluginOutput?.events||{})
                        // 
                        // @setup_without_system_tools (deadline hooks)
                        // 
                            // create placeholder files
                            const withoutSystemToolsListenerNames = eventNames.filter(each=>each.startsWith("@setup_without_system_tools/"))
                            // very unimportant, just needs to be done sometime, so put it at the bottom of the event scheduler
                            setTimeout(async () => {
                                for (const eventName of withoutSystemToolsListenerNames) {
                                    const eventPath = `${virkshop.pathTo.events}/${eventName}.${id}.autogenerated.deno.js}`
                                    try {
                                        await FileSystem.write({
                                            path: eventPath,
                                            data: `// this file was autogenerated as a placeholder by the "@setup_without_system_tools" inside of\n// ${JSON.stringify(relativePluginPath)}\n// edit that file^ instead of this one`,
                                        })
                                    } catch (error) {
                                        console.error(`error creating placeholder for ${relativePath}:${eventName}`, error)
                                    }
                                }
                            }, 100)
                            // connect all of the deadlines
                            await Promise.all(
                                withoutSystemToolsListenerNames.map(
                                    async (eventName)=>{
                                        try {
                                            const deadlineResponses = await pluginOutput.events[eventName]()
                                            for (const [deadlineName, deadlineHook] of Object.entries(deadlineResponses)) {
                                                if (!(virkshop._internal.deadlines[deadlineName] instanceof Array)) {
                                                    console.error(`         [plugin:${JSON.stringify(relativePluginPath)}] the ${JSON.stringify(eventName)} event hook`)
                                                    console.error(`             returned ${deadlineName}, which is not one of the deadlines: ${JSON.stringify(Object.keys(virkshop._internal.deadlines))}`)
                                                } else {
                                                    virkshop._internal.deadlines[deadlineName].push(
                                                        deadlineHook.apply(pluginOutput, virkshop)
                                                    )
                                                }
                                            }
                                        } catch (error) {
                                            console.error(`         [plugin:${JSON.stringify(relativePluginPath)}] hit an error on ${JSON.stringify(eventName)}:`, error)
                                        }
                                    }
                                )
                            )


                        // 
                        // @setup_with_system_tools
                        // 
                            const withSystemToolsListenerNames = eventNames.filter(each=>each.startsWith("@setup_with_system_tools/"))
                            for (const eventName of withSystemToolsListenerNames) {
                                const eventPath = `${virkshop.pathTo.events}/${eventName}.${id}.autogenerated${shellApi.fileExtensions[0]}`
                                const tempShellOutputPath = `${virkshop.pathTo.temporary}/short_term/event_evals/${`${Math.random()}.sh`.replace(/\./,"")}`
                                virkshop._internal.deadlines.beforeShellScripts.push(
                                    FileSystem.write({
                                        path: eventPath,
                                        data: shellApi.joinStatements([
                                            shellApi.lineComment(`this was autogenerated by: ${JSON.stringify(relativePluginPath)}`),
                                            shellApi.lineComment(`all its doing is importing that javascript^, running a specific function from it, and then shell-sourcing the string output`),
                                            shellApi.callCommand(
                                                Deno.execPath(),
                                                "eval",
                                                "-q",
                                                `
                                                    import { FileSystem } from "https://deno.land/x/quickr@0.6.64/main/file_system.js"
                                                    const [ virkshopFile, tempShellOutputPath, pluginPath ] = Deno.args
                                                    const { virkshop, shellApi } = await import(virkshopFile)
                                                    const { pluginOutput } = await virkshop._internal.importPlugin(pluginPath)
                                                    const result = await pluginOutput.events[${JSON.stringify(eventName)}].apply(pluginOutput)
                                                    const shellString = shellApi.joinStatements((result||[]))
                                                    await FileSystem.write({
                                                        data: shellString,
                                                        path: tempShellOutputPath,
                                                    })
                                                `,
                                                "--",
                                                `${virkshop.pathTo.virkshop}/support/virkshop.js`,
                                                tempShellOutputPath,
                                                pluginPath
                                            ),
                                            // source the resulting output file
                                            shellApi.callCommand(".", tempShellOutputPath),
                                        ])
                                    })
                                )
                            }
                        
                        // 
                        // auto-generate custom event hooks
                        // 
                            // very unimportant, just needs to be done sometime, so put it at the bottom of the event scheduler
                            // this is because custom events cant run (or at least arent supported) during startup
                            setTimeout(async () => {
                                const nonBuiltinEventNames = eventNames.filter(each=>!each.startsWith("@"))
                                for (const eventName of nonBuiltinEventNames) {
                                    const eventPath = `${virkshop.pathTo.events}/${eventName}.${id}.autogenerated.deno.js`
                                    try {
                                        await FileSystem.write({
                                            path: eventPath,
                                            data: [
                                                `#!/usr/bin/env -S '${absolutePathToDeno.replace(/'/g, `'"'"'`)}' run --allow-all`,
                                                `// NOTE: this file was auto-generated by: ${JSON.stringify(relativePluginPath)}`,
                                                `//       edit that file, not this one!`,
                                                `import { virkshop } from ${JSON.stringify(FileSystem.makeRelativePath({ from: virkshop.pathTo.commands, to: thisFile }))}`,
                                                `const {pluginOutput} = await virkshop._internal.importPlugin(${JSON.stringify(pluginPath)})`,
                                                `await pluginOutput.events[${JSON.stringify(eventName)}].apply(pluginOutput, ...Deno.args)`,
                                            ].join("\n")
                                        })
                                    } catch (error) {
                                        console.error(`error creating custom hook for ${relativePath}:${eventName}`, error)
                                    }
                                }
                            }, 100)
                },
            },
            _stages: {
                // 
                // 
                // phase 0: "prep" creates/discovers basic virkshop structure (establish linked files/folders, clean broken links)
                // 
                // 
                async phase0() {
                    debuggingLevel && console.log("[Phase0: Establishing/Verifying Structure]")
                    
                    // 
                    // delete all autogenerated stuff (would be more efficient to only delete whats needed, but much harder to do provably-correctly)
                    // 
                    debuggingLevel > 1 && console.log(`    purging all autogenerated files for purity`)
                    virkshop._internal.deadlines.beforeSetup.push(
                        glob("*.autogenerated.deno.js", {startPath: virkshop.pathTo.events, }).then(FileSystem.remove)
                    )
                    
                    // warnings (intentionally not awaited)
                    FileSystem.listFilePathsIn(virkshop.pathTo.plugins).then(paths=>{
                        const fileExtensionsToIgnore = (virkshop.options.fileExtensionsToIgnore||[])
                        for (const path of paths) {
                            // skip plugins
                            if (path.endsWith(".deno.js")) {
                                continue
                            }
                            // skip intentionally ignored extensions
                            if (fileExtensionsToIgnore.some(extension=>path.endsWith(extension))) {
                                continue
                            }
                            // make warning for unknown files in the plugin section
                            const relativePath = FileSystem.makeRelativePath({ from: virkshop.pathTo.virkshop, to: path })
                            console.warn(`        [warning] if this was supposed to be a plugin, make sure it ends with .deno.js`)
                            console.warn(`                  ${JSON.stringify(relativePath)}`)
                            console.warn(`                  if you want to get rid of this warning, add another file extension to`)
                            console.warn(`                  virkshop/settings.yaml under the "fileExtensionsToIgnore" list`)
                        }
                    })
                    
                    // TODO: purge broken system links more
                    
                    await Promise.all([
                        // load all plugins
                        ...(await glob("*.deno.js", {startPath: virkshop.pathTo.plugins, })).map(
                            eachPath=>virkshop._internal.setupPlugin(eachPath, virkshop)
                        ),

                        // link virkshop folders up-and-out into the project folder
                        ...Object.entries(virkshop.options.projectLinks||[]).map(async ([whereInProject, whereInVirkshop])=>{
                            // TODO: make $VIRKSHOP_FOLDER and $PROJECT_FOLDER required at the front
                            whereInProject = whereInProject.replace(/^\$PROJECT_FOLDER\//, "./")
                            whereInVirkshop = whereInVirkshop.replace(/^\$VIRKSHOP_FOLDER\//, "./")
                            const sourcePath = `${virkshop.pathTo.virkshop}/${whereInVirkshop}`
                            const target = await FileSystem.info(`${virkshop.pathTo.project}/${whereInProject}`)
                            if (target.isBrokenLink) {
                                await FileSystem.remove(target.path)
                            }
                            // create it, but dont destroy an existing folder (unless its a broken link)
                            if (target.isBrokenLink || !target.exists)  {
                                await FileSystem.relativeLink({
                                    existingItem: sourcePath,
                                    newItem: target.path,
                                    overwrite: true,
                                })
                            }
                        }),
                    ])
                },
                // 
                // 
                // phase 1: runs setup_without_system_tools and setup_with_system_tools
                // 
                // 
                async phase1() {
                    debuggingLevel && console.log("[Phase1: Starting before-system-tools work]")

                    // 
                    // make all the numbers correct
                    // 
                    await virkshop._internal.fixupEventPathNumbers() // need to fixup before reading events
                    
                    // 
                    // run setup_without_system_tools
                    // 
                    const eventName = "@setup_without_system_tools"
                    const alreadExecuted = new Set()
                    const parentFolderString = `${virkshop.pathTo.events}/${eventName}`
                    const selfSetupPromise = FileSystem.recursivelyListItemsIn(parentFolderString).then(
                        async (phase1Items)=>{
                            virkshop._internal.sortPrioitiesByPath(phase1Items, (each)=>each.path.slice(parentFolderString.length))
                            const startTime = (new Date()).getTime()
                            for (const eachItem of phase1Items) {
                                // if its not a folder
                                if (!eachItem.isFolder && eachItem.exists) {
                                    await FileSystem.addPermissions({path: eachItem.path, permissions: { owner: {canExecute: true} }})
                                    try {
                                        // if importable, then import it
                                        if (eachItem.path.endsWith(".deno.js")) {
                                            const uniquePath = await FileSystem.finalTargetOf(eachItem.path)
                                            if (!alreadExecuted.has(uniquePath)) {
                                                alreadExecuted.add(uniquePath)
                                                // puts things inside of virkshop._internal.deadlines
                                                await virkshop.importDeadlinesFrom({
                                                    path: eachItem.path,
                                                    source: eachItem.path.slice(parentFolderString.length),
                                                    eventName,
                                                })
                                            }
                                        // otherwise execute it
                                        } else {
                                            (debuggingLevel >= 2) && console.log(`    [Running ${eachItem.path}]`)
                                            await FileSystem.addPermissions({ path: eachItem.path, permissions: { owner: {canExecute: true} }})
                                            await run`${eachItem.path}`
                                        }
                                    } catch (error) {
                                        console.warn(`\n\nWARNING: error while executing ${eachItem.path}, ${error.stack}`,)
                                    }
                                }
                            }
                            const duration = (new Date()).getTime() - startTime
                            debuggingLevel && console.log(`    [${duration}ms: ${eventName}]`)
                        }
                    )
                    virkshop._internal.deadlines.beforeSetup.push(selfSetupPromise)

                    // 
                    // kick-off work for steps below so that it runs ASAP
                    // 
                    virkshop._internal.deadlines.beforeShellScripts.push(selfSetupPromise.then(async ()=>{
                        // read the the before_login files as soon as possible
                        const eventName = `@setup_with_system_tools`
                        const parentFolderString = `${virkshop.pathTo.events}/${eventName}`
                        const files = await FileSystem.listFilePathsIn(parentFolderString)
                        await Promise.all(files.map(async eachPath=>{
                            if (eachPath.match(/\.deno\.js$/)) {
                                virkshop._internal.shellSetupPriorities.push(
                                    [
                                        eachPath.slice(parentFolderString.length),
                                        `deno run --no-lock -q -A ${shellApi.escapeShellArgument(eachPath)}`,
                                    ]
                                )
                            } else if (eachPath.match(/\.zsh$/)) {
                                virkshop._internal.shellSetupPriorities.push(
                                    [
                                        eachPath.slice(parentFolderString.length),
                                        await FileSystem.read(eachPath),
                                    ]
                                )
                            } else {
                                console.warn(`\n\nThis file: ${eachPath}\nwas inside a ${eventName}/\nBut it didn't have a .zsh or .deno.js file extension\n(so it will be ignored besides generating this warning)`)
                            }
                        }))
                    }))

                    // 
                    // finish the beforeSetup
                    // 
                    await Promise.all(virkshop._internal.deadlines.beforeSetup)

                    // 
                    // the two operations below can be done in any order, which is why they're in this Promise.all
                    // 
                    var startTime = (new Date()).getTime()
                    var defaultWarehouse
                    await Promise.all([
                        // 
                        // parse the systemTools string
                        // 
                        ((async ()=>{
                            // make sure the systemTools file is stable
                            await Promise.all(virkshop._internal.deadlines.beforeReadingSystemTools)
                            
                            // string may have been modified by plugins
                            debuggingLevel > 1 && console.log(`    reading ${virkshop.pathTo.systemTools} (only time this file is read)`)
                            const yamlString = await FileSystem.read(virkshop.pathTo.systemTools)
                            // intentionally dont await
                            FileSystem.write({
                                data: yamlString,
                                path: virkshop.pathTo.systemTools,
                            })
                            // TODO: get a hash of this and see if nix-shell should even be regenerated or not (as an optimization)
                            const result = await systemToolsToNix({string: yamlString, path: virkshop.pathTo.systemTools})
                            defaultWarehouse = result.defaultWarehouse
                            // this ensure shouldn't be needed but its a sanity thing, test removal later with a fresh setup
                            await FileSystem.ensureIsFolder(FileSystem.parentPath(virkshop.pathTo._tempNixShellFile))
                            // TODO: add error for no default warehouse
                            await FileSystem.write({
                                data: result.string,
                                path: virkshop.pathTo._tempNixShellFile,
                                overwrite: true,
                            })
                        })()),
                        
                        // 
                        // create the new home folder
                        // 
                        ((async ()=>{
                            
                            const fileConnectionOperations = {
                                ignore: async ({homePathTarget, item})=>{},
                                append: async ({homePathTarget, item})=>{
                                    if (item.isFolder) {
                                        console.warn(`    [warning]: ${item} is a folder (cannot @append it)`)
                                    } else {
                                        // Should use a proper locking append operation, but currently (Jan 2023) FileSystem.append is not actually appending
                                        await FileSystem.write({
                                            path: homePathTarget,
                                            data: `${await FileSystem.read(homePathTarget) || ""}\n${await FileSystem.read(item.path)}`,
                                        })
                                    }
                                },
                                prepend: async ({homePathTarget, item})=>{
                                    if (item.isFolder) {
                                        console.warn(`    [warning]: ${item} is a folder (cannot @append it)`)
                                    } else {
                                        await FileSystem.write({
                                            path: homePathTarget,
                                            data: `${await FileSystem.read(item.path)}\n${(await FileSystem.read(homePathTarget)||"")}`,
                                        })
                                    }
                                },
                                overwrite: async ({homePathTarget, item})=>{
                                    if (item.isFolder) {
                                        await FileSystem.relativeLink({
                                            existingItem: item,
                                            newItem: homePathTarget,
                                            force: true,
                                            overwrite:true
                                        })
                                    } else {
                                        await FileSystem.write({
                                            path: homePathTarget,
                                            data: await FileSystem.read(item.path),
                                        })
                                    }
                                },
                                make: async ({homePathTarget, item})=>{
                                    if (item.isFolder) {
                                        await FileSystem.ensureIsFolder(homePathTarget)
                                    } else {
                                        // make executable
                                        await FileSystem.addPermissions({ path: item.path, permissions: { owner: {canExecute: true} }})
                                        // run the executable, and use the output as a file
                                        await FileSystem.write({
                                            path: homePathTarget,
                                            data: await run`${item.path} ${Stdout(returnAsString)}`,
                                        })
                                    }
                                },
                                copy_real: async ({homePathTarget, item})=>{
                                    const targetItem = await FileSystem.info(homePathTarget)
                                    // only copy once
                                    if (!targetItem.exists) {
                                        const relativeHomePath = FileSystem.makeRelativePath({ from: virkshop.pathTo.fakeHome, to: homePathTarget })
                                        const realHomePath = `${virkshop.pathTo.realHome}/${relativeHomePath}`
                                        const realHomeItem = await FileSystem.info(realHomePath)
                                        if (!realHomeItem.exists) {
                                            if (item.isFolder) {
                                                await FileSystem.ensureIsFolder(realHomeItem.path)
                                            } else {
                                                await FileSystem.ensureIsFile(realHomeItem.path)
                                            }
                                        }
                                        
                                        await FileSystem.copy({
                                            from: realHomePath,
                                            to: homePathTarget,
                                        })
                                    }
                                },
                                link_real: async ({homePathTarget, item})=>{
                                    const targetItem = await FileSystem.info(homePathTarget)
                                    // only link once
                                    if (!targetItem.isSymlink) {
                                        const relativeHomePath = FileSystem.makeRelativePath({ from: virkshop.pathTo.fakeHome, to: homePathTarget })
                                        const realHomePath = `${virkshop.pathTo.realHome}/${relativeHomePath}`
                                        const realHomeItem = await FileSystem.info(realHomePath)
                                        if (!realHomeItem.exists) {
                                            if (item.isFolder) {
                                                await FileSystem.ensureIsFolder(realHomeItem.path)
                                            } else {
                                                await FileSystem.ensureIsFile(realHomeItem.path)
                                            }
                                        }
                                        
                                        await FileSystem.absoluteLink({
                                            existingItem: realHomePath,
                                            newItem: homePathTarget,
                                        })
                                    }
                                },
                            }
                            const operationSchedule = Object.fromEntries(Object.keys(fileConnectionOperations).map(each=>[each, []]))
                            const possibleNames = Object.keys(fileConnectionOperations).map(each=>`@${each}`)
                            await Promise.all(
                                (await FileSystem.listItemsIn(virkshop.pathTo.homeMixin, { recursively: true})).map(async (eachItem)=>{
                                    const theBasename = FileSystem.basename(eachItem.path)
                                    const relativePath = FileSystem.makeRelativePath({ from: virkshop.pathTo.homeMixin, to: eachItem.path, })
                                    const homePathTarget = `${virkshop.pathTo.fakeHome}/${FileSystem.parentPath(relativePath)}/${theBasename.replace(/^@[^ ]+ /, "")}`
                                    
                                    // if it doesnt start with a command, then we have a problem
                                    if (!possibleNames.some(each=>theBasename.startsWith(`${each} `))) {
                                        if (!eachItem.isFolder) {
                                            console.warn(`    [warning]: ${eachItem.path} should start with one of: ${possibleNames.join(",")} followed by a space`)
                                        } else {
                                            let isEmpty = true
                                            for await (const each of FileSystem.iteratePathsIn(eachItem)) {
                                                isEmpty = false
                                                break
                                            }
                                            if (isEmpty) {
                                                console.warn(`    [warning]: ${eachItem.path} should either contain something that starts with one of:`)
                                                console.warn(`               ${possibleNames.join(",")}`)
                                                console.warn(`               or the item itself should start with one of those`)
                                                console.warn(`    [continuing despite warning]`)
                                            }
                                            // if not empty, then do nothing because we will end up checking the children on another iteration
                                        }
                                    } else {
                                        const operation = theBasename.match(/^@([^ ]+) /)[1]
                                        operationSchedule[operation].push({
                                            operation,
                                            homePathTarget,
                                            item: eachItem,
                                        })
                                    }
                                })
                            )
                            
                            // clear out the things that must be recreated
                            await Promise.all([
                                ...operationSchedule.append.map(({ homePathTarget })=>FileSystem.remove(homePathTarget)),
                                ...operationSchedule.prepend.map(({ homePathTarget })=>FileSystem.remove(homePathTarget)),
                            ])
                            
                            // 
                            //  create the shell file
                            // 
                                let shellProfileString = shellApi.shellProfileString
                                
                                // 
                                // add @setup_with_system_tools scripts
                                // 
                                await Promise.all(virkshop._internal.deadlines.beforeShellScripts)
                                // fixup path numbers one more time (now that plugins have created more events)
                                await virkshop._internal.fixupEventPathNumbers()
                                virkshop._internal.sortPrioitiesByPath(virkshop._internal.shellSetupPriorities , ([eachSource, ...otherData])=>eachSource)
                                for (const [eachSource, eachContent] of virkshop._internal.shellSetupPriorities) {
                                    if (debuggingLevel) {
                                        shellProfileString += `\necho ${shellApi.escapeShellArgument(`    [loading: ${FileSystem.basename(eachSource)}]`)}`
                                    }
                                    shellProfileString += `\n#\n# ${eachSource}\n#\n${eachContent}\n`
                                }
                                
                                // 
                                // add project commands
                                // 
                                shellProfileString += `
                                    #
                                    # inject project's virkshop commands
                                    #
                                    ${shellApi.generatePrependToPathString(virkshop.pathTo.commands)}
                                `.replace(/\n */g,"\n")
                                
                                // 
                                // make folders work as recursive commands
                                // 
                                for (const eachFolderPath of await FileSystem.listFolderPathsIn(virkshop.pathTo.commands)) {
                                    shellProfileString += shellApi.createHierarchicalCommandFor(eachFolderPath)
                                }
                                
                                const autogeneratedPath = `${virkshop.pathTo.fakeHome}/${shellApi.autogeneratedProfile}`
                                await FileSystem.info(shellApi.profilePath).then(async (itemInfo)=>{
                                    await FileSystem.write({
                                        path: shellApi.profilePath,
                                        data: `
                                            . ./${shellApi.escapeShellArgument(shellApi.autogeneratedProfile)}
                                        `.replace(/\n                                            /g, "\n"),
                                    })
                                })

                                shellProfileString += virkshop._internal.finalShellCode
                                
                                // write the new shell profile
                                await FileSystem.write({
                                    path: autogeneratedPath,
                                    data: shellProfileString,
                                    force: true,
                                    overwrite: true,
                                })
                            
                            // 
                            // finally run/check every operation, by operation group
                            // 
                            for (const [operation, scheduledCalls] of Object.entries(operationSchedule)) {
                                await Promise.all(scheduledCalls.map(
                                    argument=>fileConnectionOperations[operation](argument)
                                ))
                            }

                        })()),
                    ])
                    var duration = (new Date()).getTime() - startTime; var startTime = (new Date()).getTime()
                    debuggingLevel && console.log(`    [${duration}ms creating shell profile and shell.nix from system_tools.yaml]`)
                    
                    // 
                    // finish dynamic setup
                    // 
                    await Promise.all(virkshop._internal.deadlines.beforeEnteringVirkshop)
                    
                    // make all commands executable
                    const permissionPromises = []
                    for await (const eachCommand of FileSystem.recursivelyIterateItemsIn(virkshop.pathTo.commands)) {
                        if (eachCommand.isFile) {
                            permissionPromises.push(
                                FileSystem.addPermissions({path: eachCommand.path, permissions: { owner: {canExecute: true} }}).catch()
                            )
                        }
                    }
                    await Promise.all(permissionPromises)
                    
                    var duration = (new Date()).getTime() - startTime; var startTime = (new Date()).getTime()
                    debuggingLevel && console.log(`    [${duration}ms waiting on beforeEnteringVirkshop]`)
                    debuggingLevel && console.log(`[Phase2: Starting the with-system-tools work] note: this step can take a while`)
                    
                    // 
                    // run nix-shell
                    // 
                    const newPwd = FileSystem.parentPath(virkshop.pathTo._tempNixShellFile)
                    const envVars = {
                        _shell_start_time: `${startTime}`,
                        VIRKSHOP_FOLDER: virkshop.pathTo.virkshop,
                        PROJECT_FOLDER: virkshop.pathTo.project,
                        VIRKSHOP_HOME: virkshop.pathTo.fakeHome,
                        VIRKSHOP_USERS_HOME: virkshop.pathTo.realHome,
                        VIRKSHOP_DEBUG: `${debuggingLevel}`,
                        NIX_SSL_CERT_FILE: Console.env.NIX_SSL_CERT_FILE,
                        NIXPKGS_ALLOW_UNFREE: "1",
                        NIX_PROFILES: Console.env.NIX_PROFILES,
                        HOME: virkshop.pathTo.fakeHome,
                        PATH: Console.env.PATH,
                        PWD: newPwd,
                        _PWD: Console.env.PWD,
                        TMPDIR: "/tmp", // fixes some build problems (workaround for a bug in Nix)
                        SHELL: Console.env.SHELL,
                        USER: Console.env.USER,
                        SSH_AUTH_SOCK: Console.env.SSH_AUTH_SOCK || '',
                        SHLVL: Console.env.SHLVL || '',
                        OLDPWD: Console.env.OLDPWD || '',
                        COLORTERM: Console.env.COLORTERM || '',
                        TERM: Console.env.TERM || '',
                        COMMAND_MODE: "unix2003",
                        LANG: "en_US.UTF-8", // TODO: put this in settings
                    }
                    await run(
                        "nix-shell",
                        "--pure",
                        "--command", shellApi.startCommand,
                        ...Object.keys(envVars).map(
                            name=>["--keep", name]
                        ).flat(),
                        `${virkshop.pathTo._tempNixShellFile}`,
                        "-I", `nixpkgs=${defaultWarehouse.tarFileUrl}`,
                        Cwd(newPwd),
                        Env(envVars),
                    )
                    // TODO: call all the on_quit scripts
                },
            },
            async enter() {
                await virkshop._stages.phase0() // phase 0: creates/discovers basic virkshop structure (establish linked files/folders, clean broken links)
                await virkshop._stages.phase1() // phase 1: runs setup_without_system_tools
            },
            async trigger(eventPath) {
                const alreadExecuted = new Set()
                const fullPathToEvent = `${virkshop.pathTo.events}/${eventPath}`
                for await (const eachPath of FileSystem.recursivelyIteratePathsIn(fullPathToEvent, { searchOrder: 'depthFirstSearch', })) {
                    const uniquePath = await FileSystem.finalTargetOf(eachPath)
                    if (!alreadExecuted.has(uniquePath)) {
                        var success = true
                        try {
                            // if deno, then import it (much faster than executing it)
                            if (eachPath.endsWith(".deno.js")) {
                                const escapedPath = `${encodeURIComponent(eachPath).replace(/%2F/g,'/')}`
                                await import(escapedPath)
                            // otherwise execute it using the hashbang
                            } else {
                                await FileSystem.addPermissions({
                                     path: eachPath, 
                                     permissions: { owner: { canExecute: true} },
                                })
                                var { success } = await run(eachPath)
                            }
                            alreadExecuted.add(eachPath)
                        } catch (error) {
                            console.warn(`    Tried to trigger ${eachPath}, but there was an error:\n`, error)
                        }
                        if (!success) {
                            console.warn(`    Tried to trigger ${eachPath}, but there was an error (info above)`)
                        }
                    }
                }
            },
            async importDeadlinesFrom({path, eventName, source }) {
                const escapedPath = `${encodeURIComponent(path).replace(/%2F/g,'/')}`
                const {deadlines} = await import(escapedPath) || {}
                for (const eachDeadlineName of Object.keys(virkshop._internal.deadlines)) {
                    if (deadlines[eachDeadlineName] instanceof Function) {
                        virkshop._internal.deadlines[eachDeadlineName].push(
                            // start the function, and we'll await it at the respective deadline
                            deadlines[eachDeadlineName](
                                virkshop._internal.createApi({
                                    source,
                                    eventName,
                                    deadlineName: eachDeadlineName,
                                })
                            )
                        )
                    }
                }
            },
        },
        {
            folder:      { get() { return virkshop.pathTo.virkshop } }, // alias
            projectName: { get() { return FileSystem.basename(virkshop.pathTo.project)   } },
            options: { 
                get() {
                    if (virkshopCache.options) {
                        return virkshopCache.options
                    }

                    let yamlString
                    try {
                        yamlString = Deno.readTextFileSync(virkshop.pathTo.virkshopOptions)
                    } catch (error) {
                        debuggingLevel && console.log(`Couldn't find the ${FileSystem.basename(virkshop.pathTo.virkshopOptions)} file, so one will be created`)
                        // TODO: update this string before final release
                        yamlString = `
                            virkshop:
                                projectLinks:
                                    "$PROJECT_FOLDER/system_tools.yaml": "$VIRKSHOP_FOLDER/system_tools.yaml"
                                    "$PROJECT_FOLDER/commands":          "$VIRKSHOP_FOLDER/commands"
                                    "$PROJECT_FOLDER/events":            "$VIRKSHOP_FOLDER/events"
                                
                                debuggingLevel: 1
                        `.replace(/\n                            /g,"\n")
                        // async write is not awaited because this is inside a getter
                        FileSystem.write({
                            data: yamlString,
                            path: virkshop.pathTo.virkshopOptions,
                        })
                    }
                    virkshopCache.options = yaml.parse(yamlString).virkshop
                    return virkshopCache.options
                },
            },
        },
    )
    
    // ensure these are set for any @setup_without_system_tools imports
    Console.env.VIRKSHOP_FOLDER = virkshop.pathTo.virkshop
    Console.env.PROJECT_FOLDER  = virkshop.pathTo.project
    
    debuggingLevel = virkshop.options.debuggingLevel
    return virkshop
}
export const virkshop = await createVirkshop()

// 
// shellApi
// 
export const shellApi = Object.defineProperties(
    {
        autogeneratedProfile: `.zshrc.autogenerated.ignore`,
        startCommand: "zsh --no-globalrcs",
        protectedPaths: [ ".zshrc", ".zshenv", ".zlogin", ".zlogout", ".zprofile" ], // TODO: check that zlogout zprofile are correct
        fileExtensions: [ `.zsh` ],
        shellProfileString: `
            cd "$_PWD" # go back to real location
            unset _PWD

            # don't let zsh update itself without telling all the other packages 
            # instead use nix to update zsh
            DISABLE_AUTO_UPDATE="true"
            DISABLE_UPDATE_PROMPT="true"
            
            if ! [ "$VIRKSHOP_DEBUG" = "0" ]; then
                deno eval --no-lock 'console.log(\`    [\${(new Date()).getTime()-Deno.env.get("_shell_start_time")}ms nix-shell]\`)'
            fi
            unset _shell_start_time

            # This is runtime-faster than creating/calling several individual commands
            virkshop_tools () {
                sub_command="$1"
                shift
                if [ "$sub_command" = "nix_path_for" ]
                then
                    sub_command="$1"
                    shift
                    if [ "$sub_command" = "package" ]
                    then
                        deno eval --no-lock 'console.log(JSON.parse(Deno.env.get("VIRKSHOP_NIX_SHELL_DATA")).packagePaths[Deno.args[0]])' "$@"
                    else
                        echo "error: expected: virkshop_tools nix_path_for package ARG, but got virkshop_tools nix_path_for $sub_command" 
                    fi
                elif [ "$sub_command" = "nix_lib_path_for" ]
                then
                    sub_command="$1"
                    shift
                    if [ "$sub_command" = "package" ]
                    then
                        deno eval --no-lock 'console.log(JSON.parse(Deno.env.get("VIRKSHOP_NIX_SHELL_DATA")).libraryPaths[Deno.args[0]])' "$@"
                    else
                        echo "error: expected: virkshop_tools nix_lib_path_for package ARG, but got virkshop_tools nix_lib_path_for $sub_command" 
                    fi
                fi
            }
        `,
        lineComment(string) {
            return `# ${string}`
        },
        escapeShellArgument(string) { // TODO: make this include outside wrapping quotes
            return "'"+string.replace(/'/g, `'"'"'`)+"'"
        },
        generatePrependToPathString(newPath) {
            return `export PATH=${this.escapeShellArgument(newPath)}":$PATH"`
        },
        generateAppendToPathString(newPath) {
            return `export PATH="$PATH:"${this.escapeShellArgument(newPath)}`
        },
        createHierarchicalCommandFor(folderPath) {
            const name = this.escapeShellArgument(FileSystem.basename(folderPath))
            folderPath = FileSystem.makeAbsolutePath(folderPath)
            return `
                # 
                # command for ${name} folder
                # 
                    ${name} () {
                        # enable globbing
                        setopt extended_glob &>/dev/null
                        shopt -s globstar &>/dev/null
                        shopt -s dotglob &>/dev/null
                        local search_path=${this.escapeShellArgument(folderPath)}
                        local argument_combination="$search_path/$1"
                        while [[ -n "$@" ]]
                        do
                            shift 1
                            for each in "$search_path/"**/*
                            do
                                if [[ "$argument_combination" = "$each" ]]
                                then
                                    # if its a folder, then we need to go deeper
                                    if [[ -d "$each" ]]
                                    then
                                        search_path="$each"
                                        argument_combination="$argument_combination/$1"
                                        
                                        # if there is no next argument
                                        if [[ -z "$1" ]]
                                        then
                                            printf "\\nThat is a sub folder, not a command\\nValid sub-commands are\\n" 1>&2
                                            ls -1FL --group-directories-first --color "$each" | sed 's/^/    /' | sed -E 's/(\\*|@)$/ /' 1>&2
                                            return 1 # error, no command
                                        fi
                                        
                                        break
                                    # if its a file, run it with the remaining arguments
                                    elif [[ -f "$each" ]]
                                    then
                                        "$each" "$@"
                                        # make exit status identical to executed program
                                        return $?
                                    fi
                                fi
                            done
                        done
                        # if an option was given
                        if ! [ -z "$each" ]
                        then
                            echo "$each"
                            printf "\\nI could not find that sub-command\\n" 1>&2
                        fi
                        printf "Valid next-arguments would be:\\n" 1>&2
                        ls -1FL --group-directories-first --color "$search_path" | sed 's/^/    /' | sed -E 's/(\\*|@)$/ /' 1>&2
                        return 1 # error, no command
                    }
                    '__autocomplete_for__'${name} () {
                        local commands_path=${this.escapeShellArgument(FileSystem.parentPath(folderPath))}
                        # TODO: make this space friendly
                        # TODO: make this do partial-word complete 
                        function join_by { local d=\${1-} f=\${2-}; if shift 2; then printf %s "$f" "\${@/#/$d}"; fi; }
                        local item_path="$(join_by "/" $words)"
                        if [ -d "$commands_path/$item_path" ]
                        then
                            compadd $(ls "$commands_path/$item_path")
                        elif [ -d "$(dirname "$commands_path/$item_path")" ]
                        then
                            # check if file exists (finished completion)
                            if ! [ -f "$commands_path/$item_path" ]
                            then
                                # TODO: add a better check for sub-matches "java" [tab] when "java" and "javascript" exist
                                compadd $(ls "$(dirname "$commands_path/$item_path")")
                            fi
                        fi
                        # echo "$(dirname "$commands_path/$item_path")"
                    }
                    compdef '__autocomplete_for__'${name} ${name}
            `.replace(/\n                /g, "\n")
        },
        modifyEnvVar({ name, overwriteAs, prepend, append, joinUsing="", }) {
            name = name.trim()
            if (overwriteAs) {
                return `\nexport ${name}=${this.escapeShellArgument(overwriteAs)}\n`
            }
            
            let output = ""
            if (prepend) {
                output += `
                    if [ -z "$${name}" ]; then
                        export ${name}=${this.escapeShellArgument(prepend)}
                    else
                        export ${name}=${this.escapeShellArgument(prepend)}${this.escapeShellArgument(joinUsing)}"$${name}"
                    fi
                `.replace(/\n                    /,"\n")
            }

            if (append) {
                output += `
                    if [ -z "$${name}" ]; then
                        export ${name}=${this.escapeShellArgument(append)}
                    else
                        export ${name}="$${name}"${this.escapeShellArgument(joinUsing)}${this.escapeShellArgument(append)}
                    fi
                `.replace(/\n                    /,"\n")
            }

            return output
        },
        callCommand(commandName, ...args) {
            return [commandName, ...args].map(each=>shellApi.escapeShellArgument(each)).join(" ")
        },
        tempVar({name, value}) {
            if (!name.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/)) {
                throw Error(`tried to call shellApi.tempVar({ name: ${JSON.stringify(name)}, }) but that name is too exotic. Please use a typical variable name`)
            }
            return `${name}=${shellApi.escapeShellArgument(value)}`
        },
        joinStatements(commands) {
            return commands.flat(Infinity).join("\n;\n")
        },
    },
    {
        profilePath:         { get() { return `${virkshop.pathTo.fakeHome}/.zshrc` } },
    },
)


// 
// 
// Helpers
// 
// 
    function numberPrefixRenameList(filepaths) {
        let largestNumber = -Infinity
        const items = []
        const basenames = filepaths.map(eachPath=>FileSystem.basename(eachPath))
        for (const each of basenames) {
            const matchData = each.match(/^((?:[0-9_]*[0-9])?)_?(.*)/)
            const digits = matchData[1].replace(/_/g, "")
            const name = matchData[2]
            const number = `${digits || 0}`-0
            const padding = digits.match(/^0*/)[0]
            items.push({
                name,
                number,
                padding,
                noDigits: digits.length == 0,
            })
            if (number > largestNumber) {
                largestNumber = number
            }
        }
        const numberOfDigits = `${largestNumber}`.length
        const roundedToNearestThree = roundedUpToNearest({value: numberOfDigits, factor: 3})
        const newBasenames = []
        for (const each of items) {
            if (each.noDigits) {
                newBasenames.push(each.name)
            } else {
                const newDigits = `${each.padding}${each.number}`.padEnd(roundedToNearestThree, "0")
                const newPrefix = newDigits.replace(/(\d\d\d)/g, "$1_")
                newBasenames.push(`${newPrefix}${each.name}`)
            }
        }
        const thingsToRename = []
        for (const [ path, oldBasename, newBasename, item] of zip(filepaths, basenames, newBasenames, items)) {
            if (oldBasename != newBasename) {
                thingsToRename.push({
                    oldPath: path,
                    newPath: `${FileSystem.parentPath(path)}/${newBasename}`,
                })
            }
        }
        return thingsToRename
    }

// 
// 
// Yaml support
// 
// 
    class CustomYamlType {
        asString = null
    }
    
    const SchemaClass = Object.getPrototypeOf(yaml.DEFAULT_SCHEMA).constructor
    const duplicateSchema = (schema)=>new SchemaClass({
        explicit: [...schema.explicit],
        implicit: [...schema.implicit],
        include: [...schema.include],
    })
    const extendedSchema = duplicateSchema(yaml.DEFAULT_SCHEMA)
    function createCustomTag({tagName, javascriptValueisACustomType, yamlNodeIsValidACustomType, createJavasriptValueFromYamlString, customValueToYamlString, kind="scalar", schema=extendedSchema}) {
        if (kind != "scalar") {
            throw Error(`Sorry in createCustomTag({ kind: '${kind}' }), the only valid kind (currently) is scalar`)
        }
        const universalTag = `tag:yaml.org,2002:${tagName}`
        class ACustomType extends CustomYamlType {}

        const customValueSupport = new Type(universalTag, {
            kind: "scalar",
            predicate: javascriptValueisACustomType || function(object) {
                return object instanceof ACustomType
            },
            resolve: yamlNodeIsValidACustomType || function(data) {
                return true
            },
            construct: createJavasriptValueFromYamlString || function(data) {
                const customValue = new ACustomType()
                customValue.asString = data
                return customValue
            },
            represent: customValueToYamlString || function(object /*, style*/) {
                return customValue.asString
            },
        })

        // hack it into the default schema (cause .extend() isnt available)
        schema.explicit.push(customValueSupport)
        schema.compiledTypeMap.fallback[universalTag] = customValueSupport
        schema.compiledTypeMap.scalar[universalTag] = customValueSupport

        return ACustomType
    }

    // 
    // !!nix support
    // 
        const validVariableNameRegex = /^ *\b[a-zA-Z_][a-zA-Z_0-9]*\b *$/
        const NixValue = createCustomTag({
            tagName: "nix",
        })
    // 
    // !!var support
    // 
        const SystemToolVar = createCustomTag({
            tagName: "var",
            yamlNodeIsValidACustomType(data) {
                if (typeof data !== 'string') return false
                if (data.length === 0) return false
                
                data = data.trim()
                // if its a variable name
                return !!data.match(validVariableNameRegex)
            },
            createJavasriptValueFromYamlString(data) {
                const nixVar = new SystemToolVar()
                nixVar.asString = data
                nixVar.name = data.trim()
                return nixVar
            }
        })
    // 
    // !!deno support
    // 
        const DenoExecutePromise = createCustomTag({
            tagName: "deno",
            createJavasriptValueFromYamlString(data) {
                // if there is a default export somewhere, its very likely not in a string (so try NOT prepending default export)
                if (data.match(/export default/)) {
                    return import(`data:text/javascript;base64, ${btoa(data)}`).catch(()=>import(`data:text/javascript;base64, ${btoa(`export default ${data}`)}`)).then((value)=>value.default)
                // otherwise we can be sure a default export is needed
                } else {
                    return import(`data:text/javascript;base64, ${btoa(`export default ${data}`)}`).then((value)=>value.default)
                }
            }
        })
    
    const readExtendedYaml = async ({path, string})=>{
        const locallyHandledSchema = duplicateSchema(extendedSchema)
        const folderOfYamlFile = path && FileSystem.parentPath(path)
        // 
        // !!as_absolute_path support
        // 
        const AbsolutePathTag = createCustomTag({
            tagName: "as_absolute_path",
            schema: locallyHandledSchema,
            createJavasriptValueFromYamlString(data) {
                const relativePathString = data
                if (!folderOfYamlFile) {
                    // relative to CWD if there was no file
                    return FileSystem.makeAbsolutePath(relativePathString)
                } else {
                    return FileSystem.normalize(
                        FileSystem.makeAbsolutePath(
                            `${folderOfYamlFile}/${relativePathString}`
                        )
                    )
                }
            }
        })
        string = string || await FileSystem.read(path)
        const dataStructure = await recursivePromiseAll(yaml.parse(string, {schema: locallyHandledSchema,}))
        return dataStructure
    }

    // tell nix how to serialize these values
    nix.addCustomJsConverter({
        checker: (obj)=>obj instanceof CustomYamlType,
        converter: (obj)=>obj.asString,
    })
    nix.addCustomJsConverter({
        checker: (obj)=>obj instanceof SystemToolVar,
        converter: (obj)=>obj.name,
    })

import { deferred as deferredPromise } from "https://deno.land/std@0.161.0/async/mod.ts"
const objectPrototype = Object.getPrototypeOf({})

/**
 * Promise.allRecursively
 *
 * @example
 *     await recursivePromiseAll({a:1, b: [ 1, 2, new Promise((resolve, reject)=>resolve(10))] })
 *     // >>> { a: 1, b: [ 1, 2, 10 ] }
 */
const recursivePromiseAll = (object, alreadySeen=new Map()) => {
    if (alreadySeen.has(object)) {
        return alreadySeen.get(object)
    }
    if (object instanceof Promise) {
        return object
    } else if (object instanceof Array) {
        const resolveLink = deferredPromise()
        alreadySeen.set(object, resolveLink)
        Promise.all(
            object.map(each=>recursivePromiseAll(each, alreadySeen))
        ).catch(
            resolveLink.reject
        ).then(
            resolveLink.resolve
        )
        return resolveLink
    // if pure object
    } else if (Object.getPrototypeOf(object) == objectPrototype) {
        const resolveLink = deferredPromise()
        alreadySeen.set(object, resolveLink)
        ;((async ()=>{
            try {
                const keysAndValues = await Promise.all(
                    Object.entries(object).map(
                        (keyAndValue)=>recursivePromiseAll(keyAndValue, alreadySeen)
                    )
                )
                resolveLink.resolve(Object.fromEntries(keysAndValues))
            } catch (error) {
                resolveLink.reject(error)
            }
        })())
        return resolveLink
    // either a primitive or a custom object that doesnt inhert from a promise
    } else {
        return object
    }
}
export const parsePackageTools = async (pathToPackageTools)=>{
    // in the future their may be some extra logic here
    const asString = await FileSystem.read(pathToPackageTools)
    const dataStructure = await readExtendedYaml({path: pathToPackageTools, string: asString})
    const allSaveAsValues = dataStructure.map(each=>each[Object.keys(each)[0]].saveVariableAs)
    const illegalNames = allSaveAsValues.filter(each=>`${each}`.startsWith("_-"))
    if (illegalNames.length > 0) {
        throw Error(`Inside ${pathToPackageTools}, there are some illegal saveVariableAs names (names that start with "_-")\nPlease rename these values:${illegalNames.map(each=>`\n    saveVariableAs: ${each}`).join("")}`)
    }
    dataStructure.asString = asString
    dataStructure.packages = dataStructure.map(each=>each["(package)"]).filter(each=>each instanceof Object)
    dataStructure.warehouses = dataStructure.map(each=>each["(warehouse)"] || each["(defaultWarehouse)"]).filter(each=>each instanceof Object)
    dataStructure.defaultWarehouse = dataStructure.map(each=>each["(defaultWarehouse)"]).filter(each=>each instanceof Object).slice(-1)[0]
    dataStructure.directPackages = dataStructure.packages.filter(each=>each.asBuildInput&&(each.load instanceof Array))
    
    // TODO: add validation (better error messages) for missing warehouse attributes
    for (const each of dataStructure.warehouses) {
        const nixCommitHash = each.createWarehouseFrom.nixCommitHash
        const tarFileUrl = each.createWarehouseFrom.tarFileUrl || `https://github.com/NixOS/nixpkgs/archive/${nixCommitHash}.tar.gz`
        // ensure each has a tarFileUrl
        each.createWarehouseFrom.tarFileUrl = tarFileUrl
    }

    return dataStructure
}

// 
// systemToolsToNix
// 
export const systemToolsToNix = async function({string, path}) {
    // TODO: add error for trying to assign to a keyword (like "builtins", "rec", "let", etc)
    const start = (new Date()).getTime()
    const dataStructure = await readExtendedYaml({path, string})
    const allSaveAsValues = dataStructure.map(each=>each[Object.keys(each)[0]].saveVariableAs)
    const frequencyCountOfVarNames = allSaveAsValues.filter(each=>each).reduce((frequency, item)=>(frequency[item]?frequency[item]++:frequency[item]=1, frequency), {})
    const varNames = []
    let defaultWarehouse = null
    let defaultWarehouseName = ""
    const buildInputStrings = []
    const nativeBuildInputStrings = []
    const computed = {}
    const nixValues = {}
    const warehouses = {}
    const packages = {}

    const uniqueVarValues = Object.fromEntries(Object.entries(frequencyCountOfVarNames).filter(([eachName, eachCount])=>eachCount==1))
    const nonUniqueVarNames = Object.entries(frequencyCountOfVarNames).filter(([eachName, eachCount])=>eachCount!=1).map((eachName, eachCount)=>eachName)
    const nonUniqueVarValuesSoFar = {}
    const nixVarsAtThisPoint = ()=>`\n${Object.entries(nonUniqueVarValuesSoFar).map(([eachVarName, eachNixString])=>`${eachVarName} = ${indent({ string: eachNixString, by: "    ", noLead: true })};`).join("\n")}`
    const saveNixVar = (varName, varNixValue)=>{
        varNames.push(varName)
        // if its going to end up unique, store it in the uniqueVarValues
        const storageLocation = uniqueVarValues[varName] ? uniqueVarValues : nonUniqueVarValuesSoFar
        const varsSoFar = nixVarsAtThisPoint().trim()
        if (varsSoFar.length == 0) {
            storageLocation[varName] = `${indent({ string: varNixValue, by: "    ", noLead: true })}`
        } else {
            storageLocation[varName] = `(
                let
                    ${indent({ string: nixVarsAtThisPoint(), by: "                    ", noLead: true })}
                in
                    ${indent({ string: varNixValue, by: "                    ", noLead: true })}
            )`.replace(/\n            /g,"\n")
        }
    }
    const warehouseAsNixValue = (values)=> {
        const nixCommitHash = values.createWarehouseFrom.nixCommitHash
        const tarFileUrl = values.createWarehouseFrom.tarFileUrl || `https://github.com/NixOS/nixpkgs/archive/${nixCommitHash}.tar.gz`
        const tarFileHash = values.createWarehouseFrom.tarFileHash
        const warehouseArguments = values.arguments || {}
        if (!tarFileHash) {
            return `(_-_core.import
                (_-_core.fetchTarball
                    ({
                        url=${JSON.stringify(tarFileUrl)};
                    })
                )
                (${indent({ string: nix.escapeJsValue(warehouseArguments), by: "            ", noLead: true})})
            )`.replace(/\n            /g,"\n")
        } else {
            return `(_-_core.import
                (_-_core.fetchTarball
                    ({
                        url=${JSON.stringify(tarFileUrl)};
                        sha256=${JSON.stringify(tarFileHash)};
                    })
                )
                (${indent({ string: nix.escapeJsValue(warehouseArguments), by: "            ", noLead: true})})
            )`.replace(/\n            /g,"\n")
        }
    }

    for (const eachEntry of dataStructure) {
        const kind = Object.keys(eachEntry)[0]
        // 
        // (warehouse)
        // 
        if (kind == "(defaultWarehouse)" || kind == "(warehouse)") {
            // 
            // make sure defaultWarehouse is defined first, and that theres only one
            // 
            if (kind == "(defaultWarehouse)") {
                if (defaultWarehouse) {
                    throw Error(`Looks like (defaultWarehouse) is getting defined twice. Please check the yaml file to make sure theres only one (defaultWarehouse)`)
                }
            } else {
                if (!defaultWarehouseName) {
                    throw Error(`I see a warehouse being added, but the defaultWarehouse hasn't been defined yet. Please define one, its the same structure as a warehouse but with "(defaultWarehouse)" as the name`)
                }
            }
            const values = eachEntry[kind]
            // createWarehouseFrom:
            //     tarFileUrl: &defaultWarehouseAnchor "https://github.com/NixOS/nixpkgs/archive/c82b46413401efa740a0b994f52e9903a4f6dcd5.tar.gz"
            // arguments:
            //     config:
            //         allowUnfree: true
            //         cudaSupport: true
            //         permittedInsecurePackages: [ "openssl-1.0.2u" ]
            // saveVariableAs: "!!nix defaultWarehouse"

            const varName = values.saveVariableAs
            const nixCommitHash = values.createWarehouseFrom.nixCommitHash
            const tarFileUrl = values.createWarehouseFrom.tarFileUrl || `https://github.com/NixOS/nixpkgs/archive/${nixCommitHash}.tar.gz`
            const warehouseArguments = values.arguments || {}
            warehouses[varName] = new SystemToolVar()
            warehouses[varName].name = varName
            warehouses[varName].tarFileUrl = tarFileUrl
            warehouses[varName].tarFileHash = values.createWarehouseFrom.sha256
            warehouses[varName].arguments = warehouseArguments
            // if is will end up being a unique name
            saveNixVar(varName, warehouseAsNixValue(values))
            // save defaultWarehouse name
            if (kind == "(defaultWarehouse)") {
                defaultWarehouseName = varName
                defaultWarehouse = warehouses[varName]
            }
        // 
        // (compute)
        // 
        } else if (kind == "(compute)") {
            // - (compute):
            //     runCommand: [ "nix-shell", "--pure", "--packages", "deno", "deno eval 'console.log(JSON.stringify(Deno.build.os==\'darwin\'))'", "-I", *defaultWarehouseAnchor ]
            //     saveVariableAs: isMac
            const values = eachEntry[kind]
            const varName = values.saveVariableAs
            let resultAsValue
            if (Object.keys(values).includes('value')) {
                // means it was a constant, or preprocessed via a !!deno tag
                resultAsValue = values.value
            } else {
                const withPackages = values.withPackages || []
                const whichWarehouse = values.fromWarehouse || defaultWarehouse
                const tarFileUrl = warehouses[whichWarehouse.name].tarFileUrl // TODO: there's a lot of things that could screw up here, add checks/warnings for them
                const escapedArguments = 'NO_COLOR=true '+values.runCommand.map(each=>`${shellApi.escapeShellArgument(each)}`).join(" ")
                const fullCommand = ["nix-shell", "--pure", "--packages", ...withPackages, "-I", "nixpkgs="+tarFileUrl, "--run",  escapedArguments,]
                
                const commandForDebugging = fullCommand.join(" ")
                if (! withPackages) {
                    throw Error(`For\n- (compute):\n    saveVariableAs: ${varName}\n    withPackages: []\nThe withPackages being empty is a problem. Try at least try: withPackages: ["bash"]`)
                }
                
                // TODO: make sure everything in the runCommand is a string
                let resultAsJson
                try {
                    resultAsJson = await run(...fullCommand, Stdout(returnAsString))
                    // TODO: grab STDOUT and STDERR for better error messages
                } catch (error) {
                    throw Error(`There was an error when trying to run this command:\n    ${commandForDebugging}`)
                }
                try {
                    resultAsValue = JSON.parse(resultAsJson)
                } catch (error) {
                    throw Error(`There was an error with the output of this command: ${commandForDebugging}\nThe output needs to be a valid JSON string, but there was an error while parsing the string: ${error}\n\nStandard output of the command was: ${JSON.stringify(resultAsJson)}`)
                }
            }
            computed[varName] = resultAsValue
            saveNixVar(varName, nix.escapeJsValue(resultAsValue))
        // 
        // (environmentVariable)
        // 
        } else if (kind == "(environmentVariable)") {
            const values = eachEntry[kind]
            if (values.onlyIf === false) {
                continue
            } else if (values.onlyIf instanceof SystemToolVar) {
                // skip if value is false
                if (!computed[values.onlyIf.name]) {
                    continue
                }
            } else {
                virkshop._internal.finalShellCode += shellApi.modifyEnvVar({ ...values, name: values.envVar })
            }
        // 
        // (package)
        // 
        } else if (kind == "(package)") {
            // from: !!warehouse pythonPackages
            // load: [ "pyopengl",]
            // onlyIf: !!computed isLinux
            // asBuildInput: true
            const values = eachEntry[kind]
            
            // 
            // handle onlyIf
            // 
            if (values.onlyIf === false) {
                continue
            } else if (values.onlyIf instanceof SystemToolVar) {
                // skip if value is false
                if (!computed[values.onlyIf.name]) {
                    continue
                }
            } else if (values.onlyIf instanceof NixValue) {
                // TODO values.onlyIf  !!nix
                throw Error(`
                    Sorry the !!nix part isn't supported yet in the beta
                    For this value:
                        - ${kind}:
                            onlyIf: !!nix ${values.onlyIf.asString}
                `)
            // string 
            } else if (values.onlyIf) {
                const onlyIfString = values.onlyIf.name || values.onlyIf
                throw Error(`
                    

                    Inside a system_tools.yaml file
                    For this value:
                        - ${kind}:
                            # [stuff]
                            onlyIf: ${onlyIfString}
                    
                    You might have been wanting this:
                        - ${kind}:
                            # [stuff]
                            onlyIf: !!computed ${onlyIfString}
                    
                    
                `.replace(/\n                    /g,"\n"))
            }

            
            // 
            // get nix-value
            // 
            const source = values.from || defaultWarehouse
            let nixValue
            if (values.load instanceof NixValue) {
                nixValue = `(${values.load.asString})`
            } else if (source instanceof SystemToolVar) {
                const loadAttribute = values.load.map(each=>nix.escapeJsValue(`${each}`)).join(".")
                nixValue = `${source.name}.${loadAttribute}`
            // from a hash/url directly
            } else {
                const loadAttribute = values.load.map(each=>nix.escapeJsValue(`${each}`)).join(".")
                if (source instanceof Object) {
                    nixValue = `${warehouseAsNixValue(source)}.${loadAttribute}`
                } else if (typeof source == "string") {
                    nixValue = `${warehouseAsNixValue({createWarehouseFrom:{ nixCommitHash:source }})}.${loadAttribute}`
                }
                // TODO: else error
            }
            
            // 
            // add to build inputs
            // 
            if (values.asBuildInput) {
                buildInputStrings.push(nixValue)
            }
            if (values.asNativeBuildInput) {
                nativeBuildInputStrings.push(nixValue)
            }
            
            // 
            // create name if needed
            // 
            if (values.saveVariableAs) {
                const varName = values.saveVariableAs
                packages[varName] = values
                saveNixVar(varName, nixValue)
            }
        // 
        // (nix)
        // 
        } else if (kind == "(nix)") {
            // from: !!warehouse pythonPackages
            // load: [ "pyopengl",]
            // saveVariableAs: varName
            const values = eachEntry[kind]
            
            // 
            // get nix-value
            // 
            const source = values.from || defaultWarehouse
            const loadAttribute = values.load.map(each=>nix.escapeJsValue(`${each}`)).join(".")
            let nixValue
            if (source instanceof SystemToolVar) {
                nixValue = `${source.name}.${loadAttribute}`
            // from a hash/url directly
            } else {
                if (source instanceof Object) {
                    nixValue = `${warehouseAsNixValue(source)}.${loadAttribute}`
                } else if (typeof source == "string") {
                    nixValue = `${warehouseAsNixValue({createWarehouseFrom:{ nixCommitHash:source }})}.${loadAttribute}`
                }
                // TODO: else error
            }
            
            // 
            // create name if needed
            // 
            const varName = values.saveVariableAs
            nixValues[varName] = values
            saveNixVar(varName, nixValue)
        }
    }
    
    // TODO: validate that all varNames are actually valid variable names 

    // 
    // library paths for all packages
    // 
    let libraryPathsString = ""
    let packagePathStrings = ""
    for (const [varName, value] of Object.entries(packages)) {
        libraryPathsString += `"${varName}" = _-_core.lib.makeLibraryPath [ ${varName} ];\n`
        packagePathStrings += `"${varName}" = ${varName};\n`
    }
    
    return {
        defaultWarehouse,
        computed,
        nixValues,
        warehouses,
        packages,
        string: `
        let
            #
            # create a standard library for convienience 
            # 
            _-_core = (
                let
                    frozenStd = (builtins.import 
                        (builtins.fetchTarball
                            ({url=${nix.escapeJsValue(virkshop.coreWarehouse)};})
                        )
                        ({})
                    );
                in
                    (frozenStd.lib.mergeAttrs
                        (frozenStd.lib.mergeAttrs
                            (frozenStd.buildPackages) # <- for fetchFromGitHub, installShellFiles, getAttrFromPath, etc 
                            (frozenStd.lib.mergeAttrs
                                ({ stdenv = frozenStd.stdenv; })
                                (frozenStd.lib) # <- for mergeAttrs, optionals, getAttrFromPath, etc 
                            )
                        )
                        (builtins) # <- for import, fetchTarball, etc 
                    )
            );
            
            #
            # 
            # Packages, Vars, and Compute
            #
            #\n${Object.entries(uniqueVarValues).map(
                ([eachVarName, eachNixString])=>
                    `            ${eachVarName} = ${indent({ string: `${eachNixString}`, by: "            ", noLead: true })};`
            ).join("\n")}
            #
            # var names that were assigned more than once
            #${indent({ string: nixVarsAtThisPoint(), by: "            ", noLead: true })}
            #
            # nix shell data
            #
                _-_nixShellEscapedJsonData = (
                    let 
                        nixShellDataJson = (_-_core.toJSON {
                            libraryPaths = {\n${indent({string:libraryPathsString, by: "                                ",})}
                            };
                            packagePaths = {\n${indent({string:packagePathStrings, by: "                                ",})}
                            };
                        });
                        bashEscapedJson = (builtins.replaceStrings
                            [
                                "'"
                            ]
                            [
                                ${nix.escapeJsValue(`'"'"'`)}
                            ]
                            nixShellDataJson
                        );
                    in
                        bashEscapedJson
                );
        in
            _-_core.mkShell {
                # inside that shell, make sure to use these packages
                buildInputs =  [\n${indent({
                        string: [...new Set(buildInputStrings)].join("\n"),
                        by: "                    ",
                    })}
                ];
                
                nativeBuildInputs = [\n${indent({
                        string: [...new Set(nativeBuildInputStrings)].join("\n"),
                        by: "                    ",
                    })}
                ];
                
                # run some bash code before starting up the shell
                shellHook = "
                    export VIRKSHOP_NIX_SHELL_DATA='\${_-_nixShellEscapedJsonData}'
                ";
            }
        `.replace(/\n        /g,"\n"),
    }
}