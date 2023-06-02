function tree {
    "$(virkshop_tools nix_path_for tree)/bin/tree" -C --dirsfirst  -A -F --noreport "$@"
}