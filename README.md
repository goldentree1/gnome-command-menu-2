# GNOME Command Menu 2 Extension

This GNOME Shell Extension is a highly-customisable menu to manage shortcuts in the top bar.

TODO insert example images here!

This project is forked from [Command Menu by arunk140](https://github.com/arunk140/gnome-command-menu) and includes changes I gradually made to keep it working throughout recent GNOME versions (46+). 

It also adds the following features:
- Menu editor in preferences
- Multiple menus
- Change the menu position (left, center, or right)
- Change the index position (for example, you could place the menu on the left OR right of the activities button)
- Submenus can have icons
- Icons can be loaded from a filepath

---

## Installation

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

## Usage & Examples
The extension reads the configuration from [~/.commands.json](~/.commands.json) to generate the menu. Below are some example configurations you can take inspiration from to create your own [~/.commands.json](~/.commands.json):

### Simple ~/.commands.json
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
        "icon": "folder"
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
                "command": "gnome-terminal -- bash -c 'ssh user@server1'",
                "icon": "utilities-terminal"
            }
        ]
    }
]
```

### Customized ~/.commands.json
A left-positioned menu with custom icon-paths.
```
{
    "title": "Commands",
    "icon": "utilities-terminal",
    "position": "left",
    "index": "auto",
    "menu": [
        {
            "title": "Terminal",
            "command": "gnome-terminal",
            "icon": "utilities-terminal"
        },
        {
            "title": "Files",
            "command": "nautilus",
            "icon": "folder"
        },
        {
            "type": "separator"
        },
        {
            "title": "SSH Connections",
            "icon": "/usr/share/icons/Adwaita/scalable/places/network-workgroup.svg",
            "type": "submenu",
            "submenu": [
                {
                    "title": "Connect to Server #1",
                    "command": "gnome-terminal -- bash -c 'ssh user@server1'"
                },
                {
                    "title": "Connect to Server #2",
                    "command": "gnome-terminal -- bash -c 'ssh user@server2'",
                    "icon": "~/.icons/my-custom-icon.jpg"
                }
            ]
        }
    ]
}
```

## Contribution
I would love to hear about any bugs, suggested changes or feature ideas you may have! Contributions are welcome! Please leave an issue or pull request on Github :-)
