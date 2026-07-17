import GLib from 'gi://GLib';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

const CommandMenuLabelItem = GObject.registerClass(
  class CommandMenuLabelItem extends PopupMenu.PopupBaseMenuItem {
    _init({ cmd }) {
      super._init({
        reactive: false,
        style_class: 'section-label-menu-item',
      });

      this.label = new St.Label({
        text: cmd.title,
        style_class: 'popup-subtitle-menu-item',
        x_expand: true,
        x_align: Clutter.ActorAlign.START,
        y_align: Clutter.ActorAlign.CENTER,
      });
      this.label.set_style('font-size: 0.8em; padding: 0em; margin: 0em; line-height: 1em;');
      this.actor.set_style('padding-top: 0px; padding-bottom: 0px; min-height: 0;');
      this.actor.add_child(this.label);
    }
  }
);

const CommandMenuCommandItem = GObject.registerClass(
  class CommandMenuCommandItem extends PopupMenu.PopupBaseMenuItem {
    _init({ cmd, popup }) {
      super._init({});

      if (cmd.icon) {
        const icon = popup.loadIcon(cmd.icon, 'popup-menu-icon');
        if (icon) this.add_child(icon);
      }

      const label = new St.Label({
        text: cmd.title,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER
      });
      this.add_child(label);

      if (cmd.command) {
        this.connect('activate', () => {
          GLib.spawn_command_line_async(cmd.command);
        });
      }
    }
  }
);

const CommandMenuToggleItem = GObject.registerClass(
  class CommandMenuToggleItem extends PopupMenu.PopupSwitchMenuItem {
    _init({ cmd, popup, parentMenu }) {
      super._init(cmd.title, false);

      this._toggleUpdate = false;

      if (cmd.icon) {
        const icon = popup.loadIcon(cmd.icon, 'popup-menu-icon');
        if (icon) this.insert_child_at_index(icon, 0);
      }

      const { on, off, monitor } = cmd.command || {};
      popup.connectSignal(this, 'toggled', (_, state) => {
        if (this._toggleUpdate) return;
        if (state && on) GLib.spawn_command_line_async(on);
        else if (!state && off) GLib.spawn_command_line_async(off);
      });

      if (monitor) {
        popup.connectSignal(parentMenu, 'open-state-changed', (_menu, open) => {
          if (!open) return;
          try {
            const proc = Gio.Subprocess.new(
              ['bash', '-lc', monitor],
              Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            );
            proc.communicate_utf8_async(null, null)
              .then(([stdout]) => {
                const monitorState = (stdout ?? '').trim().length > 0;
                if (this.state !== monitorState) {
                  this._toggleUpdate = true;
                  this.setToggleState(monitorState);
                  this._toggleUpdate = false;
                }
              })
              .catch(e => logError(e, `${popup.uuid}: toggle monitor failed: "${monitor}"`));
          } catch (e) {
            logError(e, `${popup.uuid}: toggle monitor failed: "${monitor}"`);
          }
        });
      }
    }
  }
);

const CommandMenuSubmenuItem = GObject.registerClass(
  class CommandMenuSubmenuItem extends PopupMenu.PopupSubMenuMenuItem {
    _init({ cmd, popup }) {
      super._init(cmd.title);

      if (cmd.icon) {
        const icon = popup.loadIcon(cmd.icon, 'popup-menu-icon');
        if (icon) this.insert_child_at_index(icon, 1);
      }
    }
  }
);

const CommandMenuPopup = GObject.registerClass(
  class CommandMenuPopup extends PanelMenu.Button {
    _init(cmds, settings, uuid) {
      super._init(0.5);
      this.commands = cmds;
      this.commandMenuSettings = settings;
      this.uuid = uuid;
      this._dynamicLabels = [];
      this._signalIds = [];
      this._timerIds = [];

      this.connect('destroy', () => {
        this._timerIds.forEach(id => GLib.source_remove(id));
        this._timerIds = [];
        this._signalIds.forEach(([obj, id]) => obj.disconnect(id));
        this._signalIds = [];
        this._dynamicLabels = [];
      });

      this.renderMenu();
    }

    _startTimer(entry, interval, cb) {
      if (entry.sourceId !== 0) return;
      entry.sourceId = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT, interval, () => {
          cb();
          return GLib.SOURCE_CONTINUE;
        },
      );
      this._timerIds.push(entry.sourceId);
    }

    _stopTimer(entry) {
      if (entry.sourceId === 0) return;
      GLib.source_remove(entry.sourceId);
      this._timerIds = this._timerIds.filter(id => id !== entry.sourceId);
      entry.sourceId = 0;
    }

    async _resolveDynamicTitle(label, template) {
      if (typeof template !== 'string' || !template.includes('$(')) {
        label.text = template;
        return;
      }

      try {
        const escaped = template.replace(/"/g, '\\"');
        const proc = Gio.Subprocess.new(
          ['bash', '-c', `printf '%s' "${escaped}"`],
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE,
        );
        const [stdout] = await proc.communicate_utf8_async(null, null);
        label.text = stdout || '';
      } catch (e) {
        logError(e, `${this.uuid}: resolving dynamic title failed`);
      }
    }

    registerDynamicTitle(label, template, refreshInterval, parentMenu) {
      const entry = { label, template, sourceId: 0 };
      const interval = Math.max(1, Number(refreshInterval)); // minimum 1s refresh
      this._dynamicLabels.push(entry);

      if (!parentMenu) {
        // no parent: always refresh
        this._startTimer(entry, interval, () => this._resolveDynamicTitle(label, template));
      } else {
        // refresh only while parent menu is open
        this.connectSignal(parentMenu, 'open-state-changed', (_menu, open) => {
          if (open) {
            this._resolveDynamicTitle(label, template);
            this._startTimer(entry, interval, () => this._resolveDynamicTitle(label, template));
          } else this._stopTimer(entry);
        })
      }
    }

    connectSignal(obj, signal, cb) {
      const id = obj.connect(signal, cb);
      this._signalIds.push([obj, id]);
      return id;
    }

    loadIcon(icon, style_class) {
      if (typeof icon !== 'string' || !icon.length) return null;
      // sys icon
      if (!icon.includes('/'))
        return new St.Icon({ icon_name: icon, style_class });
      // filepath icon
      if (icon.startsWith('~/') || icon.startsWith("$HOME/"))
        icon = GLib.build_filenamev([GLib.get_home_dir(), icon.substring(icon.indexOf('/'))]);
      const file = Gio.File.new_for_path(icon);
      if (!file.query_exists(null)) return new St.Icon({ style_class });
      const gicon = new Gio.FileIcon({ file });
      return new St.Icon({ gicon, style_class });
    }

    populateMenuItems(menu, cmds, level) {
      cmds.forEach((cmd) => {
        let item = null;

        if (cmd.type === 'separator') {
          menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
          return;
        } else if (cmd.type === 'label') {
          if (!cmd.title) return;
          item = new CommandMenuLabelItem({ cmd });
        } else if (cmd.type === 'submenu' && level === 0) {
          if (!cmd.submenu) return;
          item = new CommandMenuSubmenuItem({ cmd, popup: this });
          this.populateMenuItems(item.menu, cmd.submenu, level + 1);
        } else if (cmd.type === 'toggle') {
          if (!cmd.command) return;
          item = new CommandMenuToggleItem({ cmd, popup: this, parentMenu: menu });
        } else {
          if (!cmd.command) return;
          item = new CommandMenuCommandItem({ cmd, popup: this });
        }

        if (cmd.dynamicTitle)
          this.registerDynamicTitle(item.label, cmd.title, cmd.refreshInterval, menu);

        menu.addMenuItem(item);
      });
    }

    renderMenu() {
      let menuTitle = this.commands.title ?? "";
      let box = new St.BoxLayout();

      // add menu icon
      let icon = this.loadIcon(this.commands.icon, 'system-status-icon');
      if (!icon && menuTitle === "") { // fallback icon
        icon = new St.Icon({
          icon_name: 'utilities-terminal-symbolic',
          style_class: 'system-status-icon',
        });
      }
      if (icon) box.add_child(icon);

      // add menu title
      let text = new St.Label({
        text: menuTitle,
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER
      });
      if (icon && menuTitle) {
        text.set_style('padding-right: 7px;'); // roughly center icon/label
      }
      if (this.commands.dynamicTitle)
        this.registerDynamicTitle(text, menuTitle, this.commands.refreshInterval);

      box.add_child(text);
      this.add_child(box);

      if (this.commands.type === 'button') {
        // button mode: exec command onclick
        if (this._indicator) this._indicator.visible = false;
        this.menu.toggle = () => {
          if (this.commands.command)
            GLib.spawn_command_line_async(this.commands.command);
        };
        this._clickGesture.set_enabled(true);
      } else {
        // menu mode: populate menu items
        if ((!Array.isArray(this.commands.menu) || this.commands.menu.length === 0)) {
          this.commands.menu = [{
            title: "Customize This Menu...",
            icon: 'preferences-system-symbolic',
            command: `gnome-extensions prefs ${this.uuid}`
          }];
        }
        this.populateMenuItems(this.menu, this.commands.menu, 0);
      }

      // one-shot update all dynamic labels
      this._dynamicLabels.forEach(({ label, template }) => this._resolveDynamicTitle(label, template));
    }
  });

export default class CommandMenuExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this.cmdMenus = [];
    this._settings = null;
    this._settingsIds = [];
  }

  reloadExtension() {
    this.cmdMenus.forEach(m => m.destroy());
    this.cmdMenus = [];
    this._loadMenus();
  }

  enable() {
    this._settings = this.getSettings();
    this._settingsIds.push(this._settings.connect('changed::restart-counter', () => {
      this.reloadExtension();
    }));
    this._settingsIds.push(this._settings.connect('changed::config-filepath', () => {
      this.reloadExtension();
    }));
    this._loadMenus();
  }

  disable() {
    this._settingsIds.forEach(s => this._settings.disconnect(s));
    this._settingsIds = [];
    this.cmdMenus.forEach(m => m.destroy());
    this.cmdMenus = [];
    this._settings = null;
  }

  _loadMenus() {
    // load cmds
    let filePath = this._settings.get_string('config-filepath');
    if (filePath.startsWith('~/')) filePath = GLib.build_filenamev([GLib.get_home_dir(), filePath.substring(2)]);
    const file = Gio.file_new_for_path(filePath);
    let menus = null;
    try {
      let [ok, contents, _] = file.load_contents(null);
      if (!ok) throw Error();
      const decoder = new TextDecoder();
      const json = JSON.parse(decoder.decode(contents));
      menus = parseMenus(json);
    } catch (err) {
      logError(err, `${this.uuid}: failed to parse command menu config`);
      menus = [{ menu: [] }];
    }

    // add menus to panel
    menus?.forEach((menu, i) => {
      const popup = new CommandMenuPopup(menu, this._settings, this.uuid);
      const index = Number.isInteger(+menu.index) ? +menu.index : 1;
      const pos = ['left', 'center', 'right'].includes(menu.position) ? menu.position : 'left';
      Main.panel.addToStatusArea(`commandMenu2_${i}`, popup, index, pos);
      this.cmdMenus.push(popup);
    });

    function parseMenus(json) {
      let normalised = (json instanceof Array && json.length && (json[0] instanceof Array || (json[0] instanceof Object && (json[0].menu instanceof Array || json[0].type === 'button'))))
        ? json : [json];
      return normalised.map(obj => {
        if (obj instanceof Object && obj.menu instanceof Array) { // object menu
          return { ...obj, menu: [...obj.menu] };
        } else if (obj instanceof Object && obj.type === 'button') { // button-only
          return { ...obj };
        } else if (obj instanceof Array) { // simple array menu
          return { menu: [...obj] };
        } else {
          return { menu: [] };
        }
      });
    }
  }
}
