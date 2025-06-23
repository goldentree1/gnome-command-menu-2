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

  /** @type {{commandMenuPopup:CommandMenuPopup, commands:Object|Array, commandMenuSettings:any,commandMenuSettingsId:Array}} */
  commandMenus = [{
    commandMenuPopup: null,
    commandMenuSettings: null,
    commands: {},
    commandMenuSettingsId: [],
  }];

  reloadExtension() {
    for(let i = 0; i < this.commandMenus.length; i++){
      this.commandMenus[i].commands = {};
      this.commandMenus[i].commandMenuPopup.destroy();
    }
    this.addCommandMenu();
  }

  editCommandsFile() {
    // Check if ~/.commands.json exsists (if not create it)
    let file = Gio.file_new_for_path(GLib.get_home_dir() + '/.commands.json');
    if (!file.query_exists(null)) {
      file.replace_contents(JSON.stringify(this.commandMenus[0].commands), null, false, 0, null);
    }
    // Edit ~/.commands.json
    Gio.AppInfo.launch_default_for_uri('file://' + GLib.get_home_dir() + '/.commands.json', null).launch(null, null);
  }

  loadIcon(iconStr, style_class) {
    let icon = null;
    if (iconStr && typeof iconStr === 'string' && iconStr.length > 0) {
      if (iconStr.includes('/') || iconStr.includes('.')) {
        // custom icon file
        let path = iconStr;
        try {
          // fix path for home aliases
          if (path.startsWith('~/')) {
            path = GLib.build_filenamev([GLib.get_home_dir(), path.substring(1)])
          } else if (path.startsWith('$HOME/')) {
            path = GLib.build_filenamev([GLib.get_home_dir(), path.substring(5)])
          } else if (!path.startsWith('/')) {
            GLib.build_filenamev([GLib.get_home_dir(), path])
          }
          // try load icon
          const file = Gio.File.new_for_path(path);
          if (!file.query_exists(null)) {
            throw new Error('file doesnt exist');
          }
          const gicon = new Gio.FileIcon({ file });
          icon = new St.Icon({
            gicon,
            style_class,
          });
        } catch (err) {
          // fallback to default if custom fails
          logError(`failed to load icon from "${path}":`, err);
        }
      } else {
        // system icon
        icon = new St.Icon({
          icon_name: iconStr,
          style_class,
        });
      }
    }
    return icon;
  }

  populateMenuItems(menu, cmds, level) {
    cmds.forEach((cmd) => {
      if (cmd.type === 'separator') {
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        return;
      }

      if (!cmd.title) return;

      if (cmd.type === 'submenu' && level === 0) {
        if (!cmd.submenu) return;
        const submenu = new PopupMenu.PopupSubMenuMenuItem(cmd.title);
        if (cmd.icon) {
          const icon = this.loadIcon(cmd.icon, 'popup-menu-icon');
          if (icon)
            submenu.insert_child_at_index(icon, 1);
        }
        this.populateMenuItems(submenu.menu, cmd.submenu, level + 1);
        menu.addMenuItem(submenu);
        return;
      }

      if (!cmd.command) return;

      let item = new PopupMenu.PopupBaseMenuItem();
      let icon = this.loadIcon(cmd.icon, 'popup-menu-icon');
      if (icon)
        item.add_child(icon);
      let label = new St.Label({
        text: cmd.title,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER
      });
      item.add_child(label);
      item.connect('activate', () => {
        GLib.spawn_command_line_async(cmd.command);
      });
      menu.addMenuItem(item);
    });
  }

  redrawMenu(popUpMenu) {
    let menuTitle = this.commandMenus[0].commands.title && this.commandMenus[0].commands.title.length > 0 ? this.commandMenus[0].commands.title : "";
    let box = new St.BoxLayout();

    // add icon
    let icon = null;
    if (this.commandMenus[0].commands.icon) {
      icon = this.loadIcon(this.commandMenus[0].commands.icon, 'system-status-icon');
    }
    if (!icon && menuTitle === "") {
      // no icon or title: use fallback so its not empty
      icon = new St.Icon({
        icon_name: 'utilities-terminal-symbolic',
        style_class: 'system-status-icon',
      });
    }
    if (icon) box.add_child(icon);

    // add title
    let toplabel = new St.Label({
      text: menuTitle,
      y_expand: true,
      y_align: Clutter.ActorAlign.CENTER
    });
    box.add_child(toplabel);
    popUpMenu.add_child(box);

    // populate menu
    let level = 0;
    this.populateMenuItems(popUpMenu.menu, this.commandMenus[0].commands.menu, level);

    if (this.commandMenus[0].commandMenuSettings.get_boolean('edit-button-visible')) {
      let editBtn = new PopupMenu.PopupMenuItem('Edit Commands');
      editBtn.connect('activate', () => {
        this.editCommandsFile();
      });
      popUpMenu.menu.addMenuItem(editBtn);
    }

    if (this.commandMenus[0].commandMenuSettings.get_boolean('reload-button-visible')) {
      let reloadBtn = new PopupMenu.PopupMenuItem('Reload');
      reloadBtn.connect('activate', () => {
        this.reloadExtension();
      });
      popUpMenu.menu.addMenuItem(reloadBtn);
    }
  }

  addCommandMenu() {
    const filePath = ".commands.json";
    const file = Gio.file_new_for_path(GLib.get_home_dir() + "/" + filePath);
    try {
      const [ok, contents, _] = file.load_contents(null);
      if (ok) {

        const jsonContent = JSON.parse(contents);
        if (jsonContent instanceof Array) {
          for (let i = 0; i < jsonContent.length; i++) {
            if (!this.commandMenus[i]) {
              this.commandMenus[i] = {
                commandMenuPopup: null,
                commandMenuSettings: null,
                commands: {},
                commandMenuSettingsId: [],
              };
            }
            this.commandMenus[i].commands = jsonContent[i]; // or the parsing logic you need
          }

          let cnt = 0;
          for (const item of jsonContent) {
            if (item instanceof Array || (item instanceof Object && item['menu']))
              cnt++;
          }
          log("jsonContent:", jsonContent);
          if (cnt == jsonContent.length) {
            // PARSE OK - THIS IS MULTI.
            for (let i = 0; i < cnt; i++) {
              // this.commandMenus[i].commands
              log("jsonContent" + i + ": ", jsonContent[i]);
              if (jsonContent[i] instanceof Array) {
                this.commandMenus[i].commands['menu'] = jsonContent[i];
              } else if (jsonContent[i] instanceof Object && jsonContent[i].menu instanceof Array) {
                this.commandMenus[i].commands = jsonContent[i];
              }
              log("commandMenus" + i + ": ", this.commandMenus[i].commands)
            }
          } else {
            this.commandMenus[0].commands['menu'] = jsonContent;
          }
        } else if (jsonContent instanceof Object && jsonContent.menu instanceof Array) {
          this.commandMenus[0].commands = jsonContent;
        }
      }
    } catch (e) {
      logError("ERROR! Revert to default commands", e.message)
      this.commandMenus[0].commands = {
        menu: []
      };
    }
    
    for(let i = 0; i < this.commandMenus.length;i++){
      this.commandMenus[i].commands.menu.push({
        type: 'separator'
      });
      log("commandMenus" + 0 + ": ", this.commandMenus[i].commands)
      this.commandMenus[i].commandMenuPopup = new CommandMenuPopup(this);
      Main.panel.addToStatusArea(`commandMenuPopup${i}`, this.commandMenus[i].commandMenuPopup, 1);
  
      // re-position menu based on user prefs
      let index;
      if (this.commandMenus[i].commands.position === 'left' && Main.panel._leftBox) {
        if ((!this.commandMenus[i].commands.index && this.commandMenus[i].commands.index !== 0) || typeof this.commandMenus[i].commands.index !== 'number') {
          index = 1; // default to after activities btn
        } else {
          index = this.commandMenus[i].commands.index;
        }
        this.commandMenus[i].commandMenuPopup.container.get_parent()?.remove_child(this.commandMenus[i].commandMenuPopup.container);
        Main.panel._leftBox.insert_child_at_index(this.commandMenus[i].commandMenuPopup.container, index);
      } else if ((this.commandMenus[i].commands.position === 'center' || this.commandMenus[i].commands.position === 'centre') && Main.panel._centerBox) {
        if ((!this.commandMenus[i].commands.index && this.commandMenus[i].commands.index !== 0) || typeof this.commandMenus[i].commands.index !== 'number') {
          index = 0;
        } else {
          index = this.commandMenus[i].commands.index;
        }
        this.commandMenus[i].commandMenuPopup.container.get_parent()?.remove_child(this.commandMenus[i].commandMenuPopup.container);
        Main.panel._centerBox.insert_child_at_index(this.commandMenus[i].commandMenuPopup.container, index);
      } else if (this.commandMenus[i].commands.position === 'right' && (this.commandMenus[i].commands.index || this.commandMenus[i].commands.index === 0) && typeof this.commandMenus[i].commands.index === 'number' && Main.panel._rightBox) {
        this.commandMenus[i].commandMenuPopup.container.get_parent()?.remove_child(this.commandMenus[i].commandMenuPopup.container);
        Main.panel._rightBox.insert_child_at_index(this.commandMenus[i].commandMenuPopup.container, this.commandMenus[i].commands.index);
      }
    }
  }

  enable() {
    this.commandMenus[0].commandMenuSettings = this.getSettings();
    this.addCommandMenu();
    this.commandMenus[0].commandMenuSettingsId.push(this.commandMenus[0].commandMenuSettings.connect('changed::restart-counter', () => {
      this.reloadExtension();
    }));
    this.commandMenus[0].commandMenuSettingsId.push(this.commandMenus[0].commandMenuSettings.connect('changed::edit-counter', () => {
      this.editCommandsFile();
    }));
  }

  disable() {
    for(let i = 0; i < this.commandMenus.length; i++){
      this.commandMenus[i].commandMenuSettingsId.forEach(id => {
        this.commandMenus[i].commandMenuSettings.disconnect(id);
      });
      this.commandMenus[i].commandMenuSettingsId = [];
      this.commandMenus[i].commandMenuSettings = null;
      this.commandMenus[i].commandMenuPopup.destroy();
      this.commandMenus[i].commandMenuPopup = null;
      this.commandMenus[i].commands = {};
    }
  }
}
