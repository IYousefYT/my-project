const API_URL = "http://127.0.0.1:8000";
const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "./index.html";
}

async function loadUserData() {
    try {
        const res = await fetch(`${API_URL}/users/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Unauthorized");
        const user = await res.json();
        
        document.getElementById("user-welcome").textContent = `مرحباً، ${user.nickname || user.username}`;
        document.getElementById("user-role-text").textContent = `نوع الحساب: ${user.role.toUpperCase()}`;
        
        // استدعاء دالة القائمة الجانبية بالصلاحيات المتدرجة
        renderSidebarMenu(user.role);
        
        loadOrders();
    } catch (err) {
        logout();
    }
}

async function loadOrders() {
    try {
        const res = await fetch(`${API_URL}/orders`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const orders = await res.json();
        const tbody = document.getElementById("orders-table-body");
        tbody.innerHTML = "";

        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">لا توجد طلبات متاحة حالياً.</td></tr>`;
            return;
        }

        orders.forEach(order => {
            let actionBtn = "";
            if (order.status === "pending") {
                actionBtn = `<button class="action-btn" onclick="approveOrder(${order.id})">موافقة (Admin)</button>`;
            } else if (order.status === "approved") {
                actionBtn = `<button class="action-btn" onclick="acceptOrder(${order.id})">قبول الأوردر (Provider)</button>`;
            } else {
                actionBtn = `<span style="color: var(--success-color);">قيد التنفيذ / مكتمل</span>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td>#${order.id}</td>
                    <td>${order.service_id}</td>
                    <td><span style="font-weight:700;">${order.status.toUpperCase()}</span></td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("خطأ في جلب الأوردرات", err);
    }
}

async function approveOrder(orderId) {
    const res = await fetch(`${API_URL}/orders/${orderId}/approve`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok) {
        loadOrders();
    } else {
        const err = await res.json();
        alert(err.detail);
    }
}

async function acceptOrder(orderId) {
    const res = await fetch(`${API_URL}/orders/${orderId}/accept`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok) {
        loadOrders();
    } else {
        const err = await res.json();
        alert(err.detail);
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

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function renderSidebarMenu(userRole) {
    const menuContainer = document.getElementById("sidebar-menu-items");
    if (!menuContainer) return;

    const linkStyle = "display: block; padding: 8px 12px; color: #cbd5e1; text-decoration: none; border-radius: 6px; font-size: 13px; transition: 0.2s;";
    const activeStyle = "display: block; padding: 8px 12px; color: #fff; background: var(--primary-color, #7c3aed); text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;";

    let menuHTML = `<li><a href="dashboard.html" style="${activeStyle}">الرئيسية / الملف الشخصي</a></li>`;

    // دالة مساعدة لتوليد الأقسام القابلة للطي
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

// قسم الحساب والعميل (متاح لكل المستخدمين المسجلين)
    if (["client", "provider", "admin", "founder"].includes(userRole)) {
        const items = `
            <a href="../../html/dashboard/profile.html" style="${linkStyle}">البروفايل</a>
            <a href="../../html/dashboard/tickets.html" style="${linkStyle}">التذاكر</a>
            <a href="../../html/dashboard/wallet.html" style="${linkStyle}">المحفظة</a>
            <a href="../../html/dashboard/transactions.html" style="${linkStyle}">سجل الرصيد والحجز</a>
            <a href="../../html/dashboard/notifications.html" style="${linkStyle}">الإشعارات</a>
            <a href="../../html/dashboard/chat.html" style="${linkStyle}">المحادثات</a>
        `;
        menuHTML += createDropdownCategory("حسابي والخدمات", items);
    }

    // قسم فريق العمل (متاح لمقدم الخدمات، الإدارة، والمؤسس)
    if (["provider", "admin", "founder"].includes(userRole)) {
        const items = `
            <a href="../../html/dashboard/team-orders.html" style="${linkStyle}">الطلبات المتاحة</a>
            <a href="../../html/dashboard/my-tasks.html" style="${linkStyle}">الطلبات قيد التنفيذ</a>
            <a href="../../html/dashboard/completed-tasks.html" style="${linkStyle}">الطلبات التي تم إنجازها</a>
        `;
        menuHTML += createDropdownCategory("فريق العمل", items);
    }

    // قسم الإدارة (متاح للإدارة والمؤسس)
    if (["admin", "founder"].includes(userRole)) {
        const items = `
            <a href="../../html/dashboard/admin-orders.html" style="${linkStyle}">إدارة وموافقة الطلبات</a>
            <a href="../../html/dashboard/applications.html" style="${linkStyle}">قبول/رفض التقديمات</a>
            <a href="../../html/dashboard/support-chat.html" style="${linkStyle}">الدعم الفني والردود</a>
        `;
        menuHTML += createDropdownCategory("الإدارة والدعم", items);
    }

    // قسم المالك (Founder)
    if (userRole === "founder") {
        const items = `
            <a href="../../html/dashboard/founder-accounts.html" style="${linkStyle}">إدارة جميع الحسابات</a>
            <a href="../../html/dashboard/founder-orders.html" style="${linkStyle}">إدارة الطلبات</a>
            <a href="../../html/dashboard/founder-games.html" style="${linkStyle}">إدارة وإضافة الألعاب</a>
            <a href="../../html/dashboard/founder-services.html" style="${linkStyle}">إدارة الخدمات</a>
        `;
        menuHTML += createDropdownCategory("إدارة النظام (Founder)", items);
    }

    menuContainer.innerHTML = menuHTML;
}

// دالة التحكم في فتح وإغلاق القائمة المنسدلة مع الأنيميشن
function toggleSubmenu(button) {
    button.classList.toggle("active");
    const submenu = button.nextElementSibling;
    submenu.classList.toggle("open");
}

// إضافات التحكم بالقائمة الجانبية للموبايل (Hamburger Menu)
document.addEventListener("DOMContentLoaded", () => {
    loadUserData();

    const sidebar = document.querySelector(".sidebar");
    const menuToggleBtn = document.getElementById("menu-toggle-btn");

    if (menuToggleBtn && sidebar) {
        // إنشاء طبقة خلفية مظلمة عند فتح القائمة للموبايل
        const overlay = document.createElement("div");
        overlay.className = "sidebar-overlay";
        document.body.appendChild(overlay);

        menuToggleBtn.addEventListener("click", () => {
            sidebar.classList.toggle("mobile-open");
            overlay.classList.toggle("active");
        });

        overlay.addEventListener("click", () => {
            sidebar.classList.remove("mobile-open");
            overlay.classList.remove("active");
        });

        // إغلاق القائمة تلقائياً عند الضغط على أي لينك جوها في الموبايل
        sidebar.addEventListener("click", (e) => {
            if (e.target.tagName === "A" && window.innerWidth <= 768) {
                sidebar.classList.remove("mobile-open");
                overlay.classList.remove("active");
            }
        });
    }
});

