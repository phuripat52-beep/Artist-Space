// ================= 1. INTRO ANIMATION =================
const canvas = document.getElementById('animCanvas');
const ctx = canvas.getContext('2d');
const introOverlay = document.getElementById('intro-overlay');
const mainSite = document.getElementById('main-site');
let animId;

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
const colors = ['#ff7675', '#74b9ff', '#55efc4', '#ffeaa7', '#a29bfe', '#fd79a8', '#fab1a0', '#81ecec'];
let balls = [], particles = [], phase = 'rolling', frameCount = 0;

for(let i=0; i < 8; i++) {
    const angle = (i * (Math.PI * 2) / 8);
    const dist = Math.max(window.innerWidth, window.innerHeight) * 0.8;
    balls.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, vx: (cx - (cx + Math.cos(angle) * dist)) / 120, vy: (cy - (cy + Math.sin(angle) * dist)) / 120, color: colors[i % colors.length] });
}

function createExplosion() {
    for (let i = 0; i < 250; i++) {
        const color = balls[Math.floor(Math.random() * balls.length)].color;
        particles.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, radius: Math.random() * 40 + 10, color: color, growthRate: Math.random() * 4 + 3 });
    }
}

function animate() {
    if (phase === 'finished') return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (phase === 'rolling') {
        frameCount++;
        balls.forEach(b => {
            b.x += b.vx; b.y += b.vy;
            ctx.beginPath(); ctx.arc(b.x, b.y, 85, 0, Math.PI * 2); ctx.fillStyle = b.color; ctx.fill();
        });
        if (frameCount >= 120) { phase = 'expanding'; try{document.querySelector('.skip-hint').style.opacity = '0';}catch(e){} createExplosion(); }
    }
    if (phase === 'expanding') {
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.radius += p.growthRate * 2; p.growthRate *= 1.03; 
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
        });
        if (particles[0].radius > Math.max(window.innerWidth, window.innerHeight)) { enterSite(); return; }
    }
    animId = requestAnimationFrame(animate);
}
// --- วางท่อนนี้ลงไปแทน ---
// เช็คว่าเคยดู Intro หรือยัง? (ถ้ามีค่าใน sessionStorage แปลว่าเคยดูแล้ว)
if (sessionStorage.getItem('introShown')) {
    // ⏩ เคยดูแล้ว: สั่งปิด Intro ทันที
    introOverlay.style.display = 'none';
    mainSite.style.visibility = 'visible';
    mainSite.style.opacity = '1';
    document.body.style.overflowY = 'auto';
    // สั่งให้พวก element ต่างๆ ลอยขึ้นมาเลย
    document.querySelectorAll('.reveal-element').forEach(el => el.classList.add('reveal-active'));
} else {
    // ▶️ ยังไม่เคยดู: ให้เล่น Animation ตามปกติ
    animate();
    setTimeout(() => { if (!isEntered) enterSite(); }, 4000); 
}

let isEntered = false;
function enterSite() {
    if (isEntered) return;
    isEntered = true; 
    phase = 'finished'; 
    if(animId) cancelAnimationFrame(animId);
    sessionStorage.setItem('introShown', 'true');
    introOverlay.style.transform = "translateY(-100%)"; // FIX: Force CSS
    mainSite.style.visibility = 'visible'; 
    mainSite.style.opacity = '1';
    document.body.style.overflowY = 'auto'; 
    
    document.querySelectorAll('.reveal-element').forEach((el, index) => { setTimeout(() => { el.classList.add('reveal-active'); }, 300 + (index * 150)); });
    setTimeout(() => { introOverlay.style.display = 'none'; }, 1500);
}
document.addEventListener('keydown', (e) => { if (e.code === 'Space') enterSite(); });
document.getElementById('intro-overlay').addEventListener('click', enterSite); // FIX: Click to enter

// ================= SYSTEM LOGIC =================
let currentUser = null; 
let artworks = [];

async function initSystem() {
    try {
        const res = await fetch('/api/artworks');
        if(!res.ok) throw new Error("API Error");
        artworks = await res.json();
        
        const session = sessionStorage.getItem('as_user');
        if(session) {
            currentUser = JSON.parse(session);
            updateUI();
        }
        renderTopArtists();
        renderGallery(artworks);
    } catch(e) { console.error(e); renderGallery([]); }
}

// Auth
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;
    const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password: pass }) });
    const data = await res.json();
    if(data.success) loginSuccess(data.user); else alert(data.message);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass }) });
    const data = await res.json();
    if(data.success) loginSuccess(data.user); else alert(data.message);
}

function loginSuccess(user) {
    currentUser = user; sessionStorage.setItem('as_user', JSON.stringify(currentUser)); updateUI(); closeModal('auth-modal');
}

function updateUI() {
    document.getElementById('guest-nav').classList.add('hidden');
    document.getElementById('user-nav').classList.remove('hidden');
    document.getElementById('user-nav').style.display = 'flex';
    document.getElementById('display-name').innerText = currentUser.name;
    document.getElementById('display-role').innerText = currentUser.role === 'admin' ? 'Administrator' : 'Member';
    if(currentUser.role === 'admin') { document.getElementById('admin-reset-btn').classList.remove('hidden'); document.getElementById('admin-panel').classList.remove('hidden'); loadAdminUsers(); }
}

function logout() { if(confirm('ออกจากระบบ?')) { currentUser = null; sessionStorage.removeItem('as_user'); location.reload(); } }

// Upload & Buy
// ค้นหาฟังก์ชัน handleUpload แล้วเอาโค้ดนี้ไปทับเลยครับ
async function handleUpload(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', document.getElementById('upTitle').value);
    formData.append('price', document.getElementById('upPrice').value);
    formData.append('category', document.getElementById('upCategory').value);
    formData.append('artist', currentUser.name);
    formData.append('image', document.getElementById('upImage').files[0]);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    
    if(data.success) {
        alert('ลงผลงานสำเร็จ!');
        
        // ❌ ของเก่า: location.reload(); (ลบบรรทัดนี้ทิ้ง หรือใส่ // ข้างหน้า)
        
        // ✅ ของใหม่: ล้างฟอร์มและโหลดรูปใหม่โดยไม่ต้องรีเฟรชหน้า
        document.getElementById('upload-form').reset(); // ล้างช่องกรอกข้อมูล
        
        // เรียก initSystem() เพื่อดึงรูปใหม่มาแสดงทันที
        initSystem(); 
    }
}

let selectedItemForPay = null;
function openPreview(id) {
    const item = artworks.find(a => a.id === id); if(!item) return; selectedItemForPay = item;
    document.getElementById('modal-img').src = item.img;
    document.getElementById('modal-title').textContent = item.title;
    document.getElementById('modal-artist').textContent = item.artist;
    document.getElementById('modal-price').textContent = `฿${item.price.toLocaleString()}`;
    document.getElementById('modal-desc').innerText = item.caption || "ผลงานชิ้นเอก...";
    
    const btn = document.getElementById('modal-buy-btn');
    const dlBtn = document.getElementById('modal-download-btn');
    const isOwned = currentUser && (item.owner === currentUser.name || item.artist === currentUser.name);

    if(item.isSold) {
        if(isOwned) { btn.innerHTML = '<i class="fas fa-check"></i> คุณเป็นเจ้าของแล้ว'; btn.disabled = true; btn.style.background = '#2ed573'; dlBtn.href = item.img; dlBtn.download = `Art_${item.title}.jpg`; dlBtn.classList.remove('hidden'); }
        else { btn.innerHTML = 'สินค้าขายแล้ว'; btn.disabled = true; btn.style.background = '#333'; dlBtn.classList.add('hidden'); }
    } else {
        if(currentUser && item.artist === currentUser.name) { btn.innerHTML = 'ผลงานของคุณ'; btn.disabled = true; btn.style.background = '#b2bec3'; dlBtn.href = item.img; dlBtn.classList.remove('hidden'); }
        else { btn.innerHTML = 'ซื้อผลงานนี้'; btn.disabled = false; btn.style.background = 'linear-gradient(90deg, #6c5ce7, #a55eea)'; dlBtn.classList.add('hidden'); }
    }
    document.getElementById('preview-modal').classList.add('open');
}

function openPayment() { if(!currentUser) { alert('กรุณาเข้าสู่ระบบ'); return; } closeModal('preview-modal'); document.getElementById('pay-item-name').textContent = selectedItemForPay.title; document.getElementById('pay-amount').value = `฿${selectedItemForPay.price.toLocaleString()}`; document.getElementById('payment-modal').classList.add('open'); }

async function confirmPayment(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('id', selectedItemForPay.id);
    formData.append('buyer', currentUser.name);
    formData.append('slip', document.getElementById('pay-slip').files[0]);
    const res = await fetch('/api/buy', { method: 'POST', body: formData });
    const data = await res.json();
    if(data.success) { closeModal('payment-modal'); document.getElementById('success-modal').classList.add('open'); initSystem(); }
}

// Edit & Delete
async function deleteArt(id, event) { event.stopPropagation(); if(confirm('ลบผลงานนี้?')) { await fetch('/api/delete_art', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); location.reload(); } }
function openEditModal(id, event) { event.stopPropagation(); const item = artworks.find(a => a.id === id); document.getElementById('edit-id').value = item.id; document.getElementById('edit-price').value = item.price; document.getElementById('edit-caption').value = item.caption; document.getElementById('edit-modal').classList.add('open'); }
async function confirmEdit(e) {
    e.preventDefault();
    await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: document.getElementById('edit-id').value,
            price: document.getElementById('edit-price').value,
            caption: document.getElementById('edit-caption').value
        })
    });
    location.reload();
}
async function deleteAccount() { if(confirm('ยืนยันลบบัญชี?')) { await fetch('/api/delete_account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: currentUser.email }) }); logout_no_confirm(); } }
async function systemReset() { if(confirm('รีเซ็ตระบบทั้งหมด?')) { await fetch('/api/reset', { method: 'POST' }); logout_no_confirm(); } }
function logout_no_confirm() { sessionStorage.removeItem('as_user'); location.reload(); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openAuthModal(mode='login') { document.getElementById('auth-modal').classList.add('open'); document.getElementById('login-section').classList.toggle('hidden', mode === 'register'); document.getElementById('register-section').classList.toggle('hidden', mode !== 'register'); }
function toggleAuth(mode) { openAuthModal(mode); }

// Render Logic
// ค้นหาฟังก์ชัน renderGallery แล้วทับด้วยอันนี้
// ก๊อปไปทับฟังก์ชัน renderGallery เดิมได้เลย
function renderGallery(items) {
    const grid = document.getElementById('gallery');
    
    if(items.length === 0) { 
        grid.innerHTML = '<div style="color:#666; text-align:center; grid-column:1/-1; padding:50px;">ไม่มีข้อมูล (ลองอัปโหลดดูสิ!)</div>'; 
        return; 
    }

    grid.innerHTML = items.map(item => {
        // เช็คสิทธิ์
        const isOwned = currentUser && item.owner === currentUser.name;
        const isArtist = currentUser && item.artist === currentUser.name;
        const isAdmin = currentUser && currentUser.role === 'admin';
        
        // --- LOGIC ปุ่มกด (แก้ไขใหม่) ---
        let btns = '';
        
        // ถ้าเป็นคนวาด หรือ Admin ถึงจะมีสิทธิ์เห็นปุ่ม
        if (isArtist || isAdmin) {
            if (item.isSold) {
                // กรณีขายแล้ว: ห้ามแก้ไข! (โชว์แค่ปุ่มลบ เฉพาะ Admin หรือเจ้าของที่อยากลบประวัติ)
                // แต่ปกติสินค้าขายแล้วไม่ควรลบ เพื่อเก็บประวัติ (แต่ใส่ไว้เผื่อ Admin)
                if (isAdmin) {
                    btns = `<div class="action-btn-group">
                                <button class="action-btn btn-delete" onclick="deleteArt(${item.id}, event)" title="ลบผลงาน"><i class="fas fa-trash"></i></button>
                            </div>`;
                }
            } else {
                // กรณีขายไม่ออก: แก้ไขได้ ลบได้ ปกติ
                btns = `<div class="action-btn-group">
                            <button class="action-btn btn-edit" onclick="openEditModal(${item.id}, event)" title="แก้ไข"><i class="fas fa-pencil-alt"></i></button>
                            <button class="action-btn btn-delete" onclick="deleteArt(${item.id}, event)" title="ลบผลงาน"><i class="fas fa-trash"></i></button>
                        </div>`;
            }
        }
        // --------------------------------

        // Logic การแสดงป้าย
        let soldOverlay = '';
        let soldClass = '';

        if (item.isSold) {
            if (isOwned) {
                soldClass = ''; 
                soldOverlay = `<div class="category-badge" style="background:#2ed573; top:40px; border:1px solid #2ed573;">OWNED</div>`;
            } else {
                soldClass = 'sold';
                soldOverlay = `<div class="sold-overlay-badge">SOLD</div>`;
            }
        }

        return `<div class="art-card ${soldClass}">
            <div class="card-img-container" onclick="openPreview(${item.id})">
                <span class="category-badge">${item.category}</span> 
                ${soldOverlay} 
                ${btns}
                <div class="card-overlay"><span class="view-btn">ดูรายละเอียด</span></div>
                <img src="${item.img}?t=${Date.now()}" class="card-img" alt="Artwork" onerror="this.src='https://placehold.co/600x400?text=Error'">
            </div>
            <div class="card-body">
                <h4 class="card-title">${item.title}</h4>
                <div style="font-size:13px; color:#a0a0b0;">${item.artist}</div>
                <div class="card-price">฿${item.price.toLocaleString()}</div>
            </div>
        </div>`;
    }).join('');
}

// ฟังก์ชันจัดอันดับศิลปิน (ฉบับปรับปรุง: รวมยอดขายตามชื่อ)
function renderTopArtists() {
    // 1. สร้าง Dictionary เก็บข้อมูลศิลปิน
    // รูปแบบ: { "ชื่อศิลปิน": { sales: 10, img: "url..." } }
    const artistStats = {};

    artworks.forEach(art => {
        // นับเฉพาะชิ้นที่ขายแล้ว
        if (art.isSold) {
            if (!artistStats[art.artist]) {
                // ถ้ายังไม่มีชื่อนี้ ให้เริ่มนับใหม่
                artistStats[art.artist] = {
                    name: art.artist,
                    sales: 0,
                    img: art.img // รูปโปรไฟล์ ใช้รูปจากงานล่าสุดของเขา
                };
            }
            // บวกยอดขายเพิ่ม
            artistStats[art.artist].sales += 1;
        }
    });

    // 2. แปลงเป็น Array แล้วเรียงลำดับตามยอดขาย (มาก -> น้อย)
    const sortedArtists = Object.values(artistStats)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 3); // เอาแค่ 3 อันดับแรก

    // 3. แสดงผลหน้าเว็บ
    const grid = document.getElementById('top-artists-grid');
    
    if (sortedArtists.length === 0) {
        grid.innerHTML = '<div style="color:#666; width:100%; text-align:center;">ยังไม่มีการซื้อขาย</div>';
        return;
    }

    grid.innerHTML = sortedArtists.map((artist, index) => `
        <div class="artist-rank-card">
            <div class="rank-badge">${index + 1}</div>
            <img src="${artist.img}?t=${Date.now()}" class="artist-img" alt="${artist.name}" onerror="this.src='https://placehold.co/100?text=User'">
            <div class="artist-name">${artist.name}</div>
            <div class="artist-sales">ขายแล้ว ${artist.sales} ชิ้น</div>
        </div>
    `).join('');
}

async function loadAdminUsers() { const res = await fetch('/api/users'); const users = await res.json(); document.getElementById('user-list-container').innerHTML = users.map(u => `<div class="admin-user-row"><span>👤 ${u.name} (${u.email}) - ${u.role}</span> ${u.role !== 'admin' ? `<button onclick="adminDeleteUser('${u.email}')" style="color:red; border:none; background:none;">ลบ</button>` : ''}</div>`).join(''); }
async function adminDeleteUser(email) { if(confirm('ลบผู้ใช้นี้?')) { await fetch('/api/delete_user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); loadAdminUsers(); } }

function openMyStudio() { if(!currentUser) return; document.getElementById('top-artists-section').classList.add('hidden'); document.getElementById('studio-panel').classList.remove('hidden'); switchStudioTab('upload'); }
function switchStudioTab(tab) { document.querySelectorAll('.studio-tab').forEach(t => t.classList.remove('active')); if(tab === 'upload') { document.getElementById('tab-upload').classList.add('active'); document.getElementById('upload-form').classList.remove('hidden'); document.getElementById('collection-msg').classList.add('hidden'); renderGallery(artworks.filter(a => a.artist === currentUser.name)); } else { document.getElementById('tab-collection').classList.add('active'); document.getElementById('upload-form').classList.add('hidden'); document.getElementById('collection-msg').classList.remove('hidden'); renderGallery(artworks.filter(a => a.owner === currentUser.name && a.isSold)); } }
function filterGallery(cat, btn) { document.getElementById('studio-panel').classList.add('hidden'); document.getElementById('top-artists-section').classList.remove('hidden'); document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); if(btn) btn.classList.add('active'); if(cat === 'all') renderGallery(artworks); else if(cat === 'sold') renderGallery(artworks.filter(a => a.isSold)); else renderGallery(artworks.filter(a => a.category === cat)); }
function searchGallery() { const term = document.getElementById('searchInput').value.toLowerCase(); renderGallery(artworks.filter(a => a.title.toLowerCase().includes(term) || a.artist.toLowerCase().includes(term))); }
function resetView() { location.reload(); }

initSystem();