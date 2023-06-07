function tree {
    "$(virkshop_tools nix_path_for package tree)/bin/tree" -C --dirsfirst  -A -F --noreport "$@"
}