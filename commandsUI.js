/* commandsUI.js 
 *
 * This file is part of the Custom Command Menu GNOME Shell extension
 * https://github.com/StorageB/custom-command-menu
 * 
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Gio from 'gi://Gio';
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
        const { menu, ...args } = params;
        super._init(args);

        this.menu = menu;
        const style = new Gtk.CssProvider();
        const cssData = `button > label { font-weight: normal; }`;
        style.load_from_data(cssData, cssData.length);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            style,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        this.commandsListBox = new Gtk.ListBox();
        this.commandsListBox.add_css_class('boxed-list');

        const scroller = new Gtk.ScrolledWindow();
        scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        scroller.set_propagate_natural_height(true);
        scroller.set_child(this.commandsListBox);

        const clamp = new Adw.Clamp({ child: scroller });

        const overlay = new Adw.ToastOverlay();
        overlay.set_child(clamp);

        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        box.append(overlay);

        const group = new Adw.PreferencesGroup();
        group.add(box);
        this.add(group);

        const dropTarget = Gtk.DropTarget.new(Gtk.ListBoxRow, Gdk.DragAction.MOVE);
        dropTarget.connect('drop', (_target, value, _x, y) => this._onRowDropped(value, y));
        this.commandsListBox.add_controller(dropTarget);

        this._scroller = scroller;

        this.populateCommandsListBox();
    }

    populateCommandsListBox() {
        if (!Array.isArray(this.menu.menu)) return;

        for (let i = 0; i < this.menu.menu.length; i++) {
            const item = this.menu.menu[i];

            let row;
            if (item.type === 'separator') {
                row = new Adw.ExpanderRow({
                    title: _('Separator'),
                    selectable: false,
                    expanded: false,
                });
            } else if (item.command) {
                row = new Adw.ExpanderRow({
                    title: item.title || _('Untitled'),
                    selectable: false,
                    expanded: false,
                });

                const entryRowName = new Adw.EntryRow({ title: _('Name:'), text: item.title || '' });
                const entryRowCommand = new Adw.EntryRow({ title: _('Command:'), text: item.command || '' });
                const entryRowIcon = new Adw.EntryRow({ title: _('Icon:'), text: item.icon || '' });

                row.add_row(entryRowName);
                row.add_row(entryRowCommand);
                row.add_row(entryRowIcon);
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

        this.commandsListBox.remove(draggedRow);
        const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
        this.commandsListBox.insert(draggedRow, adjustedIndex);

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
