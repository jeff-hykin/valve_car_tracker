def pick_item(items, message="Pick an item:"):
    if len(items) == 1:
        print(f'''going with items[0]''')
        return items[0]
    
    print(message)
    for i, item in enumerate(items):
        print(f"{i+1}. {item}")
    
    while True:
        choice = input("Enter the number of your choice (or 'q' to quit): ")
        
        if choice.lower() == 'q':
            print("Quitting...")
            return None
        
        try:
            choice = int(choice)
            if 1 <= choice <= len(items):
                return items[choice - 1]
            else:
                print("Invalid choice. Please enter a valid number.")
        except ValueError:
            print("Invalid input. Please enter a number or 'q' to quit.")