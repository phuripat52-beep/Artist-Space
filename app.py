import os
from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'artspace_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///artspace.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/uploads'

# สร้างโฟลเดอร์อัตโนมัติ
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'artworks'), exist_ok=True)
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'slips'), exist_ok=True)

db = SQLAlchemy(app)

# --- MODELS ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), default='member')

class Artwork(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(50))
    artist = db.Column(db.String(100))
    owner = db.Column(db.String(100))
    image_file = db.Column(db.String(200)) 
    is_sold = db.Column(db.Boolean, default=False)
    sales = db.Column(db.Integer, default=0)
    caption = db.Column(db.Text, default="")
    slip_file = db.Column(db.String(200), nullable=True) 

with app.app_context():
    db.create_all()
    if not User.query.filter_by(email='admin@artspace.com').first():
        db.session.add(User(name='Admin', email='admin@artspace.com', password='admin888', role='admin'))
        db.session.commit()

# --- ROUTES ---
@app.route('/')
def index():
    return render_template('index.html')

# --- API ---
@app.route('/api/artworks', methods=['GET'])
def get_artworks():
    # เรียงจากใหม่ไปเก่า (desc)
    items = Artwork.query.order_by(Artwork.id.desc()).all()
    data = []
    for item in items:
        data.append({
            'id': item.id,
            'title': item.title,
            'price': item.price,
            'category': item.category,
            'artist': item.artist,
            'owner': item.owner,
            'img': f"/static/uploads/artworks/{item.image_file}",
            'isSold': item.is_sold,
            'sales': item.sales,
            'caption': item.caption
        })
    return jsonify(data)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'success': False, 'message': 'อีเมลนี้ถูกใช้แล้ว'})
    new_user = User(name=data['name'], email=data['email'], password=data['password'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'success': True, 'user': {'name': new_user.name, 'email': new_user.email, 'role': new_user.role}})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email'], password=data['password']).first()
    if user:
        if user.email == 'admin@artspace.com': user.role = 'admin'; db.session.commit()
        return jsonify({'success': True, 'user': {'name': user.name, 'email': user.email, 'role': user.role}})
    return jsonify({'success': False})

# --- แก้ไข: ตั้งชื่อไฟล์ด้วยเวลา (Timestamp) ---
@app.route('/api/upload', methods=['POST'])
def upload():
    file = request.files['image']
    if file:
        # ดึงนามสกุลไฟล์เดิม
        ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'jpg'
        # ตั้งชื่อใหม่เป็นตัวเลขเวลา (เช่น 1705634.jpg)
        filename = f"{int(datetime.now().timestamp())}.{ext}"
        
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], 'artworks', filename))
        
        new_art = Artwork(
            title=request.form['title'], price=request.form['price'], category=request.form['category'],
            artist=request.form['artist'], owner=request.form['artist'], 
            image_file=filename # บันทึกชื่อใหม่ลงฐานข้อมูล
        )
        db.session.add(new_art)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False})

@app.route('/api/buy', methods=['POST'])
def buy():
    art = Artwork.query.get(request.form['id'])
    slip = request.files['slip']
    if art and slip:
        ext = slip.filename.rsplit('.', 1)[1].lower() if '.' in slip.filename else 'jpg'
        slip_name = f"SLIP_{art.id}_{int(datetime.now().timestamp())}.{ext}"
        
        slip.save(os.path.join(app.config['UPLOAD_FOLDER'], 'slips', slip_name))
        
        art.is_sold = True
        art.owner = request.form['buyer']
        art.sales += 1
        art.slip_file = slip_name
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False})

# ค้นหาฟังก์ชัน edit แล้วแทนที่ด้วยอันนี้ครับ
# ค้นหา @app.route('/api/edit'...) แล้วทับด้วยอันนี้
@app.route('/api/edit', methods=['POST'])
def edit():
    data = request.json
    try:
        art = Artwork.query.get(int(data['id']))
        if art:
            # --- เพิ่มจุดเช็คตรงนี้ ---
            if art.is_sold:
                return jsonify({'success': False, 'message': 'สินค้าขายแล้ว ไม่สามารถแก้ไขได้'})
            # -----------------------
            
            art.price = int(data['price'])
            art.caption = data['caption']
            db.session.commit()
            return jsonify({'success': True})
    except Exception as e:
        print(e)
    return jsonify({'success': False})

@app.route('/api/delete_art', methods=['POST'])
def delete_art():
    art = Artwork.query.get(request.json['id'])
    if art:
        try: os.remove(os.path.join(app.config['UPLOAD_FOLDER'], 'artworks', art.image_file))
        except: pass
        db.session.delete(art)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False})

@app.route('/api/delete_account', methods=['POST'])
def delete_account():
    user = User.query.filter_by(email=request.json['email']).first()
    if user:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False})

@app.route('/api/reset', methods=['POST'])
def reset():
    db.session.query(Artwork).delete()
    db.session.query(User).delete()
    db.session.add(User(name='Admin', email='admin@artspace.com', password='admin888', role='admin'))
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([{'name': u.name, 'email': u.email, 'role': u.role} for u in users])

@app.route('/api/delete_user', methods=['POST'])
def delete_user():
    user = User.query.filter_by(email=request.json['email']).first()
    if user:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False})

if __name__ == '__main__':
    app.run(debug=True)