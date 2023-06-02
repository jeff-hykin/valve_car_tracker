// start as many promises possible here (then await them at the last second possible for optimal runtime)
const escapeRegExpPromise = import("https://raw.githubusercontent.com/lodash/lodash/2da024c3b4f9947a48517639de7560457cd4ec6c/escapeRegExp.js")
const fileSystemPromise   = import("https://deno.land/x/quickr@0.6.20/main/file_system.js")
const runToolsPromise     = import("https://deno.land/x/quickr@0.6.20/main/run.js")

const setupHooks = true

export const deadlines = {
    async beforeSetup(virkshop) {
    },
    async beforeReadingSystemTools(virkshop) {
    },
    async beforeShellScripts(virkshop) {
    },
    async beforeEnteringVirkshop(virkshop) {
        const { FileSystem } = await fileSystemPromise
        const { run, throwIfFails, zipInto, mergeInto, returnAsString, Timeout, Env, Cwd, Stdin, Stdout, Stderr, Out, Overwrite, AppendTo } = await runToolsPromise
        
        const gitFolderPath = `${virkshop.pathTo.project}/.git`
        const gitFolderItem = await FileSystem.info(gitFolderPath)
        if (!gitFolderItem.exists) {
            // this command can take a long time
            await run`nix-shell --packages git --pure --command ${'git init'} -I ${`nixpkgs=${virkshop.coreWarehouse}`}`
        }

        if (setupHooks) {
            const escapeRegExp = (await escapeRegExpPromise).default
            // 
            // hooks
            // 
            const knownHooks = new Set([
                "applypatch-msg",
                "commit-msg",
                "fsmonitor-watchman",
                "post-update",
                "pre-applypatch",
                "pre-commit",
                "pre-merge-commit",
                "pre-push",
                "pre-rebase",
                "pre-receive",
                "prepare-commit-msg",
                "push-to-checkout",
                "update",
            ])
            const checkedHooks = new Set([])
            
            const start = virkshop.shellApi.lineComment("VIRKSHOP_HOOK_START")
            const end   = virkshop.shellApi.lineComment("VIRKSHOP_HOOK_END")
            const startToEndPattern = RegExp(`^[ \\t]*${escapeRegExp(start)}[ \\t]*[\\n\\r]+([\\d\\D]*)[\\n\\r][ \\t]*${escapeRegExp(end)}[ \\t]*$`, "m")

            function createShellHookStringFor(hookName) {
                return `${start}
                    if [ -n "$VIRKSHOP_FOLDER" ]; then
                        deno eval -q ${virkshop.shellApi.escapeShellArgument(`
                            import { Console } from "https://deno.land/x/quickr@0.6.20/main/console.js"
                            const { virkshop } = await import(\`\${Console.env.VIRKSHOP_FOLDER||"./virkshop"}/support/virkshop.js\`)
                            await virkshop.trigger("git/${hookName}")
                        `)}
                    fi
                ${end}`.replace(/\n                /g,"\n")
            }

            async function checkOnHookFile({hookName, path}) {
                // check if it is already setup
                let replacementText = null
                const internalText = await FileSystem.read(path)
                // if no content
                if (!internalText) {
                    replacementText = createShellHookStringFor(hookName)
                } else {
                    // if no existing start/end
                    if (!internalText.match(startToEndPattern)) {
                        replacementText = internalText + `\n${createShellHookStringFor(hookName)}`
                    } else {
                        // if exists but corrupted
                        const possibleReplacement = internalText.replace(startToEndPattern, createShellHookStringFor(hookName))
                        const isCorrupted = possibleReplacement != internalText
                        if (isCorrupted) {
                            replacementText = possibleReplacement
                        }
                    }
                }

                if (replacementText) {
                    await FileSystem.write({
                        path: path,
                        data: replacementText,
                    })
                }
                
                // make sure its executable
                FileSystem.addPermissions({path, permissions: { owner: {canExecute: true} }})

                checkedHooks.add(hookName)
            }

            const hooksFolderPath = `${gitFolderPath}/hooks`
            // try to do each hook concurrently
            await Promise.all((await FileSystem.listFilePathsIn(hooksFolderPath)).map(
                async (eachPath)=>{
                    const [ folders, name, ext ] = FileSystem.pathPieces(eachPath)
                    const hookName = name+ext
                    // future-proofing against hooks that might be added after time of writing
                    if (eachPath.endsWith(".sample")) {
                        knownHooks.add(name)
                    } else if (knownHooks.has(hookName)) {
                        await checkOnHookFile({ hookName, path: eachPath })
                    }
                }
            ))
            
            // cover hooks that didn't have a sample file and were not created
            const missedHooks = [...knownHooks].filter(each=>!checkedHooks.has(each))
            await Promise.all(missedHooks.map(
                hookName=>checkOnHookFile({
                    hookName,
                    path: `${hooksFolderPath}/${hookName}`,
                })
            ))
            
            await Promise.all([...knownHooks].map(
                hookName=>FileSystem.ensureIsFolder(`${virkshop.pathTo.events}/git/${hookName}`)
            ))
        }
    }
}
