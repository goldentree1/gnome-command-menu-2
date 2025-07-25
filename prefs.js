import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk'
import { ExtensionPreferences, gettext } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import CommandsUI from './prefsCommandsUI.js';
import GeneralPreferencesPage from './prefsGeneralUI.js';

export default class CommandMenuExtensionPreferences extends ExtensionPreferences {

  fillPreferencesWindow(window) {
    window.set_default_size(800, 850);
    window._settings = this.getSettings();
    this._window = window;
    this._menuEditorPages = [];
    this._menus = [];

    const filePath = ".commands.json";
    const file = Gio.file_new_for_path(GLib.get_home_dir() + "/" + filePath);

    // create default config if doesnt exist
    if (!file.query_exists(null)) {
      try {
        GLib.file_set_contents(filePath, JSON.stringify([{ icon: "utilities-terminal-symbolic", menu: [] }]));
      } catch (err) {
        logError(err, 'Failed to create new default .commands.json file');
      }
    }

    // load menus from config
    try {
      let [ok, contents, _] = file.load_contents(null);
      if (!ok) throw Error();
      const decoder = new TextDecoder();
      const json = JSON.parse(decoder.decode(contents));
      if (json instanceof Array && json.length && (json[0] instanceof Array || (json[0] instanceof Object && json[0]['menu'] instanceof Array))) {
        json.forEach(j => this._menus.push(parseMenu(j)));
      } else {
        this._menus.push(parseMenu(json));
      }
    } catch (e) {
      // couldnt parse config - show error dialog
      this._showConfigErrorDialog();
    }

    const generalPage = new GeneralPreferencesPage({
      title: gettext('General'),
      icon_name: 'preferences-system-symbolic',
      menus: this._menus,
      settings: this._window._settings,
      addMenu: (page, template = null) => this._addMenu(page, template),
      removeMenu: (page, idx) => this._removeMenu(page, idx),
      moveMenu: (page, from, to) => this._moveMenu(page, from, to),
      showMenuEditor: (idx) => this._window.set_visible_page(this._menuEditorPages[idx]),
    });

    this._window.add(generalPage);
    if (this._menus.length) this._refreshMenuEditorPages();
    this._window.set_visible_page(generalPage);
  }

  _addMenu(generalPage, template = null) {
    const ogMenus = [...this._menus];
    const addMe = template || {
      menu: [],
      title: `Menu ${this._menus.length + 1}`,
      icon: 'utilities-terminal',
      position: 'left'
    };
    this._menus.push(addMe);
    try {
      const json = JSON.stringify(this._menus, null, 2);
      const filePath = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
      GLib.file_set_contents(filePath, json);
      generalPage.updateMenus();
      this._refreshMenuEditorPages();
      this._refreshExtension();
      this._window.set_visible_page(generalPage);
    } catch (e) { // revert on fail
      logError(e, 'Failed to add menu');
      this._menus = ogMenus;
      generalPage.updateMenus();
      this._refreshMenuEditorPages();
    }
  }

  _removeMenu(generalPage, rmIdx) {
    const ogMenus = [...this._menus];
    // remove menu and save
    this._menus.splice(rmIdx, 1);
    try {
      generalPage.updateMenus();
      this._refreshMenuEditorPages();
      const targetPath = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
      GLib.file_set_contents(targetPath, JSON.stringify(this._menus, null, 2));
      this._refreshExtension();
      this._window.set_visible_page(generalPage);
    } catch (err) { // revert on fail
      logError(e, 'Failed to remove menu');
      this._menus = ogMenus;
      generalPage.updateMenus();
      this._refreshMenuEditorPages();
    }
  }

  _moveMenu(generalPage, from, to) {
    const ogMenus = [...this._menus];
    // try swap
    const temp = this._menus[from];
    this._menus[from] = this._menus[to];
    this._menus[to] = temp;
    try {
      generalPage.updateMenus();
      this._refreshMenuEditorPages();
      const targetPath = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
      GLib.file_set_contents(targetPath, JSON.stringify(this._menus, null, 2));
      this._refreshExtension();
      this._window.set_visible_page(generalPage);
    } catch (err) { // revert on fail
      logError(err, 'Failed to move menu');
      this._menus = ogMenus;
      generalPage.updateMenus();
      this._refreshMenuEditorPages();
    }
  }

  _refreshExtension() {
    let rc = this._window._settings.get_int('restart-counter');
    this._window._settings.set_int('restart-counter', rc + 1);
  }

  _refreshMenuEditorPages() {
    for (const p of this._menuEditorPages) this._window.remove(p);
    this._menuEditorPages = this._menus.map((m, i) => new CommandsUI({
      title: gettext(`Menu ${i + 1}`),
      icon_name: 'document-edit-symbolic',
      menus: this._menus,
      menuIdx: i,
      settings: this._window._settings,
    }));
    for (const p of this._menuEditorPages) this._window.add(p);
  }

  _showConfigErrorDialog() {
    const dialog = new Gtk.MessageDialog({
      transient_for: this._window,
      modal: true,
      buttons: Gtk.ButtonsType.YES_NO,
      message_type: Gtk.MessageType.ERROR,
      text: gettext("Configuration error!"),
      secondary_text: gettext("Your configuration could not be parsed from ~/.commands.json. Would you like to reset configuration?")
    });
    dialog.connect('response', (d, response) => {
      if (response === Gtk.ResponseType.YES) {
        try {
          const filePath = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
          GLib.file_set_contents(filePath, JSON.stringify([{ icon: "utilities-terminal-symbolic", menu: [] }]), -1);
          d.destroy();
          this._refreshExtension();
          imports.system.exit(0); // triggers reload if extension restarts with prefs
        } catch (err) {
          logError(err, 'Failed to reset ~/commands.json');
          imports.system.exit(1);
        }
      }
      d.destroy();
    });
    dialog.show();
  }
}

function parseMenu(obj) {
  if (obj instanceof Object && obj.menu instanceof Array) { // object menu
    return { ...obj, menu: [...obj.menu] };
  } else if (obj instanceof Array) { // simple array menu
    return { menu: [...obj] };
  } else {
    return { menu: [] };
  }
}
