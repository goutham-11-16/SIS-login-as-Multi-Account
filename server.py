import re
import http.cookiejar
import urllib.request
import urllib.parse
import json
from flask import Flask, jsonify, request, send_from_directory, session, Response

app = Flask(__name__, static_folder='static', static_url_path='')
app.secret_key = 'sis_portal_secret_key_kare'

SIS_BASE = 'https://sis.kalasalingam.ac.in'

def get_sis_session(register_no, password):
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
    
    try:
        resp = opener.open(f'{SIS_BASE}/login')
        html = resp.read().decode('utf-8')
        token_match = re.search(r'name="_token" value="([^"]+)"', html)
        if not token_match:
            return None, "CSRF token not found"
        token = token_match.group(1)
    except Exception as e:
        return None, f"Failed to connect to SIS: {str(e)}"
    
    post_data = urllib.parse.urlencode({
        '_token': token,
        'register_no': register_no,
        'password': password
    }).encode('utf-8')
    
    req = urllib.request.Request(f'{SIS_BASE}/login', data=post_data, headers={
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
    })
    
    try:
        res = opener.open(req)
        final_url = res.geturl()
        res_text = res.read().decode('utf-8', errors='ignore')
        
        if "Register Number and Password" in res_text or "login" in final_url.lower():
            return None, "Invalid Register Number or Password"
            
        return opener, None
    except Exception as e:
        return None, f"Login request failed: {str(e)}"

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    reg_no = data.get('register_no', '').strip()
    pwd = data.get('password', '').strip()
    
    if not reg_no or not pwd:
        return jsonify({'success': False, 'message': 'Please enter Register Number and Password.'}), 400
        
    opener, err = get_sis_session(reg_no, pwd)
    if err:
        return jsonify({'success': False, 'message': err}), 401
        
    session['reg_no'] = reg_no
    session['password'] = pwd
    return jsonify({'success': True, 'message': 'Authenticated successfully', 'user': reg_no})

def require_auth():
    reg_no = session.get('reg_no')
    pwd = session.get('password')
    if not reg_no or not pwd:
        return None, None, (jsonify({'error': 'Unauthorized. Please login.'}), 401)
    opener, err = get_sis_session(reg_no, pwd)
    if err:
        return None, None, (jsonify({'error': err}), 401)
    return opener, reg_no, None

@app.route('/api/timetable', methods=['GET'])
def api_timetable():
    opener, reg_no, err_resp = require_auth()
    if err_resp: return err_resp
    
    try:
        r = opener.open(f'{SIS_BASE}/semester/registration')
        html = r.read().decode('utf-8')
        
        slots = [
            "07:00 AM - 07:50 AM", "08:00 AM - 08:50 AM", "09:00 AM - 09:50 AM",
            "10:00 AM - 10:50 AM", "11:00 AM - 11:50 AM", "12:00 PM - 12:50 PM",
            "01:00 PM - 01:50 PM", "02:00 PM - 02:50 PM", "03:00 PM - 03:50 PM",
            "04:00 PM - 04:50 PM", "05:00 PM - 05:50 PM", "06:00 PM - 06:50 PM"
        ]
        
        schedule = {}
        day_rows = re.findall(r'<tr[^>]*>\s*<td><b>(Monday|Tuesday|Wednesday|Thursday|Friday)</b></td>(.*?)(?=</tr>)', html, re.DOTALL | re.IGNORECASE)
        
        for day, content in day_rows:
            day_name = day.capitalize()
            schedule[day_name] = {}
            for s in slots:
                schedule[day_name][s] = None
            
            cells = re.findall(r'<td[^>]*>(.*?)</td>', content, re.DOTALL)
            for idx, c in enumerate(cells):
                if idx < len(slots):
                    slot_name = slots[idx]
                    cleaned = re.sub(r'<[^>]+>', '', c).strip()
                    if cleaned and cleaned != '-' and cleaned != '&nbsp;':
                        parts = [p.strip() for p in cleaned.split() if p.strip()]
                        schedule[day_name][slot_name] = {
                            'code': parts[0] if len(parts) > 0 else cleaned,
                            'room': parts[1] if len(parts) > 1 else '',
                            'raw': cleaned
                        }
                    else:
                        schedule[day_name][slot_name] = None
                        
        faculty_allocations = []
        reg_table_match = re.search(r'Course Registration Details.*?(<table[^>]*>.*?</table>)', html, re.DOTALL | re.IGNORECASE)
        if reg_table_match:
            rows = re.findall(r'<tr[^>]*>(.*?)</tr>', reg_table_match.group(1), re.DOTALL)
            for row in rows:
                cols = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
                if len(cols) >= 5:
                    c_code = re.sub(r'<[^>]+>', '', cols[1]).strip()
                    c_desc = re.sub(r'<[^>]+>', '', cols[2]).strip()
                    c_credits = re.sub(r'<[^>]+>', '', cols[3]).strip()
                    c_staff = re.sub(r'<[^>]+>', '', cols[4]).strip()
                    if c_code and c_code.lower() != 'course code':
                        faculty_allocations.append({
                            'code': c_code,
                            'title': c_desc,
                            'credits': c_credits,
                            'staff': c_staff
                        })
        
        return jsonify({
            'slots': slots,
            'schedule': schedule,
            'faculty': faculty_allocations
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/attendance', methods=['GET'])
def api_attendance():
    opener, reg_no, err_resp = require_auth()
    if err_resp: return err_resp
    try:
        r = opener.open(f'{SIS_BASE}/attendance-details')
        return jsonify(json.loads(r.read().decode('utf-8')))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/attendance-slots/<assign_id>', methods=['GET'])
def api_attendance_slots(assign_id):
    opener, reg_no, err_resp = require_auth()
    if err_resp: return err_resp
    try:
        r = opener.open(f'{SIS_BASE}/attendance-details/{assign_id}')
        return jsonify(json.loads(r.read().decode('utf-8')))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/marks', methods=['GET'])
def api_marks():
    opener, reg_no, err_resp = require_auth()
    if err_resp: return err_resp
    try:
        r = opener.open(f'{SIS_BASE}/mark-details')
        return jsonify(json.loads(r.read().decode('utf-8')))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mark-assessments/<mark_id>', methods=['GET'])
def api_mark_assessments(mark_id):
    opener, reg_no, err_resp = require_auth()
    if err_resp: return err_resp
    try:
        r = opener.open(f'{SIS_BASE}/mark-details/{mark_id}')
        return jsonify(json.loads(r.read().decode('utf-8')))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/payments', methods=['GET'])
def api_payments():
    opener, reg_no, err_resp = require_auth()
    if err_resp: return err_resp
    try:
        r = opener.open(f'{SIS_BASE}/mypayments')
        html = r.read().decode('utf-8')
        transactions = []
        rows = re.findall(r'<tr\s*><td[^>]*>(\d+)</td><td[^>]*># (\d+)</td><td[^>]*>([^<]+)</td>\s*<td\s*>([^<]+)</td>\s*<td[^>]*>([^<]+)</td>\s*<td[^>]*>([^<]+)</td><td>([^<]+)</td><td>([^<]+)</td>', html)
        for row in rows:
            transactions.append({
                'sno': row[0],
                'bill_no': row[1],
                'receipt_no': row[2].strip(),
                'desc': row[3].strip(),
                'amount': row[4].strip(),
                'mode': row[5].strip(),
                'type': row[6].strip(),
                'status': row[7].strip(),
                'print_url': f'/api/receipt/{row[1]}'
            })
        return jsonify({'transactions': transactions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/receipt/<bill_no>', methods=['GET'])
def api_receipt(bill_no):
    opener, reg_no, err_resp = require_auth()
    if err_resp: return err_resp
    try:
        r = opener.open(f'{SIS_BASE}/print_transaction/{bill_no}')
        return Response(r.read(), mimetype='text/html')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/profile', methods=['GET'])
def api_profile():
    opener, reg_no, err_resp = require_auth()
    if err_resp: return err_resp
    try:
        r = opener.open(f'{SIS_BASE}/')
        html = r.read().decode('utf-8')
        
        name_match = re.search(r'<tr><td>Name of the Student</td><td>([^<]+)</td></tr>', html)
        programme_match = re.search(r'<tr><td>Degree / Programme</td><td>([^<]+)</td></tr>', html)
        batch_match = re.search(r'<tr><td>Batch</td><td>([^<]+)</td></tr>', html)
        sec_match = re.search(r'<tr><td>Section</td><td>([^<]+)</td></tr>', html)
        advisor_match = re.search(r'<tr><td>Faculty Advisor</td><td>([^<]+)</td></tr>', html)
        dob_match = re.search(r'<tr><td>Date of birth</td><td>([^<]+)</td></tr>', html)
        gender_match = re.search(r'<tr><td>Gender</td><td>([^<]+)</td></tr>', html)
        aadhar_match = re.search(r'<tr><td>Aadhar Number</td><td>([^<]+)</td></tr>', html)
        abc_match = re.search(r'<tr><td>ABC ID</td><td>([^<]+)</td></tr>', html)
        comm_match = re.search(r'<tr><td>Nationality/Religion/Community/Caste</td><td>([^<]+)</td></tr>', html)
        address_match = re.search(r'<tr><td>Address</td>\s*<td>(.*?)</td></tr>', html, re.DOTALL)
        
        clean_address = ""
        if address_match:
            clean_address = re.sub(r'<br\s*/?>', ', ', address_match.group(1)).strip()
            clean_address = re.sub(r'\s+', ' ', clean_address)

        return jsonify({
            'register_no': reg_no,
            'name': name_match.group(1) if name_match else '',
            'programme': programme_match.group(1) if programme_match else '',
            'batch': batch_match.group(1) if batch_match else '',
            'section': sec_match.group(1) if sec_match else '',
            'faculty_advisor': advisor_match.group(1) if advisor_match else '',
            'dob': dob_match.group(1) if dob_match else '',
            'gender': gender_match.group(1) if gender_match else '',
            'aadhar': aadhar_match.group(1) if aadhar_match else '',
            'abc_id': abc_match.group(1) if abc_match else '',
            'community': comm_match.group(1) if comm_match else '',
            'address': clean_address
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generic-page/<path:page_path>', methods=['GET'])
def api_generic_page(page_path):
    opener, reg_no, err_resp = require_auth()
    if err_resp: return err_resp
    try:
        r = opener.open(f'{SIS_BASE}/{page_path}')
        return Response(r.read(), mimetype='text/html')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
