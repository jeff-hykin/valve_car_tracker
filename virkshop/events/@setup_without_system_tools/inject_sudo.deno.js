export const deadlines = {
    async beforeSetup(virkshop) {
        virkshop.injectUsersCommand("sudo")
    },
}
