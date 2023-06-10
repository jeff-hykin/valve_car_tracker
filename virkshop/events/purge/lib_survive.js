import { FileSystem } from "https://deno.land/x/quickr@0.6.26/main/file_system.js"

const libSurviveConfigFolder = `${FileSystem.home}/.config/libsurvive/`
console.log(`removing: ${libSurviveConfigFolder}`)
await FileSystem.remove(
    libSurviveConfigFolder
)