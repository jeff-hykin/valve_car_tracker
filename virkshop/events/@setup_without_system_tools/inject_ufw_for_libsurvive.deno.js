export const deadlines = {
    async beforeSetup(virkshop) {
        virkshop.injectUsersCommand("ufw")
        virkshop.injectUsersCommand("systemctl")
    },
}
