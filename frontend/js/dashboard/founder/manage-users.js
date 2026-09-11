const API_URL = "http://127.0.0.1:8000";
const token = localStorage.getItem("token");
let allLoadedUsers = [];

if (!token) {
    window.location.href = "../../index.html";
}

document.addEventListener("DOMContentLoaded", () => {
    loadUserData();
    fetchAllUsers();
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

async function fetchAllUsers() {
    try {
        const response = await fetch(`${API_URL}/admin/users`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.ok) {
            allLoadedUsers = await response.json(); // حفظ البيانات هنا
            renderUsersTable(allLoadedUsers);
        } else {
            document.getElementById("users-table-body").innerHTML = `
                <tr><td colspan="6" style="text-align: center; color: #ff5555; padding: 20px;">فشل في جلب الحسابات أو ليس لديك الصلاحية الكافية.</td></tr>
            `;
        }
    } catch (err) {
        console.error(err);
        document.getElementById("users-table-body").innerHTML = `
            <tr><td colspan="6" style="text-align: center; color: #ff5555; padding: 20px;">حدث خطأ أثناء الاتصال بالسيرفر.</td></tr>
        `;
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

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function renderUsersTable(users) {
    const tbody = document.getElementById("users-table-body");
    tbody.innerHTML = "";

    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">لا توجد حسابات مسجلة حالياً.</td></tr>`;
        return;
    }

    users.forEach(user => {
        const userId = user.id || 0;
        const userBalance = user.balance !== undefined ? user.balance : 0.0;
        const isFounder = user.role === 'founder';
        
        tbody.innerHTML += `
            <tr class="user-row" onclick="toggleUserDetails(${userId})" title="اضغط لعرض التفاصيل والتحكم" style="cursor: pointer;">
                <td>#${userId}</td>
                <td style="display: flex; align-items: center; gap: 8px;">
                    <span id="arrow-${userId}" style="display:inline-block; transition:0.2s; font-size:10px; color:#8b949e;">▶</span>
                    <span>${user.username} ${isFounder ? '<span style="color:#f1e05a; font-size:11px; margin-right:5px;">(مالك النظام)</span>' : ''}</span>
                </td>
                <td>${user.nickname || '-'}</td>
                <td>${user.email}</td>
                <td><span style="font-weight:700; color: ${isFounder ? '#f1e05a' : 'var(--success-color)'};">${user.role.toUpperCase()}</span></td>
                <td>
                    ${isFounder ? '<span style="color: #8b949e; font-size: 12px;">محمي</span>' : `<button class="action-btn" style="background-color: #ef4444;" onclick="event.stopPropagation(); deleteUser(${userId})">حذف</button>`}
                </td>
            </tr>
            <tr id="details-row-${userId}" class="user-details-row" style="display: none;">
                <td colspan="6">
                    <div style="padding: 15px; background: #161b22; border-top: 1px dashed #30363d; border-radius: 6px; margin: 5px 0;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px;">
                            
                            <!-- تعديل الصلاحية -->
                            <div style="background: #0d1117; padding: 12px; border-radius: 6px; border: 1px solid #30363d;">
                                <h4 style="color: #8b949e; margin-bottom: 8px; font-size: 13px;">تعديل نوع الحساب (Role)</h4>
                                <div style="display: flex; gap: 10px;">
                                    <select id="role-select-${userId}" onclick="event.stopPropagation()" ${isFounder ? 'disabled' : ''} style="background: #161b22; border: 1px solid #30363d; color: #fff; padding: 6px; border-radius: 4px; flex-grow: 1;">
                                        <option value="client" ${user.role === 'client' ? 'selected' : ''}>Client</option>
                                        <option value="provider" ${user.role === 'provider' ? 'selected' : ''}>Provider</option>
                                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                    ${isFounder ? '' : `<button onclick="event.stopPropagation(); updateUserRole(${userId})" style="background: #238636; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">حفظ</button>`}
                                </div>
                                ${isFounder ? '<small style="color: #f1e05a; display:block; margin-top:5px;">لا يمكن تغيير صلاحية حساب المالك.</small>' : ''}
                            </div>

                            <!-- تعديل اسم العرض (Nickname) -->
                            <div style="background: #0d1117; padding: 12px; border-radius: 6px; border: 1px solid #30363d;">
                                <h4 style="color: #8b949e; margin-bottom: 8px; font-size: 13px;">تعديل اسم العرض (Nickname)</h4>
                                <div style="display: flex; gap: 10px;">
                                    <input type="text" id="nickname-input-${userId}" value="${user.nickname || ''}" placeholder="اسم العرض الجديد" onclick="event.stopPropagation()" style="background: #161b22; border: 1px solid #30363d; color: #fff; padding: 6px; border-radius: 4px; flex-grow: 1;">
                                    <button onclick="event.stopPropagation(); updateUserNickname(${userId})" style="background: #1f6feb; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">حفظ</button>
                                </div>
                            </div>

                            <!-- إدارة الرصيد -->
                            <div style="background: #0d1117; padding: 12px; border-radius: 6px; border: 1px solid #30363d; grid-column: span 2;">
                                <h4 style="color: #8b949e; margin-bottom: 8px; font-size: 13px;">الرصيد الحالي: <span style="color: #3fb950; font-weight: 700;">${userBalance}</span> $</h4>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <input type="number" id="balance-amount-${userId}" placeholder="المبلغ" onclick="event.stopPropagation()" style="background: #161b22; border: 1px solid #30363d; color: #fff; padding: 6px; border-radius: 4px; width: 130px;" min="0" max="${userBalance}">
                                    <select id="balance-op-${userId}" onclick="event.stopPropagation()" style="background: #161b22; border: 1px solid #30363d; color: #fff; padding: 6px; border-radius: 4px;">
                                        <option value="add">إضافة</option>
                                        <option value="subtract">خصم</option>
                                    </select>
                                    <button type="button" onclick="event.stopPropagation(); setMaxBalance(${userId}, ${userBalance})" style="background: #d97706; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">MAX</button>
                                    <button onclick="event.stopPropagation(); updateUserBalance(${userId}, ${userBalance})" style="background: #1f6feb; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">تحديث</button>
                                </div>
                            </div>

                        </div>

                        <!-- الطلبات -->
                        <div>
                            <h4 style="color: #8b949e; margin-bottom: 8px; font-size: 13px;">الطلبات المسجلة بحساب المستخدم</h4>
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 1px solid #30363d; color: #8b949e;">
                                        <th style="padding: 6px; text-align: right;">رقم الطلب</th>
                                        <th style="padding: 6px; text-align: right;">رقم الخدمة</th>
                                        <th style="padding: 6px; text-align: right;">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody id="user-orders-${userId}">
                                    <tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 10px;">اضغط لعرض الطلبات...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
}

function toggleUserDetails(userId) {
    const detailsRow = document.getElementById(`details-row-${userId}`);
    const arrow = document.getElementById(`arrow-${userId}`);
    const isOpen = detailsRow.style.display === "table-row";
    
    document.querySelectorAll('.user-details-row').forEach(row => row.style.display = "none");
    document.querySelectorAll('[id^="arrow-"]').forEach(el => el.style.transform = "rotate(0deg)");

    if (!isOpen) {
        detailsRow.style.display = "table-row";
        arrow.style.transform = "rotate(90deg)";
        loadUserOrders(userId);
    }
}

async function loadUserOrders(userId) {
    const ordersTbody = document.getElementById(`user-orders-${userId}`);
    ordersTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 10px;">جاري التحميل...</td></tr>`;

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/orders`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const orders = await res.json();
            ordersTbody.innerHTML = "";
            if (orders.length === 0) {
                ordersTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 10px;">لا توجد طلبات مسجلة لهذا المستخدم.</td></tr>`;
                return;
            }
            orders.forEach(ord => {
                ordersTbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #21262d;">
                        <td style="padding: 6px;">#${ord.id}</td>
                        <td style="padding: 6px;">${ord.service_id}</td>
                        <td style="padding: 6px;"><b style="color: #58a6ff;">${ord.status.toUpperCase()}</b></td>
                    </tr>
                `;
            });
        } else {
            ordersTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #ff5555; padding: 10px;">فشل جلب الطلبات</td></tr>`;
        }
    } catch (e) {
        ordersTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #ff5555; padding: 10px;">خطأ في الاتصال بالسيرفر</td></tr>`;
    }
}

function setMaxBalance(userId, currentBalance) {
    const opSelect = document.getElementById(`balance-op-${userId}`);
    const input = document.getElementById(`balance-amount-${userId}`);
    
    if (!opSelect || !input) return;

    input.value = currentBalance; 
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
            <a href="founder-accounts.html" style="${window.location.pathname.includes('founder-accounts.html') ? activeStyle : linkStyle}">إدارة جميع الحسابات</a>
            <a href="founder-orders.html" style="${linkStyle}">إدارة الطلبات</a>
            <a href="founder-games.html" style="${linkStyle}">إدارة وإضافة الألعاب</a>
            <a href="founder-services.html" style="${linkStyle}">إدارة الخدمات</a>
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
    const menuToggleBtn = document.getElementById("menu-toggle-btn");

    if (menuToggleBtn && sidebar) {
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

        sidebar.addEventListener("click", (e) => {
            if (e.target.tagName === "A" && window.innerWidth <= 768) {
                sidebar.classList.remove("mobile-open");
                overlay.classList.remove("active");
            }
        });
    }
}

function logout() {
    localStorage.removeItem("token");
    window.location.href = "../../index.html";
}

function openAddUserModal() {
    const modal = document.getElementById("addUserModal");
    if (modal) {
        modal.style.display = "flex";
        setTimeout(() => modal.classList.add("active"), 10);
    }
}

function closeAddUserModal() {
    const modal = document.getElementById("addUserModal");
    if (modal) {
        modal.classList.remove("active");
        setTimeout(() => {
            modal.style.display = "none";
        }, 300);
    }
}

async function updateUserRole(userId) {
    const newRole = document.getElementById(`role-select-${userId}`).value;
    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ role: newRole })
        });
        if (res.ok) {
            showToast("تم تحديث صلاحية المستخدم بنجاح", "success");
            await fetchAllUsers();
            toggleUserDetails(userId);
        } else {
            const err = await res.json();
            showToast(err.detail || "حدث خطأ ما", "error");
        }
    } catch (e) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
}

async function updateUserNickname(userId) {
    const inputElement = document.getElementById(`nickname-input-${userId}`);
    let newNickname = inputElement ? inputElement.value.trim() : "";
    if (newNickname === "") newNickname = null;

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/nickname`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ nickname: newNickname })
        });
        
        if (res.ok) {
            showToast("تم تحديث اسم العرض بنجاح", "success");
            await fetchAllUsers();
            toggleUserDetails(userId);
        } else {
            const err = await res.json();
            showToast(err.detail || "فشل تحديث اسم العرض", "error");
        }
    } catch (e) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
}

async function updateUserBalance(userId, currentBalance) {
    const amount = parseFloat(document.getElementById(`balance-amount-${userId}`).value);
    const operation = document.getElementById(`balance-op-${userId}`).value;

    if (isNaN(amount) || amount <= 0) {
        showToast("يرجى إدخال مبلغ صحيح", "error");
        return;
    }

    if (operation === 'subtract' && amount > currentBalance) {
        showToast("لا يمكن خصم مبلغ أكبر من الرصيد الحالي للمستخدم", "error");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/balance`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ amount: amount, operation: operation })
        });
        if (res.ok) {
            showToast("تم تحديث الرصيد بنجاح", "success");
            await fetchAllUsers();
            toggleUserDetails(userId);
        } else {
            const err = await res.json();
            showToast(err.detail || "فشل تحديث الرصيد", "error");
        }
    } catch (e) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
}

async function deleteUser(userId) {
    if (!confirm("هل أنت متأكد من حذف هذا المستخدم؟")) return;

    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            showToast("تم حذف المستخدم بنجاح", "success");
            await fetchAllUsers();
        } else {
            const err = await response.json();
            showToast(err.detail || "فشل حذف المستخدم", "error");
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
}

async function submitNewUser() {
    const username = document.getElementById("new-username").value.trim();
    const email = document.getElementById("new-email").value.trim();
    const password = document.getElementById("new-password").value.trim();
    const role = document.getElementById("new-role").value;

    if (!username || !email || !password) {
        showToast("يرجى ملء جميع الحقول المطلوبة", "error");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/admin/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ username, email, password, role })
        });

        if (res.ok) {
            showToast("تم إنشاء الحساب بنجاح", "success");
            closeAddUserModal();
            await fetchAllUsers();
        } else {
            const err = await res.json();
            showToast(err.detail || "فشل إنشاء الحساب", "error");
        }
    } catch (e) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
}

function filterUsers() {
    const searchKeyword = document.getElementById("search-input").value.toLowerCase().trim();
    const selectedRole = document.getElementById("role-filter").value;

    const filtered = allLoadedUsers.filter(user => {
        const username = (user.username || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        const nickname = (user.nickname || "").toLowerCase();
        const role = (user.role || "").toLowerCase();

        // مطابقة البحث (الاسم، البريد، أو اسم العرض)
        const matchesSearch = username.includes(searchKeyword) || 
                              email.includes(searchKeyword) || 
                              nickname.includes(searchKeyword);

        // مطابقة الفلتر حسب الصلاحية
        const matchesRole = (selectedRole === "all") || (role === selectedRole);

        return matchesSearch && matchesRole;
    });

    renderUsersTable(filtered);
}