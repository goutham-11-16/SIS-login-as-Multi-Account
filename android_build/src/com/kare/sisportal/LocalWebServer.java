package com.kare.sisportal;

import android.content.res.AssetManager;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LocalWebServer {
    private final int port;
    private final AssetManager assetManager;
    private final SisEngine sisEngine;
    private ServerSocket serverSocket;
    private boolean isRunning = false;
    private final ExecutorService threadPool = Executors.newFixedThreadPool(8);

    public LocalWebServer(int port, AssetManager assetManager, SisEngine sisEngine) {
        this.port = port;
        this.assetManager = assetManager;
        this.sisEngine = sisEngine;
    }

    public synchronized void start() throws IOException {
        if (isRunning) return;
        serverSocket = new ServerSocket(port, 50, InetAddress.getByName("127.0.0.1"));
        isRunning = true;

        new Thread(() -> {
            while (isRunning) {
                try {
                    Socket clientSocket = serverSocket.accept();
                    threadPool.execute(() -> handleClient(clientSocket));
                } catch (IOException e) {
                    if (!isRunning) break;
                }
            }
        }, "SIS-LocalServer").start();
    }

    public synchronized void stop() {
        isRunning = false;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (IOException ignored) {}
        threadPool.shutdownNow();
    }

    private void handleClient(Socket socket) {
        try (
            InputStream in = socket.getInputStream();
            OutputStream out = socket.getOutputStream()
        ) {
            BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String reqLine = reader.readLine();
            if (reqLine == null || reqLine.isEmpty()) return;

            String[] parts = reqLine.split(" ");
            if (parts.length < 2) return;

            String method = parts[0].toUpperCase();
            String fullPath = parts[1];
            String path = fullPath.contains("?") ? fullPath.substring(0, fullPath.indexOf("?")) : fullPath;

            int contentLength = 0;
            String line;
            while ((line = reader.readLine()) != null && !line.isEmpty()) {
                if (line.toLowerCase().startsWith("content-length:")) {
                    try {
                        contentLength = Integer.parseInt(line.substring(15).trim());
                    } catch (NumberFormatException ignored) {}
                }
            }

            StringBuilder body = new StringBuilder();
            if (contentLength > 0) {
                char[] buf = new char[contentLength];
                int read = 0;
                while (read < contentLength) {
                    int r = reader.read(buf, read, contentLength - read);
                    if (r == -1) break;
                    read += r;
                }
                body.append(buf, 0, read);
            }

            // Handle API routes
            if (path.startsWith("/api/")) {
                handleApi(path, method, body.toString(), out);
            } else {
                handleStatic(path, out);
            }
        } catch (Exception ignored) {
        } finally {
            try {
                socket.close();
            } catch (IOException ignored) {}
        }
    }

    private void handleApi(String path, String method, String body, OutputStream out) throws IOException {
        String responseBody = "";
        String contentType = "application/json; charset=utf-8";

        if ("/api/login".equals(path)) {
            String regNo = "";
            String pwd = "";
            try {
                // simple json extraction
                int regStart = body.indexOf("\"register_no\":");
                if (regStart != -1) {
                    int valStart = body.indexOf("\"", regStart + 14) + 1;
                    int valEnd = body.indexOf("\"", valStart);
                    if (valStart > 0 && valEnd > valStart) regNo = body.substring(valStart, valEnd);
                }
                int pwdStart = body.indexOf("\"password\":");
                if (pwdStart != -1) {
                    int valStart = body.indexOf("\"", pwdStart + 11) + 1;
                    int valEnd = body.indexOf("\"", valStart);
                    if (valStart > 0 && valEnd > valStart) pwd = body.substring(valStart, valEnd);
                }
            } catch (Exception ignored) {}

            responseBody = sisEngine.login(regNo, pwd);
        } else if ("/api/timetable".equals(path)) {
            responseBody = sisEngine.getTimetable();
        } else if ("/api/attendance".equals(path)) {
            responseBody = sisEngine.getAttendance();
        } else if (path.startsWith("/api/attendance-slots/")) {
            String slotId = path.substring("/api/attendance-slots/".length());
            responseBody = sisEngine.getAttendanceSlots(slotId);
        } else if ("/api/marks".equals(path)) {
            responseBody = sisEngine.getMarks();
        } else if (path.startsWith("/api/mark-assessments/")) {
            String markId = path.substring("/api/mark-assessments/".length());
            responseBody = sisEngine.getMarkAssessments(markId);
        } else if ("/api/payments".equals(path) || "/api/fees".equals(path)) {
            responseBody = sisEngine.getPayments();
        } else if (path.startsWith("/api/receipt/")) {
            String billNo = path.substring("/api/receipt/".length());
            responseBody = sisEngine.getReceipt(billNo);
            contentType = "text/html; charset=utf-8";
        } else if ("/api/profile".equals(path)) {
            responseBody = sisEngine.getProfile();
        } else if (path.startsWith("/api/generic-page/")) {
            String pageName = path.substring("/api/generic-page/".length());
            responseBody = sisEngine.getGenericPage(pageName);
            contentType = "text/html; charset=utf-8";
        } else {
            responseBody = "{\"error\":\"Not found\"}";
        }

        byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
        String header = "HTTP/1.1 200 OK\r\n" +
                "Content-Type: " + contentType + "\r\n" +
                "Content-Length: " + bytes.length + "\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Connection: close\r\n\r\n";

        out.write(header.getBytes(StandardCharsets.UTF_8));
        out.write(bytes);
        out.flush();
    }

    private void handleStatic(String path, OutputStream out) throws IOException {
        String cleanPath = path.equals("/") ? "/index.html" : path;
        if (cleanPath.startsWith("/")) cleanPath = cleanPath.substring(1);

        String assetPath = "www/" + cleanPath;
        String contentType = "text/html; charset=utf-8";

        if (cleanPath.endsWith(".html")) contentType = "text/html; charset=utf-8";
        else if (cleanPath.endsWith(".css")) contentType = "text/css; charset=utf-8";
        else if (cleanPath.endsWith(".js")) contentType = "application/javascript; charset=utf-8";
        else if (cleanPath.endsWith(".png")) contentType = "image/png";
        else if (cleanPath.endsWith(".jpg") || cleanPath.endsWith(".jpeg")) contentType = "image/jpeg";
        else if (cleanPath.endsWith(".ico")) contentType = "image/x-icon";
        else if (cleanPath.endsWith(".json")) contentType = "application/json";

        try (InputStream is = assetManager.open(assetPath)) {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) {
                baos.write(buf, 0, n);
            }
            byte[] data = baos.toByteArray();

            String header = "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: " + contentType + "\r\n" +
                    "Content-Length: " + data.length + "\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Connection: close\r\n\r\n";

            out.write(header.getBytes(StandardCharsets.UTF_8));
            out.write(data);
            out.flush();
        } catch (FileNotFoundException e) {
            String notFound = "<h1>404 File Not Found</h1>";
            byte[] nf = notFound.getBytes(StandardCharsets.UTF_8);
            String header = "HTTP/1.1 404 Not Found\r\nContent-Type: text/html\r\nContent-Length: " + nf.length + "\r\nConnection: close\r\n\r\n";
            out.write(header.getBytes(StandardCharsets.UTF_8));
            out.write(nf);
            out.flush();
        }
    }
}
