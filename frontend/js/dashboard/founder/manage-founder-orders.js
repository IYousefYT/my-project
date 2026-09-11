const API_URL = "http://127.0.0.1:8000";
const token = localStorage.getItem("token");
let allLoadedOrders = [];
let allLoadedClients = [];
let allLoadedGames = [];
let allLoadedServices = [];
let editingOrderId = null;

if (!token) {
    window.location.href = "../../index.html";
}

document.addEventListener("DOMContentLoaded", () => {
    loadUserData();
    fetchAllOrders();
    setupMobileSidebar();
    setupDropdownSearchSystems();
    setupOrderSearch();
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

async function fetchAllOrders() {
    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.ok) {
            allLoadedOrders = await response.json();
            renderOrdersTable(allLoadedOrders);
        } else {
            document.getElementById("orders-table-body").innerHTML = `
                <tr><td colspan="5" style="text-align: center; color: #ff5555; padding: 20px;">فشل في جلب الطلبات أو ليس لديك الصلاحية الكافية.</td></tr>
            `;
        }
    } catch (err) {
        console.error(err);
        document.getElementById("orders-table-body").innerHTML = `
            <tr><td colspan="5" style="text-align: center; color: #ff5555; padding: 20px;">حدث خطأ أثناء الاتصال بالسيرفر.</td></tr>
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

function renderOrdersTable(orders) {
    const tbody = document.getElementById("orders-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!orders || orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">لا توجد طلبات مسجلة حالياً.</td></tr>`;
        return;
    }

    orders.forEach(order => {
        const orderId = order.id || 0;
        const clientId = order.client_id || "-";
        const serviceId = order.service_id || "-";
        const status = order.status || "pending";
        
        let statusColor = "#facc15"; 
        if (status === "approved") statusColor = "#38bdf8";
        if (status === "in_progress") statusColor = "#a855f7";
        if (status === "completed") statusColor = "#22c55e";
        if (status === "cancelled") statusColor = "#ef4444";

        tbody.innerHTML += `
            <tr class="order-row">
                <td>#${orderId}</td>
                <td>${clientId}</td>
                <td>خدمة #${serviceId}</td>
                <td><span style="color: ${statusColor}; font-weight: 700;">${status.toUpperCase()}</span></td>
                <td>
                    <button style="background-color: #3b82f6; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-family: 'Cairo', sans-serif; margin-left: 5px;" onclick="openEditOrderModal(${orderId})">تعديل</button>
                    <button style="background-color: #ef4444; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-family: 'Cairo', sans-serif;" onclick="deleteOrder(${orderId})">حذف</button>
                </td>
            </tr>
        `;
    });
}

async function loadDropdownData() {
    try {
        const usersRes = await fetch(`${API_URL}/admin/users`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (usersRes.ok) {
            allLoadedClients = await usersRes.json();
            // ترتيب المستخدمين تصاعدياً حسب الـ ID
            allLoadedClients.sort((a, b) => a.id - b.id);
        }

        const gamesRes = await fetch(`${API_URL}/admin/games`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (gamesRes.ok) {
            allLoadedGames = await gamesRes.json();
            // ترتيب الألعاب تصاعدياً حسب الـ ID
            allLoadedGames.sort((a, b) => a.id - b.id);
        }

        const servicesRes = await fetch(`${API_URL}/services`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (servicesRes.ok) {
            allLoadedServices = await servicesRes.json();
            allLoadedServices.sort((a, b) => a.id - b.id);
        }
    } catch (error) {
        console.error("خطأ في جلب بيانات القوائم المنسدلة:", error);
    }
}

function setupDropdownSearchSystems() {
    // 1. بحث العملاء (يدعم ID, Username, Nickname وترتيب بالـ ID)
    setupCustomDropdown({
        searchInputId: "client-search-input",
        hiddenInputId: "new-client-id",
        optionsListId: "client-options-list",
        getItems: (query) => {
            const q = query.toLowerCase();
            return allLoadedClients
                .filter(u => 
                    String(u.id).includes(q) || 
                    (u.username && u.username.toLowerCase().includes(q)) || 
                    (u.nickname && u.nickname.toLowerCase().includes(q))
                )
                .map(u => ({ 
                    id: u.id, 
                    text: `[ID: ${u.id}] ${u.nickname ? u.nickname + ' (' + u.username + ')' : u.username}` 
                }));
        }
    });

    // 2. بحث مقدمي الخدمات (Providers/Admins/Founders)
    setupCustomDropdown({
        searchInputId: "provider-search-input",
        hiddenInputId: "new-provider-id",
        optionsListId: "provider-options-list",
        getItems: (query) => {
            const q = query.toLowerCase();
            return allLoadedClients
                .filter(u => ['provider', 'admin', 'founder'].includes(u.role))
                .filter(u => 
                    String(u.id).includes(q) || 
                    (u.username && u.username.toLowerCase().includes(q)) || 
                    (u.nickname && u.nickname.toLowerCase().includes(q))
                )
                .map(u => ({ 
                    id: u.id, 
                    text: `[ID: ${u.id}] ${u.nickname ? u.nickname + ' (' + u.username + ')' : u.username} (${u.role})` 
                }));
        }
    });

    // 3. بحث الألعاب (بالاسم أو الـ ID وترتيب بالـ ID)
    setupCustomDropdown({
        searchInputId: "game-search-input",
        hiddenInputId: "new-game-id",
        optionsListId: "game-options-list",
        getItems: (query) => {
            const q = query.toLowerCase();
            return allLoadedGames
                .filter(g => 
                    String(g.id).includes(q) || 
                    (g.title && g.title.toLowerCase().includes(q))
                )
                .map(g => ({ 
                    id: g.id, 
                    text: `[ID: ${g.id}] ${g.title}` 
                }));
        },
        onSelect: (gameId) => {
            const serviceSearchInput = document.getElementById("service-search-input");
            const serviceHiddenInput = document.getElementById("new-service-id");
            
            serviceSearchInput.value = "";
            serviceHiddenInput.value = "";
            serviceSearchInput.disabled = false;
            serviceSearchInput.placeholder = "ابحث عن الخدمة المطلوبة...";
        }
    });

    // 4. بحث الخدمات (مرتبطة باللعبة المختارة)
    setupCustomDropdown({
        searchInputId: "service-search-input",
        hiddenInputId: "new-service-id",
        optionsListId: "service-options-list",
        getItems: (query) => {
            const selectedGameId = document.getElementById("new-game-id").value;
            if (!selectedGameId) return [];
            
            const q = query.toLowerCase();
            return allLoadedServices
                .filter(s => s.game_id == selectedGameId)
                .filter(s => 
                    String(s.id).includes(q) || 
                    (s.title && s.title.toLowerCase().includes(q))
                )
                .map(s => ({ 
                    id: s.id, 
                    text: `[ID: ${s.id}] ${s.title} - ${s.price} $` 
                }));
        }
    });
}

function setupCustomDropdown({ searchInputId, hiddenInputId, optionsListId, getItems, onSelect }) {
    const searchInput = document.getElementById(searchInputId);
    const hiddenInput = document.getElementById(hiddenInputId);
    const optionsList = document.getElementById(optionsListId);

    if (!searchInput || !optionsList) return;

    function renderOptions(filterText = "") {
        const items = getItems(filterText);
        
        optionsList.innerHTML = "";
        if (items.length === 0) {
            optionsList.innerHTML = `<div class="dropdown-option-item" style="color: var(--text-muted); cursor: default;">لا توجد نتائ$طابقة</div>`;
            return;
        }

        items.forEach(item => {
            const div = document.createElement("div");
            div.className = "dropdown-option-item";
            div.textContent = item.text;
            div.addEventListener("click", () => {
                searchInput.value = item.text;
                hiddenInput.value = item.id;
                optionsList.style.display = "none";
                if (onSelect) onSelect(item.id);
            });
            optionsList.appendChild(div);
        });
    }

    searchInput.addEventListener("focus", () => {
        if (searchInput.disabled) return;
        renderOptions(searchInput.value);
        optionsList.style.display = "block";
    });

    searchInput.addEventListener("input", () => {
        hiddenInput.value = ""; 
        renderOptions(searchInput.value);
        optionsList.style.display = "block";
    });

    document.addEventListener("click", (e) => {
        if (!searchInput.contains(e.target) && !optionsList.contains(e.target)) {
            optionsList.style.display = "none";
        }
    });
}

async function openAddOrderModal() {
    editingOrderId = null;
    await loadDropdownData();

    document.getElementById("client-search-input").value = "";
    document.getElementById("new-client-id").value = "";
    document.getElementById("provider-search-input").value = "";
    document.getElementById("new-provider-id").value = "";
    document.getElementById("game-search-input").value = "";
    document.getElementById("new-game-id").value = "";
    
    const serviceSearchInput = document.getElementById("service-search-input");
    serviceSearchInput.value = "";
    serviceSearchInput.disabled = true;
    serviceSearchInput.placeholder = "اختر اللعبة أولاً لعرض خدماتها...";
    document.getElementById("new-service-id").value = "";
    
    document.getElementById("new-order-status").value = "pending";

    const modal = document.getElementById("addOrderModal");
    if (modal) {
        modal.style.display = "flex";
    }
}

async function openEditOrderModal(orderId) {
    const order = allLoadedOrders.find(o => o.id === orderId);
    if (!order) return;

    editingOrderId = orderId;
    await loadDropdownData();

    const client = allLoadedClients.find(u => u.id === order.client_id);
    if (client) {
        document.getElementById("client-search-input").value = `[ID: ${client.id}] ${client.nickname || client.username}`;
        document.getElementById("new-client-id").value = client.id;
    }

    if (order.provider_id) {
        const provider = allLoadedClients.find(u => u.id === order.provider_id);
        if (provider) {
            document.getElementById("provider-search-input").value = `[ID: ${provider.id}] ${provider.nickname || provider.username}`;
            document.getElementById("new-provider-id").value = provider.id;
        }
    }

    const service = allLoadedServices.find(s => s.id === order.service_id);
    if (service) {
        const game = allLoadedGames.find(g => g.id === service.game_id);
        if (game) {
            document.getElementById("game-search-input").value = `[ID: ${game.id}] ${game.title}`;
            document.getElementById("new-game-id").value = game.id;
        }

        const serviceSearchInput = document.getElementById("service-search-input");
        serviceSearchInput.disabled = false;
        serviceSearchInput.value = `[ID: ${service.id}] ${service.title} - ${service.price} $`;
        document.getElementById("new-service-id").value = service.id;
    }

    document.getElementById("new-order-status").value = order.status || "pending";

    const modal = document.getElementById("addOrderModal");
    if (modal) {
        modal.style.display = "flex";
    }
}

function closeAddOrderModal() {
    const modal = document.getElementById("addOrderModal");
    if (modal) {
        modal.style.display = "none";
    }
}

async function submitNewOrder() {
    const serviceId = document.getElementById("new-service-id").value;
    const clientId = document.getElementById("new-client-id").value;
    const providerId = document.getElementById("new-provider-id").value;
    const status = document.getElementById("new-order-status").value;

    if (!serviceId) {
        showToast("يرجى اختيار الخدمة المطلوبة من القائمة", "error");
        return;
    }

    const payload = {
        service_id: parseInt(serviceId),
        status: status
    };

    if (clientId) payload.client_id = parseInt(clientId);
    if (providerId) payload.provider_id = parseInt(providerId);

    try {
        const url = editingOrderId ? `${API_URL}/admin/orders/${editingOrderId}` : `${API_URL}/orders`;
        const method = editingOrderId ? "PUT" : "POST";

        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast(editingOrderId ? "تم تعديل الطلب بنجاح" : "تم إنشاء الطلب بنجاح", "success");
            closeAddOrderModal();
            await fetchAllOrders();
        } else {
            const err = await response.json();
            showToast(err.detail || "فشل حفظ الطلب", "error");
        }
    } catch (error) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
}

async function deleteOrder(orderId) {
    if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;

    try {
        const response = await fetch(`${API_URL}/admin/orders/${orderId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            showToast("تم حذف الطلب بنجاح", "success");
            await fetchAllOrders();
        } else {
            showToast("فشل حذف الطلب", "error");
        }
    } catch (err) {
        showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
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
            <a href="founder-orders.html" style="${window.location.pathname.includes('founder-orders.html') ? activeStyle : linkStyle}">إدارة الطلبات</a>
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

function setupOrderSearch() {
    const searchInput = document.getElementById("search-order-input");
    const statusFilter = document.getElementById("status-filter");

    if (!searchInput && !statusFilter) return;

    window.filterOrders = function() {
        const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
        const selectedStatus = statusFilter ? statusFilter.value : "all";

        const filteredOrders = allLoadedOrders.filter(order => {
            const orderIdStr = String(order.id || "").toLowerCase();
            const clientIdStr = String(order.client_id || "").toLowerCase();
            const statusStr = String(order.status || "").toLowerCase();

            const matchesQuery = !query || orderIdStr.includes(query) || clientIdStr.includes(query);
            const matchesStatus = selectedStatus === "all" || statusStr === selectedStatus;

            return matchesQuery && matchesStatus;
        });

        renderOrdersTable(filteredOrders);
    };
}
