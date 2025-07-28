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
    const { menus, addMenu, removeMenu, showMenuEditor, moveMenu, refreshConfig, settings, ...args } = params;
    super._init(args);

    this._menus = menus;
    this._removeMenu = removeMenu;
    this._showMenuEditor = showMenuEditor;
    this._moveMenu = moveMenu;

    // description / edit manually section
    const group = new Adw.PreferencesGroup();
    const descriptionBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
      margin_top: 3,
      margin_bottom: 15,
    });
    const description = new Gtk.Label({
      label: gettext('Welcome to Command Menu 2! Use this app to create, remove and customize your menus - or try one of our templates.'),
      wrap: true
    });
    description.get_style_context().add_class('dim-label');
    descriptionBox.append(description);
    const editConfigButton = new Gtk.Button({
      halign: Gtk.Align.START,
      label: gettext('Edit Config Manually'),
    });
    editConfigButton.connect("clicked", () => {
      const path = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
      const uri = GLib.filename_to_uri(path, null);
      Gio.AppInfo.launch_default_for_uri(uri, null);
    });
    const editManuallyBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      halign: Gtk.Align.START,
    });
    editManuallyBox.append(editConfigButton);
    const refreshConfigBtn = new Gtk.Button({ icon_name: 'view-refresh-symbolic' });
    refreshConfigBtn.set_tooltip_text(gettext("Refresh from configuration file"));
    refreshConfigBtn.connect('clicked', () => refreshConfig(this));
    editManuallyBox.append(refreshConfigBtn);
    group.add(descriptionBox);
    group.add(editManuallyBox);

    // 'your menus' section
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
    const titleLabel = new Gtk.Label({ label: gettext("Your Menus:") });
    titleLabel.set_halign(Gtk.Align.START);
    titleLabel.set_valign(Gtk.Align.CENTER);
    titleLabel.get_style_context().add_class('title-3');
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
    this._listBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    this._listBox.add_css_class('boxed-list');
    this.updateMenus();
    group2.add(headerRow);
    group2.add(this._listBox);

    // templates selector section
    const group3 = new Adw.PreferencesGroup({ title: gettext("Templates:") });
    const templates = [
      {
        name: "Simple Apps Menu",
        image: "icons/simplemenu.jpg",
        sourceFile: "examples/simplemenu.json"
      },
      {
        name: "Apple Menu",
        image: "icons/applemenu.jpg",
        sourceFile: "examples/applemenu.json"
      },
      {
        name: "Files Menu",
        image: "icons/filesmenu.jpg",
        sourceFile: "examples/filesmenu.json"
      },
      {
        name: "Penguin Menu",
        image: "icons/penguinmenu.jpg",
        sourceFile: "examples/penguinmenu.json"
      },
      {
        name: "System Menu",
        image: "icons/systemmenu.jpg",
        sourceFile: "examples/systemmenu.json"
      },
    ];
    const templatesFlowBox = new Gtk.FlowBox({
      selection_mode: Gtk.SelectionMode.NONE,
      row_spacing: 6,
    });
    for (let template of templates) {
      const templateInfoBox = new Gtk.Box({ spacing: 12 });
      const extensionObject = ExtensionPreferences.lookupByURL(import.meta.url);
      const imagePath = extensionObject.metadata.dir
        .get_child(template.image)
        .get_path();
      let img = Gtk.Image.new_from_file(imagePath);
      img.set_pixel_size(256);
      templateInfoBox.append(img);

      const templateTextBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 4,
        halign: Gtk.Align.START,
        valign: Gtk.Align.CENTER,
        hexpand: true,
        margin_start: 10
      });
      const templateTitleLabel = new Gtk.Label({
        label: template.name,
        halign: Gtk.Align.START,
        css_classes: ['title-4'], // optional: makes it stand out as a title
      });
      const templateDescriptionLabel = new Gtk.Label({
        label: template.description ?? gettext("No description provided."),
        wrap: true,
        css_classes: ['dim-label'], // subtler style
      });
      templateTextBox.append(templateTitleLabel);
      templateTextBox.append(templateDescriptionLabel);
      templateInfoBox.append(templateTextBox);

      const templateBtn = new Gtk.Button();
      templateBtn.set_child(templateInfoBox);
      templateBtn.set_tooltip_text(gettext("Apply this template"));
      templateBtn.connect("clicked", () => {
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
            addMenu(this, json);
          }
          d.destroy();
        });
        dialog.show();
      });
      templatesFlowBox.insert(templateBtn, -1);
    }

    const templatesScroll = new Gtk.ScrolledWindow({
      hscrollbar_policy: Gtk.PolicyType.NEVER,
      vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
      hexpand: true,
      vexpand: true
    });
    templatesScroll.set_child(templatesFlowBox);
    templatesScroll.set_size_request(-1, 330);
    group3.add(templatesScroll);

    // add all groups to page
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
          d.destroy();
        });
        dialog.show();
      });
      actionGroup.add_action(deleteAction);

      const upAction = new Gio.SimpleAction({ name: 'up' });
      upAction.connect('activate', () => {
        if (i > 0) this._moveMenu(this, i - 1, i);
      });
      actionGroup.add_action(upAction);

      const downAction = new Gio.SimpleAction({ name: 'down' });
      downAction.connect('activate', () => {
        if (i < this._menus.length - 1) this._moveMenu(this, i + 1, i);
      });
      actionGroup.add_action(downAction);

      row.insert_action_group('row', actionGroup);
      row.append(menuButton);

      this._listBox.append(row);
    }
  }
}
