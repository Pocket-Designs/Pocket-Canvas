// Pocket-Canvas — the sync folder, chosen with Android's own folder picker.
// Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
//
// The person picks a folder (for example the one Syncthing keeps up to date) and Android gives
// Pocket-Canvas access to that folder only, which it keeps after a restart. No "All files access".
//
// Paths are relative to the chosen folder, with "/" between parts, e.g. "devices/abc.json".
package com.pocketdesigns.pocketcanvas;

import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "SyncFolder")
public class SyncFolderPlugin extends Plugin {

    // one file operation at a time, off the main thread
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    // ---------- choosing the folder ----------

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "pickResult");
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != android.app.Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject r = new JSObject();
            r.put("canceled", true);
            call.resolve(r);
            return;
        }
        Uri tree = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(tree,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception e) {
            call.reject("Android didn't let Pocket-Canvas keep access to that folder: " + e.getMessage());
            return;
        }
        DocumentFile dir = DocumentFile.fromTreeUri(getContext(), tree);
        JSObject r = new JSObject();
        r.put("uri", tree.toString());
        r.put("name", dir != null && dir.getName() != null ? dir.getName() : "Sync folder");
        call.resolve(r);
    }

    // Is the folder still there, and may we still use it?
    @PluginMethod
    public void check(PluginCall call) {
        io.execute(() -> {
            JSObject r = new JSObject();
            try {
                DocumentFile root = root(call);
                r.put("ok", root != null && root.exists() && root.canWrite());
            } catch (Exception e) {
                r.put("ok", false);
            }
            call.resolve(r);
        });
    }

    // ---------- files inside the folder ----------

    @PluginMethod
    public void list(PluginCall call) {
        io.execute(() -> {
            try {
                DocumentFile dir = find(call, call.getString("path", ""), false);
                JSArray files = new JSArray();
                if (dir != null && dir.isDirectory()) {
                    for (DocumentFile f : dir.listFiles()) {
                        JSObject o = new JSObject();
                        o.put("name", f.getName());
                        o.put("size", f.length());
                        o.put("mtime", f.lastModified());
                        o.put("dir", f.isDirectory());
                        files.put(o);
                    }
                }
                JSObject r = new JSObject();
                r.put("files", files);
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stat(PluginCall call) {
        io.execute(() -> {
            try {
                DocumentFile f = find(call, call.getString("path", ""), false);
                JSObject r = new JSObject();
                r.put("exists", f != null && f.exists());
                if (f != null) {
                    r.put("size", f.length());
                    r.put("mtime", f.lastModified());
                    r.put("dir", f.isDirectory());
                }
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    // encoding "utf8" returns text; anything else returns base64
    @PluginMethod
    public void read(PluginCall call) {
        io.execute(() -> {
            try {
                DocumentFile f = find(call, call.getString("path", ""), false);
                if (f == null || !f.isFile()) { call.reject("File not found"); return; }
                byte[] bytes;
                try (InputStream in = resolver().openInputStream(f.getUri())) { bytes = readAll(in); }
                JSObject r = new JSObject();
                r.put("data", "utf8".equals(call.getString("encoding", "utf8"))
                    ? new String(bytes, StandardCharsets.UTF_8)
                    : Base64.encodeToString(bytes, Base64.NO_WRAP));
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void write(PluginCall call) {
        io.execute(() -> {
            try {
                String data = call.getString("data", "");
                byte[] bytes = "utf8".equals(call.getString("encoding", "utf8"))
                    ? data.getBytes(StandardCharsets.UTF_8)
                    : Base64.decode(data, Base64.DEFAULT);
                DocumentFile f = find(call, call.getString("path", ""), true);
                try (OutputStream out = resolver().openOutputStream(f.getUri(), "wt")) { out.write(bytes); }
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void mkdir(PluginCall call) {
        io.execute(() -> {
            try {
                DocumentFile root = root(call);
                DocumentFile dir = root;
                for (String part : parts(call.getString("path", ""))) {
                    DocumentFile next = dir.findFile(part);
                    if (next == null) next = dir.createDirectory(part);
                    if (next == null) throw new Exception("Couldn't make the folder " + part);
                    dir = next;
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void delete(PluginCall call) {
        io.execute(() -> {
            try {
                DocumentFile f = find(call, call.getString("path", ""), false);
                if (f != null) f.delete();
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    // Copy a file from the app's own storage into the sync folder (pictures, videos…), without
    // passing the contents through the web page.
    @PluginMethod
    public void copyIn(PluginCall call) {
        io.execute(() -> {
            try {
                File src = new File(Uri.parse(call.getString("from", "")).getPath());
                DocumentFile f = find(call, call.getString("path", ""), true);
                try (InputStream in = new FileInputStream(src); OutputStream out = resolver().openOutputStream(f.getUri(), "wt")) {
                    copy(in, out);
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    // Copy a file from the sync folder into the app's own storage.
    @PluginMethod
    public void copyOut(PluginCall call) {
        io.execute(() -> {
            try {
                DocumentFile f = find(call, call.getString("path", ""), false);
                if (f == null || !f.isFile()) { call.reject("File not found"); return; }
                File dest = new File(Uri.parse(call.getString("to", "")).getPath());
                File parent = dest.getParentFile();
                if (parent != null) parent.mkdirs();
                File tmp = new File(dest.getPath() + ".tmp");
                try (InputStream in = resolver().openInputStream(f.getUri()); OutputStream out = new FileOutputStream(tmp)) {
                    copy(in, out);
                }
                if (!tmp.renameTo(dest)) throw new Exception("Couldn't save " + dest.getName());
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    // ---------- helpers ----------

    private ContentResolver resolver() { return getContext().getContentResolver(); }

    private DocumentFile root(PluginCall call) throws Exception {
        String uri = call.getString("uri");
        if (uri == null) throw new Exception("No sync folder chosen");
        DocumentFile root = DocumentFile.fromTreeUri(getContext(), Uri.parse(uri));
        if (root == null || !root.exists()) throw new Exception("The sync folder can't be found");
        return root;
    }

    private static String[] parts(String path) {
        String p = path == null ? "" : path.replaceAll("^/+|/+$", "");
        return p.isEmpty() ? new String[0] : p.split("/+");
    }

    // Find a file or folder by path. With create=true, makes the folders on the way and the file itself.
    private DocumentFile find(PluginCall call, String path, boolean create) throws Exception {
        DocumentFile dir = root(call);
        String[] ps = parts(path);
        for (int i = 0; i < ps.length; i++) {
            String part = ps[i];
            if (part.equals("..") || part.equals(".")) throw new Exception("Bad path");
            DocumentFile next = dir.findFile(part);
            boolean last = i == ps.length - 1;
            if (next == null) {
                if (!create) return null;
                next = last ? dir.createFile("application/octet-stream", part) : dir.createDirectory(part);
                if (next == null) throw new Exception("Couldn't make " + part);
            }
            dir = next;
        }
        return dir;
    }

    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        copy(in, out);
        return out.toByteArray();
    }

    private static void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buf = new byte[64 * 1024];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
    }
}
