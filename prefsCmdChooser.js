import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

export default class CmdChooser extends Gtk.Dialog {
    static {
        GObject.registerClass({
            GTypeName: 'CommandMenu2CmdChooserPrefs',
        }, this);
    }

    constructor(parent, onCmdChosen) {
        super({
            transient_for: parent,
            modal: true,
            title: 'Choose Application',
            default_width: 400,
            default_height: 500,
        });

        const layout = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });
        const scrolled = new Gtk.ScrolledWindow({ vexpand: true });
        
        // add apps to list
        const apps = Gio.AppInfo.get_all().filter(a => a.should_show() && a.get_commandline()).sort();
        const list = new Gtk.ListBox({ selection_mode: Gtk.SelectionMode.SINGLE });
        for (const app of apps) {
            const row = new Gtk.ListBoxRow();
            const rowBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                halign: Gtk.Align.START,
                spacing: 6,
                margin_top: 4,
                margin_bottom: 4,
                margin_start: 6,
                margin_end: 6,
            });
            const icon = app.get_icon();
            const image = new Gtk.Image({
                gicon: icon,
                pixel_size: 24,
            });
            rowBox.append(image);

            const label = new Gtk.Label({ label: app.get_display_name() });
            rowBox.append(label);

            row.set_child(rowBox);
            row.appInfo = app;
            list.append(row);
        }

        // cancel btn
        scrolled.set_child(list);
        const cancelBtn = new Gtk.Button({ label: 'Cancel' });
        
        // listeners
        list.connect('row-activated', (_, row) => {
            const cmd = row.appInfo
                .get_commandline() // get cmd for app
                .replace(/%\S+/g, ''); // rm placeholders like %u
            onCmdChosen(cmd || null);
            this.close();
        });
        cancelBtn.connect('clicked', () => {
            onCmdChosen(null);
            this.close();
        });

        // add to layout
        layout.append(scrolled);
        layout.append(cancelBtn);
        this.set_child(layout);
        this.connect('close-request', () => this.destroy());
    }
}
