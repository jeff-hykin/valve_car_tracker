# TMPDIR fixes a pip issue
export TMPDIR="$VIRKSHOP_HOME/tmp.cleanable"
mkdir -p "$TMPDIR"
export VIRTUAL_ENV="$PROJECT_FOLDER/.venv"
export PATH="$VIRKSHOP_HOME/.local/bin:$PATH"
if ! [ -d "$VIRTUAL_ENV" ]
then
    echo "        creating virtual env for python"
    # run the cleanup
    python -m venv "$VIRTUAL_ENV" && echo "        virtual env created"
fi

export PATH="$VIRTUAL_ENV/bin:$PATH"