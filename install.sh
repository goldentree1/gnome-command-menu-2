#!/bin/bash
glib-compile-schemas schemas
zip gnome-command-menu-2.zip metadata.json extension.js prefs.js prefsCommandsUI.js prefsGeneralUI.js schemas/org.gnome.shell.extensions.commandmenu2.gschema.xml schemas/gschemas.compiled README.md LICENSE icons/* examples/* screenshots/*
gnome-extensions install gnome-command-menu-2.zip --force
