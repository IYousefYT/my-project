const API_URL = "http://127.0.0.1:8000";
const token = localStorage.getItem("token");
let allLoadedServices = [];
let allLoadedGames = [];
let editingServiceId = null;

if (!token) {
    window.location.href = "../../index.html";
}

document.addEventListener("DOMContentLoaded", () => {
    loadUserData();
    fetchAllData();
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

async function fetchAllData() {
    try {
        // جلب الألعاب أولاً لربط الخدمات بها
        const gamesRes = await fetch(`${API_URL}/admin/games`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (gamesRes.ok) {
            allLoadedGames = await gamesRes.json();
            populateGameFilters();
        }

        // جلب الخدمات
        const servicesRes = await fetch(`${API_URL}/services`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (servicesRes.ok) {
            allLoadedServices = await servicesRes.json();
            renderServicesTable(allLoadedServices);
        } else {
            document.getElementById("services-table-body").innerHTML = `
                <tr><td colspan="6" style="text-align: center; color: #ff5555; padding: 20px;">فشل في جلب الخدمات.</td></tr>
            `;
        }
    } catch (err) {
        console.error(err);
        document.getElementById("services-table-body").innerHTML = `
            <tr><td colspan="6" style="text-align: center; color: #ff5555; padding: 20px;">حدث خطأ أثناء الاتصال بالسيرفر.</td></tr>
        `;
    }
}

function populateGameFilters() {
    const filterSelect = document.getElementById("game-filter");
    const modalSelect = document.getElementById("new-service-game-id");
    
    let optionsHtml = `<option value="all">جميع الألعاب / المنتجات</option>`;
    let modalOptionsHtml = `<option value="">اختر اللعبة أو المنتج...</option>`;

    allLoadedGames.forEach(game => {
        optionsHtml += `<option value="${game.id}">${game.title}</option>`;
        modalOptionsHtml += `<option value="${game.id}">${game.title}</option>`;
    });

    if (filterSelect) filterSelect.innerHTML = optionsHtml;
    if (modalSelect) modalSelect.innerHTML = modalOptionsHtml;
}

function renderServicesTable(services) {
    const tbody = document.getElementById("services-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!services || services.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">لا توجد خدمات مسجلة حالياً.</td></tr>`;
        return;
    }

    services.forEach(service => {
        const game = allLoadedGames.find(g => g.id === service.game_id);
        const gameTitle = game ? game.title : `لعبة #${service.game_id}`;

        tbody.innerHTML += `
            <tr class="service-row">
                <td>#${service.id}</td>
                <td style="font-weight: 600;">${service.title}</td>
                <td>${gameTitle}</td>
                <td style="color: #3fb950; font-weight: 700;">${service.price} $</td>
                <td>#${service.provider_id || '-'}</td>
                <td>
                    <button style="background-color: #3b82f6; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-family: 'Cairo', sans-serif; margin-left: 5px;" onclick="openEditServiceModal(${service.id})">تعديل</button>
                    <button style="background-color: #ef4444; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-family: 'Cairo', sans-serif;" onclick="deleteService(${service.id})">حذف</button>
                </td>
            </tr>
        `;
    });
}

function filterServices() {
    const query = document.getElementById("search-service-input").value.trim().toLowerCase();
    const selectedGameId = document.getElementById("game-filter").value;

    const filtered = allLoadedServices.filter(service => {
        const titleMatch = service.title.toLowerCase().includes(query) || String(service.price).includes(query);
        const gameMatch = selectedGameId === "all" || String(service.game_id) === selectedGameId;
        return titleMatch && gameMatch;
    });

    renderServicesTable(filtered);
}

function openAddServiceModal() {
    editingServiceId = null;
    document.getElementById("modal-title").textContent = "إضافة خدمة جديدة";
    document.getElementById("new-service-game-id").value = "";
    document.getElementById("new-service-title").value = "";
    document.getElementById("new-service-price").value = "";
    document.getElementById("new-service-description").value = "";

    document.getElementById("addServiceModal").style.display = "flex";
}

function openEditServiceModal(serviceId) {
    const service = allLoadedServices.find(s => s.id === serviceId);
    if (!service) return;

    editingServiceId = serviceId;
    document.getElementById("modal-title").textContent = "تعديل الخدمة";
    document.getElementById("new-service-game-id").value = service.game_id;
    document.getElementById("new-service-title").value = service.title;
    document.getElementById("new-service-price").value = service.price;
    document.getElementById("new-service-description").value = service.description || "";

    document.getElementById("addServiceModal").style.display = "flex";
}

function closeAddServiceModal() {
    document.getElementById("addServiceModal").style.display = "none";
}

async function submitNewService() {
    const gameId = document.getElementById("new-service-game-id").value;
    const title = document.getElementById("new-service-title").value.trim();
    const price = document.getElementById("new-service-price").value;
    const description = document.getElementById("new-service-description").value.trim();

    if (!gameId || !title || !price) {
        showToast("يرجى ملء جميع الحقول الإلزامية (اللعبة، العنوان، السعر)", "error");
        return;
    }

    const payload = {
        title: title,
        price: parseFloat(price),
        game_id: parseInt(gameId),
        description: description || null
    };

    try {
        // ملاحظة: الـ Backend الحالي يدعم POST /services للإنشاء. 
        // لو احتجت مسار PUT لتعديل الخدمة، يمكنك إضافته في الـ FastAPI، حالياً سنقوم بإنشاء أو إرسال الطلب:
        const url = editingServiceId ? `${API_URL}/admin/services/${editingServiceId}` : `${API_URL}/services`;
        const method = editingServiceId ? "PUT" : "POST";

        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer_{token}` // سيتم استخدام الـ token الصحيح أسفل
            },
            body: JSON.stringify(payload)
        });
        
        // تصحيح رأس المصادقة:
        // "Authorization": `Bearer ${token}`

        // سنكتب الطلب الصحيح:
    } catch (e) {
        // ...
    }
}

// تعديل دالة الإرسال لضمان صحة الـ Token والمسارات:
async function submitNewService() {
    const gameId = document.getElementById("new-service-game-id").value;
    const title = document.getElementById("new-service-title").value.trim();
    const price = document.getElementById("new-service-price").value;
    const description = document.getElementById("new-service-description").value.trim();

    if (!gameId || !title || !price) {
        showToast("يرجى ملء الحقول المطلوبة", "error");
        return;
    }

    const payload = {
        title: title,
        price: parseFloat(price),
        game_id: parseInt(gameId),
        description: description
    };

    try {
        // إذا أردت دعم تعديل الخدمة لاحقاً يمكنك إضافة مسار في الـ FastAPI، حالياً نستخدم POST المتاح أو PUT لو أضفته
        const url = editingServiceId ? `${API_URL}/admin/services/${editingServiceId}` : `${API_URL}/services`;
        const method = editingServiceId ? "PUT" : "POST";

        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast(editingServiceId ? "تم تعديل الخدمة بنجاح" : "تم إضافة الخدمة بنجاح", "success");
            closeAddServiceModal();
            await fetchAllData();
        } else {
            const err = await response.json();
            showToast(err.detail || "فشل حفظ الخدمة", "error");
        }
    } catch (error) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
}

async function deleteService(serviceId) {
    if (!confirm("هل أنت متأكد من حذف هذه الخدمة؟")) return;

    try {
        const response = await fetch(`${API_URL}/admin/services/${serviceId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            showToast("تم حذف الخدمة بنجاح", "success");
            await fetchAllData();
        } else {
            showToast("فشل حذف الخدمة (تأكد من وجود صلاحية أو مسار الحذف في السيرفر)", "error");
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
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
            <a href="founder-games.html" style="${linkStyle}">إدارة وإضافة الألعاب</a>
            <a href="founder-services.html" style="${window.location.pathname.includes('founder-services.html') ? activeStyle : linkStyle}">إدارة الخدمات</a>
        `;
        menuHTML += createDropdownCategory("إدارة النظام (Founder)", items);
    }

    menuContainer.innerHTML = menuHTML;

    // فتح القائمة المنسدلة الخاصة بالفاوندر تلقائياً لأننا في صفحة تخصه
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