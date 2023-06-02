# 
# 
# treat this like a normal .zshrc file
# 
# 

# explaination:
    # for file and folder names names inside of virkshop/home you can use these followed by a space to do some magic
    #     @append
    #     @prepend
    #     @overwrite
    #     @make
    #     @copy_real
    #     @link_real
    
    
    # virkshop uses a fake-home so that nothing in your real home folder gets broken
    # AND scripts inside of virkshop/events/@setup_without_system_tools might often create files in the fake home
    # SO you don't want to have an "@overwrite .zshrc" because its likely one of the scripts has put something into the zshrc already
    # thats why we use an "@append .zshrc" file
    # you can also simultaniously have a "@prepend .zshrc" file if you
    # want to have control over what is done at the very begining of the shell startup
    
    # for example: "@append some_file.txt"
    #     so, if virkshop/home/ has a file like: "@append some_file.txt"
    #     then it will append the contents of virkshop/home/"@append some_file.txt" to whatever is 
    #     already inside of $HOME/some_file.txt

    # @append will create the target file, and any supporting folders if needed. Otherwise it will simply append to an existing file
    # @copy_real will do a one-time copy from your real home folder to the virkshop home
    # @link_real can be dangerous, because the file/folder in the fake home will point to the real home file/folder
    #            link_real will also create the file/folder in your real home if it doesn't exist, and then link to it
    #            to link a folder, create a "@link_real foldername" that contains a "@ignore .keep" file so that git will sync the folder
    # @make can act like "touch file.txt", making sure a file/folder exists, however
    #       if the file is missing, @make will be run as an executable, and the stdout generated when running it
    #       will be the contents of the resulting new-file