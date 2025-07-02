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
    _init(cmds, settings) {
      super._init(0.5);
      this.commands = cmds;
      this.commandMenuSettings = settings;
      this.redrawMenu();
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
              path = GLib.build_filenamev([GLib.get_home_dir(), path])
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

    redrawMenu() {
      let menuTitle = this.commands.title && this.commands.title.length > 0 ? this.commands.title : "";
      let box = new St.BoxLayout();

      // add icon
      let icon = null;
      if (this.commands.icon) {
        icon = this.loadIcon(this.commands.icon, 'system-status-icon');
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
      this.add_child(box);

      // populate menu
      let level = 0;
      this.populateMenuItems(this.menu, this.commands.menu, level);

      if (this.commandMenuSettings.get_boolean('edit-button-visible')) {
        let editBtn = new PopupMenu.PopupMenuItem('Edit Commands');
        editBtn.connect('activate', () => {
          this.editCommandsFile();
        });
        this.menu.addMenuItem(editBtn);
      }

      if (this.commandMenuSettings.get_boolean('reload-button-visible')) {
        let reloadBtn = new PopupMenu.PopupMenuItem('Reload');
        reloadBtn.connect('activate', () => {
          this.reloadExtension();
        });
        this.menu.addMenuItem(reloadBtn);
      }
    }
  });

export default class CommandMenuExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this.menus = [];
    this._settings = null;
    this._settingsIds = [];
  }

  reloadExtension() {
    this.disable();
    this.enable();
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

  addCommandMenus() {
    // load cmds
    var filePath = ".commands.json";
    var file = Gio.file_new_for_path(GLib.get_home_dir() + "/" + filePath);
    const menus = [];
    try {
      var [ok, contents, _] = file.load_contents(null);
      if (ok) {
        const json = JSON.parse(contents);
        if (json instanceof Array && json.length && (json[0] instanceof Array || (json[0] instanceof Object && json[0]['menu'] instanceof Array))) {
          // multi-menu
          for (let j of json) {
            if (j instanceof Object && j.menu instanceof Array) {
              // object menu
              menus.push({ ...j, menu: [...j.menu, { type: 'separator' }] });
            } else if (j instanceof Array) {
              // simple array of commands
              this.commands['menu'] = j;
              menus.push({ menu: [...j, { type: 'separator' }] });
            }
          }
        } else if (json instanceof Object && json.menu instanceof Array) {
          // object menu
          // this.commands = json;
          menus.push({ ...json, menu: [...json.menu, { type: 'separator' }] });
        } else if (json instanceof Array) {
          // simple array of commands
          this.commands['menu'] = json;
          menus.push({ menu: [...json, { type: 'separator' }] });
        }
      }
    } catch (e) {
      menus.push({
        menu: []
      });
    }

    menus.forEach((menu, i) => {
      const popup = new CommandMenuPopup(
        menu,
        this._settings,
        () => this.reloadExtension(),
        () => this.editCommandsFile()
      );

      let index = menu.index;
      if ((!menu.index && menu.index !== 0) || typeof menu.index !== 'number')
        index = 1;
      let pos = menu.position;
      if (!menu.position)
        pos = "left";

      Main.panel.addToStatusArea(`commandMenu2_${i}`, popup, index, pos);
      this.menus.push(popup);
    });
  }

  enable() {
    this._settings = this.getSettings();
    this.addCommandMenus();
    this._settingsIds.push(this._settings.connect('changed::restart-counter', () => {
      this.reloadExtension();
    }));
    this._settingsIds.push(this._settings.connect('changed::edit-counter', () => {
      this.editCommandsFile();
    }));
  }

  disable() {
    this._settingsIds.forEach(id => this._settings.disconnect(id));
    this._settingsIds = [];
    this.menus.forEach(m => m.destroy());
    this.menus = [];
    this._settings = null;
  }
}
