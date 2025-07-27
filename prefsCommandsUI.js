/* commandsUI.js 
 *
 * This file is part of the Custom Command Menu GNOME Shell extension
 * https://github.com/StorageB/custom-command-menu
 * 
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import CmdChooser from './prefsCmdChooser.js';
import IconChooser from './prefsIconChooser.js';

let draggedRow = null;

export default class CommandsUI extends Adw.PreferencesPage {
    static {
        GObject.registerClass({
            GTypeName: 'commandMenu2CommandsUIPrefs',
        }, this);
    }

    _init(params = {}) {
        const { menus, menuIdx, settings, ...args } = params;
        super._init(args);
        this.menuIdx = menuIdx;
        this.menus = menus;
        const menu = this.menus[this.menuIdx];

        const style = new Gtk.CssProvider();
        const cssData = `button > label { font-weight: normal; }`;
        style.load_from_data(cssData, cssData.length);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            style,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        // save and apply changes button
        const settingsGroup0 = new Adw.PreferencesGroup();
        const saveIcon = Gtk.Image.new_from_icon_name('document-save-symbolic');
        const saveLabel = new Gtk.Label({ label: _('Apply Changes') });
        const saveBtnBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.CENTER,
        });
        saveBtnBox.append(saveIcon);
        saveBtnBox.append(saveLabel);
        const saveButton = new Gtk.Button();
        saveButton.set_child(saveBtnBox);
        saveButton.set_tooltip_text(_('Save and Reload'));
        saveButton.connect('clicked', () => {
            menu.menu = this._listBoxToMenu();
            try {
                const json = JSON.stringify(this.menus, null, 2);
                const filePath = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
                GLib.file_set_contents(filePath, json);
                settings.set_int('restart-counter', settings.get_int('restart-counter') + 1);
            } catch (e) {
                logError(e, 'Failed to save commands');
            }
        });
        saveButton.set_hexpand(true);
        saveButton.set_halign(Gtk.Align.FILL);
        settingsGroup0.add(saveButton);

        // menu popup customiser
        const settingsGroup1 = new Adw.PreferencesGroup();
        // title row
        const titleExpanderRow = new Adw.ExpanderRow({
            title: _('Menu Title'),
            subtitle: _('Customize the title, icon and position of the menu.'),
        });
        const entryRowTitle = new Adw.EntryRow({
            title: _(`Title`),
            text: menu.title || ''
        });
        entryRowTitle.connect('changed', (entry) => {
            menu.title = entry.get_text();
        });

        // icon row
        const iconBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
        const entryRowIcon = new Adw.EntryRow({
            title: _(`Menu icon`),
            text: menu.icon || '',
            hexpand: true
        });
        entryRowIcon.connect('changed', (entry) => {
            menu.icon = entry.get_text() || undefined;
        });
        const findIconButton = new Gtk.Button({
            label: _('Choose Icon...'),
            halign: Gtk.Align.END,
            margin_bottom: 5,
            margin_top: 5,
            margin_start: 8,
            margin_end: 8,
        });
        findIconButton.connect('clicked', () => {
            const dialog = new IconChooser(this.get_root(), (_ico) => {
                const icon = _ico || "";
                entryRowIcon.set_text(icon);
                menu.icon = icon || undefined;
            });
            dialog.present();
        });
        iconBox.append(entryRowIcon);
        iconBox.append(findIconButton);

        // position row (left/right/center)
        const validPositions = ['left', 'center', 'right'];
        let currentPosition = menu.position;
        if (!validPositions.includes(currentPosition)) currentPosition = 'left';
        const positionComboRow = new Adw.ComboRow({
            title: _('Position'),
            model: Gtk.StringList.new(['left', 'center', 'right']),
            selected: validPositions.indexOf(currentPosition),
        });
        positionComboRow.connect('notify::selected', row => {
            const selected = validPositions[row.get_selected()];
            menu.position = selected;
        });

        // index row
        const indexRowBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            halign: Gtk.Align.END,
            hexpand: true,
        });
        const autoIndexLabel = new Gtk.Label({
            label: _('Auto'),
            valign: Gtk.Align.CENTER,
        });
        const autoIndexSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.START,
        });
        const indexPicker = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 1,
                page_increment: 5,
                value: 1,
            }),
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.END,
            numeric: true,
        });
        const initialValue = menu.index;
        if (Number.isInteger(+initialValue)) {
            autoIndexSwitch.set_active(false);
            indexPicker.set_value(+initialValue);
            indexPicker.set_visible(true);
        } else { // not int/intstring: use auto-index
            autoIndexSwitch.set_active(true);
            indexPicker.set_visible(false);
        }
        autoIndexSwitch.connect('notify::active', sw => {
            const isAuto = sw.get_active();
            indexPicker.set_visible(!isAuto);
            menu.index = isAuto ? undefined : indexPicker.get_value_as_int();
        });
        indexPicker.connect('value-changed', spin => {
            if (!autoIndexSwitch.get_active()) {
                menu.index = spin.get_value_as_int();
            }
        });
        indexRowBox.append(autoIndexLabel);
        indexRowBox.append(autoIndexSwitch);
        indexRowBox.append(indexPicker);
        const indexActionRow = new Adw.ActionRow({
            title: _('Index'),
        });
        indexActionRow.add_suffix(indexRowBox);
        indexActionRow.set_activatable_widget(autoIndexSwitch);
        indexActionRow.set_activatable(false);

        settingsGroup1.add(titleExpanderRow);
        titleExpanderRow.add_row(entryRowTitle);
        titleExpanderRow.add_row(iconBox);
        titleExpanderRow.add_row(positionComboRow);
        titleExpanderRow.add_row(indexActionRow);

        // dragDropDescription & 'add' buttons
        const dragDropDescription = new Gtk.Label({
            label: _("Drag & drop to rearrange, then 'Apply Changes'."),
            wrap: true,
            hexpand: true,
            halign: Gtk.Align.START
        });
        dragDropDescription.get_style_context().add_class('dim-label');
        const addRow = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_bottom: 3,
            halign: Gtk.Align.FILL,
            hexpand: true,
        });
        const addButton = new Gtk.Button({
            halign: Gtk.Align.END,
        });
        const addIcon = Gtk.Image.new_from_icon_name('document-new-symbolic');
        const addLabel = new Gtk.Label({ label: _("Add Item") });
        const addButtonBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
        });
        addButtonBox.append(addIcon);
        addButtonBox.append(addLabel);
        addButton.set_child(addButtonBox);
        addButton.connect('clicked', () => {
            this._populateListBox(this.commandsListBox, 0, [{
                title: 'New Command',
                icon: 'utilities-terminal',
                command: 'notify-send hello',
            }]);
            this._listBoxScrollToBottom();
        });

        const gMenu = new Gio.Menu();
        gMenu.append(_('Add Menu Item'), 'addmenu.addCommand');
        gMenu.append(_('Add Separator'), 'addmenu.addSeparator');
        gMenu.append(_('Add Label'), 'addmenu.addLabel');
        gMenu.append(_('Add Submenu'), 'addmenu.addSubmenu');

        const addMenuButton = new Gtk.MenuButton({
            icon_name: 'pan-down-symbolic',
            menu_model: gMenu,
            has_frame: true,
            valign: Gtk.Align.CENTER,
        });
        const addMenuActions = new Gio.SimpleActionGroup();

        const addCommandAction = new Gio.SimpleAction({ name: 'addCommand' });
        addCommandAction.connect('activate', () => {
            this._populateListBox(this.commandsListBox, 0, [{
                title: 'New Command',
                icon: 'utilities-terminal',
                command: 'notify-send hello',
            }]);
            this._listBoxScrollToBottom();
        });
        addMenuActions.add_action(addCommandAction);

        const addSeparatorAction = new Gio.SimpleAction({ name: 'addSeparator' });
        addSeparatorAction.connect('activate', () => {
            this._populateListBox(this.commandsListBox, 0, [{
                type: 'separator',
            }]);
            this._listBoxScrollToBottom();
        });
        addMenuActions.add_action(addSeparatorAction);

        const addLabelAction = new Gio.SimpleAction({ name: 'addLabel' });
        addLabelAction.connect('activate', () => {
            this._populateListBox(this.commandsListBox, 0, [{
                type: 'label',
                title: 'New Label',
            }]);
            this._listBoxScrollToBottom();
        });
        addMenuActions.add_action(addLabelAction);

        const addSubmenuAction = new Gio.SimpleAction({ name: 'addSubmenu' });
        addSubmenuAction.connect('activate', () => {
            this._populateListBox(this.commandsListBox, 0, [{
                type: 'submenu',
                title: 'New Submenu',
                submenu: [{
                    title: 'New Command 1',
                    icon: 'utilities-terminal',
                    command: 'notify-send hello1',
                }, {
                    title: 'New Command 2',
                    icon: 'utilities-terminal-symbolic',
                    command: 'notify-send hello2',
                }]
            }]);
            this._listBoxScrollToBottom();
        });
        addMenuActions.add_action(addSubmenuAction);

        addMenuButton.insert_action_group('addmenu', addMenuActions);
        const addBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 2,
            halign: Gtk.Align.END,
        });
        addBox.append(addButton);
        addBox.append(addMenuButton);
        addRow.append(dragDropDescription);
        addRow.append(addBox);

        // menu commands editor listbox
        const settingsGroup2 = new Adw.PreferencesGroup();
        this.commandsListBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            hexpand: true,
        });
        this.commandsListBox.add_css_class('boxed-list');
        const scroller = new Gtk.ScrolledWindow();
        scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scroller.set_propagate_natural_height(true);
        scroller.set_child(this.commandsListBox);
        const overlay = new Adw.ToastOverlay();
        overlay.set_child(new Adw.Clamp({ child: scroller }));
        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        box.append(overlay);

        const dropTarget = Gtk.DropTarget.new(Gtk.ListBoxRow, Gdk.DragAction.MOVE);
        dropTarget.connect('drop', (_target, value, _x, y) => this._listBoxOnRowDropped(value, y));
        this.commandsListBox.add_controller(dropTarget);

        this._scroller = scroller;

        settingsGroup2.add(addRow);
        settingsGroup2.add(box);

        this.add(settingsGroup0);
        this.add(settingsGroup1);
        this.add(settingsGroup2);

        this._populateListBox(this.commandsListBox, 0, menu.menu);
    }

    _populateListBox(listBox, depth, items) {
        if (!Array.isArray(items)) return;
        for (const item of items) {
            const row = new Adw.ExpanderRow({
                title: `<b>${_(item.type || '')}</b> ${_(item.title || '')}`,
                use_markup: true,
                selectable: false,
                expanded: false,
                margin_start: depth * 24,
            });

            row._item = item;
            row._depth = depth;

            if (item.type === 'separator') {
                row.set_title(`<b>${_('Separator')}</b>`);
            } else if (item.type === 'label') {
                row.set_title(`<b>Label:</b> ${item.title || ''}`);

                const entryRowTitle = new Adw.EntryRow({ title: _('Title:'), text: item.title || '' });
                entryRowTitle.connect('notify::text', () => {
                    item.title = entryRowTitle.text;
                    row.set_title(`<b>Label:</b> ${item.title || ''}`);
                });
                row.add_row(entryRowTitle);
            } else if (item.type === "submenu") {
                row.set_title(`<b>Submenu:</b> ${item.title || ''}`);

                const entryRowTitle = new Adw.EntryRow({ title: _('Title:'), text: item.title || '' });
                entryRowTitle.connect('notify::text', () => {
                    item.title = entryRowTitle.text;
                    row.set_title(`<b>Submenu:</b> ${item.title || ''}`);
                });
                const entryRowIcon = new Adw.EntryRow({ title: _('Icon:'), text: item.icon || '' });
                entryRowIcon.connect('notify::text', () => {
                    item.icon = entryRowIcon.text;
                });

                row.add_row(entryRowTitle);
                row.add_row(entryRowIcon);
            } else if (item.command) {
                row.set_title(item.title || _('Untitled'));

                const entryRowTitle = new Adw.EntryRow({ title: _('Title:'), text: item.title || '' });
                entryRowTitle.connect('notify::text', () => {
                    item.title = entryRowTitle.text;
                    row.set_title(item.title || _('Untitled'));
                });
                // icon editor
                const iconBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
                const entryRowIcon = new Adw.EntryRow({ title: _('Icon:'), text: item.icon || '', hexpand: true });
                entryRowIcon.connect('notify::text', () => {
                    item.icon = entryRowIcon.text;
                });
                const findIconButton = new Gtk.Button({
                    label: _('Choose Icon...'),
                    halign: Gtk.Align.END,
                    margin_bottom: 5,
                    margin_top: 5,
                    margin_start: 8,
                    margin_end: 8,
                });
                findIconButton.connect('clicked', () => {
                    const dialog = new IconChooser(this.get_root(), (_ico) => {
                        if (_ico) {
                            const icon = _ico || "";
                            entryRowIcon.set_text(icon);
                            item.icon = icon;
                        }
                    });
                    dialog.present();
                });
                iconBox.append(entryRowIcon);
                iconBox.append(findIconButton);

                // command editor
                const commandBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
                const entryRowCommand = new Adw.EntryRow({ title: _('Command:'), text: item.command || '', hexpand: true });
                entryRowCommand.connect('notify::text', () => {
                    item.command = entryRowCommand.text;
                });
                const chooseAppButton = new Gtk.Button({
                    label: _('Choose App...'),
                    halign: Gtk.Align.END,
                    margin_bottom: 5,
                    margin_top: 5,
                    margin_start: 8,
                    margin_end: 8,
                });
                chooseAppButton.connect('clicked', () => {
                    const dialog = new CmdChooser(this.get_root(), (cli) => {
                        if (cli) {
                            entryRowCommand.set_text(cli);
                            item.command = cli;
                        }
                    });
                    dialog.present();
                });
                commandBox.append(entryRowCommand);
                commandBox.append(chooseAppButton);

                row.add_row(entryRowTitle);
                row.add_row(iconBox);
                row.add_row(commandBox);
            }

            // menu button (add/delete)
            const gMenu = new Gio.Menu();
            gMenu.append(_('Duplicate'), 'row.duplicate');
            gMenu.append(_('Delete'), 'row.delete');

            const menuButton = new Gtk.MenuButton({
                icon_name: 'view-more-symbolic',
                valign: Gtk.Align.CENTER,
                has_frame: false,
                menu_model: gMenu,
            });

            const actionGroup = new Gio.SimpleActionGroup();

            const deleteAction = new Gio.SimpleAction({ name: 'delete' });
            deleteAction.connect('activate', () => {
                const rows = [...this.commandsListBox];
                const index = rows.indexOf(row);
                if (index === -1) return;

                const baseDepth = row._depth;
                const toRemove = [row];

                for (let i = index + 1; i < rows.length; i++) {
                    if (rows[i]._depth > baseDepth) {
                        toRemove.push(rows[i]);
                    } else break;
                }

                for (const r of toRemove) this.commandsListBox.remove(r);
            });
            actionGroup.add_action(deleteAction);

            const duplicateAction = new Gio.SimpleAction({ name: 'duplicate' });
            duplicateAction.connect('activate', () => {
                this._populateListBox(this.commandsListBox, 0, [JSON.parse(JSON.stringify(item))]);
                this._listBoxScrollToBottom();
            });
            actionGroup.add_action(duplicateAction);

            row.insert_action_group('row', actionGroup);
            row.add_suffix(menuButton);

            // drag/drop setup

            row.add_prefix(new Gtk.Image({
                icon_name: 'list-drag-handle-symbolic',
                css_classes: ['dim-label'],
            }));

            const dragSource = new Gtk.DragSource({ actions: Gdk.DragAction.MOVE });
            row.add_controller(dragSource);

            dragSource.connect('prepare', (_source, x, y) => {
                const value = new GObject.Value();
                value.init(Gtk.ListBoxRow);
                value.set_object(row);
                draggedRow = row;
                return Gdk.ContentProvider.new_for_value(value);
            });

            dragSource.connect('drag-begin', (_source, drag) => {
                const dragWidget = new Gtk.ListBox();
                dragWidget.set_size_request(row.get_width(), row.get_height());
                dragWidget.add_css_class('boxed-list');
                const dragRow = new Adw.ExpanderRow({
                    title: row.title,
                    selectable: false,
                });
                dragRow.add_prefix(new Gtk.Image({
                    icon_name: 'list-drag-handle-symbolic',
                    css_classes: ['dim-label'],
                }));
                dragWidget.append(dragRow);
                dragWidget.drag_highlight_row(dragRow);
                const icon = Gtk.DragIcon.get_for_drag(drag);
                icon.child = dragWidget;
                drag.set_hotspot(0, 0);
            });

            if (item.icon) {
                let iconWidget;
                if (item.icon.includes('/') || item.icon.includes('.')) {
                    iconWidget = Gtk.Image.new_from_file(item.icon);
                } else {
                    iconWidget = Gtk.Image.new_from_icon_name(item.icon);
                }
                iconWidget.add_css_class('dim-label');
                row.add_prefix(iconWidget);
            }

            listBox.append(row);

            if (item.type === "submenu") {
                this._populateListBox(listBox, depth + 1, item.submenu);
            }
        }
    }

    /** 
     * Listbox doesnt support nesting, but we've done it by adding _depth var to list.
     * This converts list's depth-based menu to the .commands.json menu
     */
    _listBoxToMenu() {
        const newMenu = [];
        const stack = [{ depth: -1, items: newMenu }];

        let row = this.commandsListBox.get_first_child();
        while (row) {
            const item = row._item;
            const depth = row._depth || 0;
            const newItem = {
                type: item.type || undefined,
                title: item.title || '',
                icon: item.icon || undefined,
                command: item.command || '',
            };

            // submenu
            while (stack.length > 1 && depth <= stack[stack.length - 1].depth) {
                stack.pop();
            }

            stack[stack.length - 1].items.push(newItem);

            // submenu
            if (item.type === 'submenu') {
                newItem.submenu = [];
                stack.push({ depth, items: newItem.submenu });
            }

            row = row.get_next_sibling();
        }
        return newMenu;
    }

    _listBoxScrollToBottom() {
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            const adj = this._scroller.get_vadjustment?.();
            if (!adj) return GLib.SOURCE_REMOVE;
            adj.set_value(adj.get_upper() - adj.get_page_size());
            return GLib.SOURCE_REMOVE;
        });
    }

    _listBoxOnRowDropped(value, y) {
        const targetRow = this.commandsListBox.get_row_at_y(y);
        if (!value || !targetRow || !draggedRow) return false;
        if (targetRow === draggedRow) return false;

        const rows = [...this.commandsListBox];
        const fromIndex = rows.indexOf(draggedRow);
        const targetIndex = rows.indexOf(targetRow);
        if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) return false;

        const moveThese = [rows[fromIndex]];

        // add nested items (adjacent rows with higher depth values)
        for (let i = fromIndex + 1; i < rows.length; i++) {
            if (rows[i]._depth > rows[fromIndex]._depth) {
                moveThese.push(rows[i]);
            } else {
                break;
            }
        }

        if (targetIndex > fromIndex && targetIndex < fromIndex + moveThese.length)
            return false; // dont allow submenu to drag into itself

        const adjustment = this._scroller.get_vadjustment();
        const scrollValue = adjustment.get_value();

        // remove items
        for (const row of moveThese) this.commandsListBox.remove(row);

        let insertIndex = targetIndex > fromIndex ? targetIndex - moveThese.length : targetIndex;
        const baseDepth = draggedRow._depth;
        for (const row of moveThese) {
            const relative = row._depth - baseDepth;
            row._depth = targetRow._depth + relative;
            row.set_margin_start(row._depth * 24);
            this.commandsListBox.insert(row, insertIndex++);
        }

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            adjustment.set_value(scrollValue);
            return GLib.SOURCE_REMOVE;
        });

        const clock = this._scroller.get_frame_clock?.();
        if (clock) {
            const handlerId = clock.connect('after-paint', () => {
                adjustment.set_value(scrollValue);
                clock.disconnect(handlerId);
            });
        }

        draggedRow = null;
        return true;
    }

}
