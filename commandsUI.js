/* commandsUI.js 
 *
 * This file is part of the Custom Command Menu GNOME Shell extension
 * https://github.com/StorageB/custom-command-menu
 * 
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
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

        const newButton = new Gtk.Button();
        newButton.set_child(Gtk.Image.new_from_icon_name('document-new-symbolic'));
        newButton.set_tooltip_text(_('New (raw save)'));
        newButton.connect('clicked', () => {
            try {
                const json = JSON.stringify(this.menu, null, 2);
                const filePath = GLib.build_filenamev([GLib.get_home_dir(), '.commands.json']);
                GLib.file_set_contents(filePath, json, -1);
                print('Commands saved to ~/.commands.json');
            } catch (e) {
                logError(e, 'Failed to save commands');
            }
        });

        const saveButton = new Gtk.Button();
        saveButton.set_child(Gtk.Image.new_from_icon_name('document-save-symbolic'));
        saveButton.set_tooltip_text(_('Save and Reload'));
        saveButton.connect('clicked', () => {
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

        [newButton, saveButton, refreshButton].forEach(button => {
            button.set_hexpand(true);
            button.set_halign(Gtk.Align.FILL);
            buttonBox.append(button);
        });

        commandEditorGroup.add(buttonBox);
        commandEditorGroup.add(box);

        this.add(mainGroup);
        this.add(metadataGroup);
        this.add(commandEditorGroup);

        this.populateCommandsListBox();
    }

    populateCommandsListBox() {
        if (!Array.isArray(this.menus[this.menuIdx].menu)) return;

        for (let i = 0; i < this.menus[this.menuIdx].menu.length; i++) {
            const item = this.menus[this.menuIdx].menu[i];

            let row;
            if (item.type === 'separator') {
                row = new Adw.ExpanderRow({
                    title: `<b>${_('Separator')}</b>`,
                    use_markup: true,
                    selectable: false,
                    expanded: false,
                });
            } else if (item.type === 'label') {
                row = new Adw.ExpanderRow({
                    title: `<b>Label:</b> ${item.title || ''}`,
                    use_markup: true,
                    selectable: false,
                    expanded: false,
                });

                const entryRowTitle = new Adw.EntryRow({ title: _('Label Title:'), text: item.title || '' });

                entryRowTitle.connect('notify::text', () => {
                    item.title = entryRowTitle.text;
                    row.set_title(`<b>Label:</b> ${item.title || ''}`);
                });

                row.add_row(entryRowTitle)
            } else if (item.command) {
                row = new Adw.ExpanderRow({
                    title: item.title || _('Untitled'),
                    selectable: false,
                    expanded: false,
                });

                const entryRowName = new Adw.EntryRow({ title: _('Name:'), text: item.title || '' });
                const entryRowCommand = new Adw.EntryRow({ title: _('Command:'), text: item.command || '' });
                const entryRowIcon = new Adw.EntryRow({ title: _('Icon:'), text: item.icon || '' });

                // Bind changes to JSON data
                entryRowName.connect('notify::text', () => {
                    item.title = entryRowName.text;
                    row.set_title(item.title || _('Untitled'));
                });

                entryRowCommand.connect('notify::text', () => {
                    item.command = entryRowCommand.text;
                });

                entryRowIcon.connect('notify::text', () => {
                    item.icon = entryRowIcon.text;
                });

                row.add_row(entryRowName);
                row.add_row(entryRowCommand);
                row.add_row(entryRowIcon);
            } else {
                continue; // TODO TEMPORARY! THIS SHOULD NOT BE HERE - THROW ERROR IF UNRECOGNISED
            }

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

            this.commandsListBox.append(row);
        }
    }

    _onRowDropped(value, y) {
        const targetRow = this.commandsListBox.get_row_at_y(y);
        if (!value || !targetRow || !draggedRow) return false;
        if (targetRow === draggedRow) return false;

        const fromIndex = [...this.commandsListBox].indexOf(draggedRow);
        const toIndex = [...this.commandsListBox].indexOf(targetRow);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return false;

        const adjustment = this._scroller.get_vadjustment();
        const scrollValue = adjustment.get_value();

        // edit listbox
        this.commandsListBox.remove(draggedRow);
        const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
        this.commandsListBox.insert(draggedRow, adjustedIndex);

        // edit menu items
        const item = this.menus[this.menuIdx].menu[fromIndex];
        this.menus[this.menuIdx].menu.splice(fromIndex, 1);
        this.menus[this.menuIdx].menu.splice(adjustedIndex, 0, item);

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
