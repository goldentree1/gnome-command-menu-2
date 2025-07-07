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

let draggedRow = null;

export default class commandsUI extends Adw.PreferencesPage {
    static {
        GObject.registerClass({
            GTypeName: 'commandsUI',
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
        const buttonBox = new Gtk.Box({
            margin_top: 0,
            margin_bottom: 0,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            spacing: 6,
        });
        const saveIcon = Gtk.Image.new_from_icon_name('document-save-symbolic');
        const saveLabel = new Gtk.Label({ label: _('Apply Changes') });
        const saveBtnBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_top: 0,
            margin_bottom: 0,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
        });
        saveBtnBox.append(saveIcon);
        saveBtnBox.append(saveLabel);
        const saveButton = new Gtk.Button();
        saveButton.set_child(saveBtnBox);
        saveButton.set_tooltip_text(_('Save and Reload'));
        saveButton.connect('clicked', () => {
            log("[CMDMENU_PREFS]", "clicked save!");

            const newMenu = [];
            const stack = [{ depth: -1, items: newMenu }];

            let row = this.commandsListBox.get_first_child();
            while (row) {
                const item = row._item;
                const depth = row._depth || 0;
                log('[CMDMENU_PREFS]', item);

                const newItem = {
                    type: item.type,
                    title: item.title || '',
                    icon: item.icon || undefined,
                    command: item.command || '',
                };

                // Handle nested submenu logic
                while (stack.length > 1 && depth <= stack[stack.length - 1].depth) {
                    stack.pop();
                }

                // Add to current parent's items array
                stack[stack.length - 1].items.push(newItem);

                // If this is a submenu, push to stack for following items
                if (item.type === 'submenu') {
                    newItem.submenu = [];
                    stack.push({ depth, items: newItem.submenu });
                }

                row = row.get_next_sibling();
            }

            this.menus[this.menuIdx].menu = newMenu;

            try {
                const json = JSON.stringify(this.menus, null, 2);
                const filePath = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
                GLib.file_set_contents(filePath, json, -1);
                settings.set_int('restart-counter', settings.get_int('restart-counter') + 1);
            } catch (e) {
                logError(e, 'Failed to save commands');
            }
        });
        saveButton.set_hexpand(true);
        saveButton.set_halign(Gtk.Align.FILL);
        buttonBox.append(saveButton);
        settingsGroup0.add(buttonBox);

        // menu popup customiser
        const settingsGroup1 = new Adw.PreferencesGroup();
        {
            const titleExpanderRow = new Adw.ExpanderRow({
                title: _('Menu Title'),
                subtitle: _('Customize the title, icon and position of the menu.'),
            });
            const entryRowTitle = new Adw.EntryRow({
                title: _(`Position`),
                text: this.menus[this.menuIdx].position || ''
            });
            entryRowTitle.connect('changed', (entry) => {
                this.menus[this.menuIdx].title = entry.get_text();
            });
            const entryRowIcon = new Adw.EntryRow({
                title: _(`Index`),
                text: this.menus[this.menuIdx].index || ''
            });
            entryRowIcon.connect('changed', (entry) => {
                this.menus[this.menuIdx].index = entry.get_text() || undefined;
            });
            const entryRowPosition = new Adw.EntryRow({
                title: _(`Menu title`),
                text: this.menus[this.menuIdx].title || ''
            });
            entryRowPosition.connect('changed', (entry) => {
                this.menus[this.menuIdx].title = entry.get_text() || '';
            });
            const entryRowIndex = new Adw.EntryRow({
                title: _(`Menu icon`),
                text: this.menus[this.menuIdx].icon || ''
            });
            entryRowIndex.connect('changed', (entry) => {
                this.menus[this.menuIdx].icon = entry.get_text() || undefined;
            });

            settingsGroup1.add(titleExpanderRow);
            titleExpanderRow.add_row(entryRowPosition);
            titleExpanderRow.add_row(entryRowIndex);
            titleExpanderRow.add_row(entryRowTitle);
            titleExpanderRow.add_row(entryRowIcon);
        }

        const description = new Gtk.Label({
            label: _("Drag and drop to rearrange menu items"),
            wrap: true,
            xalign: 0,
            hexpand: true,
            halign: Gtk.Align.START
        });
        description.get_style_context().add_class('dim-label');

        // add button + menu
        const rowBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
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

            // TODO - this and insert others... MAY NEED REFACTOR CUZ PRETTY FUCKD RIGHT NOW TO REFRESH

            // // Step 1: Insert the new row at the top (or any desired position)
            // const newRow = new Gtk.Box({
            //     orientation: Gtk.Orientation.HORIZONTAL,
            //     spacing: 12,
            //     margin_top: 6,
            //     margin_bottom: 6,
            //     margin_start: 12,
            //     margin_end: 12,
            //     valign: Gtk.Align.CENTER,
            // });

            // // Construct new row content here...

            // this.commandsListBox.insert(newRow, 0);  // Insert the new row at the top

            // // Step 2: Optionally modify the menu data
            // this.menus[this.menuIdx].menu.unshift({
            //     title: 'New Menu Item',
            //     icon: 'utilities-terminal',
            //     command: 'notify-send hello'
            // });

            // // Step 3: Repopulate the listbox with the updated menu
            // this.commandsListBox.remove_all();  // Clear current items
            // this.updateMenus();  // Or loop through the menu data and add it back
            // this.commandsListBox.insert(newRow, 0);
            // // this.menus[this.menuIdx].menu = [
            // //     {
            // //         title: 'New Menu Item',
            // //         icon: 'utilities-terminal',
            // //         command: 'notify-send hello'
            // //     },
            // //     ...this.menus[this.menuIdx].menu
            // // ];

        });

        const menuModel = new Gio.Menu();
        menuModel.append(_("Add Command"), 'app.addCommand');
        menuModel.append(_("Add Separator"), 'app.addSeparator');
        menuModel.append(_("Add Label"), 'app.addLabel');
        menuModel.append(_("Add Submenu"), 'app.addSubmenu');
        const addMenuButton = new Gtk.MenuButton({
            icon_name: 'pan-down-symbolic',
            menu_model: menuModel,
            halign: Gtk.Align.END,
        });
        const addBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 1,
            halign: Gtk.Align.END,
        });
        addBox.append(addButton);
        addBox.append(addMenuButton);
        rowBox.append(description);
        rowBox.append(addBox);
        const descriptionBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 12,
            margin_end: 12,
        });
        descriptionBox.append(rowBox);

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
        dropTarget.connect('drop', (_target, value, _x, y) => this._onRowDropped(value, y));
        this.commandsListBox.add_controller(dropTarget);

        this._scroller = scroller;

        settingsGroup2.add(descriptionBox);
        settingsGroup2.add(box);

        this.add(settingsGroup0);
        this.add(settingsGroup1);
        this.add(settingsGroup2);

        this.populateCommandsListBox(this.commandsListBox, 0, this.menus[this.menuIdx].menu);

    }

    updateMenus() {
        this.commandsListBox.remove_all();  // Clear current list

        // Iterate through the menus and create rows
        for (let i = 0; i < this.menus[this.menuIdx].menu.length; i++) {
            const menu = this.menus[this.menuIdx].menu[i];

            // Create a new row with your desired content
            const row = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 12,
                margin_end: 12,
                valign: Gtk.Align.CENTER,
            });

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
            leftBox.append(menuLabel);
            leftBox.append(iconWidget);
            leftBox.append(labelEnd);

            row.append(leftBox);

            // Add row to the list
            this.commandsListBox.append(row);
        }
    }

    populateCommandsListBox(listBox, depth, items) {
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
                const entryRowIcon = new Adw.EntryRow({ title: _('Icon:'), text: item.icon || '' });
                entryRowIcon.connect('notify::text', () => {
                    item.icon = entryRowIcon.text;
                });
                const entryRowCommand = new Adw.EntryRow({ title: _('Command:'), text: item.command || '' });
                entryRowCommand.connect('notify::text', () => {
                    item.command = entryRowCommand.text;
                });

                row.add_row(entryRowTitle);
                row.add_row(entryRowIcon);
                row.add_row(entryRowCommand);
            }

            // menu button (add/delete)
            const gMenu = new Gio.Menu();
            gMenu.append(_('Insert new'), 'row.insert');
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

            });
            actionGroup.add_action(duplicateAction);

            row.insert_action_group('row', actionGroup);
            row.add_suffix(menuButton);
            row.insert_action_group('row', actionGroup);


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
                this.populateCommandsListBox(listBox, depth + 1, item.submenu);
            }
        }
    }

    _onRowDropped(value, y) {
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
