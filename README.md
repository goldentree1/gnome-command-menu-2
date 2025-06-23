# GNOME Command Menu 2 Extension

This GNOME Shell Extension is a highly-customisable menu to manage shortcuts in the top bar. 

This project is forked from [Command Menu by arunk140] and it adds the following features:
- GNOME 48 supported
- Submenus can have icons
- Icons can be loaded from a file
- Change the menu position (left, center, right)
- Change the index position (for example, you could place the menu on the left OR right of the activities button)



<!-- [<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" alt="Get it on GNOME Extensions" height="100" align="middle">][ego]  -->

[ego]: https://extensions.gnome.org/extension/4850/command-menu/

GNOME shell extension to manage command shortcuts in the GNOME Top Bar.

Inspired by Shuttle and SSHMenu.

![Command Menu Example Screenshot](Screenshot-Example.png "Command Menu Example Screenshot")

For Icon Names - https://specifications.freedesktop.org/icon-naming-spec/latest/ar01s04.html

---

#### Example ~/.commands.json (Check the examples folder for more..)

```
[
    {
        "title": "Termimal",
        "command": "gnome-terminal",
        "icon": "utilities-terminal"
    },
    {
        "title": "File Manager 3",
        "command": "nautilus",
        "icon": "folder"
    },
    {
        "type": "separator"
    },
    {
        "title": "Web Browser",
        "command": "firefox",
        "icon": "web-browser"
    },
    {
        "type": "separator"
    },
    {
        "title": "SSH Connections",
        "type": "submenu",
        "submenu": [
            {
                "title": "Connect to Server (SSH)",
                "command": "gnome-terminal -- bash -c 'ssh root@10.144.1.2 -p 8022'",
                "icon": "utilities-terminal"
            }
        ]
    }
]
```

## Installation

This extension is not available on [GNOME Extensions](https://extensions.gnome.org/) yet, but it can be manually installed:

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
