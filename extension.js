import GLib from 'gi://GLib';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

const CommandMenuPopup = GObject.registerClass(
  class CommandMenuPopup extends PanelMenu.Button {
    _init(ext) {
      super._init(0.5);
      ext.redrawMenu(this);
    }
  });

export default class CommandMenuExtension extends Extension {
  commandMenuPopup = null;
  commandMenuSettings = null;
  commands = {};
  commandMenuSettingsId = [];

  reloadExtension() {
    this.commands = {};
    this.commandMenuPopup.destroy();
    this.addCommandMenu();
  }

  editCommandsFile() {
    // Check if ~/.commands.json exsists (if not create it)
    let file = Gio.file_new_for_path(GLib.get_home_dir() + '/.commands.json');
    if (!file.query_exists(null)) {
      file.replace_contents(JSON.stringify(commands), null, false, 0, null);
    }
    // Edit ~/.commands.json
    Gio.AppInfo.launch_default_for_uri('file://' + GLib.get_home_dir() + '/.commands.json', null).launch(null, null);
  }

  populateMenuItems(menu, cmds, level) {
    cmds.forEach((cmd) => {
      if (cmd.type === 'separator') {
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        return;
      }
      if (!cmd.title) { return; }
      if (cmd.type === 'submenu' && level === 0) { // Stop submenu from being added after the first level
        let submenu;
        if (!cmd.submenu) { return; }
        submenu = new PopupMenu.PopupSubMenuMenuItem(cmd.title, Boolean(cmd.icon));
        if (cmd.icon) {
          submenu.icon.icon_name = cmd.icon;
        }
        this.populateMenuItems(submenu.menu, cmd.submenu, level + 1);
        menu.addMenuItem(submenu);
        return;
      }
      if (!cmd.command) { return; }
      let item;
      if (cmd.icon) {
        item = new PopupMenu.PopupImageMenuItem(
          cmd.title,
          cmd.icon
        );
      } else {
        item = new PopupMenu.PopupMenuItem(cmd.title);
      }
      item.connect('activate', () => {
        GLib.spawn_command_line_async(cmd.command);
      });
      menu.addMenuItem(item);
    })
  }

  redrawMenu(popUpMenu) {
    let menuTitle = this.commands.title && this.commands.title.length > 0 ? this.commands.title : "";
    let box = new St.BoxLayout();
    if (this.commands.showIcon !== false || (menuTitle === "")) {
      let menuIcon = {
        icon_name: this.commands.icon && this.commands.icon.length > 0 ? this.commands.icon : "utilities-terminal-symbolic",
        style_class: 'system-status-icon',
      };
      let icon = new St.Icon(menuIcon);
      box.add_child(icon);
    }

    let toplabel = new St.Label({
      text: menuTitle,
      y_expand: true,
      y_align: Clutter.ActorAlign.CENTER
    });
    box.add_child(toplabel);
    popUpMenu.add_child(box);
    let level = 0;
    this.populateMenuItems(popUpMenu.menu, this.commands.menu, level);

    if (this.commandMenuSettings.get_boolean('edit-button-visible')) {
      let editBtn = new PopupMenu.PopupMenuItem('Edit Commands');
      editBtn.connect('activate', () => {
        this.editCommandsFile();
      });
      popUpMenu.menu.addMenuItem(editBtn);
    }

    if (this.commandMenuSettings.get_boolean('reload-button-visible')) {
      let reloadBtn = new PopupMenu.PopupMenuItem('Reload');
      reloadBtn.connect('activate', () => {
        this.reloadExtension();
      });
      popUpMenu.menu.addMenuItem(reloadBtn);
    }
  }

  addCommandMenu() {
    var filePath = ".commands.json";
    var file = Gio.file_new_for_path(GLib.get_home_dir() + "/" + filePath);
    try {
      var [ok, contents, _] = file.load_contents(null);
      if (ok) {
        var jsonContent = JSON.parse(contents);
        if (jsonContent instanceof Array) {
          this.commands['menu'] = jsonContent;
        } else if (jsonContent instanceof Object && jsonContent.menu instanceof Array) {
          this.commands = jsonContent;
        }

      }
    } catch (e) {
      this.commands = {
        menu: []
      };
    }
    this.commands.menu.push({
      type: 'separator'
    });
    this.commandMenuPopup = new CommandMenuPopup(this);

    if (this.commands.position === "left") {
      if (Main.panel._leftBox) {
        let index;
        if ((!this.commands.index && this.commands.index != 0) || typeof this.commands.index !== "number") {
          index = 1; // after activities btn
        } else {
          index = this.commands.index;
        }
        Main.panel._leftBox.insert_child_at_index(this.commandMenuPopup.container, index);
      } else { // fallback
        Main.panel.addToStatusArea('commandMenuPopup', this.commandMenuPopup, 1);
      }
    } else if (this.commands.position === "center" || this.commands.position === "centre") {
      // Center is BUGGY - needs login/logout cycle to register
      if (Main.panel._centerBox) {
        let index;
        if ((!this.commands.index && this.commands.index != 0) || typeof this.commands.index !== "number") {
          index = 0;
        } else {
          index = this.commands.index;
        }
        Main.panel._centerBox.insert_child_at_index(this.commandMenuPopup.container, index);
      } else { // fallback
        Main.panel.addToStatusArea('commandMenuPopup', this.commandMenuPopup, 1);
      }
      Main.panel._.insert_child_at_index(this.commandMenuPopup.container, index);
    }
    else {
      if ((!this.commands.index && this.commands.index != 0) || typeof this.commands.index !== "number" || !Main.panel._rightBox) {
        Main.panel.addToStatusArea('commandMenuPopup', this.commandMenuPopup, 1);
      } else {
        Main.panel._rightBox.insert_child_at_index(this.commandMenuPopup.container, 0);
      }
    }
  };

  enable() {
    this.commandMenuSettings = this.getSettings();
    this.addCommandMenu();
    this.commandMenuSettingsId.push(this.commandMenuSettings.connect('changed::restart-counter', () => {
      this.reloadExtension();
    }));
    this.commandMenuSettingsId.push(this.commandMenuSettings.connect('changed::edit-counter', () => {
      this.editCommandsFile();
    }));
  };

  disable() {
    this.commandMenuSettingsId.forEach(id => {
      this.commandMenuSettings.disconnect(id);
    });
    this.commandMenuSettingsId = [];
    this.commandMenuSettings = null;
    this.commandMenuPopup.destroy();
    this.commandMenuPopup = null;
    this.commands = {};
  };
}
