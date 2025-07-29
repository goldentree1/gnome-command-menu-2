import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk'
import { ExtensionPreferences, gettext } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import CommandsUI from './prefsCommandsUI.js';
import GeneralPreferencesPage from './prefsGeneralUI.js';

export default class CommandMenuExtensionPreferences extends ExtensionPreferences {

  fillPreferencesWindow(window) {
    window.set_default_size(750, 850);
    this._settings = this.getSettings();
    this._window = window;
    this._menuEditorPages = [];
    this._menus = [];

    this._loadConfig();

    this.generalPage = new GeneralPreferencesPage({
      title: gettext('General'),
      icon_name: 'preferences-system-symbolic',
      menus: this._menus,
      settings: this._settings,
      addMenu: (template = null) => {
        this._mutateMenus((m) => {
          const addMe = template || {
            menu: [],
            title: `Menu ${m.length + 1}`,
            icon: 'utilities-terminal',
            position: 'left'
          };
          m.push(addMe);
        });
      },
      removeMenu: (rmIdx) => {
        this._mutateMenus((m) => {
          m.splice(rmIdx, 1);
        })
      },
      moveMenu: (from, to) => {
        this._mutateMenus((m) => {
          const temp = m[from];
          m[from] = m[to];
          m[to] = temp;
        })
      },
      showMenuEditor: (idx) => {
        this._window.set_visible_page(this._menuEditorPages[idx])
      },
      refreshConfig: () => {
        this._mutateMenus((m) => {
          while (m.length) m.pop();
          this._loadConfig();
        }, false);
      }
    });

    this._window.add(this.generalPage);
    if (this._menus.length) this._refreshMenuEditorPages();
    this._window.set_visible_page(this.generalPage);
  }

  _loadConfig() {
    let filePath = this._settings.get_string('config-filepath');
    if (filePath.startsWith('~/')) filePath = GLib.build_filenamev([GLib.get_home_dir(), filePath.substring(2)]);
    const file = Gio.file_new_for_path(filePath);

    // create default config if doesnt exist
    if (!file.query_exists(null)) {
      try {
        GLib.file_set_contents(filePath, JSON.stringify([{ icon: "utilities-terminal-symbolic", menu: [] }]));
      } catch (err) {
        logError(err, 'Failed to create default configuration file');
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
  }

  _mutateMenus(mutateFn, saveToConfig = true) {
    const ogMenus = [...this._menus];
    mutateFn(this._menus);
    this.generalPage.updateMenus();
    this._refreshMenuEditorPages();
    this._refreshExtension();
    this._window.set_visible_page(this.generalPage);

    if (saveToConfig) {
      try {
        const json = JSON.stringify(this._menus, null, 2);
        let filePath = this._settings.get_string('config-filepath');
        if (filePath.startsWith('~/'))
          filePath = GLib.build_filenamev([GLib.get_home_dir(), filePath.substring(2)]);
        GLib.file_set_contents(filePath, json);
      } catch (err) {
        logError(err.uuid, 'failed to save menus to configuration file', err);
        // TODO error popup dialog? check logError ok too ^^
        this._menus = ogMenus;
        this.generalPage.updateMenus();
        this._refreshExtension();
        this._refreshMenuEditorPages();
        this._window.set_visible_page(this.generalPage);
      }
    }
  }

  _refreshExtension() {
    let rc = this._settings.get_int('restart-counter');
    this._settings.set_int('restart-counter', rc + 1);
  }

  _refreshMenuEditorPages() {
    for (const p of this._menuEditorPages) this._window.remove(p);
    this._menuEditorPages = this._menus.map((m, i) => new CommandsUI({
      title: gettext(`Menu ${i + 1}`),
      icon_name: 'document-edit-symbolic',
      menus: this._menus,
      menuIdx: i,
      settings: this._settings,
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
      secondary_text: gettext(`Your configuration could not be parsed from '${this._settings.get_string('config-filepath')}'. Would you like to reset configuration?`)
    });
    dialog.connect('response', (d, response) => {
      if (response === Gtk.ResponseType.YES) {
        try {
          const filePath = this._settings.get_string('config-filepath');
          GLib.file_set_contents(filePath, JSON.stringify([{ icon: "utilities-terminal-symbolic", menu: [] }]), -1);
          d.destroy();
          this._refreshExtension(); // TODO fix this its rubbish logic
          imports.system.exit(0); // triggers reload if extension restarts with prefs
        } catch (err) {
          logError(err, `Failed to reset configuration file at "${this._settings.get_string('config-filepath')}".`);
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
