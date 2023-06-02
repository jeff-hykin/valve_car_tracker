export const deadlines = {
    async beforeSetup(virkshop) {
        return virkshop.injectUsersCommand("nvim")
    },
}
