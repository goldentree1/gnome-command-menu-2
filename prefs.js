import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw';
import { ExtensionPreferences, gettext } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const MyPrefsWidget = new GObject.Class({
  Name: "CommandMenu.Prefs.Widget",
  GTypeName: "CommandMenuPrefsWidget",
  Extends: Gtk.Box,
  _init: function (commandMenuExtensionPreferences, params) {
    this.parent(params);
    this.margin = 20;
    this.set_spacing(15);
    this.set_orientation(Gtk.Orientation.VERTICAL);
    this.commandMenuExtensionPreferences = commandMenuExtensionPreferences;

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
      settings.set_int('restart-counter', rc + 1);
    });

    let editAction = new Gtk.Button({
      label: "Edit Commands"
    });
    editAction.connect("clicked", function () {
      var ed = settings.get_int('edit-counter');
      settings.set_int('edit-counter', ed + 1);
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

    // TEMPLATES SECTION --

    const templates = [
      {
        name: "macOS Clone",
        image: "screenshots/example-macos.png",
        sourceFile: "examples/macos.json"
      },
      {
        name: "Penguin Menu",
        image: "screenshots/example-penguinmenu.png",
        sourceFile: "examples/penguinmenu.json"
      },
    ];

    let templateLabel = new Gtk.Label({
      label: "Templates (click to apply)",
      xalign: 0
    });
    this.append(templateLabel);
    let flowBox = new Gtk.FlowBox({
      selectionMode: Gtk.SelectionMode.NONE,
      columnSpacing: 12,
      rowSpacing: 12,
      marginTop: 10
    });

    for (let template of templates) {
      let vbox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
        marginBottom: 10
      });

      const imagePath = this.commandMenuExtensionPreferences.metadata.dir
        .get_child(template.image)
        .get_path();
      let img = Gtk.Image.new_from_file(imagePath);
      img.set_pixel_size(420);
      vbox.append(img);

      let label = new Gtk.Label({ label: template.name });
      vbox.append(label);

      // Wrap the vbox in a Gtk.Button for click functionality
      let button = new Gtk.Button();
      button.set_child(vbox);  // Set the vbox as the content of the button

      // Connect the 'clicked' signal of the button
      button.connect("clicked", () => {
        let dialog = new Gtk.MessageDialog({
          modal: true,
          transient_for: this.get_root(),
          message_type: Gtk.MessageType.QUESTION,
          buttons: Gtk.ButtonsType.OK_CANCEL,
          text: `Apply template "${template.name}"?`,
          secondary_text: "This will overwrite your ~/.commands.json file."
        });

        dialog.connect("response", (d, response) => {
          if (response === Gtk.ResponseType.OK) {
            // Overwrite ~/.commands.json
            const templatePath = this.commandMenuExtensionPreferences.metadata.dir
              .get_child(template.sourceFile)
              .get_path();
            const fileData = GLib.file_get_contents(templatePath)[1];

            const targetPath = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
            GLib.file_set_contents(targetPath, fileData);

            // Trigger reload
            let rc = settings.get_int('restart-counter');
            settings.set_int('restart-counter', rc + 1);
          }
          d.destroy();
        });

        dialog.show();
      });

      // Add button to the flow box
      flowBox.insert(button, -1);
    }

    this.append(flowBox);

  }
});


export default class CommandMenuExtensionPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    window._settings = this.getSettings();
    const page = new Adw.PreferencesPage();

    const group = new Adw.PreferencesGroup({
      title: gettext('Command Menu 2'),
    });
    page.add(group);

    let widget = new MyPrefsWidget(this, {});
    group.add(widget);

    window.add(page);
  }
}
