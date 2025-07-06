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

        const mainGroup = new Adw.PreferencesGroup();

        // menu picker + add/remove buttons
        const menuPickerBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 });
        const addMenuButton = new Gtk.Button({ label: _('Add Menu') });
        const removeMenuButton = new Gtk.Button({ label: _('Remove Menu') });
        const menuSelector = new Gtk.ComboBoxText();
        menuSelector.append_text('Main Menu');
        menuSelector.set_active(0);
        menuPickerBox.append(menuSelector);
        menuPickerBox.append(addMenuButton);
        menuPickerBox.append(removeMenuButton);
        mainGroup.add(menuPickerBox);

        // menu metadata editor
        const metadataGroup = new Adw.PreferencesGroup({ title: _('Menu Metadata') });
        const metadataBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 });

        const titleRow = new Adw.EntryRow({ title: _('Title'), text: menu.title || '' });
        const iconRow = new Adw.EntryRow({ title: _('Icon'), text: menu.icon || '' });
        const browseIconButton = new Gtk.Button({ label: _('Browse…') });
        const viewIconsButton = new Gtk.Button({ label: _('System Icons…') });
        const iconButtonBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
        iconButtonBox.append(browseIconButton);
        iconButtonBox.append(viewIconsButton);

        const iconContainer = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        iconContainer.append(iconRow);
        iconContainer.append(iconButtonBox);

        const positionRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
        const leftToggle = Gtk.ToggleButton.new_with_label(_('Left'));
        const centerToggle = Gtk.ToggleButton.new_with_label(_('Center'));
        const rightToggle = Gtk.ToggleButton.new_with_label(_('Right'));
        positionRow.append(leftToggle);
        positionRow.append(centerToggle);
        positionRow.append(rightToggle);

        const indexRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
        const indexEntry = new Adw.EntryRow({ title: _('Index'), text: typeof menu.index === 'number' ? String(menu.index) : '' });
        const autoIndexButton = Gtk.ToggleButton.new_with_label(_('Auto'));
        indexRow.append(indexEntry);
        indexRow.append(autoIndexButton);

        metadataBox.append(titleRow);
        metadataBox.append(iconContainer);
        metadataBox.append(positionRow);
        metadataBox.append(indexRow);
        metadataGroup.add(metadataBox);

        // commands editor listbox
        this.commandsListBox = new Gtk.ListBox();
        this.commandsListBox.add_css_class('boxed-list');
        const scroller = new Gtk.ScrolledWindow();
        scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scroller.set_propagate_natural_height(true);
        scroller.set_child(this.commandsListBox);
        const overlay = new Adw.ToastOverlay();
        overlay.set_child(new Adw.Clamp({ child: scroller }));
        const commandEditorGroup = new Adw.PreferencesGroup();
        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        box.append(overlay);

        const dropTarget = Gtk.DropTarget.new(Gtk.ListBoxRow, Gdk.DragAction.MOVE);
        dropTarget.connect('drop', (_target, value, _x, y) => this._onRowDropped(value, y));
        this.commandsListBox.add_controller(dropTarget);

        this._scroller = scroller;

        // buttons
        const refreshButton = new Gtk.Button();
        refreshButton.set_child(Gtk.Image.new_from_icon_name('view-refresh-symbolic'));
        refreshButton.set_tooltip_text(_('Refresh Extension'));
        refreshButton.connect('clicked', () => {
            settings.set_int('restart-counter', settings.get_int('restart-counter') + 1);
        });

        const saveButton = new Gtk.Button();
        saveButton.set_child(Gtk.Image.new_from_icon_name('document-save-symbolic'));
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

        const buttonBox = new Gtk.Box({
            margin_top: 12,
            margin_bottom: 12,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            spacing: 12,
        });

        [saveButton, refreshButton].forEach(button => {
            button.set_hexpand(true);
            button.set_halign(Gtk.Align.FILL);
            buttonBox.append(button);
        });

        commandEditorGroup.add(buttonBox);
        commandEditorGroup.add(box);

        this.add(mainGroup);
        this.add(metadataGroup);
        this.add(commandEditorGroup);

        this.populateCommandsListBox(this.commandsListBox, 0, this.menus[this.menuIdx].menu);
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

                const entryRowTitle = new Adw.EntryRow({ title: _('Name:'), text: item.title || '' });
                entryRowTitle.connect('notify::text', () => {
                    item.title = entryRowTitle.text;
                    row.set_title(item.title || _('Untitled'));
                });
                const entryRowCommand = new Adw.EntryRow({ title: _('Command:'), text: item.command || '' });
                entryRowCommand.connect('notify::text', () => {
                    item.command = entryRowCommand.text;
                });
                const entryRowIcon = new Adw.EntryRow({ title: _('Icon:'), text: item.icon || '' });
                entryRowIcon.connect('notify::text', () => {
                    item.icon = entryRowIcon.text;
                });

                row.add_row(entryRowTitle);
                row.add_row(entryRowCommand);
                row.add_row(entryRowIcon);
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
