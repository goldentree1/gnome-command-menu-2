import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import CommandsUI from './prefsCommandsUI.js';
import GeneralPreferencesPage from './prefsGeneralUI.js';

export default class CommandMenuExtensionPreferences extends ExtensionPreferences {

  fillPreferencesWindow(window) {
    window.set_default_size(800, 850);
    window._settings = this.getSettings();

    var filePath = ".commands.json";
    var file = Gio.file_new_for_path(GLib.get_home_dir() + "/" + filePath);
    const menus = [];
    try {
      var [ok, contents, _] = file.load_contents(null);
      if (ok) {
        const json = JSON.parse(contents);
        if (json instanceof Array && json.length && (json[0] instanceof Array || (json[0] instanceof Object && json[0]['menu'] instanceof Array))) {
          for (let j of json) {
            if (j instanceof Object && j.menu instanceof Array) {
              menus.push({ ...j, menu: j.menu });
            } else if (j instanceof Array) {
              menus.push({ menu: j });
            }
          }
        } else if (json instanceof Object && json.menu instanceof Array) {
          menus.push({ ...json, menu: json.menu });
        } else if (json instanceof Array && json.length) {
          menus.push({ menu: json });
        }
      }
    } catch (e) {
      // TODO add error screen asking if want to reset commands.json
      logError("Could not parse ~/.commands.json in prefs.js");
    }

    let menuEditorPages = [];
    const refreshMenuEditorPages = () => {
      for (const p of menuEditorPages) window.remove(p);
      menuEditorPages = menus.map((m, i) => new CommandsUI({
        title: gettext(`Menu ${i + 1}`),
        icon_name: 'document-edit-symbolic',
        menus: menus,
        menuIdx: i,
        settings: window._settings,
      }));
      for (const p of menuEditorPages) window.add(p);
    };

    const generalPage = new GeneralPreferencesPage({
      title: gettext('General'),
      icon_name: 'preferences-system-symbolic',
      menus,
      settings: window._settings,
      addMenu: (page, template = null) => {
        const addMe = template || {
          menu: [],
          title: `Menu ${menus.length + 1}`,
          icon: 'utilities-terminal',
          position: 'left'
        };
        menus.push(addMe);
        page.updateMenus();
        refreshMenuEditorPages();
        try {
          const json = JSON.stringify(menus, null, 2);
          const filePath = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
          GLib.file_set_contents(filePath, json, -1);
        } catch (e) {
          menus.pop();
          page.updateMenus();
          refreshMenuEditorPages();
          logError(e, 'Failed to add commands');
        }
        window._settings.set_int('restart-counter', window._settings.get_int('restart-counter') + 1);
        window.set_visible_page(generalPage);
      },
      removeMenu: (page, idx) => {
        const ogMenus = [...menus];
        // remove menu and save
        menus.splice(idx, 1);
        try {
          // reload settings pages and extension
          page.updateMenus();
          refreshMenuEditorPages();
          const targetPath = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
          GLib.file_set_contents(targetPath, JSON.stringify(menus, null, 2));
        } catch (err) {
          logError(e, 'Failed to remove menu');
          menus = ogMenus;
          page.updateMenus();
          refreshMenuEditorPages();
        }

        let rc = window._settings.get_int('restart-counter');
        window._settings.set_int('restart-counter', rc + 1);
        window.set_visible_page(generalPage);
      },
      showMenuEditor: (idx) => {
        window.set_visible_page(menuEditorPages[idx])
      },
      triggerMenuEditorsUpdate() {
        refreshMenuEditorPages();
        // TODO this isnt safe yet - revert if file_set_contents fails like other fns
        const targetPath = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
        GLib.file_set_contents(targetPath, JSON.stringify(menus, null, 2));
        let rc = window._settings.get_int('restart-counter');
        window._settings.set_int('restart-counter', rc + 1);
      }
    });

    window.add(generalPage);
    if (menus.length) refreshMenuEditorPages();
  }
}
