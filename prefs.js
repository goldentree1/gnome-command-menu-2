import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk'
import Adw from 'gi://Adw';
import { ExtensionPreferences, gettext } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import commandsUI from './commandsUI.js'

class GeneralPreferencesPage extends Adw.PreferencesPage {
  static {
    GObject.registerClass({
      GTypeName: 'thingUI',
    }, this);
  }

  _init(params = {}) {
    const { menus, addMenu, removeMenu, showMenuEditor, triggerMenuEditorsUpdate, settings, ...args } = params;
    super._init(args);

    this._menus = menus;
    this._removeMenu = removeMenu;
    this._showMenuEditor = showMenuEditor;
    this._triggerMenuEditorsUpdate = triggerMenuEditorsUpdate;

    // intro
    const group = new Adw.PreferencesGroup();
    const descriptionBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
      margin_top: 20,
      margin_bottom: 15,
      margin_start: 12,
      margin_end: 12,
    });
    const description = new Gtk.Label({
      label: gettext('Welcome to Command Menu 2! Use this app to create, remove and customize your menus - or try one of our fully-functional templates.'),
      wrap: true,
      xalign: 0
    });
    description.get_style_context().add_class('dim-label');
    descriptionBox.append(description);
    group.add(descriptionBox);

    const group2 = new Adw.PreferencesGroup();

    const headerRow = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      halign: Gtk.Align.FILL,
      margin_top: 6,
      margin_bottom: 12,
      margin_start: 0,
      margin_end: 0,
    });

    // title on left
    const titleLabel = new Gtk.Label({
      label: gettext("Your Menus:"),
      xalign: 0,
    });
    titleLabel.set_halign(Gtk.Align.START);
    titleLabel.set_valign(Gtk.Align.CENTER);
    titleLabel.get_style_context().add_class('title-2');

    // button on right
    const addMenuButton = new Gtk.Button({
      halign: Gtk.Align.END,
    });
    const icon = Gtk.Image.new_from_icon_name('document-new-symbolic');
    const label = new Gtk.Label({ label: gettext("Add Menu") });
    const buttonBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
    });
    buttonBox.append(icon);
    buttonBox.append(label);
    addMenuButton.set_child(buttonBox);
    addMenuButton.set_tooltip_text(gettext("Create a new empty menu"));
    addMenuButton.connect("clicked", () => { addMenu(this); });
    const spacer = new Gtk.Box({ hexpand: true });
    headerRow.append(titleLabel);
    headerRow.append(spacer);
    headerRow.append(addMenuButton);
    group2.add(headerRow);

    // menus listbox
    this._listBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    this._listBox.add_css_class('boxed-list');
    this.updateMenus();
    group2.add(this._listBox);


    // templates
    const group3 = new Adw.PreferencesGroup({
      title: gettext('Templates (click to add to menus):'),
    });
    group3.set_margin_top(12);

    const flowBox = new Gtk.FlowBox({
      selectionMode: Gtk.SelectionMode.NONE,
      columnSpacing: 6,
      rowSpacing: 6,
      margin_top: 0,
      margin_bottom: 10,
      margin_start: 6,
      margin_end: 6,
    });

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

    for (let template of templates) {
      let vbox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
        margin_bottom: 10
      });

      const extensionObject = ExtensionPreferences.lookupByURL(import.meta.url);
      const imagePath = extensionObject.metadata.dir
        .get_child(template.image)
        .get_path();
      let img = Gtk.Image.new_from_file(imagePath);
      img.set_pixel_size(220);
      vbox.append(img);

      let label = new Gtk.Label({
        label: template.name,
        halign: Gtk.Align.CENTER,
      });
      vbox.append(label);

      let button = new Gtk.Button();
      button.set_child(vbox);

      button.set_tooltip_text(gettext("Apply this template"));

      button.connect("clicked", () => {
        let dialog = new Gtk.MessageDialog({
          modal: true,
          transient_for: this.get_root(),
          message_type: Gtk.MessageType.QUESTION,
          buttons: Gtk.ButtonsType.OK_CANCEL,
          text: gettext(`Add template "${template.name}" as a new menu?`),
          // secondary_text: gettext("This will overwrite your ~/.commands.json file."),
        });

        dialog.connect("response", (d, response) => {
          if (response === Gtk.ResponseType.OK) {
            const templatePath = extensionObject.metadata.dir
              .get_child(template.sourceFile)
              .get_path();
            const fileData = GLib.file_get_contents(templatePath)[1];
            addMenu(this, JSON.parse(fileData));

            // reload menu
            let rc = settings.get_int('restart-counter');
            settings.set_int('restart-counter', rc + 1);
          }
          d.destroy();
        });

        dialog.show();
      });

      flowBox.insert(button, -1);
    }

    group3.add(flowBox);


    this.add(group);
    this.add(group2);
    this.add(group3);
  }

  updateMenus() {
    this._listBox.remove_all();

    for (let i = 0; i < this._menus.length; i++) {
      const menu = this._menus[i];
      const row = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        margin_top: 6,
        margin_bottom: 6,
        margin_start: 12,
        margin_end: 12,
        valign: Gtk.Align.CENTER,
      });

      // label
      const menuLabel = new Gtk.Label({
        use_markup: true,
        label: `<b>Menu ${i + 1}:</b>`,
        xalign: 0,
      });
      let icon = menu.icon || '';
      if (icon.startsWith('~/') || icon.startsWith('$HOME/')) {
        icon = GLib.build_filenamev([GLib.get_home_dir(), icon.substring(icon.indexOf('/'))]);
      }
      if (!icon.startsWith('/')) {
        icon = GLib.build_filenamev([GLib.get_home_dir(), icon]);
      }
      const iconWidget = (icon.includes('/') || icon.includes('.'))
        ? Gtk.Image.new_from_file(icon)
        : Gtk.Image.new_from_icon_name(icon || 'image-missing-symbolic');
      iconWidget.add_css_class('dim-label');
      const labelEnd = new Gtk.Label({
        label: menu.title || '',
        xalign: 5,
      });
      const leftBox = new Gtk.Box({ spacing: 6 });
      leftBox.set_hexpand(true);
      leftBox.set_halign(Gtk.Align.START);
      leftBox.set_valign(Gtk.Align.CENTER);
      // Wrap icon + title in a "pill" box
      const pillBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.CENTER,
        margin_top: 2,
        margin_bottom: 2,
        margin_start: 8,
        margin_end: 8,
      });
      const css = `
  .inline-pill {
    background-color: rgba(0,0,0,0.75);
    fill: white;
    color:white;
    border-radius: 9999px;
    padding: 4px 8px;
  }
`;
      const cssProvider = new Gtk.CssProvider();
      cssProvider.load_from_data(css, css.length);
      pillBox.get_style_context().add_class('inline-pill');
      Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default(),
        cssProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
      );
      pillBox.append(iconWidget);
      pillBox.append(labelEnd);
      leftBox.append(menuLabel);
      leftBox.append(pillBox);
      row.append(leftBox);

      // edit icon
      const editIconWidget = Gtk.Image.new_from_icon_name('document-edit-symbolic');
      const editLabel = new Gtk.Label({ label: gettext('Edit') });

      const editBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
      });
      editBox.append(editIconWidget);
      editBox.append(editLabel);

      const editButton = new Gtk.Button({ valign: Gtk.Align.CENTER });
      editButton.set_child(editBox);
      editButton.set_tooltip_text(gettext(`Go to editor for 'Menu ${i + 1}'`));
      editButton.connect('clicked', () => this._showMenuEditor(i));

      row.append(editButton);

      // 3 dot menu w/ remove, up and down
      const gMenu = new Gio.Menu();
      gMenu.append(gettext('Move up'), 'row.up');
      gMenu.append(gettext('Move down'), 'row.down');
      gMenu.append(gettext('Delete'), 'row.delete');

      const menuButton = new Gtk.MenuButton({
        icon_name: 'view-more-symbolic',
        valign: Gtk.Align.CENTER,
        has_frame: false,
        menu_model: gMenu,
      });

      const actionGroup = new Gio.SimpleActionGroup();
      const deleteAction = new Gio.SimpleAction({ name: 'delete' });
      deleteAction.connect('activate', () => {
        const dialog = new Gtk.MessageDialog({
          modal: true,
          transient_for: this.get_root(),
          message_type: Gtk.MessageType.QUESTION,
          buttons: Gtk.ButtonsType.OK_CANCEL,
          text: `Are you sure you want to remove 'Menu ${i + 1}'?`,
        });

        dialog.connect("response", (d, res) => {
          if (res === Gtk.ResponseType.OK) this._removeMenu(this, i);
          this.updateMenus();
          d.destroy();
        });

        dialog.show();
      });
      actionGroup.add_action(deleteAction);

      const upAction = new Gio.SimpleAction({ name: 'up' });

      upAction.connect('activate', () => {
        if (i > 0) {
          const temp = this._menus[i - 1];
          this._menus[i - 1] = this._menus[i];
          this._menus[i] = temp;
          this.updateMenus();
          this._triggerMenuEditorsUpdate();
        }
      });
      actionGroup.add_action(upAction);

      const downAction = new Gio.SimpleAction({ name: 'down' });
      downAction.connect('activate', () => {
        if (i < this._menus.length - 1) {
          const temp = this._menus[i + 1];
          this._menus[i + 1] = this._menus[i];
          this._menus[i] = temp;
          this.updateMenus();
          this._triggerMenuEditorsUpdate();
        }
      });
      actionGroup.add_action(downAction);

      row.insert_action_group('row', actionGroup);
      row.append(menuButton);

      this._listBox.append(row);
    }
  }
}


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
      logError("Could not parse ~/.commands.json in prefs.js");
    }

    log("[CMDMENU_PREFS]", "len:", menus.length);

    let menuEditorPages = [];
    const refreshMenuEditorPages = () => {
      for (const p of menuEditorPages) window.remove(p);

      menuEditorPages = menus.map((m, i) => new commandsUI({
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
        // Force menu reload via settings tick
        let rc = window._settings.get_int('restart-counter');
        window._settings.set_int('restart-counter', rc + 1);
      }
    });

    window.add(generalPage);
    if (menus.length) refreshMenuEditorPages();
  }
}
