// Pocket-Canvas for Android
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
package com.pocketdesigns.pocketcanvas;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SyncFolderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
