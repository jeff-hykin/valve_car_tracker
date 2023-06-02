# pre-alpha:
- `1_bare_minimum`
    - DONE: add example for is_raspbian or is_arm
    - DONE:  create CLI option for saving ENV vars (permanently)
    - DONE: reconsider the !!warehouse in favor of something like !!var, and use varName instead of saveAs
    - DONE: virkshop.injectUsersCommand(name)
    - LATER: clean up the virkshop command for getting paths and such (make it a deno command, give it a --help, etc)
    - LATER: add warning if injected command overwrites non-symlink file (indicating the user had a custom command there)
- `mixins/git`
    - DONE: fix the hooks (check if inside env)
- `2_minimal`
    - add cachix support: settings input for a cachix name, use ENV var for pushing
- `3_standard`
    - LATER: eventually ask about setting up a 50mb/100mb commit warning
    - LATER: eventually add a folder-sync option (list all folders, use `git check-ignore`)
    - DONE: add `clean` and `purge` commands
    - DONE: add `trigger` command
    - DONE: injections:  `vim`, `vi`, `emacs`, `nvim`, `code`
    - DONE: link keychain
    - DONE: link deno cache
- `4_extras`
    - DONE: all the rust CLI helpers (`btm`, `tldr`, etc)
    - DONE: jeff git shortcuts
- `mixins/python/minimal`
    - pip command
- `mixins/python/standard`
    - python poetry if pypoetry.toml exists
    - autoinit venv
    - adds to gitignore
    - adds clean and purge hooks
    - install modules (requirements.txt, pypoetry.toml, maybe also run any `setup.py`)
    - hash check for if python-venv version changed (and purge/reinstall upon python version change)
    - git hooks that check if dependencies change upon pull/checkout
    - eventually make venv and interactive upon_mixing question
- `mixins/nodejs/standard`
    - adds to gitignore
    - adds npm-init
    - adds startup module install check
    - hash check for if node/npm version changed (and purge/reinstall upon node/npm version change)

- documentation:
    - how to convert a nix-channel thing (nixGL) into system_tools.yaml
    - getting path of nixpkgs
- consider worst-case confusing scenarios, or conflicts caused by gitignore fighting with `commands/` or `home/`

- add onlyIf: !!nix support

- DONE: create a `skeleton` branch, no injections, git, node, or python
- DONE: create a `mixins/git/standard` mixin
    - DONE: ensures a git instance is initialized
    - DONE: @copy_real .gitconfig
    - DONE: @link_real ssh
    - DONE: adds gitignore with standard ignores (OS ignores and .ignore/.private)
    - DONE: subrepo command
    - DONE: git hook events
    - remove git subrepo
    - eventually ask about setting up a 50mb/100mb commit warning
    - eventually add a folder-sync option (list all folders, use `git check-ignore`)

- DONE: rename `@core` without the @
- DONE: add `virkshop/mixin` with support for an `@upon_mixing` event
- DONE: add support for
    - `@append .zshrc`
    - `@prepend .zshrc`
    - `@overwrite .zshrc`
    - `@make .zshrc`
    - `@copy_real .zshrc`
    - `@link_real .zshrc`

- DONE: try getting super_map to work with virkshop
- DONE: remove relative paths to virkshop.js, use URL instead, maybe have a walk-up importer from URL and everything else local
- DONE: create method for removing relative paths to virkshop.js
- DONE: cli "virkshop/install [package name]"
- DONE: add `!!deno`
- DONE: create deno library for virkshop
- DONE: create virkshop trigger for purge/clean
- DONE: create clean command
- DONE: create purge command
- DONE: consider allowing env vars to be set inside system_tools
    - prepend
    - append

- DONE: pad out numbers and auto-rename them
- DONE: allow loading advanced nix code
- DONE: make nix_tools, os_mac, etc unnecessary. Put everything inside @virkshop
- DONE: prevent mixins adding zshrc, zlogin, etc by anything other than the masterMixin
- DONE: clear out the dead code
- DONE: have .zshrc source a generated file
- DONE: stop bash from loading a profile (--norc --noprofile)
- DONE: get home folder linking working

# beta
- todo: clean up `virkshop/mixin` so that it doesn't depend on a command line git (maybe also try avoiding the use of allow-unrelated-histories)
    - maybe make it use the same @append system for all its files/folders, and then avoid git entirely
    - maybe look into git merging, but treating all the mixin stuff as ealier-commits (compared to on-this-repo commits)
- allow specifing binary names from particular packages
- create an ENV-diff command for "it works on my machine" scenarios
- Documentation
    - Basics
        - When is virkshop NOT a good idea?
        - How do I use someone's virkshop?
        - How do I make my own virkshop?
        - How can I customize a virkshop?
            1. Adding a command
            2. Adding a system tool
            3. Adding an env var
            4. 
            5. Adding a mixin
    - Advanced
        - How to add a custom nix expression
        - Making your own mixin
- add back TLDR cache linking
- make linking nix cache controllable through options.json
- virkshop update (wrapper around git mixin)
- git hook events
- make sure master mixin runs last for commands/documentation etc
- get auto-add to git ignore to work
- add basic documentation
- make a way to change shells (implement a javascript API for Zsh shell)
- mention when there are home-folder conflicts between mixins
- add a check to make sure the virkshop folder doesnt contain non-necessary items
- squash all the commits
- handle env vars from computed values

# delta
- use WASM git inside of deno
- tutorializer
- nix-based if statements
- generic nix variables
- only load executable names that are directly mentioned (no extra/overflow binaries in path)

old todo:
- create `virkshop.appendToEnvVar`
    - will need a way to save/seralize data
        - add a hidden getter that maps to a json file inside of short term temp
    - create `setEnvVar()`
        - add a process as the very first .zsh script, have it be dynamically generated by a deno script
            - handle defining env vars
    - create `appendToEnvVar()`
    - create `prependToEnvVar()`
    - make those functions give an error if they're executed inside the Virkshop itself (or come up with a complex system of writing to another file and having zsh source that file after every execution)
- inline all the startup scripts
    - generate a single .zshrc file
    - for each .zsh file, inline it
    - for all other files, just try running them
- do custom work for the home mixin
    - notify user about potential conflicts
    - notify mixins if they attempt to use something like `.bashrc`
- create `addToGitignore()` function
- mixin tools
    - redo the startup message
    - have nix_tools use deno to link to the nix profile real-home, then 
    - fix git hooks
- figure out how to combine the nix file from individual mixins
- `triggerEvent()` function
- `wrapExecutable()` function for sudo, vim, and the like
- `appendToEnvVar()`
- `zshrc()`
- standardize and publish a deno FileSystem lib
- standardize and publish a deno Virkshop lib
- consider having a background deno task for faster execution times of scripts
- consider verifying the structure (broken links) as a background task after the shell starts
- make the nix install check faster
- make enter rewrite itself (and ignore changes) after a user successfully runs it once. Have the rewrite change the hashbang