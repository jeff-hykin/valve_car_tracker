// NOTE: startup will generally finish faster if code is put inside of @setup_without_system_tools (compared to @setup_with_system_tools)

export const deadlines = {
    // deadlines are in chronological order (top is the shortest/soonest)
    // HOWEVER, the startup time will be optimized if code is
    // placed in the bottom-most deadline (last deadline)
    // because of async/concurrent computations
    async beforeSetup(virkshop) {
        // virkshop.injectUsersCommand("sudo")
    },
    async beforeReadingSystemTools(virkshop) {
    },
    async beforeShellScripts(virkshop) {
    },
    async beforeEnteringVirkshop(virkshop) {
        console.log(`
            ****************************************************************************************
                                                                                                  
                 __    __                                      __              /\\\`\\               
                /\\ \\  /\\ \\                                    /\\ \\             \\ \\ \\              
                \\ \\ \\_\`_\\ \\                                   \\ \\ \\             \\ \\ \\             
                 \\ \\  ___  \\     ,------,   /\\~\\ /\\~\\/\\~\\     ,\\_\\ \\     __  __  \\ \\ \\            
                  \\ \\ \\_/ \\ \\   /\\ .---, \\  \\ \\ \\\\ \\ \\ \\ \\   / .__, \\   /\\ \\/\\ \\  \\ \\_\\           
                   \\ \\ \\ \\ \\ \\  \\ \\ \\___\\ \\  \\ \\ \\_/  \\_/ \\ /\\ \\  /\\ \\  \\ \\ \\_\\ \\  \\/./           
                    \\ \\_\\ \\ \\_\\  \\ \\______/   \\ \\____^____/ \\ \\_____,_\\  \\/\`____ \\  /\\\`\`\`\\        
                     \\/_/  \\/_/   \`._____/     \\/___//___/   \\/___,_ /    \`/___/\\ \\ \\/___/        
                                                                               \\_| \\              
                                                                              /\\___/              
                                                                              \\/__/               
                                                                                                   
            ****************************************************************************************
                                      Setting up your Environment!                                    
        `.replace(/\n        /g,"\n"))

        // // prints out as:
        // //     ****************************************************************************************
        // // 
        // //          __    __                                      __              /\`\               
        // //         /\ \  /\ \                                    /\ \             \ \ \              
        // //         \ \ \_`_\ \                                   \ \ \             \ \ \             
        // //          \ \  ___  \     ,------,   /\~\ /\~\/\~\     ,\_\ \     __  __  \ \ \            
        // //           \ \ \_/ \ \   /\ .---, \  \ \ \\ \ \ \ \   / .__, \   /\ \/\ \  \ \_\           
        // //            \ \ \ \ \ \  \ \ \___\ \  \ \ \_/  \_/ \ /\ \  /\ \  \ \ \_\ \  \/./           
        // //             \ \_\ \ \_\  \ \______/   \ \____^____/ \ \_____,_\  \/`____ \  /\```\        
        // //              \/_/  \/_/   `._____/     \/___//___/   \/___,_ /    `/___/\ \ \/___/        
        // //                                                                        \_| \              
        // //                                                                       /\___/              
        // //                                                                       \/__/               
        // //                                                                                            
        // //     ****************************************************************************************
        // //                             Setting up your Environment!                                    
    }
}
