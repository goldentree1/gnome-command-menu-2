#!/bin/bash
glib-compile-schemas schemas
zip gnome-command-menu-2.zip icon.svg metadata.json extension.js prefs.js schemas/org.gnome.shell.extensions.commandmenu2.gschema.xml schemas/gschemas.compiled README.md LICENSE
gnome-extensions install gnome-command-menu-2.zip --force
