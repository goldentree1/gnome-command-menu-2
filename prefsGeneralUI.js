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
    const { menus, addMenu, removeMenu, moveMenu, showMenuEditor, refreshConfig, settings, ...args } = params;
    super._init(args);

    this._menus = menus;
    this._removeMenu = removeMenu;
    this._moveMenu = moveMenu;
    this._showMenuEditor = showMenuEditor;
    this._settings = settings;

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
    const addMenuButton = new Gtk.Button({
      margin_bottom: 6,
      halign: Gtk.Align.START
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
    addMenuButton.connect("clicked", () => { addMenu(); });
    this._listBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    this._listBox.add_css_class('boxed-list');
    this.updateMenus();
    group2.add(addMenuButton);
    group2.add(this._listBox);

    // 'Templates' section
    const group3 = new Adw.PreferencesGroup({ title: gettext("Templates:") });
    const templates = [
      {
        name: "Simple Apps Menu",
        image: "icons/simplemenu.jpg",
        sourceFile: "examples/simplemenu.json",
        description: "Browser, files and terminal. That's it!",
      },
      {
        name: "Apple Menu",
        image: "icons/applemenu.jpg",
        sourceFile: "examples/applemenu.json",
        description: "An Apple-inspired menu... on Linux.",
      },
      {
        name: "Files Menu",
        image: "icons/filesmenu.jpg",
        sourceFile: "examples/filesmenu.json",
        description: "Access your important files/folders.",
      },
      {
        name: "Penguin Menu",
        image: "icons/penguinmenu.jpg",
        sourceFile: "examples/penguinmenu.json",
        description: "It has a penguin! And lots more.",
      },
      {
        name: "System Menu",
        image: "icons/systemmenu.jpg",
        sourceFile: "examples/systemmenu.json",
        description: "Some system utilities and settings.",
      },
    ];
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
        label: `<b>Menu ${i + 1}:</b>`,
        use_markup: true
      });

      let icon = menu.icon || '';
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
      editButton.set_tooltip_text(gettext(`Go to editor for 'Menu ${i + 1}'`));
      editButton.connect('clicked', () => this._showMenuEditor(i));
      row.append(editButton);

      this._listBox.append(row);
    }
  }
}
