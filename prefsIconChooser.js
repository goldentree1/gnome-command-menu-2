import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

export default class IconChooser extends Gtk.Dialog {
    static {
        GObject.registerClass({
            GTypeName: 'CommandMenu2IconChooserPrefs',
        }, this);
    }

    constructor(parent, onIconChosen) {
        super({
            transient_for: parent,
            modal: true,
            title: 'Choose Icon',
            default_width: 600,
            default_height: 500,
        });

        const layout = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });

        const sysScroller = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true,
            min_content_height: 400,
        });

        // basic sys icons + sys icons info link
        const systemIcons = [
            'utilities-terminal',
            'utilities-terminal-symbolic',
            'preferences-system',
            'preferences-system-symbolic',
            'preferences-other',
            'folder',
            'applications-system',
            'document-open',
            'system-run',
        ];
        const systemBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
            vexpand: true,
            hexpand: true,
        });
        for (const iconName of systemIcons) {
            const row = new Gtk.ListBoxRow();
            const rowBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
            const image = new Gtk.Image({ icon_name: iconName, pixel_size: 24 });
            const label = new Gtk.Label({ label: iconName });
            rowBox.append(image);
            rowBox.append(label);
            row.set_child(rowBox);
            row._iconName = iconName;
            systemBox.append(row);
        }
        sysScroller.set_child(systemBox);

        // app icons (from user-installed programs)
        const appScroller = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true,
            min_content_height: 400,
        });
        const apps = Gio.AppInfo.get_all().filter(a => a.should_show() && a.get_icon());
        const appBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
            vexpand: true,
            hexpand: true,
        });
        for (const app of apps) {
            const row = new Gtk.ListBoxRow();
            const rowBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
            const iconName = app.get_icon().to_string();
            const image = new Gtk.Image({ icon_name: iconName, pixel_size: 24 });
            const label = new Gtk.Label({ label: iconName });
            rowBox.append(image);
            rowBox.append(label);
            row.set_child(rowBox);
            row._iconName = iconName;
            appBox.append(row);
        }
        appScroller.set_child(appBox);

        // user-selected icon path
        const browseBox = new Gtk.Box({
            // orientation: Gtk.Orientation.VERTICAL,
            spacing: 18,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER
        });
        const browseBtn = new Gtk.Button({ label: 'Browse Files…' });
        browseBtn.connect('clicked', () => {
            const fileChooser = new Gtk.FileChooserNative({
                title: 'Select Icon File',
                action: Gtk.FileChooserAction.OPEN,
                transient_for: this,
                modal: true,
            });
            fileChooser.connect('response', (d, response) => {
                if (response === Gtk.ResponseType.ACCEPT) {
                    const file = fileChooser.get_file();
                    if (file) onIconChosen(file.get_path());
                }
                d.destroy();
                this.close();
            });
            fileChooser.show();
        });
        browseBox.append(browseBtn);

        // listeners
        systemBox.connect('row-activated', (_, row) => {
            onIconChosen(row._iconName);
            this.close();
        });

        appBox.connect('row-activated', (_, row) => {
            onIconChosen(row._iconName);
            this.close();
        });

        // add to layout
        layout.append(sysScroller);
        layout.append(appScroller);
        layout.append(browseBox);
        this.set_child(layout);
        this.connect('close-request', () => this.destroy());
    }
}
