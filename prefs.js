import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
//import Gio from 'gi://Gio';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const MyPrefsWidget = new GObject.Class({
  Name : "CommandMenu.Prefs.Widget",
  GTypeName : "CommandMenuPrefsWidget",
  Extends : Gtk.Box,
  _init : function (commandMenuExtensionPreferences, params) {
    this.parent(params);
    this.margin = 20;
    this.set_spacing(15);
    this.set_orientation(Gtk.Orientation.VERTICAL);
    this.commandMenuExtensionPreferences = commandMenuExtensionPreferences;

    let myLabel = new Gtk.Label({
      label: "Translated Text"    
    });
    const linkBtn = new Gtk.LinkButton({
      label: "Examples (~/.commands.json)",
      uri: 'https://github.com/arunk140/gnome-command-menu/tree/main/examples',
      halign: Gtk.Align.END,
      valign: Gtk.Align.CENTER,
      hexpand: true,
  });
    
    var settings = this.commandMenuExtensionPreferences.getSettings();

    let reloadBtn = new Gtk.Button({
      label: "Reload Extension"
    });
    reloadBtn.connect("clicked", function () {
      var rc = settings.get_int('restart-counter');
      settings.set_int('restart-counter', rc+1);
    });

    let editAction = new Gtk.Button({
      label: "Edit Commands"
    });
    editAction.connect("clicked", function () {
      var ed = settings.get_int('edit-counter');
      settings.set_int('edit-counter', ed+1);
    });


    const toggles = [
      {
        label: "Hide/Show 'Edit Commands' Button in Menu",
        key: "edit-button-visible"
      },
      {
        label: "Hide/Show 'Reload' Button in Menu",
        key: "reload-button-visible"
      }
    ]

    toggles.forEach((toggle) => {
      let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 20
      });
      let label = new Gtk.Label({
        label: toggle.label,
        xalign: 0
      });
      let switcher = new Gtk.Switch({
        active: settings.get_boolean(toggle.key)
      });
      switcher.connect('notify::active', function (button) {
        settings.set_boolean(toggle.key, button.active);
        settings.set_int('restart-counter', settings.get_int('restart-counter') + 1);
      });
      hbox.append(label, true, true, 0);
      hbox.append(switcher);
      this.append(hbox);
    });

    let hBox = new Gtk.Box();
    hBox.set_orientation(Gtk.Orientation.HORIZONTAL);
    hBox.prepend(linkBtn, false, false, 0);

    this.append(reloadBtn, false, false, 0);
    this.append(editAction, false, false, 0);
    this.append(hBox);
  }
});


export default class CommandMenuExtensionPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window._settings = this.getSettings();
    const page = new Adw.PreferencesPage();

    const group = new Adw.PreferencesGroup({
        title: _('Command Menu'),
    });
    page.add(group);

    let widget = new MyPrefsWidget(this, {});
    group.add(widget);

    window.add(page);
  }
}
