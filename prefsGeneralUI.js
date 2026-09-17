import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk'
import Adw from 'gi://Adw';
import { ExtensionPreferences, gettext } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GeneralPreferencesPage extends Adw.PreferencesPage {
  static {
    GObject.registerClass({
      GTypeName: 'commandMenu2GeneralPrefs',
    }, this);
  }

  _init(params = {}) {
    const { menus, addMenu, duplicateMenu, removeMenu, moveMenu, showMenuEditor, refreshConfig, settings, ...args } = params;
    super._init(args);

    this._menus = menus;
    this._removeMenu = removeMenu;
    this._moveMenu = moveMenu;
    this._duplicateMenu = duplicateMenu;
    this._showMenuEditor = showMenuEditor;
    this._settings = settings;

    const templates = [
      {
        name: "Basic Menu",
        image: "icons/basic-menu.jpg",
        sourceFile: "examples/basic-menu.json",
        description: "Browser, files and terminal. That's it!",
      },
      {
        name: "Apple Menu",
        image: "icons/apple-menu.jpg",
        sourceFile: "examples/apple-menu.json",
        description: "An Apple-inspired menu... on Linux.",
      },
      {
        name: "Files Menu",
        image: "icons/files-menu.jpg",
        sourceFile: "examples/files-menu.json",
        description: "Access your important files/folders.",
      },
      {
        name: "Kitchen Sink Menu",
        image: "icons/kitchen-sink-menu.jpg",
        sourceFile: "examples/kitchen-sink-menu.json",
        description: "A bit of everything. Lots of useful controls and utilities.",
      },
      {
        name: "System Menu",
        image: "icons/system-menu.jpg",
        sourceFile: "examples/system-menu.json",
        description: "Some system utilities and settings.",
      },
      {
        name: "System Stats Menu",
        image: "icons/system-stats-menu.jpg",
        sourceFile: "examples/system-stats-menu.json",
        description: "Live system stats and useful system information.",
      },
      {
        name: "Vibes Menu",
        image: "icons/vibes-menu.jpg",
        sourceFile: "examples/vibes-menu.json",
        description: "Display, focus and power toggles.",
      },
      {
        name: "Wi-Fi Menu",
        image: "icons/wifi-menu.jpg",
        sourceFile: "examples/wifi-menu.json",
        description: "Wi-Fi toggle with live connection status in the title.",
      },
      {
        name: "Power Menu",
        image: "icons/power-menu.jpg",
        sourceFile: "examples/power-menu.json",
        description: "Lock, suspend, restart and shut down.",
      },
      {
        name: "Weather Button",
        image: "icons/weather-button.jpg",
        sourceFile: "examples/weather-button.json",
        description: "A button showing live weather at a glance.",
      },
      {
        name: "Public IP Button",
        image: "icons/public-ip-button.jpg",
        sourceFile: "examples/public-ip-button.json",
        description: "A button showing your current public IP address.",
      },
    ];

    // description section
    const group0 = new Adw.PreferencesGroup();
    const description = new Gtk.Label({
      label: gettext('Welcome to Command Menu 2! Use this app to create, remove and customize your menus - or try one of our templates.'),
      wrap: true
    });
    description.get_style_context().add_class('dim-label');
    group0.add(description);

    // 'Configuration File' section
    const group = new Adw.PreferencesGroup({ title: gettext("Configuration File:") });
    const editManuallyBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      halign: Gtk.Align.FILL,
      hexpand: true
    });

    // edit btn
    const editConfigButton = new Gtk.Button({
      halign: Gtk.Align.START,
      label: gettext('Edit Manually'),
    });
    editConfigButton.connect("clicked", () => {
      let path = this._settings.get_string('config-filepath');
      if (path.startsWith('~/'))
        path = GLib.build_filenamev([GLib.get_home_dir(), path.substring(2)]);
      const file = Gio.File.new_for_path(path);
      const defaultTextApp = Gio.AppInfo.get_default_for_type('text/plain', false);
      if (defaultTextApp) {
        defaultTextApp.launch([file], null);
      } else {
        Gio.AppInfo.launch_default_for_uri(file.get_uri(), null);
      }
    });
    editManuallyBox.append(editConfigButton);

    // refresh btn
    const refreshConfigBtn = new Gtk.Button({ icon_name: 'view-refresh-symbolic', halign: Gtk.Align.START });
    refreshConfigBtn.set_tooltip_text(gettext("Refresh from configuration file"));
    refreshConfigBtn.connect('clicked', () => refreshConfig());
    editManuallyBox.append(refreshConfigBtn);

    // show current config path
    const configPathEntry = new Gtk.Entry({
      hexpand: true,
      editable: false,
      text: this._settings.get_string('config-filepath'),
    });
    configPathEntry.get_style_context().add_class('gtk-disabled');
    editManuallyBox.append(configPathEntry);

    // change config filepath btn
    const changeConfigFilepathBtn = new Gtk.Button({ icon_name: 'document-edit-symbolic', halign: Gtk.Align.END });
    changeConfigFilepathBtn.set_tooltip_text(gettext("Change configuration file location"));
    changeConfigFilepathBtn.connect('clicked', () => {
      const dialog = new Gtk.FileChooserDialog({
        title: "Select Command Menu Config",
        action: Gtk.FileChooserAction.SAVE,
        transient_for: this.get_root(),
        modal: true,
      });
      dialog.add_button("_Cancel", Gtk.ResponseType.CANCEL);
      dialog.add_button("_Select", Gtk.ResponseType.OK);
      let filepath = this._settings.get_string('config-filepath');
      if (filepath.startsWith('~/'))
        filepath = GLib.build_filenamev([GLib.get_home_dir(), filepath.substring(2)]);
      const filename = GLib.path_get_basename(filepath);
      const dir = GLib.path_get_dirname(filepath);
      dialog.set_current_folder(Gio.File.new_for_path(dir));
      dialog.set_current_name(filename);
      dialog.connect('response', (dlg, response) => {
        if (response === Gtk.ResponseType.OK) {
          const file = dialog.get_file();
          const path = file.get_path();
          this._settings.set_string('config-filepath', path);
          configPathEntry.set_text(path);
          GLib.file_set_contents(path, JSON.stringify(this._menus, null, 2));
          refreshConfig();
        }
        dlg.destroy();
      });
      dialog.show();
    });
    editManuallyBox.append(changeConfigFilepathBtn);

    group.add(editManuallyBox);

    // 'Your Menus' section
    const group2 = new Adw.PreferencesGroup({ title: gettext("Your Menus:") });
    const addButtonsBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      margin_bottom: 6,
      halign: Gtk.Align.START,
    });
    const addMenuButton = new Gtk.Button({ halign: Gtk.Align.START });
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
    addMenuButton.connect("clicked", () => { addMenu(); });

    const addButtonButton = new Gtk.Button({ halign: Gtk.Align.START });
    const buttonIcon = Gtk.Image.new_from_icon_name('input-mouse-symbolic');
    const buttonLabel = new Gtk.Label({ label: gettext("Add Button") });
    const addButtonBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
    });
    addButtonBox.append(buttonIcon);
    addButtonBox.append(buttonLabel);
    addButtonButton.set_child(addButtonBox);
    addButtonButton.set_tooltip_text(gettext("Create a new button (single click action, no menu)"));
    addButtonButton.connect("clicked", () => {
      addMenu({
        type: 'button',
        title: `Button ${this._menus.length + 1}`,
        icon: 'input-mouse-symbolic',
        command: `bash -c 'action=$(notify-send -w -A "customize=Customize this menu" -A "cancel=Cancel" "Customize this menu?" "Open extension preferences to customize this button."); [ "$action" = "customize" ] && gnome-extensions prefs command-menu2@goldentree1.github.com'`,
      });
    });
    addButtonsBox.append(addMenuButton);
    addButtonsBox.append(addButtonButton);

    this._listBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    this._listBox.add_css_class('boxed-list');
    this.updateMenus();
    group2.add(addButtonsBox);
    group2.add(this._listBox);

    // 'Templates' section
    const group3 = new Adw.PreferencesGroup({ title: gettext("Templates:") });
    const templatesFlowBox = new Gtk.FlowBox({
      selection_mode: Gtk.SelectionMode.NONE,
      row_spacing: 6,
    });
    for (const template of templates) {
      const vbox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
        margin_bottom: 10
      });
      const extensionObject = ExtensionPreferences.lookupByURL(import.meta.url);
      const imagePath = extensionObject.metadata.dir
        .get_child(template.image)
        .get_path();
      const img = Gtk.Image.new_from_file(imagePath);
      img.set_pixel_size(200);
      vbox.append(img);

      const label = new Gtk.Label({
        label: template.name,
        halign: Gtk.Align.CENTER,
      });
      label.add_css_class("heading");
      vbox.append(label);

      const descBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        halign: Gtk.Align.CENTER,  // center horizontally
        hexpand: false,
        margin_top: 4,
      });
      const desc = new Gtk.Label({
        wrap: true,
        label: template.description || 'No description provided.',
        halign: Gtk.Align.CENTER,
      });
      desc.set_justify(Gtk.Justification.CENTER);
      desc.add_css_class("caption");
      descBox.set_size_request(180, -1);
      descBox.append(desc);
      vbox.append(descBox);

      const button = new Gtk.Button();
      button.set_child(vbox);
      button.set_tooltip_text(gettext("Apply this template"));
      button.connect("clicked", () => {
        const dialog = new Gtk.MessageDialog({
          modal: true,
          transient_for: this.get_root(),
          message_type: Gtk.MessageType.QUESTION,
          buttons: Gtk.ButtonsType.OK_CANCEL,
          text: gettext(`Add template "${template.name}" as a new menu?`),
        });
        dialog.connect("response", (d, response) => {
          if (response === Gtk.ResponseType.OK) {
            const templatePath = extensionObject.metadata.dir
              .get_child(template.sourceFile)
              .get_path();
            const contents = GLib.file_get_contents(templatePath)[1];
            const decoder = new TextDecoder();
            const json = JSON.parse(decoder.decode(contents));
            addMenu(json);
          }
          d.destroy();
        });
        dialog.show();
      });
      templatesFlowBox.insert(button, -1);
    }
    group3.add(templatesFlowBox);

    // add all groups to page
    this.add(group0);
    this.add(group);
    this.add(group2);
    this.add(group3);
  }

  updateMenus() {
    this._listBox.remove_all();

    for (let i = 0; i < this._menus.length; i++) {
      const menu = this._menus[i];
      const isButton = menu.type === 'button';
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
        label: `<b>${isButton ? 'Button' : 'Menu'} ${i + 1}:</b>`,
        use_markup: true
      });

      let icon = menu.icon || (isButton ? 'input-mouse-symbolic' : '');
      let iconWidget = new Gtk.Image();
      iconWidget.add_css_class('dim-label');
      if (icon?.startsWith('~/') || icon.startsWith('$HOME/'))
        icon = GLib.build_filenamev([GLib.get_home_dir(), icon.substring(icon.indexOf('/'))]);
      if (icon?.includes('/')) {
        iconWidget.set_from_file(icon || "");
      } else {
        iconWidget.set_from_icon_name(icon || "");
      }

      const labelEnd = new Gtk.Label({ label: menu.title || '', });
      const leftBox = new Gtk.Box({ spacing: 6 });
      leftBox.set_hexpand(true);
      leftBox.set_halign(Gtk.Align.START);
      leftBox.set_valign(Gtk.Align.CENTER);
      // put in pill box with grey-ish colour so can be seen in light or dark themes
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
    background-color: rgba(0,0,0,0.4);
    color:white;
    border-radius: 5px;
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
      if (icon) pillBox.append(iconWidget);
      pillBox.append(labelEnd);
      leftBox.append(menuLabel);
      leftBox.append(pillBox);
      row.append(leftBox);

      // 3 dot menu w/ remove, up and down
      const gMenu = new Gio.Menu();
      // gMenu.append(gettext('Move up'), 'row.up');
      // gMenu.append(gettext('Move down'), 'row.down');
      // gMenu.append(gettext('Delete'), 'row.delete');
      gMenu.append(gettext('Move up'), 'row.up');
      gMenu.append(gettext('Move down'), 'row.down');
      gMenu.append(gettext('Duplicate'), 'row.duplicate');
      gMenu.append(gettext('Delete'), 'row.delete');

      const menuButton = new Gtk.MenuButton({
        icon_name: 'view-more-symbolic',
        valign: Gtk.Align.CENTER,
        has_frame: false,
        menu_model: gMenu,
      });

      const actionGroup = new Gio.SimpleActionGroup();

      const duplicateAction = new Gio.SimpleAction({ name: 'duplicate' });
      duplicateAction.connect('activate', () => {
        this._duplicateMenu(i);
      });
      actionGroup.add_action(duplicateAction);

      const deleteAction = new Gio.SimpleAction({ name: 'delete' });
      deleteAction.connect('activate', () => {
        const dialog = new Gtk.MessageDialog({
          modal: true,
          transient_for: this.get_root(),
          message_type: Gtk.MessageType.QUESTION,
          buttons: Gtk.ButtonsType.OK_CANCEL,
          text: `Are you sure you want to remove '${isButton ? 'Button' : 'Menu'} ${i + 1}'?`,
        });
        dialog.connect("response", (d, res) => {
          if (res === Gtk.ResponseType.OK) this._removeMenu(i);
          d.destroy();
        });
        dialog.show();
      });
      actionGroup.add_action(deleteAction);

      const upAction = new Gio.SimpleAction({ name: 'up' });
      upAction.connect('activate', () => {
        if (i > 0) this._moveMenu(i - 1, i);
      });
      actionGroup.add_action(upAction);

      const downAction = new Gio.SimpleAction({ name: 'down' });
      downAction.connect('activate', () => {
        if (i < this._menus.length - 1) this._moveMenu(i + 1, i);
      });
      actionGroup.add_action(downAction);
      row.insert_action_group('row', actionGroup);
      row.append(menuButton);

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
      editButton.set_tooltip_text(gettext(`Go to editor for '${isButton ? 'Button' : 'Menu'} ${i + 1}'`));
      editButton.connect('clicked', () => this._showMenuEditor(i));
      row.append(editButton);

      this._listBox.append(row);
    }
  }
}
