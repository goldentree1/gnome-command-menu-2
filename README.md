# GNOME Command Menu 2 Extension

This GNOME Shell Extension provides highly customisable menus to access your apps, files, scripts and more in the top bar.

Try one of our templates - or build your own menu!

![Command Menu Screenshot](screenshots/example-composite.png)

This project is forked from [Command Menu by arunk140](https://github.com/arunk140/gnome-command-menu) and includes changes I gradually made to keep it working in recent GNOME versions (46+). It also adds the following features:
- Menu editor GUI!
- Multiple custom menus
- Change menu positions (left, center, or right)
- Change index (for example, you could place the menu on the left or right of the activities button)
- Submenus can have icons
- Icons can be loaded from a filepath

---

## Manual Installation

This extension is not yet available on [GNOME Extensions](https://extensions.gnome.org/), but it can be manually installed:

1. Install the extension:
    ```bash
    git clone https://github.com/goldentree1/gnome-command-menu-2
    cd gnome-command-menu
    bash install.sh 
    ```

    You may need to logout and login again so the extension is recognised!

2. Enable it:
    ```bash
    gnome-extensions enable command-menu2@goldentree1.github.com
    ```
    Or alternatively, use [Extension Manager](https://flathub.org/apps/com.mattjakeman.ExtensionManager) to enable it.

3. Create your menu!
    ```bash
    gnome-extensions prefs command-menu2@goldentree1.github.com
    ```
     Or alternatively, use [Extension Manager](https://flathub.org/apps/com.mattjakeman.ExtensionManager) to open preferences.


## Usage & Example Configuration
This extension reads the configuration stored in [~/.commands.json](~/.commands.json) to generate your menus. Use the preferences app to create your menus, or feel free to manually edit the configuration yourself.

Below is a simple example [~/.commands.json](~/.commands.json) with two menu items :
```
[
    {
        "title": "Termimal",
        "command": "gnome-terminal",
        "icon": "utilities-terminal"
    },
    {
        "title": "Files",
        "command": "nautilus",
        "icon": "~/path/to/icon.png"
    }
]
```

## Contribution
I would love to hear about any bugs, suggested changes or feature ideas you may have! Contributions are welcome! Please leave an issue or pull request on Github.
