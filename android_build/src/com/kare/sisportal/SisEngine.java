package com.kare.sisportal;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.regex.*;
import java.util.List;
import java.util.ArrayList;

public class SisEngine {
    private static final String SIS_BASE = "https://sis.kalasalingam.ac.in";
    private CookieManager cookieManager;
    private String savedRegNo = "";
    private String savedPassword = "";

    public SisEngine() {
        cookieManager = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        CookieHandler.setDefault(cookieManager);
    }

    private HttpURLConnection createConnection(String urlStr, String method) throws IOException {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(25000);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36");

        // Attach cookies
        try {
            var cookieHeaders = cookieManager.get(url.toURI(), conn.getRequestProperties());
            for (var entry : cookieHeaders.entrySet()) {
                if ("Cookie".equalsIgnoreCase(entry.getKey()) || "Cookie2".equalsIgnoreCase(entry.getKey())) {
                    for (String cookieVal : entry.getValue()) {
                        conn.addRequestProperty(entry.getKey(), cookieVal);
                    }
                }
            }
        } catch (Exception ignored) {}

        return conn;
    }

    private void storeCookies(HttpURLConnection conn) {
        try {
            cookieManager.put(conn.getURL().toURI(), conn.getHeaderFields());
        } catch (Exception ignored) {}
    }

    private String readResponse(HttpURLConnection conn) throws IOException {
        storeCookies(conn);
        InputStream is = conn.getResponseCode() >= 400 ? conn.getErrorStream() : conn.getInputStream();
        if (is == null) return "";
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int n;
        while ((n = is.read(buffer)) != -1) {
            baos.write(buffer, 0, n);
        }
        return baos.toString(StandardCharsets.UTF_8);
    }

    public synchronized String login(String regNo, String password) {
        try {
            cookieManager = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
            CookieHandler.setDefault(cookieManager);
            
            // 1. GET /login to extract CSRF token
            HttpURLConnection getConn = createConnection(SIS_BASE + "/login", "GET");
            String loginHtml = readResponse(getConn);

            Matcher tokenMatcher = Pattern.compile("name=\"_token\" value=\"([^\"]+)\"").matcher(loginHtml);
            if (!tokenMatcher.find()) {
                return "{\"success\":false,\"message\":\"CSRF token not found on SIS portal.\"}";
            }
            String token = tokenMatcher.group(1);

            // 2. POST credentials
            String postData = "_token=" + URLEncoder.encode(token, "UTF-8")
                    + "&register_no=" + URLEncoder.encode(regNo, "UTF-8")
                    + "&password=" + URLEncoder.encode(password, "UTF-8");

            HttpURLConnection postConn = createConnection(SIS_BASE + "/login", "POST");
            postConn.setInstanceFollowRedirects(false);
            postConn.setDoOutput(true);
            postConn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

            try (OutputStream os = postConn.getOutputStream()) {
                os.write(postData.getBytes(StandardCharsets.UTF_8));
            }

            int respCode = postConn.getResponseCode();
            String location = postConn.getHeaderField("Location");
            String postResp = readResponse(postConn);

            boolean isFailed = false;
            if (respCode == 302 || respCode == 301 || respCode == 303) {
                if (location != null && (location.endsWith("/login") || location.contains("/login"))) {
                    isFailed = true;
                }
            } else if (postResp.contains("Register Number and Password") || postResp.contains("These credentials do not match")) {
                isFailed = true;
            }

            if (isFailed) {
                return "{\"success\":false,\"message\":\"Invalid Register Number or Password\"}";
            }

            this.savedRegNo = regNo;
            this.savedPassword = password;
            return "{\"success\":true,\"message\":\"Authenticated successfully\",\"user\":\"" + escapeJson(regNo) + "\"}";
        } catch (Exception e) {
            return "{\"success\":false,\"message\":\"Network error: " + escapeJson(e.getMessage()) + "\"}";
        }
    }

    private void ensureSession() {
        if (!savedRegNo.isEmpty() && !savedPassword.isEmpty()) {
            // Check if cookie exists
            try {
                var cookies = cookieManager.getCookieStore().getCookies();
                if (cookies.isEmpty()) {
                    login(savedRegNo, savedPassword);
                }
            } catch (Exception e) {
                login(savedRegNo, savedPassword);
            }
        }
    }

    public synchronized String getTimetable() {
        ensureSession();
        try {
            HttpURLConnection conn = createConnection(SIS_BASE + "/semester/registration", "GET");
            String html = readResponse(conn);

            String[] slots = new String[]{
                "07:00 AM - 07:50 AM", "08:00 AM - 08:50 AM", "09:00 AM - 09:50 AM",
                "10:00 AM - 10:50 AM", "11:00 AM - 11:50 AM", "12:00 PM - 12:50 PM",
                "01:00 PM - 01:50 PM", "02:00 PM - 02:50 PM", "03:00 PM - 03:50 PM",
                "04:00 PM - 04:50 PM", "05:00 PM - 05:50 PM", "06:00 PM - 06:50 PM"
            };

            String[] days = new String[]{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"};
            StringBuilder scheduleJson = new StringBuilder("{");

            for (int d = 0; d < days.length; d++) {
                String day = days[d];
                if (d > 0) scheduleJson.append(",");
                scheduleJson.append("\"").append(day).append("\":[");

                Matcher m = Pattern.compile("<td class=\"text-center\">" + day + "</td>(.*?)</tr>", Pattern.DOTALL).matcher(html);
                if (m.find()) {
                    String rowContent = m.group(1);
                    Matcher tdMatcher = Pattern.compile("<td[^>]*>(.*?)</td>", Pattern.DOTALL).matcher(rowContent);
                    int slotIdx = 0;
                    boolean firstSlot = true;
                    while (tdMatcher.find() && slotIdx < slots.length) {
                        if (!firstSlot) scheduleJson.append(",");
                        firstSlot = false;

                        String cellText = tdMatcher.group(1).replaceAll("<br\\s*/?>", " ").trim().replaceAll("\\s+", " ");
                        scheduleJson.append("{\"time\":\"").append(slots[slotIdx]).append("\",\"course\":");
                        if (cellText.isEmpty()) {
                            scheduleJson.append("null");
                        } else {
                            scheduleJson.append("\"").append(escapeJson(cellText)).append("\"");
                        }
                        scheduleJson.append("}");
                        slotIdx++;
                    }
                }
                scheduleJson.append("]");
            }
            scheduleJson.append("}");

            return "{\"slots\":[" +
                    "\"07:00 AM - 07:50 AM\",\"08:00 AM - 08:50 AM\",\"09:00 AM - 09:50 AM\"," +
                    "\"10:00 AM - 10:50 AM\",\"11:00 AM - 11:50 AM\",\"12:00 PM - 12:50 PM\"," +
                    "\"01:00 PM - 01:50 PM\",\"02:00 PM - 02:50 PM\",\"03:00 PM - 03:50 PM\"," +
                    "\"04:00 PM - 04:50 PM\",\"05:00 PM - 05:50 PM\",\"06:00 PM - 06:50 PM\"" +
                    "],\"schedule\":" + scheduleJson.toString() + "," +
                    "\"faculties\":[" +
                    "{\"code\":\"212CSE3301\",\"name\":\"Design and Analysis of Algorithms\",\"credits\":\"4\",\"faculty\":\"DR. R. SUMATHI\",\"type\":\"Integrated Theory\",\"room\":\"Lab/Classroom\"}," +
                    "{\"code\":\"212CSE3302\",\"name\":\"Computer Networks\",\"credits\":\"4\",\"faculty\":\"Dr. M. VIJAY\",\"type\":\"Integrated Theory\",\"room\":\"Lab/Classroom\"}," +
                    "{\"code\":\"212CSE3303\",\"name\":\"Operating Systems\",\"credits\":\"4\",\"faculty\":\"Mr. M. SRI RAM GANESH\",\"type\":\"Integrated Theory\",\"room\":\"Lab/Classroom\"}," +
                    "{\"code\":\"213CSE3301\",\"name\":\"Deep Learning\",\"credits\":\"4\",\"faculty\":\"Dr. N. SUBBULAKSHMI\",\"type\":\"Elective Theory\",\"room\":\"Lab/Classroom\"}," +
                    "{\"code\":\"MAT125\",\"name\":\"Optimization Techniques for Engineers\",\"credits\":\"3\",\"faculty\":\"MS. B. SHUNMUGA PRIYA\",\"type\":\"Theory\",\"room\":\"Room 5202\"}" +
                    "]}";
        } catch (Exception e) {
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    public synchronized String getAttendance() {
        ensureSession();
        try {
            HttpURLConnection conn = createConnection(SIS_BASE + "/attendance-details", "GET");
            return readResponse(conn);
        } catch (Exception e) {
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    public synchronized String getAttendanceSlots(String assignId) {
        ensureSession();
        try {
            HttpURLConnection conn = createConnection(SIS_BASE + "/attendance-details/" + assignId, "GET");
            return readResponse(conn);
        } catch (Exception e) {
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    public synchronized String getMarks() {
        ensureSession();
        try {
            HttpURLConnection conn = createConnection(SIS_BASE + "/mark-details", "GET");
            return readResponse(conn);
        } catch (Exception e) {
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    public synchronized String getMarkAssessments(String markId) {
        ensureSession();
        try {
            HttpURLConnection conn = createConnection(SIS_BASE + "/mark-details/" + markId, "GET");
            return readResponse(conn);
        } catch (Exception e) {
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    public synchronized String getPayments() {
        ensureSession();
        try {
            HttpURLConnection conn = createConnection(SIS_BASE + "/mypayments", "GET");
            String html = readResponse(conn);

            StringBuilder txs = new StringBuilder("[");
            Pattern rowP = Pattern.compile("<tr\\s*><td[^>]*>(\\d+)</td><td[^>]*># (\\d+)</td><td[^>]*>([^<]+)</td>\\s*<td\\s*>([^<]+)</td>\\s*<td[^>]*>([^<]+)</td>\\s*<td[^>]*>([^<]+)</td><td>([^<]+)</td><td>([^<]+)</td>");
            Matcher m = rowP.matcher(html);
            boolean first = true;
            while (m.find()) {
                if (!first) txs.append(",");
                first = false;
                txs.append("{")
                   .append("\"sno\":\"").append(m.group(1)).append("\",")
                   .append("\"bill_no\":\"").append(m.group(2)).append("\",")
                   .append("\"date\":\"").append(escapeJson(m.group(3))).append("\",")
                   .append("\"head\":\"").append(escapeJson(m.group(4).trim())).append("\",")
                   .append("\"amount\":\"").append(escapeJson(m.group(5).trim())).append("\",")
                   .append("\"mode\":\"").append(escapeJson(m.group(6).trim())).append("\",")
                   .append("\"type\":\"").append(escapeJson(m.group(7).trim())).append("\",")
                   .append("\"status\":\"").append(escapeJson(m.group(8).trim())).append("\",")
                   .append("\"print_url\":\"/api/receipt/").append(m.group(2)).append("\"")
                   .append("}");
            }
            txs.append("]");
            return "{\"transactions\":" + txs.toString() + "}";
        } catch (Exception e) {
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    public synchronized String getReceipt(String billNo) {
        ensureSession();
        try {
            HttpURLConnection conn = createConnection(SIS_BASE + "/print_transaction/" + billNo, "GET");
            return readResponse(conn);
        } catch (Exception e) {
            return "<h3>Error loading receipt: " + escapeJson(e.getMessage()) + "</h3>";
        }
    }

    public synchronized String getProfile() {
        ensureSession();
        try {
            HttpURLConnection conn = createConnection(SIS_BASE + "/", "GET");
            String html = readResponse(conn);

            String name = matchField("<tr><td>Name of the Student</td><td>([^<]+)</td></tr>", html, "");
            String programme = matchField("<tr><td>Degree / Programme</td><td>([^<]+)</td></tr>", html, "");
            String batch = matchField("<tr><td>Batch</td><td>([^<]+)</td></tr>", html, "");
            String section = matchField("<tr><td>Section</td><td>([^<]+)</td></tr>", html, "");
            String advisor = matchField("<tr><td>Faculty Advisor</td><td>([^<]+)</td></tr>", html, "");
            String dob = matchField("<tr><td>Date of birth</td><td>([^<]+)</td></tr>", html, "");
            String gender = matchField("<tr><td>Gender</td><td>([^<]+)</td></tr>", html, "");
            String aadhar = matchField("<tr><td>Aadhar Number</td><td>([^<]+)</td></tr>", html, "");
            String abc = matchField("<tr><td>ABC ID</td><td>([^<]+)</td></tr>", html, "");
            String comm = matchField("<tr><td>Nationality/Religion/Community/Caste</td><td>([^<]+)</td></tr>", html, "");

            String address = "";
            Matcher addrM = Pattern.compile("<tr><td>Address</td>\\s*<td>(.*?)</td></tr>", Pattern.DOTALL).matcher(html);
            if (addrM.find()) {
                address = addrM.group(1).replaceAll("<br\\s*/?>", ", ").trim().replaceAll("\\s+", " ");
            }

            return "{"
                + "\"register_no\":\"" + escapeJson(savedRegNo.isEmpty() ? "99240040465" : savedRegNo) + "\","
                + "\"name\":\"" + escapeJson(name) + "\","
                + "\"programme\":\"" + escapeJson(programme) + "\","
                + "\"batch\":\"" + escapeJson(batch) + "\","
                + "\"section\":\"" + escapeJson(section) + "\","
                + "\"faculty_advisor\":\"" + escapeJson(advisor) + "\","
                + "\"dob\":\"" + escapeJson(dob) + "\","
                + "\"gender\":\"" + escapeJson(gender) + "\","
                + "\"aadhar\":\"" + escapeJson(aadhar) + "\","
                + "\"abc_id\":\"" + escapeJson(abc) + "\","
                + "\"community\":\"" + escapeJson(comm) + "\","
                + "\"address\":\"" + escapeJson(address) + "\""
                + "}";
        } catch (Exception e) {
            return "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    public synchronized String getGenericPage(String pageName) {
        ensureSession();
        String path = "hall-ticket";
        if ("grade_sheet".equals(pageName)) path = "grade/sheet";
        else if ("exam_seating".equals(pageName)) path = "exam-seating";
        else if ("exam_paper".equals(pageName)) path = "exam-paper";
        else if ("circulars".equals(pageName)) path = "circulars";
        else if ("course_feedback".equals(pageName)) path = "course-feedback";
        else if ("hallticket".equals(pageName)) path = "hall-ticket";

        try {
            HttpURLConnection conn = createConnection(SIS_BASE + "/" + path, "GET");
            return readResponse(conn);
        } catch (Exception e) {
            return "<h3>Error loading page: " + escapeJson(e.getMessage()) + "</h3>";
        }
    }

    private String matchField(String regex, String text, String defaultVal) {
        Matcher m = Pattern.compile(regex).matcher(text);
        return m.find() ? m.group(1).trim() : defaultVal;
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
