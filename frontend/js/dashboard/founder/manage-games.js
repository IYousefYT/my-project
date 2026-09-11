const API_URL = "http://127.0.0.1:8000";
const token = localStorage.getItem("token");
let allLoadedGames = [];
let editingGameId = null;

if (!token) {
    window.location.href = "../../index.html";
}

document.addEventListener("DOMContentLoaded", () => {
    loadUserData();
    fetchGames();
    setupMobileSidebar();
});

async function loadUserData() {
    try {
        const res = await fetch(`${API_URL}/users/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Unauthorized");
        const user = await res.json();
        
        if (user.role !== "founder") {
            showToast("ليس لديك صلاحية للوصول لهذه الصفحة", "error");
            window.location.href = "dashboard.html";
            return;
        }

        renderSidebarMenu(user.role);
    } catch (err) {
        logout();
    }
}

async function fetchGames() {
    try {
        const response = await fetch(`${API_URL}/admin/games`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.ok) {
            allLoadedGames = await response.json();
            renderGamesTable(allLoadedGames);
        } else {
            document.getElementById("games-table-body").innerHTML = `
                <tr><td colspan="6" style="text-align: center; color: #ff5555; padding: 20px;">فشل في جلب الألعاب والمنتجات.</td></tr>
            `;
        }
    } catch (err) {
        console.error(err);
        document.getElementById("games-table-body").innerHTML = `
            <tr><td colspan="6" style="text-align: center; color: #ff5555; padding: 20px;">حدث خطأ أثناء الاتصال بالسيرفر.</td></tr>
        `;
    }
}

function renderGamesTable(games) {
    const tbody = document.getElementById("games-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!games || games.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">لا توجد منتجات أو ألعاب مسجلة حالياً.</td></tr>`;
        return;
    }

    games.forEach(game => {
        const gameId = game.id;
        const title = game.title || "بدون اسم";
        const category = game.category || "games";
        const iconUrl = game.icon_url || game.image_url;
        const isActive = game.is_active !== false; // افتراضياً متاح لو لم يتم تحديدها
        
        const categoryText = category === "cards" ? "بطاقة رقمية" : "لعبة";
        
        const imageThumbnail = iconUrl 
            ? `<img src="${iconUrl}" style="width: 35px; height: 35px; object-fit: cover; border-radius: 4px; vertical-align: middle;">` 
            : `<div style="width: 35px; height: 35px; background: #30363d; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; color: #8b949e;">بدون</div>`;

        tbody.innerHTML += `
            <tr class="game-row">
                <td>#${gameId}</td>
                <td>${imageThumbnail}</td>
                <td style="font-weight: 600;">${title}</td>
                <td>${categoryText}</td>
                <td>
                    <label style="position: relative; display: inline-block; width: 40px; height: 22px; cursor: pointer;">
                        <input type="checkbox" ${isActive ? 'checked' : ''} onchange="toggleGameStatus(${gameId}, this.checked)" style="opacity: 0; width: 0; height: 0;">
                        <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isActive ? '#238636' : '#30363d'}; transition: .3s; border-radius: 22px;"></span>
                        <span style="position: absolute; content: ''; height: 16px; width: 16px; left: ${isActive ? '20px' : '4px'}; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                    </label>
                    <span style="margin-right: 8px; font-size: 12px; color: ${isActive ? '#3fb950' : '#8b949e'};">${isActive ? 'مفعل' : 'معطل'}</span>
                </td>
                <td>
                    <button style="background-color: #3b82f6; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-family: 'Cairo', sans-serif; margin-left: 5px;" onclick="openEditGameModal(${gameId})">تعديل</button>
                    <button style="background-color: #ef4444; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-family: 'Cairo', sans-serif;" onclick="deleteGame(${gameId})">حذف</button>
                </td>
            </tr>
        `;
    });
}

// دالة تحديث حالة اللعبة فوراً عند تغيير زر الـ Toggle في الجدول وإعادة رسمه
async function toggleGameStatus(gameId, newStatus) {
    try {
        const response = await fetch(`${API_URL}/admin/games/${gameId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ is_active: newStatus })
        });

        if (response.ok) {
            showToast(newStatus ? "تم تفعيل المنتج بنجاح" : "تم تعطيل المنتج بنجاح", "success");
            const game = allLoadedGames.find(g => g.id === gameId);
            if (game) {
                game.is_active = newStatus;
            }
            renderGamesTable(allLoadedGames); // تحديث واجهة الجدول فوراً
        } else {
            showToast("فشل تحديث حالة المنتج", "error");
            fetchGames();
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
        fetchGames();
    }
}

function filterGames() {
    const query = document.getElementById("search-game-input").value.trim().toLowerCase();
    const selectedCategory = document.getElementById("category-filter").value;

    const filtered = allLoadedGames.filter(game => {
        const titleMatch = (game.title || "").toLowerCase().includes(query);
        const categoryMatch = selectedCategory === "all" || game.category === selectedCategory;
        return titleMatch && categoryMatch;
    });

    renderGamesTable(filtered);
}

function openAddGameModal() {
    editingGameId = null;
    document.getElementById("modal-title").textContent = "إضافة لعبة أو منتج جديد";
    document.getElementById("new-game-name").value = "";
    document.getElementById("new-game-description").value = "";
    document.getElementById("new-game-category").value = "games";
    document.getElementById("new-game-icon").value = "";
    document.getElementById("new-game-image-file").value = "";
    document.getElementById("image-preview-container").style.display = "none";

    document.getElementById("addGameModal").style.display = "flex";
}

function openEditGameModal(gameId) {
    const game = allLoadedGames.find(g => g.id === gameId);
    if (!game) return;

    editingGameId = gameId;
    document.getElementById("modal-title").textContent = "تعديل اللعبة أو المنتج";
    document.getElementById("new-game-name").value = game.title || "";
    document.getElementById("new-game-description").value = game.description || "";
    document.getElementById("new-game-category").value = game.category || "games";
    
    const iconUrl = game.icon_url || game.image_url || "";
    document.getElementById("new-game-icon").value = iconUrl;
    
    if (iconUrl) {
        document.getElementById("img-preview").src = iconUrl;
        document.getElementById("image-preview-container").style.display = "block";
    } else {
        document.getElementById("image-preview-container").style.display = "none";
    }

    document.getElementById("new-game-image-file").value = "";
    document.getElementById("addGameModal").style.display = "flex";
}

function closeAddGameModal() {
    document.getElementById("addGameModal").style.display = "none";
}

async function submitNewGame() {
    const title = document.getElementById("new-game-name").value.trim();
    const description = document.getElementById("new-game-description").value.trim();
    const category = document.getElementById("new-game-category").value;
    const imageFileInput = document.getElementById("new-game-image-file");
    let iconUrl = document.getElementById("new-game-icon").value.trim();

    if (!title) {
        showToast("يرجى إدخال اسم اللعبة أو المنتج", "error");
        return;
    }

    try {
        if (imageFileInput.files && imageFileInput.files[0]) {
            const formData = new FormData();
            formData.append("file", imageFileInput.files[0]);

            const uploadRes = await fetch(`${API_URL}/admin/upload-image`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });

            if (uploadRes.ok) {
                const uploadData = await uploadRes.json();
                iconUrl = uploadData.image_url;
            } else {
                showToast("فشل رفع الصورة", "error");
                return;
            }
        }

        const payload = {
            title: title,
            description: description,
            category: category,
            icon_url: iconUrl || null,
            image_url: iconUrl || null
        };

        const url = editingGameId ? `${API_URL}/admin/games/${editingGameId}` : `${API_URL}/admin/games`;
        const method = editingGameId ? "PATCH" : "POST";

        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast(editingGameId ? "تم تعديل المنتج بنجاح" : "تم إضافة المنتج بنجاح", "success");
            closeAddGameModal();
            await fetchGames();
        } else {
            const err = await response.json();
            showToast(err.detail || "فشل حفظ المنتج", "error");
        }
    } catch (error) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
}

async function deleteGame(gameId) {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج/اللعبة؟")) return;

    try {
        const response = await fetch(`${API_URL}/admin/games/${gameId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            showToast("تم حذف المنتج بنجاح", "success");
            await fetchGames();
        } else {
            showToast("فشل حذف المنتج", "error");
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
}

function previewAndValidateImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
        showToast("حجم الصورة يجب ألا يتجاوز 500 كيلوبايت", "error");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById("img-preview").src = e.target.result;
        document.getElementById("image-preview-container").style.display = "block";
    };
    reader.readAsDataURL(file);
}

function clearSelectedImage() {
    document.getElementById("new-game-image-file").value = "";
    document.getElementById("new-game-icon").value = "";
    document.getElementById("image-preview-container").style.display = "none";
}

function openImageZoom(src) {
    document.getElementById("zoomed-img").src = src;
    document.getElementById("imageZoomModal").style.display = "flex";
}

function closeImageZoom() {
    document.getElementById("imageZoomModal").style.display = "none";
}

function renderSidebarMenu(userRole) {
    const menuContainer = document.getElementById("sidebar-menu-items");
    if (!menuContainer) return;

    const linkStyle = "display: block; padding: 8px 12px; color: #cbd5e1; text-decoration: none; border-radius: 6px; font-size: 13px; transition: 0.2s;";
    const activeStyle = "display: block; padding: 8px 12px; color: #fff; background: var(--primary-color, #7c3aed); text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;";

    let menuHTML = `<li><a href="dashboard.html" style="${linkStyle}">الرئيسية / الملف الشخصي</a></li>`;

    function createDropdownCategory(title, itemsHtml) {
        return `
            <li>
                <button class="sidebar-category-btn" onclick="toggleSubmenu(this)">
                    <span>${title}</span>
                    <span class="arrow">▼</span>
                </button>
                <div class="sidebar-submenu">
                    ${itemsHtml}
                </div>
            </li>
        `;
    }

    if (["client", "provider", "admin", "founder"].includes(userRole)) {
        const items = `
            <a href="profile.html" style="${linkStyle}">البروفايل</a>
            <a href="tickets.html" style="${linkStyle}">التذاكر</a>
            <a href="wallet.html" style="${linkStyle}">المحفظة</a>
            <a href="transactions.html" style="${linkStyle}">سجل الرصيد والحجز</a>
            <a href="notifications.html" style="${linkStyle}">الإشعارات</a>
            <a href="chat.html" style="${linkStyle}">المحادثات</a>
        `;
        menuHTML += createDropdownCategory("حسابي والخدمات", items);
    }

    if (["provider", "admin", "founder"].includes(userRole)) {
        const items = `
            <a href="team-orders.html" style="${linkStyle}">الطلبات المتاحة</a>
            <a href="my-tasks.html" style="${linkStyle}">الطلبات قيد التنفيذ</a>
            <a href="completed-tasks.html" style="${linkStyle}">الطلبات التي تم إنجازها</a>
        `;
        menuHTML += createDropdownCategory("فريق العمل", items);
    }

    if (["admin", "founder"].includes(userRole)) {
        const items = `
            <a href="admin-orders.html" style="${linkStyle}">إدارة وموافقة الطلبات</a>
            <a href="applications.html" style="${linkStyle}">قبول/رفض التقديمات</a>
            <a href="support-chat.html" style="${linkStyle}">الدعم الفني والردود</a>
        `;
        menuHTML += createDropdownCategory("الإدارة والدعم", items);
    }

    if (userRole === "founder") {
        const items = `
            <a href="founder-accounts.html" style="${linkStyle}">إدارة جميع الحسابات</a>
            <a href="founder-orders.html" style="${linkStyle}">إدارة الطلبات</a>
            <a href="founder-games.html" style="${window.location.pathname.includes('founder-games.html') ? activeStyle : linkStyle}">إدارة وإضافة الألعاب</a>
            <a href="founder-services.html" style="${linkStyle}">إدارة الخدمات</a>
        `;
        menuHTML += createDropdownCategory("إدارة النظام (Founder)", items);
    }

    menuContainer.innerHTML = menuHTML;

    const submenus = menuContainer.querySelectorAll('.sidebar-submenu');
    submenus.forEach(submenu => {
        if (submenu.innerHTML.includes('founder-games.html')) {
            submenu.classList.add('open');
            const btn = submenu.previousElementSibling;
            if (btn) btn.classList.add('active');
        }
    });
}

function toggleSubmenu(button) {
    button.classList.toggle("active");
    const submenu = button.nextElementSibling;
    if (submenu) {
        submenu.classList.toggle("open");
    }
}

function setupMobileSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const menuDropdownBtn = document.getElementById("menu-toggle-btn");

    if (menuDropdownBtn && sidebar) {
        const overlay = document.createElement("div");
        overlay.className = "sidebar-overlay";
        document.body.appendChild(overlay);

        menuDropdownBtn.addEventListener("click", () => {
            sidebar.classList.toggle("mobile-open");
            overlay.classList.toggle("active");
        });

        overlay.addEventListener("click", () => {
            sidebar.classList.remove("mobile-open");
            overlay.classList.remove("active");
        });
    }
}

function logout() {
    localStorage.removeItem("token");
    window.location.href = "../../index.html";
}

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✔' : '✖'}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}