import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import CommandsUI from './prefsCommandsUI.js';
import GeneralPreferencesPage from './prefsGeneralUI.js';

export default class CommandMenuExtensionPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window.set_default_size(900, 800);

    const settings = this.getSettings();
    const menus = loadConfig();
    let menuEditorPages = [];

    const defaultMenu = (len=0) => {
      return {
        title: `Menu ${len + 1}`,
        icon: "utilities-terminal-symbolic",
        menu: [{
          title: "Customize this menu...",
          icon: "preferences-system-symbolic",
          command: "gnome-extensions prefs command-menu2@goldentree1.github.com",
        }],
      };
    };

    const generalPage = new GeneralPreferencesPage({
      title: gettext('General'),
      icon_name: 'preferences-system-symbolic',
      menus: menus,
      settings: settings,
      addMenu: (template = null) => {
        mutateMenus(m => {
          const addMe = template || defaultMenu(m.length);
          m.push(addMe);
        });
      },
      duplicateMenu: (idx) => {
        mutateMenus(m => {
          m.splice(idx + 1, 0, JSON.parse(JSON.stringify(m[idx])));
        });
      },
      removeMenu: (rmIdx) => {
        mutateMenus(m => {
          m.splice(rmIdx, 1);
        });
      },
      moveMenu: (from, to) => {
        mutateMenus(m => {
          const temp = m[from];
          m[from] = m[to];
          m[to] = temp;
        });
      },
      showMenuEditor: (idx) => {
        window.set_visible_page(menuEditorPages[idx]);
      },
      parseMenus: (json) => parseMenus(json),
      refreshConfig: () => {
        mutateMenus(m => {
          m.length = 0;
          m.push(...loadConfig());
        }, false);
      }
    });

    window.add(generalPage);
    refreshMenuEditorPages();
    window.set_visible_page(generalPage);

    function loadConfig() {
      let filePath = settings.get_string('config-filepath');
      if (filePath.startsWith('~/'))
        filePath = GLib.build_filenamev([GLib.get_home_dir(), filePath.substring(2)]);
      const file = Gio.file_new_for_path(filePath);

      if (!file.query_exists(null)) {
        try {
          GLib.file_set_contents(filePath, JSON.stringify(defaultMenu()));
        } catch (err) {
          logError(err, 'Failed to create default configuration file');
        }
      }

      try {
        let [ok, contents, _] = file.load_contents(null);
        if (!ok) throw Error();
        const decoder = new TextDecoder();
        const json = JSON.parse(decoder.decode(contents));
        return parseMenus(json);
      } catch (e) {
        showConfigErrorDialog();
        return [];
      }
    }

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

    function mutateMenus(mutateFn, saveToConfig = true) {
      const ogMenus = [...menus];
      mutateFn(menus);
      generalPage.updateMenus();
      refreshMenuEditorPages();
      refreshExtension();
      window.set_visible_page(generalPage);

      if (saveToConfig) {
        try {
          const json = JSON.stringify(menus, null, 2);
          let filePath = settings.get_string('config-filepath');
          if (filePath.startsWith('~/'))
            filePath = GLib.build_filenamev([GLib.get_home_dir(), filePath.substring(2)]);
          GLib.file_set_contents(filePath, json);
        } catch (err) {
          logError(err.uuid, 'failed to save menus to configuration file', err);
          menus.length = 0;
          menus.push(...ogMenus);
          generalPage.updateMenus();
          refreshExtension();
          refreshMenuEditorPages();
          window.set_visible_page(generalPage);
        }
      }
    }

    function refreshExtension() {
      let rc = settings.get_int('restart-counter');
      settings.set_int('restart-counter', rc + 1);
    }

    function refreshMenuEditorPages() {
      menuEditorPages.forEach(p => window.remove(p));
      menuEditorPages = menus.map((m, i) => new CommandsUI({
        title: gettext(m.type === 'button' ? `Button ${i + 1}` : `Menu ${i + 1}`),
        icon_name: m.type === 'button' ? 'input-mouse-symbolic' : 'document-edit-symbolic',
        menus: menus,
        menuIdx: i,
        settings: settings,
      }));
      menuEditorPages.forEach(p => window.add(p));
    }

    function showConfigErrorDialog() {
      const dialog = new Gtk.MessageDialog({
        transient_for: window,
        modal: true,
        buttons: Gtk.ButtonsType.YES_NO,
        message_type: Gtk.MessageType.ERROR,
        text: gettext("Configuration error!"),
        secondary_text: gettext(`Your configuration could not be parsed from '${settings.get_string('config-filepath')}'. Would you like to reset configuration?`)
      });
      dialog.connect('response', (d, response) => {
        if (response === Gtk.ResponseType.YES) {
          try {
            const filePath = settings.get_string('config-filepath');
            GLib.file_set_contents(filePath, JSON.stringify(defaultMenu()));
            d.destroy();
            refreshExtension();
            const restartDialog = new Gtk.MessageDialog({
              transient_for: window,
              modal: true,
              buttons: Gtk.ButtonsType.OK,
              message_type: Gtk.MessageType.INFO,
              text: gettext("Please restart Preferences"),
              secondary_text: gettext("The configuration has been reset. Please close and reopen preferences to continue.")
            });
            restartDialog.connect('response', d2 => d2.destroy());
            restartDialog.show();
          } catch (err) {
            logError(err, `Failed to reset configuration file at "${settings.get_string('config-filepath')}".`);
          }
        }
        d.destroy();
      });
      dialog.show();
    }
  }
}
